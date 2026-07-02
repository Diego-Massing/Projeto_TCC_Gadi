import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { CORS_HEADERS, listVehiclePositions, normalizePlaca, sascarLogin } from "../_shared/sascar.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: secrets, error: secretsErr } = await admin.rpc("get_sascar_secrets");
    if (secretsErr) throw secretsErr;

    const secretMap = Object.fromEntries((secrets ?? []).map((s: any) => [s.name, s.decrypted_secret]));

    // verify_jwt is disabled at the gateway (cron calls have no user session), so this
    // function does its own auth: accept either a logged-in app user, or the cron secret.
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const cronSecret = req.headers.get("x-cron-secret");
    if (!userData?.user && cronSecret !== secretMap["sascar_cron_secret"]) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const session = await sascarLogin(secretMap["sascar_user"], secretMap["sascar_pass"]);
    const vehicles = await listVehiclePositions(session);
    const byPlaca = new Map(vehicles.map((v) => [normalizePlaca(v.placa), v]));

    const { data: trucks, error: trucksErr } = await admin.from("trucks").select("id, placa");
    if (trucksErr) throw trucksErr;

    const detalhes: { placa: string; kmAtual: number }[] = [];
    for (const truck of trucks ?? []) {
      const match = byPlaca.get(normalizePlaca(truck.placa));
      if (!match) continue;
      const { error: updErr } = await admin.from("trucks").update({ kmAtual: match.km }).eq("id", truck.id);
      if (updErr) throw updErr;
      detalhes.push({ placa: truck.placa, kmAtual: match.km });
    }

    return new Response(JSON.stringify({ atualizados: detalhes.length, detalhes }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
