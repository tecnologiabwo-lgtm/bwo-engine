/* Lógica de la Sala de Producción — sin React, probada en test/engine.mjs. */
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
export const diffDays = (a, b) => Math.round((parse(a) - parse(b)) / 864e5);
export const todayISO = () => iso(new Date());

export const FMT = {
  reel: { n: "Reel", c: "#E6197E", video: true },
  carrusel: { n: "Carrusel", c: "#22D3C5" },
  historias: { n: "Historias", c: "#A78BFA" },
  post: { n: "Post", c: "#F5A623" },
  institucional: { n: "Historia institucional", c: "#94A3B8" },
};
export const fm = (p) => FMT[p.fmt] || { n: p.fmt || "Pieza", c: "#94A3B8" };
export const isVideo = (p) => !!fm(p).video;

export const RANK = { borrador: 0, aprobacion: 1, cambios: 1, aprobado: 2, produccion: 3, edicion: 4, listo: 5, publicado: 6 };
export const statusLabel = (s, p = {}) => ({
  borrador: "Borrador", aprobacion: "En aprobación", cambios: "Cambios pedidos", aprobado: "Aprobado",
  produccion: isVideo(p) ? "Por grabar" : "En diseño", edicion: "En edición", listo: "Listo para publicar", publicado: "Publicado",
}[s] || s);
export const STATUS_COLOR = { borrador: "#64748B", aprobacion: "#F5A623", cambios: "#E6197E", aprobado: "#22D3C5", produccion: "#A78BFA", edicion: "#A78BFA", listo: "#34D399", publicado: "#34D399" };
export const steps = (p) => (isVideo(p) ? ["aprobacion", "aprobado", "produccion", "edicion", "listo", "publicado"] : ["aprobacion", "aprobado", "produccion", "listo", "publicado"]);

/* Planificación inversa: hitos que cada pieza debe cumplir antes de su fecha */
export const milestones = (p) => (isVideo(p)
  ? [{ rank: 2, d: -7, n: "Aprobación" }, { rank: 4, d: -3, n: "Grabación entregada" }, { rank: 5, d: -1, n: "Edición lista" }, { rank: 6, d: 0, n: "Publicación" }]
  : [{ rank: 2, d: -4, n: "Aprobación" }, { rank: 5, d: -1, n: "Diseño listo" }, { rank: 6, d: 0, n: "Publicación" }]);

export function timing(p, today = todayISO()) {
  const r = RANK[p.status] ?? 1;
  let late = null, next = null;
  for (const m of milestones(p)) {
    if (r >= m.rank) continue;
    const due = addDays(p.date, m.d);
    if (due < today && !late) late = { ...m, due };
    if (!next) next = { ...m, due };
  }
  return { late, next, soon: !late && !!next && diffDays(next.due, today) <= 2 };
}

/* ---- Evaluador aritmético seguro (reemplaza Function()) ----
   Solo números, + - * / y paréntesis. Devuelve null si la expresión no es válida. */
export function safeCalc(expr) {
  const s = String(expr ?? "").replace(/\s+/g, "");
  if (!s || !/^[0-9.+\-*/()]+$/.test(s)) return null;
  let i = 0;
  const peek = () => s[i];
  function number() {
    const m = /^\d*\.?\d+/.exec(s.slice(i));
    if (!m) throw 0;
    i += m[0].length; return parseFloat(m[0]);
  }
  function factor() {
    if (peek() === "-") { i++; return -factor(); }
    if (peek() === "+") { i++; return factor(); }
    if (peek() === "(") { i++; const v = expr_(); if (peek() !== ")") throw 0; i++; return v; }
    return number();
  }
  function term() { let v = factor(); while (peek() === "*" || peek() === "/") { const op = s[i++]; const w = factor(); v = op === "*" ? v * w : v / w; } return v; }
  function expr_() { let v = term(); while (peek() === "+" || peek() === "-") { const op = s[i++]; const w = term(); v = op === "+" ? v + w : v - w; } return v; }
  try { const v = expr_(); return i === s.length && Number.isFinite(v) ? v : null; } catch { return null; }
}

export function factRows(p) {
  return (p.facts || []).map((f) => {
    const v = safeCalc(f.calc);
    const claim = Number(f.claim);
    const ok = v != null && Number.isFinite(claim) && (claim === 0 ? Math.abs(v) < 1e-9 : Math.abs(v - claim) / Math.abs(claim) < 0.03);
    return { ...f, v, ok };
  });
}

export function ctaChecks(p) {
  const c = p.cta || {};
  if (c.type === "palabra") {
    const list = [{ k: "word", n: c.value ? `Palabra clave definida: ${c.value}` : "Definir la palabra clave", auto: true, ok: !!c.value }];
    if (c.resource) list.push({ k: "resource", n: `Recurso listo: ${c.resource}` });
    list.push({ k: "flow", n: "Respuesta automática activa en Clientify" });
    return list;
  }
  if (c.type === "whatsapp") return [{ k: "link", n: `Enlace de WhatsApp de ventas configurado («${c.value || "—"}»)` }, { k: "flow", n: "Ruteo del lead en Clientify" }];
  return [];
}
export const ctaPending = (p) => ctaChecks(p).filter((x) => (x.auto ? !x.ok : !(p.cta_ready || {})[x.k]));

export function issues(list, today = todayISO()) {
  const out = [];
  for (const p of list) {
    const t = timing(p, today);
    if (t.late) out.push({ p, sev: "late", type: "plazo", t: `${t.late.n} vencida`, d: `Debía estar el ${t.late.due} · hoy está «${statusLabel(p.status, p)}»` });
    else if (t.soon && RANK[p.status] < 6) out.push({ p, sev: "warn", type: "plazo", t: `${t.next.n} vence pronto`, d: `Fecha límite: ${t.next.due}` });
    if (p.decision?.q && p.choice == null) out.push({ p, sev: "warn", type: "decision", t: "Decisión pendiente del cliente", d: p.decision.q });
    for (const g of p.gaps || []) out.push({ p, sev: "info", type: "vacio", t: "Dato faltante en el guion", d: g });
    const cta = ctaPending(p);
    if (cta.length && p.status !== "publicado") out.push({ p, sev: diffDays(p.date, today) <= 3 ? "late" : "warn", type: "cta", t: "CTA sin preparar", d: cta.map((x) => x.n).join(" · ") });
    for (const f of factRows(p)) if (!f.ok) out.push({ p, sev: "late", type: "dato", t: "Cifra que no cuadra", d: `${f.label}: el guion dice ${f.claim} ${f.unit || ""}` });
  }
  return out;
}

export const blocksDone = (p) => (p.blocks || []).filter((_, i) => (p.checks || {})[i]).length;

/* ---- Importación del JSON de la Fábrica (formato heredado) ---- */
export function parseImport(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error("El texto no es un JSON válido. Revisa comas y comillas."); }
  const c = data?.calendar, ps = data?.pieces;
  if (!c || !Array.isArray(ps) || !ps.length) throw new Error("Falta «calendar» o la lista «pieces» está vacía.");
  const bad = ps.find((p) => !p.id || !/^\d{4}-\d{2}-\d{2}$/.test(p.date || "") || !Array.isArray(p.blocks));
  if (bad) throw new Error(`La pieza «${bad.title || bad.id || "sin id"}» necesita id, date (AAAA-MM-DD) y blocks.`);
  const bad2 = ps.find((p) => p.fmt && !FMT[p.fmt]);
  if (bad2) throw new Error(`Formato «${bad2.fmt}» no válido en «${bad2.title || bad2.id}». Usa: ${Object.keys(FMT).join(", ")}.`);
  const first = [...ps].map((p) => p.date).sort()[0];
  const month = `${first.slice(0, 7)}-01`;
  const calendar = { month, title: c.name || "", objective: c.objective || null, summary: c.summary || null, channels: c.channels || null, arc: c.arc || [], milestones: c.milestones || [] };
  const pieces = ps.map((p) => ({
    ext_id: String(p.id), date: p.date, fmt: p.fmt || "reel", title: p.title || "", sub: p.sub || null,
    series: p.series || null, num: p.num ?? null, audience: p.aud || p.audience || null, pain: p.pain || null,
    intent: p.intent || null, tone: p.tone || null, visual: p.visual || null, setup: p.setup || null, props: p.props || null,
    dur_min: p.dur?.[0] ?? null, dur_max: p.dur?.[1] ?? null,
    blocks: (p.blocks || []).map((b) => ({ k: b.k || "", t: b.t || "", x: b.x || "", v: b.v || "", s: b.s || "" })),
    cta: p.cta || {}, decision: p.decision || null, gaps: p.gaps || [], facts: p.facts || [],
  }));
  return { calendar, pieces };
}

export const EMPTY_PIECE = {
  date: "", fmt: "reel", title: "", sub: "", series: "", num: null, audience: "", pain: "", intent: "", tone: "",
  visual: "", setup: "", props: "", dur_min: null, dur_max: null,
  blocks: [{ k: "Hook", t: "0–3 s", x: "", v: "", s: "" }], cta: { type: "", value: "", resource: "" },
  decision: null, gaps: [], facts: [],
};

/** Plantillas de estructura para arrancar un guion con un clic. */
export const STRUCTURES = {
  reel: [{ k: "Hook", t: "0–3 s" }, { k: "Problema", t: "3–10 s" }, { k: "Desarrollo", t: "10–25 s" }, { k: "CTA", t: "25–30 s" }],
  carrusel: [{ k: "Portada" }, { k: "Lámina 2" }, { k: "Lámina 3" }, { k: "Lámina 4" }, { k: "Cierre + CTA" }],
  historias: [{ k: "Historia 1 · Gancho" }, { k: "Historia 2 · Contexto" }, { k: "Historia 3 · Encuesta/Sticker" }, { k: "Historia 4 · CTA" }],
  post: [{ k: "Visual" }, { k: "Copy" }, { k: "CTA" }],
  institucional: [{ k: "Apertura" }, { k: "Mensaje" }, { k: "Cierre" }],
};
