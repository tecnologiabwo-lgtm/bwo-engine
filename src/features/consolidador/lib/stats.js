/* Histórico mensual del Consolidador — funciones puras (probadas en test/stats.mjs).
 *
 * 1) splitByMonth(model, series): reparte lo cargado en meses calendario.
 *    - Pauta: si la entidad trae desglose diario (dims.day) se suma por mes exacto.
 *      Si no, se prorratea por días del período y la fila queda marcada prorated.
 *      Seguidores ganados (igFollows) no viene por día: se reparte según la inversión.
 *    - Orgánico: cada serie diaria se suma por mes. Claves fb* → Facebook.
 * 2) rollup(ads, organic, granularity): agrega meses guardados en mes, trimestre o año,
 *    con comparación contra el período anterior y el mismo período del año anterior.
 *    El alcance mensual NO es sumable en sentido estricto (las personas se repiten):
 *    se informa como «suma de alcances mensuales». */

const pad = (n) => String(n).padStart(2, "0");
export const monthOf = (iso) => `${String(iso).slice(0, 7)}-01`;
const daysInMonth = (m) => { const [y, mo] = m.split("-").map(Number); return new Date(y, mo, 0).getDate(); };
const toDate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const num = (v) => (Number.isFinite(+v) ? +v : 0);
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Días del período [from,to] que caen en cada mes. */
export function daysPerMonth(from, to) {
  const out = {};
  if (!from || !to || from > to) return out;
  for (let d = toDate(from); iso(d) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    const m = monthOf(iso(d)); out[m] = (out[m] || 0) + 1;
  }
  return out;
}

export function splitByMonth(model, series = {}) {
  const warnings = [];
  const ads = new Map();
  const add = (row) => {
    const k = `${row.month}|${row.level}|${row.entity}|${row.objective}`;
    const cur = ads.get(k);
    if (!cur) { ads.set(k, row); return; }
    ["spend", "results", "impressions", "reach", "ig_follows", "days"].forEach((f) => (cur[f] = num(cur[f]) + num(row[f])));
    cur.prorated = cur.prorated || row.prorated;
  };
  for (const c of model?.campaigns || []) {
    const base = { level: c.level || model.level || "campaign", entity: c.name || "(sin nombre)", objective: c.objective || "", result_type: c.resultType || null };
    const day = (c.dims?.day || []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d.label)));
    if (day.length) {
      const by = {};
      for (const d of day) {
        const m = monthOf(d.label);
        const b = by[m] || (by[m] = { spend: 0, results: 0, impressions: 0, reach: 0, days: 0 });
        b.spend += num(d.spend); b.results += num(d.results); b.impressions += num(d.impressions); b.reach += num(d.reach); b.days++;
      }
      const totalSpend = Object.values(by).reduce((a, b) => a + b.spend, 0) || 1;
      for (const [m, b] of Object.entries(by)) {
        add({ ...base, month: m, spend: r2(b.spend), results: r2(b.results), impressions: Math.round(b.impressions), reach: Math.round(b.reach),
          ig_follows: r2(num(c.igFollows) * (b.spend / totalSpend)), days: b.days, prorated: false });
      }
      // Si el desglose diario no cubre todo (filas sin fecha), se avisa
      const daySpend = Object.values(by).reduce((a, b) => a + b.spend, 0);
      if (num(c.spend) - daySpend > 0.5) warnings.push(`«${base.entity}»: el desglose diario suma ${r2(daySpend)} de ${r2(num(c.spend))}; se guarda lo diario.`);
      continue;
    }
    const p = c.period;
    if (!p?.from || !p?.to) { warnings.push(`«${base.entity}» no tiene fechas: no se puede ubicar en un mes.`); continue; }
    const dpm = daysPerMonth(p.from, p.to);
    const total = Object.values(dpm).reduce((a, b) => a + b, 0);
    const months = Object.keys(dpm);
    if (months.length > 1) warnings.push(`«${base.entity}» abarca ${months.length} meses sin desglose diario: se reparte por días (estimado).`);
    for (const [m, n] of Object.entries(dpm)) {
      const f = n / total;
      add({ ...base, month: m, spend: r2(num(c.spend) * f), results: r2(num(c.results) * f), impressions: Math.round(num(c.impressions) * f),
        reach: Math.round(num(c.reach) * f), ig_follows: r2(num(c.igFollows) * f), days: n, prorated: months.length > 1 });
    }
  }

  const org = new Map();
  for (const [key, rows] of Object.entries(series || {})) {
    if (!Array.isArray(rows) || !rows.length) continue;
    const fb = /^fb[A-Z]/.test(key);
    const platform = fb ? "facebook" : "instagram";
    const metric = fb ? key[2].toLowerCase() + key.slice(3) : key;
    for (const r of rows) {
      if (!/^\d{4}-\d{2}-\d{2}/.test(String(r.date))) continue;
      const m = monthOf(r.date), k = `${m}|${platform}|${metric}`;
      const cur = org.get(k) || { month: m, platform, metric, value: 0, days: 0 };
      cur.value += num(r.value); cur.days++; org.set(k, cur);
    }
  }
  const organic = [...org.values()].map((o) => ({ ...o, value: r2(o.value) }));
  const months = [...new Set([...[...ads.values()].map((a) => a.month), ...organic.map((o) => o.month)])].sort();
  for (const m of months) {
    const dm = daysInMonth(m);
    const covered = Math.max(0, ...organic.filter((o) => o.month === m).map((o) => o.days), ...[...ads.values()].filter((a) => a.month === m && !a.prorated).map((a) => a.days || 0));
    if (covered && covered < dm) warnings.push(`${m.slice(0, 7)}: los datos cubren ${covered} de ${dm} días (mes incompleto).`);
  }
  return { months, ads: [...ads.values()], organic, warnings };
}

/* ---------- Revisión por período ---------- */
export const periodKey = (month, g) => {
  const [y, m] = month.split("-").map(Number);
  return g === "year" ? `${y}` : g === "quarter" ? `${y}-T${Math.ceil(m / 3)}` : `${y}-${pad(m)}`;
};
export const periodLabel = (key) => {
  const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  if (/^\d{4}$/.test(key)) return key;
  if (/T\d$/.test(key)) return `T${key.slice(-1)} ${key.slice(0, 4)}`;
  return `${MES[+key.slice(5, 7) - 1]} ${key.slice(0, 4)}`;
};
const prevKey = (key) => {
  if (/^\d{4}$/.test(key)) return String(+key - 1);
  if (/T\d$/.test(key)) { const y = +key.slice(0, 4), q = +key.slice(-1); return q === 1 ? `${y - 1}-T4` : `${y}-T${q - 1}`; }
  const y = +key.slice(0, 4), m = +key.slice(5, 7); return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
};
const yoyKey = (key) => (/^\d{4}$/.test(key) ? null : `${+key.slice(0, 4) - 1}${key.slice(4)}`);

const emptyTotals = () => ({ spend: 0, results: 0, impressions: 0, reach: 0, ig_follows: 0, months: new Set(), prorated: false, byObjective: {}, entities: {}, organic: {} });

export function rollup(ads = [], organic = [], granularity = "month") {
  const map = new Map();
  const get = (k) => map.get(k) || (map.set(k, emptyTotals()), map.get(k));
  for (const a of ads) {
    const t = get(periodKey(a.month, granularity));
    t.spend += num(a.spend); t.results += num(a.results); t.impressions += num(a.impressions); t.reach += num(a.reach); t.ig_follows += num(a.ig_follows);
    t.months.add(a.month); t.prorated = t.prorated || !!a.prorated;
    const o = t.byObjective[a.objective || "—"] || (t.byObjective[a.objective || "—"] = { spend: 0, results: 0 });
    o.spend += num(a.spend); o.results += num(a.results);
    const e = t.entities[a.entity] || (t.entities[a.entity] = { entity: a.entity, objective: a.objective, spend: 0, results: 0, impressions: 0 });
    e.spend += num(a.spend); e.results += num(a.results); e.impressions += num(a.impressions);
  }
  for (const o of organic) {
    const t = get(periodKey(o.month, granularity));
    t.months.add(o.month);
    const k = `${o.platform}.${o.metric}`; t.organic[k] = (t.organic[k] || 0) + num(o.value);
  }
  const finish = (t) => t && ({
    spend: r2(t.spend), results: r2(t.results), impressions: Math.round(t.impressions), reach: Math.round(t.reach), ig_follows: r2(t.ig_follows),
    cpl: t.results ? r2(t.spend / t.results) : null, cpm: t.impressions ? r2((t.spend / t.impressions) * 1000) : null,
    months: t.months.size, prorated: t.prorated,
    byObjective: Object.fromEntries(Object.entries(t.byObjective).map(([k, v]) => [k, { ...v, spend: r2(v.spend), results: r2(v.results), cpl: v.results ? r2(v.spend / v.results) : null }])),
    entities: Object.values(t.entities).map((e) => ({ ...e, spend: r2(e.spend), cpl: e.results ? r2(e.spend / e.results) : null })).sort((a, b) => b.spend - a.spend),
    organic: Object.fromEntries(Object.entries(t.organic).map(([k, v]) => [k, r2(v)])),
  });
  const keys = [...map.keys()].sort();
  const done = new Map(keys.map((k) => [k, finish(map.get(k))]));
  const delta = (a, b) => (b == null || a == null || b === 0 ? null : (a - b) / Math.abs(b));
  return keys.map((key) => {
    const cur = done.get(key), prev = done.get(prevKey(key)) || null, yoy = yoyKey(key) ? done.get(yoyKey(key)) || null : null;
    const cmp = (ref) => ref && ({ spend: delta(cur.spend, ref.spend), results: delta(cur.results, ref.results), cpl: delta(cur.cpl, ref.cpl), impressions: delta(cur.impressions, ref.impressions) });
    const expected = granularity === "year" ? 12 : granularity === "quarter" ? 3 : 1;
    return { key, label: periodLabel(key), ...cur, complete: cur.months >= expected, vsPrev: cmp(prev), vsYear: cmp(yoy), prevKey: prev ? prevKey(key) : null };
  });
}
