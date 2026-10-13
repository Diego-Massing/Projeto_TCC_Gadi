import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { CORS_HEADERS, getKmForRange, listVehiclePositions, mapWithConcurrency, normalizePlaca, sascarLogin, spDayEndMs, spDayStartMs, withRetry } from "../_shared/sascar.ts";
import { getrakKmForRange, getrakLogin, listGetrakVehicles, placaMercosul } from "../_shared/getrak.ts";

// KM rodado por caminhão num período, juntando os rastreadores da frota:
// Getrak (quem estiver lá tem prioridade — caminhões que saíram da Sascar às vezes
// continuam listados nela com dado velho), Sascar/Michelin, e por último o KM por dia
// do New Rastreamento que o PC do admin grava em km_diario.
// Cada rastreador falha sozinho: se um login cair, os caminhões dele saem com erro
// e os do outro continuam.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const { dateFrom, dateTo } = await req.json();
    if (!dateFrom || !dateTo) {
      return new Response(JSON.stringify({ error: "dateFrom e dateTo são obrigatórios (YYYY-MM-DD)" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Reads trucks with the caller's own JWT (forwarded automatically by supabase.functions.invoke),
    // so this respects whatever RLS is configured — no need for a service-role client here.
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );
    const { data: trucks, error: trucksErr } = await userClient.from("trucks").select("id, placa").order("placa");
    if (trucksErr) throw trucksErr;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const secretMap: Record<string, string> = {};
    for (const rpc of ["get_sascar_secrets", "get_tracker_secrets"]) {
      const { data, error } = await admin.rpc(rpc);
      if (error) throw error;
      for (const s of data ?? []) secretMap[s.name] = s.decrypted_secret;
    }

    // Getrak
    let getrak: Awaited<ReturnType<typeof getrakLogin>> | null = null;
    let getrakErro: string | null = null;
    const getrakByPlaca = new Map<string, number>();
    try {
      getrak = await getrakLogin(secretMap["getrak_client_basic"], secretMap["getrak_user"], secretMap["getrak_pass"]);
      for (const v of await listGetrakVehicles(getrak)) getrakByPlaca.set(placaMercosul(v.plate), v.id);
    } catch (e) {
      getrakErro = e instanceof Error ? e.message : String(e);
    }

    // Sascar
    let sascar: Awaited<ReturnType<typeof sascarLogin>> | null = null;
    let sascarErro: string | null = null;
    const sascarByPlaca = new Map<string, any>();
    try {
      sascar = await sascarLogin(secretMap["sascar_user"], secretMap["sascar_pass"]);
      for (const v of await listVehiclePositions(sascar)) sascarByPlaca.set(placaMercosul(normalizePlaca(v.placa)), v);
    } catch (e) {
      sascarErro = e instanceof Error ? e.message : String(e);
    }

    // KM por dia gravado pelo programa do PC (tools/km-newrastr) para o New Rastreamento,
    // que não tem API. Soma os dias do período; avisa se faltar dia.
    const hojeSP = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
    const ateEsperado = dateTo < hojeSP ? dateTo : hojeSP;
    const diasEsperados = Math.round((Date.parse(ateEsperado) - Date.parse(dateFrom)) / 86_400_000) + 1;
    const diario = new Map<string, { km: number; dias: number; ultimo: string; atualizado: string }>();
    {
      const { data, error } = await admin.from("km_diario").select("placa, data, km, atualizado_em")
        .gte("data", dateFrom).lte("data", dateTo);
      if (error) throw error;
      for (const d of data ?? []) {
        const p = placaMercosul(d.placa);
        const acc = diario.get(p) ?? { km: 0, dias: 0, ultimo: "", atualizado: "" };
        acc.km += Number(d.km) || 0;
        acc.dias += 1;
        if (d.data > acc.ultimo) acc.ultimo = d.data;
        if (d.atualizado_em > acc.atualizado) acc.atualizado = d.atualizado_em;
        diario.set(p, acc);
      }
    }
    const fmtBR = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);

    const dateFromMs = spDayStartMs(dateFrom);
    const dateToMs = spDayEndMs(dateTo);
    const vazio = (truck: any, fonte: string | null, erro: string) =>
      ({ truckId: truck.id, placa: truck.placa, fonte, kmInicio: null, kmFim: null, kmRodado: null, erro });

    // Um round-trip por caminhão. Disparar tudo de uma vez estoura o timeout da function
    // (sequencial) ou faz a Sascar responder corpo vazio sob carga (paralelo irrestrito) —
    // por isso: no máx. 4 chamadas simultâneas, com retry em cada uma.
    const resultados = await mapWithConcurrency(trucks ?? [], 4, async (truck) => {
      const placa = placaMercosul(truck.placa);
      try {
        const gId = getrakByPlaca.get(placa);
        if (gId && getrak) {
          const range = await withRetry(() => getrakKmForRange(getrak!, gId, dateFrom, dateTo));
          if (!range) return vazio(truck, "Getrak", "Sem deslocamentos no período");
          return { truckId: truck.id, placa: truck.placa, fonte: "Getrak", ...range };
        }
        const sMatch = sascarByPlaca.get(placa);
        if (sMatch && sascar) {
          const range = await withRetry(() => getKmForRange(sascar!, sMatch.identifierVehicle, dateFromMs, dateToMs));
          if (!range) return vazio(truck, "Sascar", "Sem posições no período");
          return {
            truckId: truck.id,
            placa: truck.placa,
            fonte: "Sascar",
            kmInicio: range.kmInicio,
            kmFim: range.kmFim,
            kmRodado: Math.round((range.kmFim - range.kmInicio) * 10) / 10,
          };
        }
        const d = diario.get(placa);
        if (d) {
          const atualizado = new Date(d.atualizado).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
          return {
            truckId: truck.id, placa: truck.placa, fonte: "New Rastreamento",
            kmInicio: null, kmFim: null, kmRodado: Math.round(d.km * 10) / 10,
            nota: d.dias < diasEsperados ? `dados só até ${fmtBR(d.ultimo)} (${d.dias} de ${diasEsperados} dias)` : `atualizado em ${atualizado}`,
          };
        }
        const erros = [getrakErro && `Getrak: ${getrakErro}`, sascarErro && `Sascar: ${sascarErro}`].filter(Boolean);
        return vazio(truck, null, erros.length ? erros.join(" · ") : "Placa não encontrada nos rastreadores");
      } catch (e) {
        return vazio(truck, getrakByPlaca.has(placa) ? "Getrak" : "Sascar", e instanceof Error ? e.message : String(e));
      }
    });

    const total = resultados.reduce((s, r) => s + (r.kmRodado || 0), 0);
    return new Response(JSON.stringify({ dateFrom, dateTo, resultados, total, erros: { getrak: getrakErro, sascar: sascarErro } }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
