// Cliente da API do Getrak/RotaSystem (plataforma v2 — v2.getrak.com.br).
//
// Login OAuth "password" em api.getrak.com/newkoauth, com a chave do aplicativo web
// (getrak_client_basic, Basic) + usuário/senha do portal — tudo no Vault, lido via
// get_tracker_secrets(). O relatório "Deslocamentos e paradas" devolve o KM rodado no
// período em total_odometer; o portal limita a 31 dias por consulta, então períodos
// maiores são divididos.

const API = "https://api.getrak.com";
const MAX_DIAS = 31;

export interface GetrakSession {
  token: string;
}

export interface GetrakVehicle {
  id: number;
  plate: string;
}

// O portal manda o usuário como "<usuário>@<central>" — a central da Gadi é "rotasystem".
const CENTRAL = "rotasystem";

export async function getrakLogin(clientBasic: string, username: string, password: string): Promise<GetrakSession> {
  const user = username.trim();
  const res = await fetch(`${API}/newkoauth/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${clientBasic.trim()}`,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "password",
      username: user.includes("@") ? user : `${user}@${CENTRAL}`,
      password,
    }).toString(),
  });
  const json = await res.json().catch(() => ({}));
  if (res.ok && json.access_token) return { token: json.access_token };
  // Só o código/descrição do erro OAuth — nunca o corpo inteiro (pode ecoar dados).
  throw new Error(`Login no Getrak falhou (HTTP ${res.status} ${json.error ?? ""} ${String(json.error_description ?? "").slice(0, 120)})`.trim());
}

async function get(session: GetrakSession, path: string, params: [string, string][]): Promise<any> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API}${path}?${qs}`, {
    headers: { Authorization: `Bearer ${session.token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Getrak ${path} respondeu HTTP ${res.status}`);
  return res.json();
}

export async function listGetrakVehicles(session: GetrakSession): Promise<GetrakVehicle[]> {
  const out: GetrakVehicle[] = [];
  for (let page = 1; page <= 20; page++) {
    const json = await get(session, "/v1.0/vehicles", [
      ["filters[status]", "activeRestricted"],
      ["page", String(page)],
      ["per_page", "100"],
      ["order[plate]", "ASC"],
      ["fields", "id,plate"],
    ]);
    for (const v of json.data ?? []) out.push({ id: v.id, plate: v.plate });
    if (page >= (json.pages ?? 1)) break;
  }
  return out;
}

// Divide [from, to] (YYYY-MM-DD) em blocos de no máximo MAX_DIAS dias.
function blocos(from: string, to: string): [string, string][] {
  const out: [string, string][] = [];
  let ini = new Date(`${from}T12:00:00Z`);
  const fim = new Date(`${to}T12:00:00Z`);
  while (ini <= fim) {
    const b = new Date(ini);
    b.setUTCDate(b.getUTCDate() + MAX_DIAS - 1);
    const end = b < fim ? b : fim;
    out.push([ini.toISOString().slice(0, 10), end.toISOString().slice(0, 10)]);
    ini = new Date(end);
    ini.setUTCDate(ini.getUTCDate() + 1);
  }
  return out;
}

/** KM rodado no período e hodômetro no início/fim. null = sem deslocamentos no período. */
export async function getrakKmForRange(
  session: GetrakSession,
  vehicleId: number,
  from: string,
  to: string,
): Promise<{ kmInicio: number; kmFim: number; kmRodado: number } | null> {
  let kmInicio: number | null = null;
  let kmRodado = 0;
  for (const [ini, fim] of blocos(from, to)) {
    const json = await get(session, "/v1/localization/displacement-stop/vehicle", [
      ["vehicle_id", String(vehicleId)],
      ["start_date", ini],
      ["end_date", fim],
      ["start_hour", "00:00:00"],
      ["end_hour", "23:59:59"],
      ["minimum_duration", "0"],
      ["type_interval", "1"],
      ["event_type", "1"],
      ["page", "1"],
      ["per_page", "1"],
      ["use_invalid_positions", "false"],
    ]);
    if (!json.total_items) continue;
    if (kmInicio === null) kmInicio = json.detailed?.[0]?.start_odometer ?? null;
    kmRodado += json.total_odometer ?? json.total_distance ?? 0;
  }
  if (kmInicio === null && kmRodado === 0) return null;
  kmRodado = Math.round(kmRodado * 10) / 10;
  const ini = kmInicio ?? 0;
  return { kmInicio: ini, kmFim: Math.round((ini + kmRodado) * 10) / 10, kmRodado };
}

/** Placa antiga (ABC1234) → Mercosul (ABC1C34): o 5º caractere vira letra (0=A … 9=J). */
export function placaMercosul(placa: string): string {
  const p = (placa || "").toUpperCase().replace(/[\s-]/g, "");
  return /^[A-Z]{3}\d{4}$/.test(p) ? p.slice(0, 4) + "ABCDEFGHIJ"[Number(p[4])] + p.slice(5) : p;
}
