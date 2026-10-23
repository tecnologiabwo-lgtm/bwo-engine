/* Generador de exportaciones sintéticas de Meta Ads + verdad independiente.
   La verdad se calcula sumando desde los anuncios; la herramienta nunca ve
   esa verdad, solo los archivos .xlsx fabricados. */
import * as XLSX from "xlsx";
import { parseWorkbook, buildModel, LEVEL_LABEL } from "../src/modules/consolidador/lib/parser.js";
import { buildReportHtml } from "../src/modules/consolidador/lib/report.js";

let PASS = 0, FAIL = 0; const failures = [];
const check = (scn, label, cond, detail = "") => { if (cond) PASS++; else { FAIL++; if (failures.length < 40) failures.push(`[${scn}] ${label} ${detail}`); } };
const near = (a, b, e = 0.011) => a !== null && a !== undefined && Math.abs(a - b) < e;

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const LV = ["campaign", "adset", "ad"], COLNAME = { campaign: "Nombre de la campaña", adset: "Nombre del conjunto de anuncios", ad: "Nombre del anuncio" };
const DIMS = { age: ["Edad", ["18-24", "25-34", "35-44", "45-54"]], gender: ["Sexo", ["male", "female", "unknown"]], region: ["Región", ["Carabobo", "Lara", "Zulia"]], placement: ["Ubicación", ["Feed", "Instagram Reels", "Instagram Stories"]], day: ["Día", ["2026-09-01", "2026-09-02", "2026-09-03"]] };

/* ---------- verdad: árbol campaña → conjunto → anuncio ---------- */
function makeTruth(R, { nC, sameNames }) {
  const camps = [];
  for (let c = 0; c < nC; c++) {
    const nA = sameNames ? 1 : 1 + Math.floor(R() * 3);
    const camp = { level: "campaign", name: `Campaña ${c + 1} ${["Leads", "Región", "Promo"][c % 3]}`, children: [] };
    for (let a = 0; a < nA; a++) {
      const nAd = sameNames ? 1 : 1 + Math.floor(R() * 3);
      const adset = { level: "adset", name: sameNames ? camp.name : `C${c + 1} Conjunto ${String.fromCharCode(65 + a)}`, children: [], parent: camp };
      for (let d = 0; d < nAd; d++) {
        const impressions = 400 + Math.floor(R() * 20000);
        const ad = { level: "ad", name: sameNames ? camp.name : `C${c + 1}${String.fromCharCode(65 + a)} Anuncio ${d + 1}`, parent: adset,
          results: Math.floor(R() * 40), spend: Math.round((1 + R() * 80) * 100) / 100, impressions,
          reach: Math.floor(impressions / (1.2 + R() * 1.8)) };
        ad.cpc = Math.round((0.1 + R()) * 1e8) / 1e8; ad.clicks = Math.round(ad.spend / ad.cpc); ad.cpc = ad.spend / ad.clicks;
        adset.children.push(ad);
      }
      camp.children.push(adset);
    }
    camps.push(camp);
  }
  // agregados: resultados/gasto/impresiones suman; alcance NO (deduplicado)
  const agg = (n) => {
    if (!n.children) return n;
    n.children.forEach(agg);
    const ch = n.children;
    n.results = ch.reduce((a, x) => a + x.results, 0);
    n.spend = Math.round(ch.reduce((a, x) => a + x.spend, 0) * 100) / 100;
    n.impressions = ch.reduce((a, x) => a + x.impressions, 0);
    n.clicks = ch.reduce((a, x) => a + x.clicks, 0);
    const mx = Math.max(...ch.map((x) => x.reach)), sm = ch.reduce((a, x) => a + x.reach, 0);
    n.reach = ch.length === 1 ? ch[0].reach : mx + Math.floor((sm - mx) * 0.7);
    n.cpc = n.spend / n.clicks;
    return n;
  };
  camps.forEach(agg);
  return camps;
}
const nodesAt = (camps, lvl) => lvl === "campaign" ? camps : lvl === "adset" ? camps.flatMap((c) => c.children) : camps.flatMap((c) => c.children.flatMap((a) => a.children));
const ancestor = (n, lvl) => { let x = n; while (x && x.level !== lvl) x = x.parent; return x; };
const leavesOf = (n) => (n.children ? n.children.flatMap(leavesOf) : [n]);

/* reparte un total en k partes exactas (enteros o centavos) */
function split(R, total, k, cents) {
  const unit = cents ? 100 : 1, T = Math.round(total * unit), w = Array.from({ length: k }, () => 0.2 + R());
  const sw = w.reduce((a, b) => a + b, 0); const parts = w.map((x) => Math.floor((T * x) / sw));
  parts[k - 1] += T - parts.reduce((a, b) => a + b, 0);
  return parts.map((p) => p / unit);
}

/* ---------- fabricar archivos .xlsx con el formato de Meta ---------- */
function workbook(rows, header, { headerAt0, formattedFirst }) {
  const grid = headerAt0 ? [header, ...rows] : [["Informe sin título", "This is raw data"], [], header, ...rows];
  const wb = XLSX.utils.book_new();
  if (formattedFirst) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Informe"], [], ["texto"]]), "Formatted Report");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(grid), "Raw Data Report");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return out instanceof ArrayBuffer ? out : out.buffer;
}
function idCells(node, cols, allBlank) {
  return cols.map((c) => { const a = ancestor(node, c); return a ? a.name : (allBlank ? "" : "All"); });
}
function metricCells(n, { noResults, noImpr, withClicks, sparse }) {
  const c = [noResults ? "" : "Clientes potenciales (formulario)", noResults ? "" : n.results, Math.round(n.spend * 100) / 100];
  if (!noImpr) c.push(n.impressions);
  c.push(n.reach);
  if (!sparse) c.push(withClicks ? n.clicks : "", n.cpc);
  return c;
}
function metricHeader({ noImpr, sparse }) { return ["Tipo de resultado", "Resultados", "Importe gastado (USD)", ...(noImpr ? [] : ["Impresiones"]), "Alcance", ...(sparse ? [] : ["Clics en el enlace", "CPC (costo por clic en el enlace)"])]; }

function buildFiles(R, truth, cfg) {
  const files = [];
  const missingCamp = cfg.missingResults ? truth[0] : null;
  const noRes = (n) => missingCamp && ancestor(n, "campaign") === missingCamp;
  const finest = cfg.cols[cfg.cols.length - 1];
  // filas resumen exportadas: nivel más fino de las columnas + (opcional) niveles superiores
  const summaryLevels = cfg.emitHigher ? cfg.cols : [finest];
  const exported = new Set();
  // profundidad mixta: la última campaña solo se exporta como total de campaña
  const mixedCamp = cfg.mixed ? truth[truth.length - 1] : null;
  const baseRows = [];
  summaryLevels.forEach((lvl) => nodesAt(truth, lvl).forEach((n) => {
    if (mixedCamp && ancestor(n, "campaign") === mixedCamp && lvl !== "campaign") return;
    exported.add(n);
    baseRows.push([...idCells(n, cfg.cols, cfg.allBlank), "active", lvl, ...metricCells(n, { noResults: noRes(n), withClicks: cfg.withClicks })]);
  }));
  if (mixedCamp && !summaryLevels.includes("campaign") && cfg.cols.includes("campaign")) {
    exported.add(mixedCamp);
    baseRows.push([...idCells(mixedCamp, cfg.cols, cfg.allBlank), "active", "campaign", ...metricCells(mixedCamp, { noResults: noRes(mixedCamp), withClicks: cfg.withClicks })]);
  }
  files.push({ name: "base.xlsx", buf: workbook(baseRows, [...cfg.cols.map((c) => COLNAME[c]), "Estado de la entrega", "Nivel de la entrega", ...metricHeader({})], cfg) });

  // desgloses
  const bdCols = cfg.bdCols || cfg.cols, bdLevel = bdCols[bdCols.length - 1];
  cfg.dims.forEach((dim) => {
    const [title, cats] = DIMS[dim]; const rows = [];
    nodesAt(truth, bdLevel).forEach((n) => {
      if (mixedCamp && ancestor(n, "campaign") === mixedCamp) n = mixedCamp; // la campaña mixta llega a nivel campaña
      const ids = idCells(n, bdCols, cfg.allBlank);
      if (rows.some((r) => r.__node === n)) return;
      const st = cfg.bdSparse ? ["active"] : [];
      if (cfg.bdAllRows) { const r = [...ids, "All", ...st, ...metricCells(n, { noResults: noRes(n), noImpr: cfg.bdNoImpr, withClicks: false, sparse: cfg.bdSparse })]; r.__node = n; rows.push(r); }
      const res = split(R, n.results, cats.length, false), sp = split(R, n.spend, cats.length, true),
        im = split(R, n.impressions, cats.length, false), re = split(R, n.reach, cats.length, false);
      cats.forEach((cat, i) => {
        const r = [...ids, cat, ...st, noRes(n) ? "" : "Clientes potenciales (formulario)", noRes(n) ? "" : res[i], sp[i], ...(cfg.bdNoImpr ? [] : [im[i]]), re[i], ...(cfg.bdSparse ? [] : ["", ""])];
        r.__node = n; rows.push(r);
      });
    });
    files.push({ name: `${dim}.xlsx`, buf: workbook(rows.map((r) => [...r]), [...bdCols.map((c) => COLNAME[c]), title, ...(cfg.bdSparse ? ["Estado de la entrega"] : []), ...metricHeader({ noImpr: cfg.bdNoImpr, sparse: cfg.bdSparse })], cfg) });
  });
  return { files, exported, missingCamp, mixedCamp };
}

/* ---------- ejecutar la herramienta y comparar con la verdad ---------- */
function runTool(files, order) {
  let rows = [], cur = "USD";
  order.forEach((i) => { const r = parseWorkbook(XLSX, files[i].buf); if (r) { cur = r.currency; rows.push(...r.rows); } });
  return (lvl) => buildModel(rows, cur, [], lvl);
}

function verify(scn, truth, built, cfg, tool) {
  const { exported, missingCamp, mixedCamp } = built;
  const m0 = tool("campaign");
  const finestTool = m0.availableLevels;
  // niveles esperados: los nombres que llegan a las entidades contadas
  // si los desgloses van a un nivel más fino que la base y traen el total de cada
  // entidad (fila "All"), ese nivel es legítimo; sin esa fila, solo cuenta la base
  const effCols = cfg.bdCols ? (cfg.bdAllRows && cfg.dims.length ? cfg.bdCols : cfg.cols) : cfg.cols;
  const expect = LV.filter((l) => effCols.includes(l));
  check(scn, "niveles ofrecidos", JSON.stringify(finestTool) === JSON.stringify(expect), `esperado ${expect} obtuvo ${finestTool}`);

  const totalRes = nodesAt(truth, "campaign").filter((c) => c !== missingCamp).reduce((a, c) => a + c.results, 0);
  const totalSpend = nodesAt(truth, "campaign").reduce((a, c) => a + c.spend, 0);
  const totalImpr = nodesAt(truth, "campaign").reduce((a, c) => a + c.impressions, 0);

  finestTool.forEach((lvl) => {
    const m = tool(lvl); const G = m.campaigns;
    check(scn, `[${lvl}] resultados totales`, G.filter((g) => !g.resultsMissing).reduce((a, g) => a + g.results, 0) === totalRes, `esperado ${totalRes} obtuvo ${G.reduce((a, g) => a + g.results, 0)}`);
    check(scn, `[${lvl}] inversión total`, near(G.reduce((a, g) => a + g.spend, 0), totalSpend), `esperado ${totalSpend.toFixed(2)} obtuvo ${G.reduce((a, g) => a + g.spend, 0).toFixed(2)}`);
    check(scn, `[${lvl}] impresiones totales`, G.reduce((a, g) => a + (g.impressions || 0), 0) === totalImpr);
    G.forEach((g) => {
      // nodo verdadero del grupo
      let node = nodesAt(truth, lvl).find((n) => n.name === g.name) || null;
      if (!node && mixedCamp && g.name.startsWith(mixedCamp.name + " · sin desglose")) node = mixedCamp;
      if (!node && cfg.sameNames) node = nodesAt(truth, "campaign").find((n) => n.name === g.name);
      check(scn, `[${lvl}] grupo «${g.name}» identificado`, !!node);
      if (!node) return;
      const isMissing = missingCamp && ancestor(node, "campaign") === missingCamp;
      check(scn, `[${lvl}] «${g.name}» resultados`, isMissing ? g.resultsMissing : g.results === node.results, `esperado ${isMissing ? "sin datos" : node.results} obtuvo ${g.resultsMissing ? "sin datos" : g.results}`);
      check(scn, `[${lvl}] «${g.name}» inversión`, near(g.spend, node.spend), `esperado ${node.spend} obtuvo ${g.spend}`);
      check(scn, `[${lvl}] «${g.name}» clics`, g.linkClicks === node.clicks, `esperado ${node.clicks} obtuvo ${g.linkClicks}`);
      // alcance: el exportado para ese nivel; si no, suma marcada
      if (exported.has(node)) check(scn, `[${lvl}] «${g.name}» alcance de Meta`, g.reach === node.reach, `esperado ${node.reach} obtuvo ${g.reach}`);
      else check(scn, `[${lvl}] «${g.name}» alcance marcado como suma`, g.reachNote === "suma" || g.memberCount === 1, `nota ${g.reachNote}`);
      // desgloses: cada dimensión suma el total del grupo
      if (!isMissing) Object.entries(g.dims).forEach(([d, rs]) => check(scn, `[${lvl}] «${g.name}» desglose ${d}`, rs.reduce((a, x) => a + x.results, 0) === g.results, `suma ${rs.reduce((a, x) => a + x.results, 0)} vs ${g.results}`));
      cfg.dims.forEach((d) => check(scn, `[${lvl}] «${g.name}» trae desglose ${d}`, !!g.dims[d]?.length));
      // jerarquía: un conjunto/anuncio conoce su campaña real
      if (lvl !== "campaign" && node.level === lvl && cfg.cols.includes("campaign") && !cfg.sameNames && !cfg.bdCols)
        check(scn, `[${lvl}] «${g.name}» campaña padre`, JSON.stringify(g.parentCampaigns) === JSON.stringify([ancestor(node, "campaign").name]), `obtuvo ${JSON.stringify(g.parentCampaigns)}`);
    });

    // INFORME EJECUTIVO: debe incluir TODAS las entidades del nivel, una vez cada una
    const html = buildReportHtml({ client: "Test", model: m, levelLabel: LEVEL_LABEL[lvl], levelPlural: "Varios",
      entities: G.map((c) => ({ c, kpis: [{ label: "K", value: c.name, note: "" }], findings: [] })) });
    const heads = (html.match(/<h1 class="part[^"]*" id="ent-\d+"/g) || []).length;
    check(scn, `[${lvl}] informe: una sección por entidad`, heads === G.length, `esperado ${G.length} obtuvo ${heads}`);
    G.forEach((g, i) => {
      check(scn, `[${lvl}] informe incluye «${g.name}»`, html.includes(`id="ent-${i}"`) && html.includes(`>${g.name.replace(/&/g, "&amp;")}</h1>`) === (G.length > 1));
    });
    if (G.length > 1) {
      // fila total de cada objetivo = suma exacta de sus entidades
      m.objectives.forEach((o) => {
        const sum = G.filter((g) => g.objective === o.objective).reduce((a, g) => a + g.spend, 0);
        const fmt = new Intl.NumberFormat("es-ES", { style: "currency", currency: m.currency || "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(sum);
        check(scn, `[${lvl}] informe: total ${o.objective}`, html.includes(`<b>${fmt}</b>`), fmt);
      });
      G.filter((g) => g.resultsMissing).forEach((g) => {
        const i = html.indexOf(`>${g.name}</a></b>`); const row = i < 0 ? "" : html.slice(i, html.indexOf("</tr>", i));
        check(scn, `[${lvl}] informe: «${g.name}» sin datos (no 0)`, row.includes("sin datos"), row.slice(0, 200));
      });
    }
  });
}

/* ---------- escenarios ---------- */
const COLSETS = [["campaign"], ["campaign", "adset"], ["campaign", "adset", "ad"], ["adset", "ad"], ["ad"], ["campaign", "ad"], ["adset"]];
let scn = 0;
function run(cfg, seed) {
  const R = rng(seed); const truth = makeTruth(R, { nC: cfg.nC || 1 + Math.floor(R() * 3), sameNames: cfg.sameNames });
  const built = buildFiles(R, truth, cfg); const id = `#${++scn} ${JSON.stringify({ ...cfg, dims: cfg.dims.length })}`;
  try {
    const n = built.files.length, fwd = [...Array(n).keys()], rev = [...fwd].reverse();
    const t1 = runTool(built.files, fwd), t2 = runTool(built.files, rev);
    verify(id, truth, built, cfg, t1);
    verify(id + " (orden inverso)", truth, built, cfg, t2);
    const snap = (t) => JSON.stringify(t(t("campaign").availableLevels.slice(-1)[0] || "campaign").campaigns.map((c) => [c.name, c.results, c.spend.toFixed(2), c.reach, c.linkClicks]).sort());
    check(id, "mismo resultado en cualquier orden de carga", snap(t1) === snap(t2));
  } catch (e) { check(id, "sin excepciones", false, e.stack.split("\n").slice(0, 3).join(" | ")); }
}

let seed = 1;
const ALLD = ["age", "gender", "region", "placement", "day"];
for (const cols of COLSETS) for (const emitHigher of [false, true]) for (const bdAllRows of [false, true]) for (const allBlank of [false, true])
  for (const headerAt0 of [false, true]) for (const dims of [[], ALLD])
    run({ cols, emitHigher, bdAllRows, allBlank, headerAt0, formattedFirst: seed % 2 === 0, withClicks: seed % 3 !== 0, dims }, seed++);
// desgloses "ralos" (sin clics ni CPC), como los archivos reales de CP por Región
for (const cols of COLSETS) for (const emitHigher of [false, true])
  run({ cols, emitHigher, bdAllRows: true, bdSparse: true, allBlank: false, dims: ALLD, withClicks: false, nC: 2 }, seed++);
// casos especiales
for (let k = 0; k < 20; k++) {
  run({ cols: ["campaign", "adset", "ad"], emitHigher: k % 2 === 0, bdAllRows: true, allBlank: k % 3 === 0, dims: ALLD, sameNames: true, nC: 1 + (k % 3) }, seed++);           // mismos nombres en 3 niveles
  run({ cols: ["campaign"], bdCols: ["campaign", "adset", "ad"], emitHigher: false, bdAllRows: k % 2 === 0, allBlank: false, dims: ALLD, sameNames: k % 2 === 1 }, seed++); // base campaña + desgloses a nivel anuncio
  run({ cols: ["campaign", "adset"], emitHigher: true, bdAllRows: true, allBlank: k % 2 === 0, dims: ALLD, mixed: true, nC: 2 + (k % 2) }, seed++);                         // profundidad mixta
  run({ cols: COLSETS[k % 3 + 1], emitHigher: true, bdAllRows: true, allBlank: false, dims: ALLD, missingResults: true, nC: 2 }, seed++);                                    // resultados vacíos
  run({ cols: ["campaign", "adset"], emitHigher: k % 2 === 0, bdAllRows: k % 2 === 1, bdNoImpr: true, allBlank: false, dims: ALLD, withClicks: false }, seed++);             // desgloses sin impresiones, clics solo por CPC
}
console.log(`ESCENARIOS: ${scn} · VERIFICACIONES: ${PASS + FAIL} · OK: ${PASS} · FALLOS: ${FAIL}`);
failures.forEach((f) => console.log("  ✗ " + f));
if (FAIL) process.exit(1);
