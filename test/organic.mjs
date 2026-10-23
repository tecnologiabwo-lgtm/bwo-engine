/* Ritmo de publicación semanal: feed vs historias por semana (lun–dom).
   Verdad calculada por fuerza bruta, independiente de lib/organic.js. */
import { weeklyPosts, classifyPost } from "../src/modules/consolidador/lib/organic.js";

let PASS = 0, FAIL = 0; const failures = [];
const check = (scn, label, cond, detail = "") => { if (cond) PASS++; else { FAIL++; if (failures.length < 40) failures.push(`[${scn}] ${label} ${detail}`); } };
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const TYPES = ["Historia de Instagram", "Reel de Instagram", "Secuencia de Instagram", "Imagen de Instagram"];
const day = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
// lunes de la semana, calculado distinto: retroceder día a día hasta getUTCDay()==1
function mondayBrute(iso) { let d = new Date(iso + "T00:00:00Z"); while (d.getUTCDay() !== 1) d = new Date(d.getTime() - 86400000); return d.toISOString().slice(0, 10); }

/* --- clasificación --- */
check("tipos", "historia", classifyPost("Historia de Instagram").kind === "story");
check("tipos", "reel", classifyPost("Reel de Instagram").format === "reel");
check("tipos", "carrusel", classifyPost("Secuencia de Instagram").format === "carrusel");
check("tipos", "imagen", classifyPost("Imagen de Instagram").format === "imagen");
check("tipos", "desconocido", classifyPost("Algo raro").kind === "other");

/* --- septiembre 2026 (empieza martes): semanas recortadas al periodo --- */
{
  const posts = [{ type: TYPES[1], date: "2026-09-01" }, { type: TYPES[0], date: "2026-09-06" }, { type: TYPES[0], date: "2026-09-07" }, { type: TYPES[2], date: "2026-09-30" }];
  const w = weeklyPosts(posts, { from: "2026-09-01", to: "2026-09-30" });
  check("sep", "5 semanas", w.weeks.length === 5, w.weeks.length);
  check("sep", "1ª semana 1–6 sep, 6 días", w.weeks[0].from === "2026-09-01" && w.weeks[0].to === "2026-09-06" && w.weeks[0].days === 6 && w.weeks[0].partial);
  check("sep", "1ª semana: 1 feed + 1 historia", w.weeks[0].feed === 1 && w.weeks[0].stories === 1);
  check("sep", "2ª semana empieza lunes 7", w.weeks[1].from === "2026-09-07" && w.weeks[1].stories === 1 && !w.weeks[1].partial);
  check("sep", "última semana 28–30, 3 días", w.weeks[4].from === "2026-09-28" && w.weeks[4].days === 3 && w.weeks[4].feed === 1);
  check("sep", "semanas vacías en 0 (hay archivo)", w.weeks[2].total === 0 && w.weeks[3].total === 0);
  check("sep", "promedio = total / (30/7)", Math.abs(w.avgFeed - 2 / (30 / 7)) < 1e-9);
}
/* --- solo historias: el feed queda sin datos, no 0 --- */
{
  const w = weeklyPosts([{ type: TYPES[0], date: "2026-08-03" }]);
  check("solo historias", "hasFeed=false", !w.hasFeed && w.avgFeed === null && w.hasStories);
}
/* --- publicación fuera del periodo: amplía el rango, no se pierde --- */
{
  const w = weeklyPosts([{ type: TYPES[1], date: "2026-08-31" }, { type: TYPES[0], date: "2026-09-10" }], { from: "2026-09-01", to: "2026-09-30" });
  check("fuera de rango", "no se descarta", w.totals.total === 2 && w.period.from === "2026-08-31");
}
/* --- sin fecha --- */
{
  const w = weeklyPosts([{ type: TYPES[1], date: null }, { type: TYPES[0], date: "2026-09-10" }]);
  check("sin fecha", "contada aparte", w.undated === 1 && w.totals.total === 1);
  check("sin fecha", "todo sin fecha → null", weeklyPosts([{ type: TYPES[1], date: null }]) === null);
}

/* --- fuzz --- */
let scn = 0;
for (let seed = 1; seed <= 400; seed++) {
  const R = rng(seed); scn++;
  const y = 2025 + Math.floor(R() * 2), m = 1 + Math.floor(R() * 12);
  const span = 5 + Math.floor(R() * 90);
  const start = day(y, m, 1 + Math.floor(R() * 28));
  const end = new Date(new Date(start + "T00:00:00Z").getTime() + (span - 1) * 86400000).toISOString().slice(0, 10);
  const n = Math.floor(R() * 120);
  const onlyKinds = R() < 0.2 ? [TYPES[0]] : R() < 0.2 ? TYPES.slice(1) : TYPES;
  const posts = Array.from({ length: n }, () => {
    const off = Math.floor(R() * span);
    return { type: onlyKinds[Math.floor(R() * onlyKinds.length)], date: new Date(new Date(start + "T00:00:00Z").getTime() + off * 86400000).toISOString().slice(0, 10) };
  });
  const w = weeklyPosts(posts, { from: start, to: end });
  const id = `#${scn}`;
  if (!n) { check(id, "sin publicaciones → null", w === null); continue; }
  check(id, "total = publicaciones", w.totals.total === n, `${w.totals.total} vs ${n}`);
  check(id, "suma semanas = total", w.weeks.reduce((a, x) => a + x.total, 0) === n);
  check(id, "feed + historias + otras = total", w.weeks.every((x) => x.feed + x.stories + x.other === x.total));
  check(id, "formatos suman el feed", w.weeks.every((x) => Object.values(x.formats).reduce((a, b) => a + b, 0) === x.feed));
  check(id, "días cubiertos = periodo", w.weeks.reduce((a, x) => a + x.days, 0) === span, `${w.weeks.reduce((a, x) => a + x.days, 0)} vs ${span}`);
  check(id, "semanas contiguas", w.weeks.every((x, i) => i === 0 || (new Date(x.from) - new Date(w.weeks[i - 1].to)) === 86400000));
  check(id, "semanas interiores empiezan lunes", w.weeks.slice(1).every((x) => new Date(x.from + "T00:00:00Z").getUTCDay() === 1));
  // verdad por fuerza bruta
  const truth = new Map();
  posts.forEach((p) => { const k = mondayBrute(p.date); const t = truth.get(k) || { s: 0, f: 0 }; if (p.type === TYPES[0]) t.s++; else t.f++; truth.set(k, t); });
  w.weeks.forEach((x) => { const t = truth.get(x.key) || { s: 0, f: 0 }; check(id, `semana ${x.key}`, x.stories === t.s && x.feed === t.f, `${x.feed}/${x.stories} vs ${t.f}/${t.s}`); });
  check(id, "hasFeed/hasStories", w.hasFeed === posts.some((p) => p.type !== TYPES[0]) && w.hasStories === posts.some((p) => p.type === TYPES[0]));
}
console.log(`ORGÁNICO SEMANAL · VERIFICACIONES: ${PASS + FAIL} · OK: ${PASS} · FALLOS: ${FAIL}`);
failures.forEach((f) => console.log("  ✗ " + f));
if (FAIL) process.exit(1);
