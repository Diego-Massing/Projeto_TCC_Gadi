// Monta as viagens de um caminhão a partir das posições GPS, para a tela "Fretes Sugeridos".
//
// Regras (validadas contra os fretes de jul–set/2026 de JBY, FGF, GEM e FHE):
// - parada = velocidade ≤ 5 por ≥ 20 min; paradas seguidas a ≤ 3 km viram uma "visita",
//   e visitas seguidas a ≤ 10 km se juntam (carga espalhada em vários pontos da cidade);
// - uma visita é ponta de viagem se:
//     a) é pátio de cliente: ≥ 2 paradas somando ≥ 2 h, a ≤ 30 km de uma cidade que já
//        aparece em algum frete (posto/pernoite é uma parada só; casa do motorista não
//        está em frete nenhum);
//     b) o caminhão volta pelo caminho de onde veio (lugar novo, ex. Mar del Plata);
//     c) é aduana e o caminhão atravessa de país — o frete é lançado dividido na fronteira;
// - pontas a ≤ 60 km uma da outra são a mesma "zona" (cliente + base + posto da cidade),
//   com o nome da cidade que mais aparece nos fretes;
// - KM pelo hodômetro; se ele estiver travado/estranho, pela soma do trajeto do GPS;
// - carregado/vazio pelo histórico da rota; rota nova: depois de carregado vem vazio.
import type { GpsPoint } from "./sascar.ts";

export interface Lugar { nome: string; lat: number; lon: number; pais: string }
export interface FreteHist {
  id: number; truckId: number; data: string; origem: string; destino: string;
  km: number; tipo: string; valorFrete: number; modalidade: string | null; cliente: string | null;
}
export interface Viagem {
  saida: string; chegada: string;
  de: string; para: string;           // nome pra mostrar
  deLugar: string | null; paraLugar: string | null; // chave em lugares_frete
  pDe: [number, number]; pPara: [number, number];   // onde o caminhão parou de fato
  km: number; kmFonte: "hodometro" | "gps";
  kmTabela: number | null;
  tipo: "carregado" | "vazio"; tipoFonte: "historico" | "regra";
  ref: { valorFrete: number; modalidade: string | null; cliente: string | null; data: string } | null;
  freteId: number | null; // frete já lançado que corresponde a esta viagem
}

type P = [number, number];
const FRONTEIRAS = ["uruguaiana", "libres", "sao borja", "santo tome"];

export function normNome(s: string): string {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
}

export function placaMercosul(placa: string): string {
  const p = (placa || "").toUpperCase().replace(/[\s-]/g, "");
  return /^[A-Z]{3}\d{4}$/.test(p) ? p.slice(0, 4) + "ABCDEFGHIJ"[Number(p[4])] + p.slice(5) : p;
}

function dist(a: P, b: P): number {
  const r = Math.PI / 180;
  const la1 = a[0] * r, la2 = b[0] * r, dla = la2 - la1, dlo = (b[1] - a[1]) * r;
  const h = Math.sin(dla / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dlo / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

interface Visita {
  chega: number; sai: number; p: P; n: number; dwell: number;
  oc: number | null; os: number | null; // hodômetro ao chegar / sair
  gc: number; gs: number;               // km acumulado do trajeto GPS ao chegar / sair
}

function visitas(pts: GpsPoint[]): Visita[] {
  // paradas
  const paradas: Visita[] = [];
  let cum = 0, cur: GpsPoint[] = [], curCum: number[] = [];
  const fecha = () => {
    if (cur.length && cur[cur.length - 1].ts - cur[0].ts >= 20 * 60_000) {
      const odos = cur.map((x) => x.odo).filter((x): x is number => x != null && x > 0);
      paradas.push({
        chega: cur[0].ts, sai: cur[cur.length - 1].ts,
        p: [cur.reduce((s, x) => s + x.lat, 0) / cur.length, cur.reduce((s, x) => s + x.lon, 0) / cur.length],
        n: 1, dwell: (cur[cur.length - 1].ts - cur[0].ts) / 3_600_000,
        oc: odos.length ? Math.min(...odos) : null, os: odos.length ? Math.max(...odos) : null,
        gc: curCum[0], gs: curCum[curCum.length - 1],
      });
    }
    cur = []; curCum = [];
  };
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) {
      const seg = dist([pts[i - 1].lat, pts[i - 1].lon], [pts[i].lat, pts[i].lon]);
      if (seg < 50) cum += seg; // salto grande = falha de sinal, não conta
    }
    if (pts[i].speed <= 5) { cur.push(pts[i]); curCum.push(cum); } else fecha();
  }
  fecha();
  // junta paradas próximas (3 km em sequência; depois 10 km a partir do início da visita)
  const junta = (vs: Visita[], raio: number, refPrimeira: boolean) => {
    const out: Visita[] = [];
    let ultimo: P | null = null;
    for (const v of vs) {
      const o = out[out.length - 1];
      if (o && dist(refPrimeira ? o.p : ultimo!, v.p) <= raio) {
        o.sai = v.sai; o.n += v.n; o.dwell += v.dwell; o.gs = v.gs;
        if (v.os != null) o.os = v.os;
        if (o.oc == null) o.oc = v.oc;
      } else out.push({ ...v });
      ultimo = v.p;
    }
    return out;
  };
  return junta(junta(paradas, 3, false), 10, true);
}

export function montarViagens(pts: GpsPoint[], lugares: Lugar[], hist: FreteHist[], truckId: number): Viagem[] {
  const coords = new Map(lugares.map((l) => [l.nome, [l.lat, l.lon] as P]));
  const paisDe = new Map(lugares.map((l) => [l.nome, l.pais]));
  const lugarDe = (nome: string) => coords.get(normNome(nome)) ?? null;
  const maisPerto = (p: P): [string, number] => {
    let best = "", bd = Infinity;
    for (const l of lugares) { const d = dist(p, [l.lat, l.lon]); if (d < bd) { bd = d; best = l.nome; } }
    return [best, bd];
  };
  const conhecido = (p: P, raio: number) => { const [k, d] = maisPerto(p); return d <= raio ? k : null; };
  const pais = (p: P) => paisDe.get(maisPerto(p)[0]) ?? "BR";

  const pop = new Map<string, number>();
  const histC = hist.map((f) => {
    for (const n of [f.origem, f.destino]) { const k = normNome(n); if (coords.has(k)) pop.set(k, (pop.get(k) ?? 0) + 1); }
    return { f, o: lugarDe(f.origem), d: lugarDe(f.destino) };
  });

  const vs = visitas(pts);

  // pontas de viagem
  const pontas: Visita[] = [];
  vs.forEach((v, i) => {
    let j: Visita | undefined, k: Visita | undefined;
    for (let x = i - 1; x >= 0; x--) if (dist(vs[x].p, v.p) >= 80) { j = vs[x]; break; }
    for (let x = i + 1; x < vs.length; x++) if (dist(vs[x].p, v.p) >= 80) { k = vs[x]; break; }
    const site = v.n >= 2 && v.dwell >= 2;
    const volta = !!(j && k && dist(j.p, k.p) < 0.6 * (dist(j.p, v.p) + dist(v.p, k.p)));
    const fronteira = !!(j && k && FRONTEIRAS.some((f) => coords.has(f) && dist(v.p, coords.get(f)!) <= 15) && pais(j.p) !== pais(k.p));
    if (volta || fronteira || (site && conhecido(v.p, 30))) pontas.push(v);
  });

  // zonas
  const zonas: { eps: Visita[]; nome: string | null; p: P }[] = [];
  for (const e of pontas) {
    const z = zonas[zonas.length - 1];
    if (z && dist(z.eps[z.eps.length - 1].p, e.p) <= 60) z.eps.push(e);
    else zonas.push({ eps: [e], nome: null, p: e.p });
  }
  for (const z of zonas) {
    let melhor: string | null = null, mp = -1;
    for (const e of z.eps) { const k = conhecido(e.p, 30); if (k && (pop.get(k) ?? 0) > mp) { melhor = k; mp = pop.get(k) ?? 0; } }
    if (!melhor) {
      const rep = z.eps.reduce((a, b) => (b.n > a.n || (b.n === a.n && b.dwell > a.dwell) ? b : a));
      melhor = conhecido(rep.p, 80);
      z.p = rep.p;
    }
    z.nome = melhor;
    if (melhor) z.p = coords.get(melhor)!;
  }
  // atravessar a ponte entre cidades gêmeas da fronteira (São Borja ↔ Santo Tomé,
  // Uruguaiana ↔ Libres) não é viagem: as duas pontas viram uma zona só
  for (let i = zonas.length - 1; i > 0; i--) {
    const a = zonas[i - 1], b = zonas[i];
    if (a.nome && b.nome && FRONTEIRAS.includes(a.nome) && FRONTEIRAS.includes(b.nome) && a.nome !== b.nome && dist(a.p, b.p) <= 25) {
      a.eps.push(...b.eps);
      if ((pop.get(b.nome) ?? 0) > (pop.get(a.nome) ?? 0)) { a.nome = b.nome; a.p = b.p; }
      zonas.splice(i, 1);
    }
  }

  const titulo = (k: string | null, p: P) => k ? k.replace(/\b\w/g, (c) => c.toUpperCase()) : `Local desconhecido (${p[0].toFixed(2)}, ${p[1].toFixed(2)})`;
  const viagens: Viagem[] = [];
  for (let i = 0; i + 1 < zonas.length; i++) {
    const a = zonas[i], b = zonas[i + 1];
    if (a.nome && a.nome === b.nome) continue;
    const sai = a.eps[a.eps.length - 1], chega = b.eps[0];
    const kmGps = chega.gc - sai.gs;
    const kmOdo = sai.os != null && chega.oc != null ? chega.oc - sai.os : null;
    const odoOk = kmOdo != null && kmOdo >= 0.8 * kmGps && kmOdo <= 1.3 * kmGps + 20;
    const km = Math.round(odoOk ? kmOdo! : kmGps);
    if (km < 15) continue;

    // fretes da mesma rota; primeiro os deste caminhão e com as cidades mais perto das paradas
    const iguais = histC
      .filter((h) => h.o && h.d && dist(h.o, a.p) <= 80 && dist(h.d, b.p) <= 80)
      .map((h) => ({ ...h, prio: (h.f.truckId === truckId ? 0 : 2) + (Math.max(dist(h.o!, a.p), dist(h.d!, b.p)) <= 40 ? 0 : 1) }))
      .sort((x, y) => x.prio - y.prio || y.f.data.localeCompare(x.f.data));
    let tipo: "carregado" | "vazio", tipoFonte: "historico" | "regra";
    if (iguais.length) {
      const base = iguais.some((h) => h.f.truckId === truckId) ? iguais.filter((h) => h.f.truckId === truckId) : iguais;
      const nc = base.filter((h) => h.f.tipo === "carregado").length;
      tipo = nc >= base.length - nc ? "carregado" : "vazio"; tipoFonte = "historico";
    } else {
      const ant = viagens[viagens.length - 1]?.tipo;
      tipo = km < 150 ? "vazio" : ant === "carregado" ? "vazio" : "carregado"; tipoFonte = "regra";
    }
    const ref = iguais.find((h) => h.f.tipo === tipo)?.f ?? null;
    viagens.push({
      saida: new Date(sai.sai).toISOString(), chegada: new Date(chega.chega).toISOString(),
      de: ref?.origem || titulo(a.nome, a.p), para: ref?.destino || titulo(b.nome, b.p),
      deLugar: a.nome, paraLugar: b.nome, pDe: sai.p, pPara: chega.p,
      km, kmFonte: odoOk ? "hodometro" : "gps", kmTabela: ref?.km ?? null,
      tipo, tipoFonte,
      ref: ref ? { valorFrete: Number(ref.valorFrete) || 0, modalidade: ref.modalidade, cliente: ref.cliente, data: ref.data } : null,
      freteId: null,
    });
  }
  return viagens;
}

/** Liga cada frete já lançado do caminhão à viagem do GPS correspondente (marca freteId). */
export function marcarLancados(viagens: Viagem[], fretes: FreteHist[], lugares: Lugar[]): void {
  const coords = new Map(lugares.map((l) => [l.nome, [l.lat, l.lon] as P]));
  const dia = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
  const soma = (d: string, n: number) => new Date(Date.parse(d + "T12:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
  const pDe = (v: Viagem) => (v.deLugar && coords.get(v.deLugar)) || v.pDe;
  const pPara = (v: Viagem) => (v.paraLugar && coords.get(v.paraLugar)) || v.pPara;
  for (const f of [...fretes].sort((a, b) => a.data.localeCompare(b.data))) {
    const o = coords.get(normNome(f.origem)), d = coords.get(normNome(f.destino));
    const naData = viagens.filter((v) => v.freteId == null && soma(dia(v.saida), -3) <= f.data && f.data <= soma(dia(v.chegada), 3));
    const perto = (v: Viagem) => Math.abs(Date.parse(dia(v.saida)) - Date.parse(f.data));
    const kmParecido = (v: Viagem) => Math.abs(v.km - f.km) <= 0.15 * f.km + 20;
    let cand = naData.filter((v) => o && d && dist(pDe(v), o) <= 100 && dist(pPara(v), d) <= 100);
    // cidade lançada diferente da parada (ex.: "Santa Fé" × Rosário): uma ponta e o KM batendo
    if (!cand.length) cand = naData.filter((v) => kmParecido(v) && (!o || !d || dist(pDe(v), o) <= 100 || dist(pPara(v), d) <= 100));
    cand.sort((x, y) => perto(x) - perto(y));
    if (cand.length) cand[0].freteId = f.id;
  }
}
