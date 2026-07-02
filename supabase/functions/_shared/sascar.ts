// Shared Sascar/Michelin MyConnectedFleet client.
// Ported from Att_Oleos/scraper.py (obter_token_keycloak_pkce_requests + obter_bff_token).
// Pure HTTP (no browser) PKCE login: GET the Keycloak login form, extract the
// hidden fields + form action, POST credentials without following the redirect,
// pull the auth code out of the Location header fragment, then exchange it for a token.

const IAM_BASE = "https://iam.sascar.com.br/auth/realms/user-auth-temp";
const REDIRECT_URI = "https://myconnectedfleet.michelin.com/indexMichelin.html";
const BFF_BASE = "https://sasweb2-mod-bff-v1-sasweb2-produto-prd.apps.ocp4.sascar.com.br";
const POSICOES_URL = `${BFF_BASE}/sasweb2-mod-relatorio-posicoes/posicoes`;
const ULTIMA_POSICAO_URL = `${BFF_BASE}/lastposition-map/v2/veiculos-ultima-posicao`;

const HODOMETER_TO_KM = 10;

// The app is served from various origins (localhost during dev, the real host in prod),
// and supabase.functions.invoke() always preflights with an OPTIONS request first.
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Fixed account parameters for Transportes Gadi (see sascar_km_api.md).
export const SASCAR_USER_ID = 194432;
export const SASCAR_ID_CONTRACT = 22603;
export const SASCAR_IDENTIFIER_CLIENT = 160338;
export const SASCAR_DEVICE_TYPE = 79;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36";

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(input: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(digest);
}

function randomToken(len = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(len)));
}

function extractHiddenFields(html: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const inputRe = /<input[^>]*>/gi;
  for (const m of html.matchAll(inputRe)) {
    const tag = m[0];
    const type = /type=["']([^"']*)["']/i.exec(tag)?.[1]?.toLowerCase();
    if (type !== "hidden") continue;
    const name = /name=["']([^"']*)["']/i.exec(tag)?.[1];
    const value = /value=["']([^"']*)["']/i.exec(tag)?.[1] ?? "";
    if (name) fields[name] = value;
  }
  return fields;
}

async function loginKeycloakPkce(username: string, password: string): Promise<string> {
  const codeVerifier = randomToken(32);
  const codeChallenge = b64url(await sha256(codeVerifier));
  const state = randomToken(16);
  const nonce = randomToken(16);

  const authUrl = `${IAM_BASE}/protocol/openid-connect/auth`
    + `?client_id=app-clients`
    + `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`
    + `&state=${state}`
    + `&response_mode=fragment`
    + `&response_type=code`
    + `&scope=openid`
    + `&nonce=${nonce}`
    + `&code_challenge=${codeChallenge}`
    + `&code_challenge_method=S256`;

  const resp1 = await fetch(authUrl, { headers: { "User-Agent": UA } });
  if (!resp1.ok) throw new Error(`IAM não acessível: ${resp1.status}`);
  const html = await resp1.text();

  const actionMatch = /action="([^"]+)"/.exec(html);
  if (!actionMatch) throw new Error("Formulário de login não encontrado na página IAM.");
  const formAction = actionMatch[1].replace(/&amp;/g, "&");
  const hidden = extractHiddenFields(html);

  // Cookies from the GET must be replayed on the POST (Keycloak sets several: AUTH_SESSION_ID,
  // KC_AUTH_SESSION_HASH, KC_RESTART...). Headers.get("set-cookie") only returns one of them —
  // getSetCookie() is required to see them all.
  const setCookies = typeof (resp1.headers as any).getSetCookie === "function"
    ? (resp1.headers as any).getSetCookie()
    : [resp1.headers.get("set-cookie") ?? ""].filter(Boolean);
  const cookieHeader = setCookies.map((c: string) => c.split(";")[0]).join("; ");

  // The Keycloak login page (usernameTransform.js) rewrites "@" to "%" in the
  // username right before submit — replicate that here since we skip the browser JS.
  const submittedUsername = username.includes("@") ? username.replace(/@/g, "%") : username;
  const body = new URLSearchParams({ ...hidden, username: submittedUsername, password });
  const resp2 = await fetch(formAction, {
    method: "POST",
    redirect: "manual",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    body: body.toString(),
  });

  const location = resp2.headers.get("location") ?? "";
  if (!location) {
    const errText = await resp2.text();
    const errMatch = /id="input-error"[^>]*>\s*([^<]*)/.exec(errText);
    const detail = errMatch?.[1]?.trim() || `status ${resp2.status}`;
    throw new Error(`Login falhou: ${detail}`);
  }

  const fragment = location.split("#")[1] ?? "";
  const authCode = new URLSearchParams(fragment).get("code");
  if (!authCode) throw new Error(`Código de autenticação não encontrado no redirect. Location=${location.slice(0, 200)}`);

  const resp3 = await fetch(`${IAM_BASE}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: "app-clients",
      code: authCode,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier,
    }).toString(),
  });
  if (!resp3.ok) throw new Error(`Token exchange falhou: ${resp3.status} - ${(await resp3.text()).slice(0, 200)}`);
  const tokenJson = await resp3.json();
  const accessToken = tokenJson.access_token;
  if (!accessToken) throw new Error("Token exchange sem access_token.");
  return accessToken;
}

async function obterBffToken(keycloakToken: string): Promise<string> {
  const endpoint = `${BFF_BASE}/authentication/token`;
  const tentativas = [
    { headers: { Authorization: `Bearer ${keycloakToken}`, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ access_token: keycloakToken }) },
    { headers: { Authorization: `Bearer ${keycloakToken}`, Accept: "application/json" }, body: undefined },
    { headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ token: keycloakToken }) },
  ];
  for (const t of tentativas) {
    try {
      const resp = await fetch(endpoint, { method: "POST", headers: t.headers, body: t.body });
      if (resp.ok) {
        const text = await resp.text();
        if (text.trim()) {
          const data = JSON.parse(text);
          const token = data.access_token || data.token || data.bff_token;
          if (token) return token;
        }
      }
    } catch (_e) {
      // try next variant
    }
  }
  throw new Error("Não foi possível obter o BFF token da Sascar.");
}

export interface SascarSession {
  bffToken: string;
}

export async function sascarLogin(username: string, password: string): Promise<SascarSession> {
  const keycloakToken = await loginKeycloakPkce(username, password);
  const bffToken = await obterBffToken(keycloakToken);
  return { bffToken };
}

function bffHeaders(bffToken: string) {
  return {
    Authorization: `Bearer ${bffToken}`,
    MyToken: bffToken,
    "Content-Type": "application/json",
    "Content-Language": "ES_AR",
    Referer: "https://myconnectedfleet.michelin.com/main.html",
    "User-Agent": UA,
  };
}

export interface VehiclePosition {
  placa: string;
  identifierVehicle: number;
  km: number;
}

export async function listVehiclePositions(session: SascarSession): Promise<VehiclePosition[]> {
  const resp = await fetch(ULTIMA_POSICAO_URL, {
    method: "POST",
    headers: bffHeaders(session.bffToken),
    body: JSON.stringify({ userId: SASCAR_USER_ID }),
  });
  if (!resp.ok) throw new Error(`veiculos-ultima-posicao falhou: ${resp.status}`);
  const data = await resp.json();
  const payload: any[] = data.payload || [];
  return payload
    .filter((item) => item.vehiclePlate && item.hodometer != null)
    .map((item) => ({
      placa: String(item.vehiclePlate).trim().toUpperCase(),
      identifierVehicle: item.identifierVehicle,
      km: Math.round(Number(item.hodometer) / HODOMETER_TO_KM),
    }));
}

export function normalizePlaca(placa: string): string {
  return (placa || "").toUpperCase().replace(/[\s-]/g, "");
}

/** Returns hodometer (in km, no conversion needed) at the start and end of the given range. */
export async function getKmForRange(
  session: SascarSession,
  identifierVehicle: number,
  dateFromMs: number,
  dateToMs: number,
): Promise<{ kmInicio: number; kmFim: number } | null> {
  const body = {
    idContract: SASCAR_ID_CONTRACT,
    dailyPosition: {
      dateFromLong: dateFromMs,
      dateToLong: dateToMs,
      identifierDeviceType: SASCAR_DEVICE_TYPE,
      identifierClient: SASCAR_IDENTIFIER_CLIENT,
      identifierUser: SASCAR_USER_ID,
      identifierVehicles: identifierVehicle,
      identifiersVehicles: identifierVehicle,
      identifierVehiclesList: identifierVehicle,
      identifierVehicle: identifierVehicle,
      identifierDrivers: [],
      identifierDriver: [],
      nameDriver: null,
      dateOption: "custom",
      timeOption: "full",
      timezoneUser: "America/Sao_Paulo",
      dateEventFrom: dateFromMs,
      dateEventTo: dateToMs,
      innerIdentifierClient: SASCAR_IDENTIFIER_CLIENT,
    },
  };
  const resp = await fetch(POSICOES_URL, { method: "POST", headers: bffHeaders(session.bffToken), body: JSON.stringify(body) });
  if (!resp.ok) throw new Error(`posicoes falhou: ${resp.status}`);
  const data = await resp.json();
  const payload: any[] = data.payload || [];
  if (!payload.length) return null;
  return {
    kmInicio: Number(payload[0].hodometer),
    kmFim: Number(payload[payload.length - 1].hodometer),
  };
}

/** SP (UTC-3) midnight/end-of-day epoch ms helpers. */
export function spDayStartMs(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00-03:00`).getTime();
}
export function spDayEndMs(dateStr: string): number {
  return new Date(`${dateStr}T23:59:59-03:00`).getTime();
}
