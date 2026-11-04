/* ============================================================
   VIZ v2.1 — agregaciones puras (intervalos, heatmap, sankey)
   Sin dependencia de React; verificable en Node.
   Regla: solo agrega lo que existe; nunca inventa buckets vacíos.
   ============================================================ */

export const INTERVALS = { day: "Día", month: "Mes", quarter: "Trimestre", semester: "Semestre", year: "Año" };
const M2 = (n) => String(n).padStart(2, "0");
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/* clave de bucket a partir de una fecha ISO (YYYY-MM-DD) */
export function bucketKey(dateStr, mode) {
  const [y, m] = dateStr.split("-").map(Number);
  if (mode === "year") return `${y}`;
  if (mode === "semester") return `${y}-S${m <= 6 ? 1 : 2}`;
  if (mode === "quarter") return `${y}-T${Math.floor((m - 1) / 3) + 1}`;
  if (mode === "month") return `${y}-${M2(m)}`;
  return dateStr;
}
export function bucketLabel(key, mode) {
  if (mode === "day") return key.slice(5);
  if (mode === "month") { const [y, m] = key.split("-"); return `${MESES[+m - 1]} ${y.slice(2)}`; }
  if (mode === "year") return key;
  return key.replace("-", " "); // 2026-T3 → 2026 T3
}

/* días de calendario que TEORICAMENTE tiene un bucket (para medir cobertura) */
export function bucketSpanDays(key, mode) {
  if (mode === "day") return 1;
  const [y] = key.split("-").map(Number);
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  if (mode === "year") return leap ? 366 : 365;
  if (mode === "semester") { const s = +key.split("S")[1]; return s === 1 ? (leap ? 182 : 181) : 184; }
  if (mode === "quarter") { const q = +key.split("T")[1]; const d = { 1: leap ? 91 : 90, 2: 91, 3: 92, 4: 92 }; return d[q]; }
  if (mode === "month") { const m = +key.split("-")[1]; return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]; }
  return 1;
}

/* agrupa filas diarias {date, ...campos} en buckets, sumando los campos indicados */
export function bucketRows(rows, mode, fields = ["spend", "results", "impressions", "reach"]) {
  const map = new Map();
  rows.forEach((r) => {
    const dateStr = r.date || r.label; // acepta filas con "date" o con "label" (dims.day)
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return;
    const k = bucketKey(dateStr, mode);
    const b = map.get(k) || { key: k, _dates: new Set() };
    fields.forEach((f) => (b[f] = (b[f] || 0) + (r[f] || 0)));
    b._dates.add(dateStr);
    map.set(k, b);
  });
  return [...map.values()]
    .map((b) => {
      const daysWith = b._dates.size;
      const span = bucketSpanDays(b.key, mode);
      return {
        ...b, label: bucketLabel(b.key, mode),
        daysWith, span,
        partial: mode !== "day" && daysWith < span,
        coverage: span ? daysWith / span : 1,
        cpl: b.results ? b.spend / b.results : null,
        cpm: b.impressions ? (b.spend / b.impressions) * 1000 : null,
        frequency: b.reach ? b.impressions / b.reach : null,
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

/* matriz de calor por día de semana × semana del período */
const DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export function heatmap(rows, field = "results") {
  const valid = rows.filter((r) => r.date);
  if (!valid.length) return null;
  const dates = valid.map((r) => r.date).sort();
  const first = new Date(dates[0] + "T00:00:00Z");
  // lunes de la semana del primer dato, como ancla para numerar semanas
  const anchor = new Date(first); anchor.setUTCDate(anchor.getUTCDate() - ((first.getUTCDay() + 6) % 7));
  const cells = valid.map((r) => {
    const d = new Date(r.date + "T00:00:00Z");
    const dow = (d.getUTCDay() + 6) % 7; // 0 = lunes
    const week = Math.floor((d - anchor) / (7 * 86400000));
    return { date: r.date, dow, week, value: r[field] || 0 };
  });
  const weeks = [...new Set(cells.map((c) => c.week))].sort((a, b) => a - b);
  const max = Math.max(0, ...cells.map((c) => c.value));
  const byDow = DOW.map((name, i) => {
    const v = cells.filter((c) => c.dow === i);
    const sum = v.reduce((a, c) => a + c.value, 0);
    return { dow: i, name, sum, avg: v.length ? sum / v.length : 0, n: v.length };
  });
  return { cells, weeks, max, dowNames: DOW, byDow };
}

/* datos para diagrama Sankey: objetivo → campaña → ubicación/región (flujo = resultados) */
export function sankey(campaigns, leafDim = "placement") {
  const nodes = []; const idx = new Map();
  const add = (name, depth) => {
    if (!idx.has(name)) { idx.set(name, nodes.length); nodes.push({ name, depth }); }
    else nodes[idx.get(name)].depth = Math.max(nodes[idx.get(name)].depth, depth);
    return idx.get(name);
  };
  const GENDER_ES = { male: "Hombres", female: "Mujeres", unknown: "N/D" };
  const labelFn = (l) => leafDim === "gender" ? (GENDER_ES[l.toLowerCase()] || l) : l;
  const links = [];
  campaigns.filter((c) => c.results > 0).forEach((c) => {
    const o = add(c.objective, 0); const cc = add(c.name, 1);
    links.push({ source: o, target: cc, value: c.results });
    const leaf = c.dims[leafDim];
    if (leaf) leaf.filter((p) => p.results > 0).forEach((p) => {
      links.push({ source: cc, target: add(labelFn(p.label), 2), value: p.results });
    });
  });
  const maxDepth = Math.max(0, ...nodes.map((n) => n.depth));
  return { nodes, links, maxDepth };
}
