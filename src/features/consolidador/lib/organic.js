/* ============================================================
   ORGÁNICO — ritmo de publicación semanal
   Cuenta publicaciones de feed e historias por semana (lunes a
   domingo) a partir de los CSV de publicaciones de Meta. Solo
   cuenta lo que viene en los archivos: si no se cargó el CSV de
   historias (o el de feed), esa columna queda «sin datos», no 0.
   ============================================================ */

const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Clasifica el «Tipo de publicación» de Meta.
 *  kind: "story" | "feed" | "other" · format: reel | carrusel | imagen | historia | otro */
export function classifyPost(type) {
  const t = String(type || "").toLowerCase();
  if (t.includes("historia") || t.includes("story")) return { kind: "story", format: "historia" };
  if (t.includes("reel")) return { kind: "feed", format: "reel" };
  if (t.includes("secuencia") || t.includes("carrusel") || t.includes("carousel") || t.includes("álbum") || t.includes("album")) return { kind: "feed", format: "carrusel" };
  if (t.includes("imagen") || t.includes("foto") || t.includes("image") || t.includes("photo")) return { kind: "feed", format: "imagen" };
  if (t.includes("video") || t.includes("vídeo")) return { kind: "feed", format: "video" };
  return { kind: "other", format: "otro" };
}

const isoDay = (d) => d.toISOString().slice(0, 10);
const parseDay = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
};
/** Lunes de la semana (UTC) del día dado. */
export function mondayOf(d) {
  const x = new Date(d.getTime());
  const dow = (x.getUTCDay() + 6) % 7; // 0 = lunes
  x.setUTCDate(x.getUTCDate() - dow);
  return x;
}
const fmt = (d) => `${d.getUTCDate()} ${MES[d.getUTCMonth()]}`;

/**
 * Agrupa las publicaciones por semana.
 * @param posts  [{ type, date: "YYYY-MM-DD" }]
 * @param period opcional { from, to } (YYYY-MM-DD) — el rango del reporte;
 *               si no se da, se usa el rango de fechas de las publicaciones.
 * @returns null si no hay publicaciones con fecha; si no:
 *   { weeks: [{ key, from, to, label, feed, stories, other, total, formats, partial }],
 *     totals, hasFeed, hasStories, hasOther, undated, period, avgFeed, avgStories }
 */
export function weeklyPosts(posts, period = null) {
  const list = (posts || []).map((p) => ({ ...p, ...classifyPost(p.type), d: parseDay(p.date) }));
  const dated = list.filter((p) => p.d);
  if (!dated.length) return null;
  const hasFeed = list.some((p) => p.kind === "feed");
  const hasStories = list.some((p) => p.kind === "story");
  const hasOther = list.some((p) => p.kind === "other");

  const ds = dated.map((p) => isoDay(p.d)).sort();
  let from = parseDay(period?.from) || parseDay(ds[0]);
  let to = parseDay(period?.to) || parseDay(ds[ds.length - 1]);
  // si alguna publicación cae fuera del rango indicado, el rango se amplía:
  // nunca se descarta una publicación que sí está en el archivo
  if (parseDay(ds[0]) < from) from = parseDay(ds[0]);
  if (parseDay(ds[ds.length - 1]) > to) to = parseDay(ds[ds.length - 1]);

  const weeks = [];
  for (let m = mondayOf(from); m <= to; m = new Date(m.getTime() + 7 * 86400000)) {
    const sun = new Date(m.getTime() + 6 * 86400000);
    const wf = m < from ? from : m;           // recortado al periodo
    const wt = sun > to ? to : sun;
    const days = Math.round((wt - wf) / 86400000) + 1;
    weeks.push({
      key: isoDay(m), from: isoDay(wf), to: isoDay(wt),
      label: wf.getUTCMonth() === wt.getUTCMonth() ? `${wf.getUTCDate()}–${fmt(wt)}` : `${fmt(wf)} – ${fmt(wt)}`,
      days, partial: days < 7,
      feed: 0, stories: 0, other: 0, total: 0,
      formats: { reel: 0, carrusel: 0, imagen: 0, video: 0 },
    });
  }
  const byKey = new Map(weeks.map((w) => [w.key, w]));
  dated.forEach((p) => {
    const w = byKey.get(isoDay(mondayOf(p.d)));
    if (!w) return;
    w.total += 1;
    if (p.kind === "story") w.stories += 1;
    else if (p.kind === "feed") { w.feed += 1; if (p.format in w.formats) w.formats[p.format] += 1; }
    else w.other += 1;
  });
  const totals = weeks.reduce((a, w) => {
    a.feed += w.feed; a.stories += w.stories; a.other += w.other; a.total += w.total;
    Object.keys(w.formats).forEach((k) => (a.formats[k] += w.formats[k]));
    return a;
  }, { feed: 0, stories: 0, other: 0, total: 0, formats: { reel: 0, carrusel: 0, imagen: 0, video: 0 } });
  // promedio por semana completa equivalente (días / 7) — evita que una
  // semana de 2 días al borde del mes distorsione el promedio
  const spanDays = Math.round((to - from) / 86400000) + 1;
  const wEq = spanDays / 7;
  return {
    weeks, totals, hasFeed, hasStories, hasOther,
    undated: list.length - dated.length,
    period: { from: isoDay(from), to: isoDay(to), days: spanDays },
    avgFeed: hasFeed ? totals.feed / wEq : null,
    avgStories: hasStories ? totals.stories / wEq : null,
  };
}
