// Frota Control — KM dos caminhões do New Rastreamento Online
//
// O portal não tem API e recusa login feito por requisição direta, então abrimos um
// Chrome de verdade (Playwright) — roda no GitHub Actions (.github/workflows/km-newrastr.yml).
//
// Modos (variável MODO):
//   teste   — só faz o login e lista os veículos (para validar o caminho)
//
// Credenciais vêm dos segredos do repositório: NEWRASTR_EMAIL, NEWRASTR_LOGIN, NEWRASTR_PASS.
// Se o portal mostrar captcha, paramos com erro — não tentamos contornar.
import { chromium } from "playwright";

const BASE = "https://newrastreamentoonline.com.br";
const MODO = process.env.MODO || "teste";

function exigir(nome) {
  const v = process.env[nome];
  if (!v) throw new Error(`Falta o segredo ${nome}`);
  return v;
}

async function login(page) {
  await page.goto(`${BASE}/new/login`, { waitUntil: "networkidle" });
  await page.waitForSelector("#txtEmail_I", { timeout: 30000 });

  const captcha = await page.evaluate(() =>
    typeof panCaptcha !== "undefined" && panCaptcha.GetClientVisible());
  if (captcha) throw new Error("O portal pediu captcha no login — entre uma vez pelo navegador e rode de novo");

  // Digita como uma pessoa; o LoginClick do portal criptografa antes de enviar.
  await page.fill("#txtEmail_I", exigir("NEWRASTR_EMAIL"));
  await page.fill("#txtLogin_I", exigir("NEWRASTR_LOGIN"));
  await page.fill("#txtPassword_I", exigir("NEWRASTR_PASS"));

  const avisos = [];
  page.on("dialog", async (d) => { avisos.push(d.message()); await d.dismiss(); });
  await Promise.all([
    page.waitForURL((u) => !/\/login/i.test(u.pathname), { timeout: 45000 }).catch(() => null),
    page.click("#btnLogin"),
  ]);

  if (/\/login/i.test(new URL(page.url()).pathname)) {
    const captchaDepois = await page.evaluate(() =>
      typeof panCaptcha !== "undefined" && panCaptcha.GetClientVisible()).catch(() => false);
    if (captchaDepois) throw new Error("O portal pediu captcha depois do login — entre uma vez pelo navegador e rode de novo");
    throw new Error(`Login recusado${avisos.length ? `: ${avisos.join(" | ")}` : ""}`);
  }

  // Aviso de LGPD/termos às vezes aparece depois do login; não aceitamos nada automaticamente.
  console.log("Login OK →", new URL(page.url()).pathname);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  try {
    await login(page);
    if (MODO === "teste") {
      await page.waitForTimeout(5000);
      const placas = await page.evaluate(() =>
        [...new Set((document.body.innerText.match(/\b[A-Z]{3}\d[A-Z0-9]\d{2}\b/g) || []))]);
      console.log("Veículos visíveis no mapa:", placas.join(", ") || "(nenhum)");
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
