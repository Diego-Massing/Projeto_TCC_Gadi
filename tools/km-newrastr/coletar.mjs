// Frota Control — KM dos caminhões do New Rastreamento Online
//
// O portal não tem API, recusa login feito direto pelo servidor e bloqueia acessos de
// fora do Brasil (e o firewall dele barra navegador invisível) — então este programa roda no PC do admin (agendado no Windows), abre um
// Chrome de verdade (Playwright), lê o "Relatório de Hodômetro" dia a dia e grava em
// km_diario no Supabase. A tela "KM Rodado" soma os dias do período pedido.
//
// Cada execução continua do último dia completo gravado (ou BACKFILL_DIAS atrás na
// primeira vez) e regrava o dia de hoje como parcial — PC desligado uns dias não deixa
// buraco: a próxima execução completa.
//
// Configuração em .env (mesma pasta, fora do Git): NEWRASTR_EMAIL, NEWRASTR_LOGIN,
// NEWRASTR_PASS, KM_INGEST_SECRET, SUPABASE_URL, SUPABASE_ANON_KEY.
// Se o portal mostrar captcha, paramos com erro — não tentamos contornar.
//
// Uso: node coletar.mjs            (normal)
//      node coletar.mjs --teste    (só login e lista de veículos, não grava nada)
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const AQUI = dirname(fileURLToPath(import.meta.url));
const BASE = "https://newrastreamentoonline.com.br";
const FONTE = "New Rastreamento";
const BACKFILL_DIAS = Number(process.env.BACKFILL_DIAS) || 90; // dias buscados na primeira execução
const TESTE = process.argv.includes("--teste");

const env = Object.fromEntries(
  readFileSync(join(AQUI, ".env"), "utf8").split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const exigir = (nome) => {
  if (!env[nome]) throw new Error(`Falta ${nome} no .env`);
  return env[nome];
};

// ---------- Supabase ----------
async function rpc(nome, args) {
  const res = await fetch(`${exigir("SUPABASE_URL")}/rest/v1/rpc/${nome}`, {
    method: "POST",
    headers: {
      apikey: exigir("SUPABASE_ANON_KEY"),
      Authorization: `Bearer ${exigir("SUPABASE_ANON_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`Supabase ${nome}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// ---------- datas (horário de Brasília) ----------
const hojeBR = () => new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// ---------- portal ----------
async function esperarPostback(page) {
  await page.waitForFunction(() => {
    const prm = window.Sys?.WebForms?.PageRequestManager?.getInstance?.();
    return !prm || !prm.get_isInAsyncPostBack();
  }, null, { timeout: 90000 });
}

async function login(page) {
  // "networkidle" nunca chega: o portal fica fazendo chamadas de fundo o tempo todo.
  await page.goto(`${BASE}/new/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("#txtEmail_I", { timeout: 45000 });
  await page.waitForFunction(() => typeof txtEmail !== "undefined" && typeof ASPx !== "undefined", null, { timeout: 30000 });
  // Espera a página terminar de carregar: os scripts do portal preenchem no fim campos que
  // o login exige (site/mapa selecionados, DXScript, reCAPTCHA). Clicar antes = login recusado.
  await page.waitForLoadState("load", { timeout: 60000 }).catch(() => {});
  await page.waitForFunction(() => document.querySelector('[name="DXScript"]')?.value, null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const captcha = () => page.evaluate(() => typeof panCaptcha !== "undefined" && panCaptcha.GetClientVisible()).catch(() => false);
  if (await captcha()) throw new Error("O portal pediu captcha no login — entre uma vez pelo navegador e rode de novo");

  // Preenche pela API dos próprios campos DevExpress (SetText): digitar/preencher o <input>
  // não atualiza o valor interno que o LoginClick do portal lê e criptografa.
  await page.evaluate(([email, login, senha]) => {
    txtEmail.SetText(email);
    txtLogin.SetText(login);
    txtPassword.SetText(senha);
  }, [exigir("NEWRASTR_EMAIL"), exigir("NEWRASTR_LOGIN"), exigir("NEWRASTR_PASS")]);
  if (TESTE) {
    // Diagnóstico: só tamanhos, nunca os valores.
    console.log("Criptografia do portal:", await page.evaluate(() => {
      const k = __h.Get("c");
      const e = new JSEncrypt(); e.setPublicKey(k);
      const r = e.encrypt("teste");
      return { chaveCarregada: typeof k === "string" && k.length > 100, resultado: typeof r, tamanho: r ? r.length : 0 };
    }));
    console.log("Campos preenchidos (tamanhos):", await page.evaluate(() => ({
      emailInput: document.querySelector("#txtEmail_I").value.length,
      emailGetText: txtEmail.GetText().length,
      loginGetText: txtLogin.GetText().length,
      senhaGetText: txtPassword.GetText().length,
      focoEm: document.activeElement?.id,
    })));
  }

  const avisos = [];
  page.on("dialog", async (d) => { avisos.push(d.message()); await d.dismiss(); });
  if (TESTE) page.on("request", (r) => {
    if (r.method() === "POST" && /\/login/i.test(r.url())) {
      const p = new URLSearchParams(r.postData() || "");
      console.log("POST login enviado:", [...p.entries()].map(([k, v]) => `${k}=${v.length}${/^(cbo|btn|__EVENT)/.test(k) && v.length < 30 ? `(${v})` : ""}`).join(" "));
    }
  });
  await Promise.all([
    page.waitForURL((u) => !/\/login/i.test(u.pathname), { timeout: 60000 }).catch(() => null),
    page.click("#btnLogin"),
  ]);
  if (/\/login/i.test(new URL(page.url()).pathname)) {
    if (await captcha()) throw new Error("O portal pediu captcha depois do login — entre uma vez pelo navegador e rode de novo");
    throw new Error(`Login recusado${avisos.length ? `: ${avisos.join(" | ")}` : ""}`);
  }
  console.log("Login OK");
}

async function abrirRelatorio(page) {
  await page.goto(`${BASE}/new/report/vehicle/HodometroPuro/0`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => typeof ASPx !== "undefined" && document.querySelector('[id$="dteDataInicial_I"]'), null, { timeout: 45000 });
}

/** Placas disponíveis no combo de veículos do relatório. */
async function listarPlacas(page) {
  // A grade da caixa suspensa só é criada na primeira abertura: abre pela API, lê, fecha.
  const dropdown = (acao) => page.evaluate((acao) => {
    const dd = ASPx.GetControlCollection().GetControlsByPredicate((c) => c.name && c.name.endsWith("dropPlaca"))[0];
    dd?.[acao]?.();
  }, acao);
  await dropdown("ShowDropDown");
  await page.waitForSelector('tr[id*="gvAvailable_DXDataRow"]', { state: "attached", timeout: 30000 });
  await page.waitForTimeout(500);
  const placas = await page.$$eval('tr[id*="gvAvailable_DXDataRow"]', (rows) =>
    rows.map((r) => [...r.cells].map((c) => c.textContent.trim()).find((t) => /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(t))).filter(Boolean));
  await dropdown("HideDropDown");
  return [...new Set(placas)];
}

// A placa é uma caixa suspensa (DropDownEdit) com uma grade dentro: abre pela API e clica
// na linha visível (a grade tem uma cópia escondida das linhas, que não recebe o clique).
async function selecionarPlaca(page, placa) {
  await page.evaluate(() => {
    const dd = ASPx.GetControlCollection().GetControlsByPredicate((c) => c.name && c.name.endsWith("dropPlaca"))[0];
    dd?.ShowDropDown?.();
  });
  const linha = page.locator('tr[id*="gvAvailable_DXDataRow"]:visible', { hasText: placa }).first();
  await linha.waitFor({ state: "visible", timeout: 30000 });
  await linha.click();
  await page.waitForTimeout(500);
  await esperarPostback(page);
  const texto = await page.inputValue('[id$="dropPlaca_I"]').catch(() => "");
  if (!texto.includes(placa)) throw new Error(`não consegui selecionar ${placa} (combo mostra "${texto}")`);
}

/** KM rodado (Dist. Percorrida) da placa selecionada entre dois instantes. */
async function kmPeriodo(page, placa, ini, fim) {
  await page.evaluate(([a, b]) => {
    const get = (suf) => ASPx.GetControlCollection().GetControlsByPredicate((c) => c.name && c.name.endsWith(suf))[0];
    get("dteDataInicial").SetDate(new Date(a[0], a[1], a[2], a[3], a[4], a[5]));
    get("dteDataFinal").SetDate(new Date(b[0], b[1], b[2], b[3], b[4], b[5]));
  }, [ini, fim].map((d) => [d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()]));
  // Clica em "Consultar" pela API do próprio botão DevExpress (DoClick = o mesmo que o
  // clique do usuário dispara); o clique pelo seletor não acionava a consulta.
  // A consulta troca a grade inteira (UpdatePanel): só lemos depois que a grade antiga
  // saiu da página — se não sair, a consulta não rodou e paramos (nada de gravar 0).
  const gradeAntiga = await page.$('[id$="gvReport"]');
  const clicou = await page.evaluate(() => {
    const btn = ASPx.GetControlCollection().GetControlsByPredicate((c) => c.name && /btnSearch$/.test(c.name))[0];
    if (btn?.DoClick) { btn.DoClick(); return "api"; }
    const el = [...document.querySelectorAll("input, a, div, span")].find((e) => e.offsetParent && /^\s*Consultar\s*$/.test(e.value || e.textContent));
    if (el) { el.click(); return "texto"; }
    return null;
  });
  if (!clicou) throw new Error('botão "Consultar" não encontrado');
  const trocou = gradeAntiga
    ? await page.waitForFunction((el) => !el.isConnected, gradeAntiga, { timeout: 90000 }).then(() => true).catch(() => false)
    : true;
  if (!trocou) throw new Error(`a consulta não atualizou a tabela (clique via ${clicou})`);
  await esperarPostback(page);
  await page.waitForFunction(() => ![...document.querySelectorAll('[id*="LP"], .dxlpLoadingPanel_DevEx')]
    .some((e) => e.offsetParent && /Carregando/i.test(e.textContent)), null, { timeout: 90000 }).catch(() => {});
  if (process.env.DEBUG) console.log("DEBUG", await page.evaluate(() => {
    const val = (suf) => document.querySelector(`[id$="${suf}_I"]`)?.value;
    const grid = document.querySelector('[id$="gvReport"]');
    return {
      dataIni: val("dteDataInicial"), dataFim: val("dteDataFinal"), placaCombo: val("dropPlaca"),
      gridId: grid?.id, gridTag: grid?.tagName,
      linhas: [...(grid?.querySelectorAll("tr") || [])].map((r) => `${r.id || "-"}: ${r.innerText.replace(/\s+/g, " ").trim().slice(0, 120)}`).filter((t) => !/^-: $/.test(t)).slice(0, 12),
    };
  }));
  return page.evaluate((placa) => {
    const grid = document.querySelector('[id$="gvReport"]');
    if (!grid) return { erro: "grade do relatório não encontrada" };
    // Colunas: Placa | Identificador | Dist. Percorrida (Km) | Origem. O cabeçalho tem células
    // extras (agrupamento), então a distância é lida pela posição relativa à placa.
    const num = (t) => /^\d[\d.,]*$/.test(t);
    for (const r of grid.querySelectorAll('tr[id*="DXDataRow"]')) {
      const cells = [...r.cells].map((c) => c.innerText.trim());
      const i = cells.indexOf(placa);
      if (i < 0) continue;
      const txt = num(cells[i + 2] ?? "") ? cells[i + 2] : cells.slice(i + 1).find(num);
      if (txt == null) return { erro: "coluna de distância não encontrada" };
      return { km: Number(txt.replace(/\./g, "").replace(",", ".")) };
    }
    return { km: 0 }; // sem linhas = não andou / sem posições no período
  }, placa);
}

async function main() {
  // Chrome normal (com janela): o firewall do portal bloqueia o modo invisível (headless).
  // Abre minimizado para não atrapalhar quem estiver usando o PC. Sem nenhum disfarce.
  const browser = await chromium.launch({ headless: false, args: ["--start-minimized"] });
  const page = await browser.newPage({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  page.setDefaultTimeout(60000);
  try {
    await login(page);
    await abrirRelatorio(page);
    const placas = await listarPlacas(page);
    console.log("Veículos no portal:", placas.join(", ") || "(nenhum)");
    if (TESTE || !placas.length) return;

    const status = await rpc("km_diario_status", { p_secret: exigir("KM_INGEST_SECRET"), p_fonte: FONTE });
    const ultimo = Object.fromEntries(status.map((s) => [s.placa, s.ultimo_dia]));
    const hoje = hojeBR();
    const hojeIni = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

    for (const placa of placas) {
      await selecionarPlaca(page, placa);
      let dia = ultimo[placa]
        ? addDias(new Date(`${ultimo[placa]}T00:00:00`), 1)
        : addDias(hojeIni, -BACKFILL_DIAS);
      const linhas = [];
      while (dia <= hojeIni) {
        const ehHoje = iso(dia) === iso(hojeIni);
        const fim = ehHoje ? hoje : new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 23, 59, 59);
        const r = await kmPeriodo(page, placa, dia, fim);
        if (r.erro) throw new Error(`${placa} ${iso(dia)}: ${r.erro}`);
        linhas.push({ placa, data: iso(dia), km: r.km, parcial: ehHoje });
        dia = addDias(dia, 1);
        // grava em lotes para não perder o progresso de um backfill longo
        if (linhas.length >= 15) await rpc("km_diario_ingest", { p_secret: exigir("KM_INGEST_SECRET"), p_fonte: FONTE, p_linhas: linhas.splice(0) });
      }
      if (linhas.length) await rpc("km_diario_ingest", { p_secret: exigir("KM_INGEST_SECRET"), p_fonte: FONTE, p_linhas: linhas });
      console.log(`${placa}: atualizado até ${iso(hoje)} ${hoje.toTimeString().slice(0, 5)}`);
    }
  } finally {
    // Sai do portal para liberar a sessão (o portal aceita uma sessão por usuário).
    await page.evaluate(() => fetch("/ws/mainWebServices.asmx/Logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).catch(() => {});
    await browser.close();
  }
}

main().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
