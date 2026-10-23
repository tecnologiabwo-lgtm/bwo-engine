import { resolveSeries } from "../src/modules/consolidador/lib/series.js";
let PASS = 0, FAIL = 0; const fails = [];
const ok = (scn, l, c, d = "") => { if (c) PASS++; else { FAIL++; if (fails.length < 30) fails.push(`[${scn}] ${l} ${d}`); } };
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const days = (month, n) => Array.from({ length: n }, (_, i) => `2026-${month}-${String(i + 1).padStart(2, "0")}`);
const serie = (R, ds, scale) => ds.map((date) => ({ date, value: Math.floor(R() * scale) }));
const sum = (rows) => (rows || []).reduce((a, r) => a + r.value, 0);
const file = (name, key, label, rows) => ({ name, key, label, rows });

// ambiguas: mismo título en IG y FB · explícitas: el título dice la plataforma
const AMBIG = [["views", "Visualizaciones"], ["interactions", "Interacciones con el contenido"], ["reach", "Alcance"], ["viewers", "Espectadores"]];
const FBK = { views: "fbViews", interactions: "fbInteractions", reach: "fbReach", viewers: "fbViewers" };

for (let seed = 1; seed <= 400; seed++) {
  const R = rng(seed), scn = `#${seed}`;
  const fbIsBare = R() < 0.5;                     // patrón de nombres del navegador: FB sin sufijo (o al revés)
  const name = (base, pl) => (pl === "fb") === fbIsBare ? `${base}.csv` : `${base} (1).csv`;
  const D = days("09", 20 + Math.floor(R() * 11));
  const files = [], truth = {};
  // explícitas (aportan evidencia del patrón)
  const nEvidence = Math.floor(R() * 4); // 0..3 pares explícitos
  [["followers", "fbFollowers", "Seguidores"], ["profileVisits", "fbVisits", "Visitas"], ["linkClicks", "fbLinkClicks", "Clics en el enlace"]].slice(0, nEvidence)
    .forEach(([ig, fb, base]) => {
      const a = serie(R, D, 50), b = serie(R, D, 20);
      files.push(file(name(base, "ig"), ig, base, a), file(name(base, "fb"), fb, base, b)); truth[ig] = a; truth[fb] = b;
    });
  // ambiguas en conflicto
  const amb = AMBIG.filter(() => R() < 0.7);
  amb.forEach(([k, label]) => {
    const ig = serie(R, D, 3000), fb = serie(R, D, 900);
    if (ig.every((r, i) => r.value === fb[i].value)) fb[0].value += 1; // garantizar que difieren
    files.push(file(name(label, "ig"), k, label, ig), file(name(label, "fb"), k, label, fb));
    truth[k] = ig; truth[FBK[k]] = fb;
  });
  // ruido: un archivo duplicado idéntico, y un mes anterior sin solaparse
  if (R() < 0.4 && files.length) { const f = files[Math.floor(R() * files.length)]; files.push({ ...f, name: f.name.replace(".csv", " (2).csv") }); }
  for (let i = files.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [files[i], files[j]] = [files[j], files[i]]; }

  // 1) sin asignar: nada ambiguo se publica
  let r = resolveSeries(files, {});
  amb.forEach(([k]) => ok(scn, `«${k}» no se publica sin asignar`, !r.series[k] && !r.series[FBK[k]]));
  ok(scn, "conflictos = métricas ambiguas", r.conflicts.length === amb.length, `${r.conflicts.length} vs ${amb.length}`);
  Object.keys(truth).filter((k) => !AMBIG.some(([a]) => a === k) && !Object.values(FBK).includes(k))
    .forEach((k) => ok(scn, `explícita «${k}» publicada exacta`, sum(r.series[k]) === sum(truth[k])));

  // 2) sugerencia: solo si hay evidencia consistente de ambos sufijos
  const expectSug = nEvidence >= 1 && amb.length > 0;
  ok(scn, "sugerencias disponibles solo con evidencia", r.suggestionsAvailable === expectSug, `esperado ${expectSug} obtuvo ${r.suggestionsAvailable} (evidencias ${nEvidence})`);
  if (expectSug) r.conflicts.forEach((c) => c.files.forEach((f) => {
    const fl = files.find((x) => x.name === f.name); const isFb = sum(fl.rows) === sum(truth[FBK[c.key]]);
    ok(scn, `sugerencia correcta para ${f.name}`, f.suggested === (isFb ? "fb" : "ig"), `obtuvo ${f.suggested}`);
  }));

  // 3) aplicar sugerencias / asignación correcta → cifras exactas en su plataforma
  const assign = {};
  // plataforma real según el CONTENIDO del archivo (no su nombre)
  r.conflicts.forEach((c) => c.files.forEach((f) => { const fl = files.find((x) => x.name === f.name); assign[f.name] = sum(fl.rows) === sum(truth[FBK[c.key]]) ? "fb" : "ig"; }));
  r = resolveSeries(files, assign);
  ok(scn, "todo resuelto tras asignar", r.conflicts.every((c) => c.done), r.conflicts.map((c) => c.problem).join(";"));
  amb.forEach(([k]) => {
    ok(scn, `«${k}» Instagram exacto`, sum(r.series[k]) === sum(truth[k]), `${sum(r.series[k])} vs ${sum(truth[k])}`);
    ok(scn, `«${k}» Facebook exacto y separado`, sum(r.series[FBK[k]]) === sum(truth[FBK[k]]));
  });

  // 4) asignación errónea: ambos a la misma plataforma → bloqueado y explicado
  if (amb.length) {
    const bad = { ...assign }; r.conflicts[0].files.forEach((f) => (bad[f.name] = "ig"));
    const rb = resolveSeries(files, bad); const c0 = rb.conflicts.find((c) => c.key === r.conflicts[0].key);
    ok(scn, "misma plataforma a dos archivos distintos: bloqueado", !c0.done && /no pueden ser ambos/.test(c0.problem || ""));
    ok(scn, "…y la métrica no se publica con un archivo elegido al azar", !rb.series[c0.key] || sum(rb.series[c0.key]) !== sum(truth[c0.key]) + sum(truth[FBK[c0.key]]));
  }
}

// casos dirigidos
{
  const D = days("09", 10), R = rng(9);
  const a = serie(R, D, 100), b = serie(R, D, 100); b[0].value = a[0].value + 1;
  // evidencia inconsistente: el mismo sufijo apunta a IG y a FB → sin sugerencia
  const fs = [file("Seguidores.csv", "followers", "S", serie(R, D, 9)), file("Visitas.csv", "fbVisits", "V", serie(R, D, 9)),
    file("Visualizaciones.csv", "views", "Visualizaciones", a), file("Visualizaciones (1).csv", "views", "Visualizaciones", b)];
  ok("dirigido", "evidencia inconsistente: sin sugerencia", !resolveSeries(fs, {}).suggestionsAvailable);
  // dos meses de la misma métrica sin solaparse: se unen sin conflicto
  const ago = days("08", 31).map((d) => ({ date: d, value: 5 })), sep = days("09", 30).map((d) => ({ date: d, value: 7 }));
  const r2 = resolveSeries([file("Alcance ago.csv", "reach", "Alcance", ago), file("Alcance sep.csv", "reach", "Alcance", sep)], {});
  ok("dirigido", "dos meses se unen sin conflicto", r2.conflicts.length === 0 && sum(r2.series.reach) === 31 * 5 + 30 * 7);
  // asignar a Facebook una métrica que choca con una serie explícita de Facebook ya cargada
  const fbv = serie(R, D, 9), alt = fbv.map((x) => ({ ...x, value: x.value + 3 }));
  const fs3 = [file("Visitas FB.csv", "fbVisits", "Visitas de Facebook", fbv), file("Visitas A.csv", "profileVisits", "Visitas", serie(R, D, 50)), file("Visitas B.csv", "profileVisits", "Visitas", alt)];
  const r3 = resolveSeries(fs3, { "Visitas A.csv": "ig", "Visitas B.csv": "fb" });
  ok("dirigido", "choque con serie de Facebook existente: bloqueado", r3.conflicts[0] && !r3.conflicts[0].done && /choca/.test(r3.conflicts[0].problem || ""));
  ok("dirigido", "…y la serie de Facebook original queda intacta", sum(r3.series.fbVisits) === sum(fbv));
}
console.log(`SERIES IG/FB · VERIFICACIONES: ${PASS + FAIL} · OK: ${PASS} · FALLOS: ${FAIL}`);
fails.forEach((f) => console.log("  ✗ " + f));
if (FAIL) process.exit(1);
