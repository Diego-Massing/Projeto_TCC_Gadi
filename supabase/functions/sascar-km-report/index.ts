import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { CORS_HEADERS, getKmForRange, listVehiclePositions, mapWithConcurrency, normalizePlaca, sascarLogin, spDayEndMs, spDayStartMs, withRetry } from "../_shared/sascar.ts";

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

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: secrets, error: secretsErr } = await admin.rpc("get_sascar_secrets");
    if (secretsErr) throw secretsErr;
    const secretMap = Object.fromEntries((secrets ?? []).map((s: any) => [s.name, s.decrypted_secret]));

    const { data: trucks, error: trucksErr } = await userClient.from("trucks").select("id, placa").order("placa");
    if (trucksErr) throw trucksErr;

    const session = await sascarLogin(secretMap["sascar_user"], secretMap["sascar_pass"]);
    const vehicles = await listVehiclePositions(session);
    const byPlaca = new Map(vehicles.map((v) => [normalizePlaca(v.placa), v]));

    const dateFromMs = spDayStartMs(dateFrom);
    const dateToMs = spDayEndMs(dateTo);

    // Um round-trip por caminhão à Sascar. Disparar tudo de uma vez estoura o timeout
    // da function (sequencial) ou faz a Sascar responder corpo vazio sob carga (paralelo
    // irrestrito) — por isso: no máx. 4 chamadas simultâneas, com retry em cada uma.
    const resultados = await mapWithConcurrency(trucks ?? [], 4, async (truck) => {
      const match = byPlaca.get(normalizePlaca(truck.placa));
      if (!match) {
        return { truckId: truck.id, placa: truck.placa, kmInicio: null, kmFim: null, kmRodado: null, erro: "Placa não encontrada na Sascar" };
      }
      try {
        const range = await withRetry(() => getKmForRange(session, match.identifierVehicle, dateFromMs, dateToMs));
        if (!range) {
          return { truckId: truck.id, placa: truck.placa, kmInicio: null, kmFim: null, kmRodado: null, erro: "Sem posições no período" };
        }
        return {
          truckId: truck.id,
          placa: truck.placa,
          kmInicio: range.kmInicio,
          kmFim: range.kmFim,
          kmRodado: Math.round((range.kmFim - range.kmInicio) * 10) / 10,
        };
      } catch (e) {
        return { truckId: truck.id, placa: truck.placa, kmInicio: null, kmFim: null, kmRodado: null, erro: e instanceof Error ? e.message : String(e) };
      }
    });

    const total = resultados.reduce((s, r) => s + (r.kmRodado || 0), 0);
    return new Response(JSON.stringify({ dateFrom, dateTo, resultados, total }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
