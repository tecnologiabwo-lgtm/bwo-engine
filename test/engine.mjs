/* Pruebas de los motores de BWO Engine: cotizador, calculadora ROI y Sala.
   Ejecutar: node test/engine.mjs  (incluido en npm test) */
import { computeQuote, toggleItem } from "../src/lib/quote.js";
import { automation, funnel, roi } from "../src/lib/roi.js";
import { safeCalc, factRows, timing, issues, parseImport, ctaPending } from "../src/lib/sala.js";

import { DEFAULT_CATALOG as DEFAULT } from "../src/lib/catalogData.js";
let ok = 0, fail = 0;
const eq = (name, got, want) => {
  const pass = typeof want === "number" && Number.isFinite(want) ? Math.abs(got - want) < 1e-6 : JSON.stringify(got) === JSON.stringify(want);
  pass ? ok++ : (fail++, console.log(`FALLA ${name}: obtuvo ${JSON.stringify(got)}, esperaba ${JSON.stringify(want)}`));
};

/* ---------- Cotizador ---------- */
const CAT = [
  { id: "plan_a", category: "plan", price: 450, unit: "mes", meta: {} },
  { id: "plan_b", category: "plan", price: 750, unit: "mes", meta: {} },
  { id: "crm", category: "crm", price: 150, unit: "mes", meta: {} },
  { id: "setup_plan", category: "setup", price: 350, unit: "unico", meta: { for: "plan" } },
  { id: "setup_crm", category: "setup", price: 250, unit: "unico", meta: { for: "crm" } },
  { id: "cf", category: "clientify", price: 65, price_year: 468, unit: "mes", meta: {} },
  { id: "web", category: "web", price: 900, unit: "unico", meta: {} },
  { id: "hours", category: "support", price: 35, unit: "hora", meta: { recurring: true } },
  { id: "day", category: "event", price: 70, unit: "dia", meta: {} },
];
const CATS = [{ key: "plan", group: "base" }, { key: "crm", group: "base" }, { key: "web", group: "web" }, { key: "clientify" }, { key: "setup" }];

let q = computeQuote(CAT, { plan_a: { qty: 1 }, setup_plan: { qty: 1 } });
eq("plan: mensual", q.monthly, 450); eq("plan: único", q.oneTime, 350); eq("plan: primera cuota", q.firstTotal, 800); eq("plan: año 1", q.yearOne, 800 + 450 * 11);

q = computeQuote(CAT, { cf: { qty: 2, billing: "anio" } });
eq("clientify anual va a la primera cuota", q.annual, 936); eq("clientify anual no es mensual", q.monthly, 0); eq("clientify anual primera cuota", q.firstTotal, 936);
q = computeQuote(CAT, { cf: { qty: 2, billing: "mes" } });
eq("clientify mensual", q.monthly, 130);

q = computeQuote(CAT, { hours: { qty: 4 }, day: { qty: 3 } });
eq("soporte por horas es mensual", q.monthly, 140); eq("eventos por día es único", q.oneTime, 210);

q = computeQuote(CAT, { plan_a: { qty: 1 }, setup_plan: { qty: 1 }, cf: { qty: 1 } }, { setup: 10, services: 20, clientify: 50 });
eq("desc setup", q.lines.find((l) => l.id === "setup_plan").net, 315);
eq("desc servicios", q.lines.find((l) => l.id === "plan_a").net, 360);
eq("desc clientify", q.lines.find((l) => l.id === "cf").net, 32.5);
eq("ahorro total", q.discount, 35 + 90 + 32.5);

q = computeQuote(CAT, { plan_a: { qty: 1 } }, { services: 150 }, 0.21);
eq("descuento acotado a 100%", q.monthly, 0);
q = computeQuote(CAT, { plan_a: { qty: 1 }, setup_plan: { qty: 1 } }, {}, 0.21);
eq("impuesto primera cuota", q.firstTax, 168); eq("impuesto mensual", q.monthlyTotal, 544.5);
eq("ítem inexistente ignorado", computeQuote(CAT, { nope: { qty: 1 } }).lines.length, 0);
eq("cantidad 0 ignorada", computeQuote(CAT, { plan_a: { qty: 0 } }).lines.length, 0);
eq("redondeo a centavos", computeQuote([{ id: "x", category: "web", price: 0.1, unit: "unico", meta: {} }], { x: { qty: 3 } }).oneTime, 0.3);

let s = toggleItem(CAT, {}, "plan_a", CATS);
eq("al elegir plan se sugiere su setup", Object.keys(s).sort(), ["plan_a", "setup_plan"]);
s = toggleItem(CAT, s, "plan_b", CATS);
eq("planes son excluyentes", Object.keys(s).sort(), ["plan_b", "setup_plan"]);
s = toggleItem(CAT, s, "crm", CATS);
eq("CRM excluye plan y su setup", Object.keys(s).sort(), ["crm", "setup_crm"]);
s = toggleItem(CAT, s, "crm", CATS);
eq("tocar de nuevo lo quita", Object.keys(s).sort(), ["setup_crm"]);

if (DEFAULT) {
  const ids = new Set(DEFAULT.map((i) => i.id));
  eq("catálogo: ids únicos", ids.size, DEFAULT.length);
  eq("catálogo: precios válidos", DEFAULT.every((i) => i.price >= 0), true);
  eq("catálogo: setups apuntan a categorías reales", DEFAULT.filter((i) => i.meta?.for).every((i) => DEFAULT.some((j) => j.category === i.meta.for)), true);
}

/* ---------- Calculadora ROI ---------- */
const a = automation({ actions: 1500, minutes: 2, salary: 18000, weeklyHours: 40 });
eq("horas evitadas", a.hours, 50); eq("costo hora", a.rate, 18000 / 2080); eq("ahorro", a.savings, 50 * 18000 / 2080);
eq("jornada 0 cae a 40h", automation({ actions: 60, minutes: 1, salary: 2080, weeklyHours: 0 }).rate, 1);
const fb = funnel(1000, { r: 80, q: 50, w: 30 }), fu = funnel(1000, { r: 95, q: 60, w: 35 });
eq("embudo base", fb.won, 120); eq("embudo mejorado sin redondeo intermedio", fu.won, 199.5);
eq("embudo con pocos leads no se pierde", funnel(7, { r: 50, q: 50, w: 50 }).won, 0.875);
const r = roi({ setup: 1500, monthly: 100, savings: 400, sales: 5, ticket: 500, margin: 30 });
eq("beneficio mensual", r.benefit, 1050); eq("payback", r.payback, 1500 / 1050);
eq("roi 12m = (12·b − inv)/(inv + 12·costo)", r.roi12, (12 * 1050 - 1500) / (1500 + 1200));
eq("curva mes 0", r.curve[0].acc, -1500);
eq("sin beneficio no se recupera", roi({ setup: 100, monthly: 50, savings: 0, sales: 0, ticket: 0, margin: 0 }).payback, Infinity);

/* ---------- Sala ---------- */
eq("calc básico", safeCalc("60*50*50/6000"), 25);
eq("calc paréntesis", safeCalc("(2+3)*4"), 20);
eq("calc negativo", safeCalc("-3+5"), 2);
eq("calc rechaza código", safeCalc("alert(1)"), null);
eq("calc rechaza incompleto", safeCalc("2+"), null);
eq("calc división por cero", safeCalc("1/0"), null);
eq("cifra que cuadra", factRows({ facts: [{ label: "x", calc: "60*50*50/6000", claim: 25 }] })[0].ok, true);
eq("cifra que no cuadra", factRows({ facts: [{ label: "x", calc: "10", claim: 20 }] })[0].ok, false);
eq("cifra con claim 0 no divide por cero", factRows({ facts: [{ label: "x", calc: "0", claim: 0 }] })[0].ok, true);
const reel = { fmt: "reel", status: "aprobacion", date: "2026-11-20" };
eq("reel atrasado: aprobación vencía 7 días antes", timing(reel, "2026-11-14").late?.n, "Aprobación");
eq("reel a tiempo", timing(reel, "2026-11-12").late, null);
eq("reel próximo hito pronto", timing(reel, "2026-11-12").soon, true);
eq("publicado no tiene atrasos", timing({ ...reel, status: "publicado" }, "2026-12-30").late, null);
eq("CTA palabra sin valor pendiente", ctaPending({ cta: { type: "palabra" }, cta_ready: {} }).length, 2);
eq("CTA whatsapp listo", ctaPending({ cta: { type: "whatsapp", value: "x" }, cta_ready: { link: true, flow: true } }).length, 0);
eq("issues detecta decisión", issues([{ ...reel, decision: { q: "¿A o B?" }, choice: null }], "2026-11-01").some((i) => i.type === "decision"), true);

const imp = parseImport(JSON.stringify({ calendar: { id: "c", name: "Cliente", objective: "Obj" },
  pieces: [{ id: "p1", date: "2026-11-03", fmt: "reel", title: "T", dur: [30, 35], aud: "Nuevo", blocks: [{ k: "Hook", x: "Hola" }] }, { id: "p2", date: "2026-10-30", blocks: [] }] }));
eq("import: mes = primera fecha", imp.calendar.month, "2026-10-01");
eq("import: duración", [imp.pieces[0].dur_min, imp.pieces[0].dur_max], [30, 35]);
eq("import: aud → audience", imp.pieces[0].audience, "Nuevo");
eq("import: ext_id", imp.pieces[1].ext_id, "p2");
const bad = (t) => { try { parseImport(t); return "sin error"; } catch (e) { return "error"; } };
eq("import: JSON inválido", bad("{"), "error");
eq("import: pieza sin fecha", bad(JSON.stringify({ calendar: {}, pieces: [{ id: "x", blocks: [] }] })), "error");
eq("import: formato inválido", bad(JSON.stringify({ calendar: {}, pieces: [{ id: "x", date: "2026-01-01", fmt: "tiktok", blocks: [] }] })), "error");

console.log(`MOTORES BWO ENGINE · VERIFICACIONES: ${ok + fail} · OK: ${ok} · FALLOS: ${fail}`);
if (fail) process.exit(1);
