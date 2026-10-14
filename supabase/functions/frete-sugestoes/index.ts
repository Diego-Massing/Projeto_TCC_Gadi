import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { CORS_HEADERS, getPositionsForDay, listVehiclePositions, mapWithConcurrency, normalizePlaca, sascarLogin, withRetry } from "../_shared/sascar.ts";
import type { GpsPoint } from "../_shared/sascar.ts";
import { marcarLancados, montarViagens, placaMercosul } from "../_shared/trips.ts";
import type { FreteHist, Lugar } from "../_shared/trips.ts";

// Fretes sugeridos: lê o GPS da Sascar de um caminhão no período, monta as viagens
// (_shared/trips.ts) e marca as que já têm frete lançado. Não grava nada — aprovar
// vira um frete normal pelo app, descartar vai pra frete_sugestoes_descartadas.
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });

function dias(de: string, ate: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(de + "T12:00:00Z"); t <= Date.parse(ate + "T12:00:00Z"); t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}
const somaDias = (d: string, n: number) => new Date(Date.parse(d + "T12:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  try {
    const { truckId, dateFrom, dateTo } = await req.json();
    if (!truckId || !dateFrom || !dateTo) return json({ error: "truckId, dateFrom e dateTo são obrigatórios" }, 400);
    if (Date.parse(dateTo) - Date.parse(dateFrom) > 45 * 86_400_000) return json({ error: "Período máximo: 45 dias" }, 400);

    // Credenciais da Sascar só no Vault, lidas com service role.
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: secrets, error: sErr } = await admin.rpc("get_sascar_secrets");
    if (sErr) throw sErr;
    const sm = Object.fromEntries((secrets ?? []).map((s: any) => [s.name, s.decrypted_secret]));

    // Do app: lê tudo com o JWT de quem chamou (RLS: admin/visualizador).
    // Do cron (x-cron-secret): lê com service role.
    const viaCron = !!req.headers.get("x-cron-secret") && req.headers.get("x-cron-secret") === sm["sascar_cron_secret"];
    const user = viaCron ? admin : createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    if (!viaCron) {
      const { data: role } = await user.rpc("current_app_role");
      if (role !== "admin" && role !== "visualizador") return json({ error: "Sem permissão" }, 403);
    }

    const { data: truck, error: tErr } = await user.from("trucks").select("id, placa").eq("id", truckId).single();
    if (tErr || !truck) return json({ error: "Caminhão não encontrado" }, 404);

    const [lug, desc] = await Promise.all([
      user.from("lugares_frete").select("nome, lat, lon, pais"),
      user.from("frete_sugestoes_descartadas").select("saida").eq("truckId", truckId),
    ]);
    for (const r of [lug, desc]) if (r.error) throw r.error;
    const lugares = (lug.data ?? []) as Lugar[];
    // histórico de fretes (PostgREST devolve no máximo 1000 por vez)
    const todos: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await user.from("freights")
        .select('id, "truckId", data, origem, destino, km, tipo, "valorFrete", modalidade, cliente')
        .order("id").range(from, from + 999);
      if (error) throw error;
      todos.push(...data);
      if (data.length < 1000) break;
    }
    const fretes = todos.filter((f) => f.data && f.origem && f.destino) as FreteHist[];

    const session = await sascarLogin(sm["sascar_user"], sm["sascar_pass"]);
    const alvo = placaMercosul(normalizePlaca(truck.placa));
    const veic = (await listVehiclePositions(session)).find((v) => placaMercosul(normalizePlaca(v.placa)) === alvo);
    if (!veic) return json({ error: `A placa ${truck.placa} não está na Sascar — por enquanto só funciona com caminhões da Sascar.` }, 422);

    // Pega 3 dias de folga de cada lado pra pegar viagem que começa antes/termina depois.
    const hoje = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);
    const ate = somaDias(dateTo, 3) < hoje ? somaDias(dateTo, 3) : hoje;
    const lista = dias(somaDias(dateFrom, -3), ate);
    const falhas: string[] = [];
    const porDia = await mapWithConcurrency(lista, 3, async (d) => {
      try { return await withRetry(() => getPositionsForDay(session, veic.identifierVehicle, d)); }
      catch (_e) { falhas.push(d); return [] as GpsPoint[]; }
    });
    const pts = porDia.flat().sort((a, b) => a.ts - b.ts);

    const viagens = montarViagens(pts, lugares, fretes, truck.id);
    const doCaminhao = fretes.filter((f) => f.truckId === truck.id && f.data >= somaDias(dateFrom, -7) && f.data <= somaDias(dateTo, 7));
    marcarLancados(viagens, doCaminhao, lugares);
    // lançados no período que não bateram com viagem nenhuma (ex.: o GPS dividiu em duas)
    // — a tela mostra pra não lançar de novo
    const ligados = new Set(viagens.map((v) => v.freteId));
    const semViagem = doCaminhao.filter((f) => f.data >= dateFrom && f.data <= dateTo && !ligados.has(f.id))
      .map(({ id, data, origem, destino, km, tipo }) => ({ id, data, origem, destino, km, tipo }));

    const descartes = (desc.data ?? []).map((d: any) => Date.parse(d.saida));
    const diaSP = (iso: string) => new Date(Date.parse(iso) - 3 * 3_600_000).toISOString().slice(0, 10);
    const resultado = viagens
      .filter((v) => diaSP(v.saida) >= dateFrom && diaSP(v.saida) <= dateTo)
      .map((v) => ({ ...v, descartada: descartes.some((t) => Math.abs(t - Date.parse(v.saida)) < 2 * 3_600_000) }));

    return json({ placa: truck.placa, posicoes: pts.length, diasSemDados: falhas.sort(), viagens: resultado, fretesSemViagem: semViagem });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
