/* Búsqueda local del Centro de ayuda: sin acentos, por palabras, con peso
   en título > resumen > cuerpo. Probada en test/help.mjs. */
export const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const STOP = new Set("el la los las un una de del y o a en que como para por con mi mis tu es se lo al".split(" "));
/* Raíz simple: recorta terminaciones y unifica verbos irregulares frecuentes. */
const IRREG = { aprue: "aprob", pued: "pod", quier: "quer", cuest: "cost", muest: "most", encuent: "encont" };
export const stem = (w) => { let r = w.length > 5 ? w.slice(0, Math.max(5, w.length - 3)) : w; for (const [a, b] of Object.entries(IRREG)) if (r.startsWith(a)) r = b + r.slice(a.length); return r; };
export function search(articles, q) {
  const words = norm(q).split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !STOP.has(w)).map(stem);
  if (!words.length) return [];
  return articles.map((a) => {
    const t = norm(a.title), s = norm(a.summary), b = norm(a.body).replace(/aprue/g, "aprob");
    let score = 0, hits = 0;
    for (const w of words) { const h = (t.includes(w) ? 6 : 0) + (s.includes(w) ? 3 : 0) + (b.includes(w) ? 1 : 0); if (h) hits++; score += h; }
    return { a, score: hits === words.length ? score * 2 : score };
  }).filter((r) => r.score > 0).sort((x, y) => y.score - x.score).map((r) => r.a);
}
export const slugify = (s) => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
