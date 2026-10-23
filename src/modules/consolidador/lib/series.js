/* ============================================================
   SERIES ORGÁNICAS — resolución Instagram / Facebook
   Lógica pura (sin React) para poder probarla de forma automática.

   Problema: Meta exporta algunas métricas de Instagram y de Facebook con
   el MISMO título ("Visualizaciones", "Interacciones con el contenido",
   "Alcance", "Espectadores") y sin ninguna marca de plataforma dentro del
   archivo. Otras sí la dicen en el título ("Seguidores de Facebook").

   Reglas:
   1. Nunca se elige un archivo en silencio. Si dos archivos de la misma
      métrica traen valores distintos para los mismos días, la métrica
      queda en conflicto hasta que el usuario asigna la plataforma.
   2. Archivos idénticos (el mismo cargado dos veces) cuentan una vez.
   3. Archivos de la misma métrica con días distintos (dos meses) se unen.
   4. Una asignación que produciría otro choque (dos archivos distintos a
      la misma plataforma, o caer sobre una serie ya existente con otros
      valores) no se aplica: el conflicto sigue abierto y se explica.
   5. Sugerencia por evidencia: los archivos cuyo título SÍ dice la
      plataforma revelan cómo nombró el navegador la descarga (p. ej. sin
      sufijo = Facebook, "(1)" = Instagram). Solo si ese patrón es
      consistente en todo el paquete se sugiere; el usuario confirma.
   ============================================================ */

// métrica de Instagram → equivalente de Facebook
export const FB_KEY = { views: "fbViews", interactions: "fbInteractions", reach: "fbReach", profileVisits: "fbVisits", followers: "fbFollowers", linkClicks: "fbLinkClicks", viewers: "fbViewers" };

// métricas cuyo título dice explícitamente la plataforma
const EXPLICIT = { followers: "ig", profileVisits: "ig", linkClicks: "ig", fbVisits: "fb", fbFollowers: "fb", fbLinkClicks: "fb" };

/** Sufijo que el navegador agrega a descargas repetidas: "X (1).csv" → "1", "X.csv" → "". */
export function downloadSuffix(name) {
  const m = String(name).match(/\s\((\d+)\)\.[a-z0-9]+$/i);
  return m ? m[1] : "";
}

const sameDays = (a, b) => {
  const m = new Map(a.map((r) => [r.date, r.value]));
  return b.some((r) => m.has(r.date) && m.get(r.date) !== r.value) ? "clash"
    : b.every((r) => m.has(r.date)) && a.length === b.length ? "identical" : "compatible";
};

import { compareAudience, mergeAudience, hasAudience } from "./audience.js";

const audDetail = (a) => [a.ageGender?.length ? `${a.ageGender.length} rangos de edad` : null, a.cities?.length ? `${a.cities.length} ciudades` : null, a.countries?.length ? `${a.countries.length} países` : null].filter(Boolean).join(" · ") || "sin secciones";

/**
 * @param seriesFiles   [{ name, key, label, rows }]
 * @param assign        { [fileName]: "ig" | "fb" }
 * @param audienceFiles [{ name, audience }] — archivos «Público»
 * @returns { series, conflicts, suggestionsAvailable, audience, fbAudience }
 */
export function resolveSeries(seriesFiles = [], assign = {}, audienceFiles = []) {
  const byKey = {};
  // de archivos idénticos (descargados dos veces) se conserva el de nombre más
  // corto — el original, sin el sufijo extra que agrega el navegador
  [...seriesFiles].sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name))
    .forEach((f) => {
      const list = (byKey[f.key] = byKey[f.key] || []);
      if (!list.some((u) => sameDays(u.rows, f.rows) === "identical")) list.push(f);
    });

  // ---- evidencia: sufijo de descarga → plataforma, desde títulos explícitos
  const evidence = {}; // sufijo -> Set(plataformas)
  Object.values(byKey).flat().forEach((f) => {
    const pl = EXPLICIT[f.key];
    if (!pl) return;
    const s = downloadSuffix(f.name);
    (evidence[s] = evidence[s] || new Set()).add(pl);
  });
  const evSuffixes = Object.keys(evidence);
  // consistente: ningún sufijo apunta a las dos plataformas, y hay evidencia de ambas
  const consistent = evSuffixes.every((s) => evidence[s].size === 1) &&
    new Set(evSuffixes.map((s) => [...evidence[s]][0])).size === 2;
  const suggestFor = (name) => (consistent && evidence[downloadSuffix(name)] ? [...evidence[downloadSuffix(name)]][0] : null);

  const out = {};          // clave → filas
  const origin = {};       // clave → nombres de archivo que la alimentan
  const conflicts = [];
  // agrega filas a una clave; devuelve false si chocan con lo que ya había
  const tryPut = (k, rows, name, dry = false) => {
    const prev = out[k] || [];
    if (prev.length && sameDays(prev, rows) === "clash") return false;
    if (dry) return true;
    out[k] = [...prev, ...rows].filter((x, i, a) => a.findIndex((y) => y.date === x.date) === i).sort((a, b) => a.date.localeCompare(b.date));
    (origin[k] = origin[k] || []).push(name);
    return true;
  };

  // primero las métricas sin conflicto (incluidas las explícitas de Facebook),
  // para que una asignación posterior detecte si choca con ellas
  const pending = [];
  Object.entries(byKey).forEach(([key, list]) => {
    const uniq = [];
    list.forEach((f) => { if (!uniq.some((u) => sameDays(u.rows, f.rows) === "identical")) uniq.push(f); });
    const clashes = uniq.some((a, i) => uniq.some((b, j) => j > i && sameDays(a.rows, b.rows) === "clash"));
    if (!clashes) uniq.forEach((f) => tryPut(key, f.rows, f.name));
    else pending.push([key, uniq]);
  });

  pending.forEach(([key, uniq]) => {
    const files = uniq.map((f) => ({
      name: f.name, days: f.rows.length, total: f.rows.reduce((a, x) => a + x.value, 0),
      platform: assign[f.name] || null, suggested: suggestFor(f.name),
    }));
    // la sugerencia solo vale si distingue a los archivos (no dos iguales)
    const sugs = files.map((f) => f.suggested);
    if (sugs.some((s) => !s) || new Set(sugs).size !== sugs.length) files.forEach((f) => (f.suggested = null));

    // validar asignación: dos archivos que chocan no pueden ir a la misma plataforma
    let problem = null;
    uniq.forEach((a, i) => uniq.forEach((b, j) => {
      if (j > i && assign[a.name] && assign[a.name] === assign[b.name] && sameDays(a.rows, b.rows) === "clash")
        problem = `«${a.name}» y «${b.name}» tienen valores distintos y no pueden ser ambos de ${assign[a.name] === "ig" ? "Instagram" : "Facebook"}.`;
    }));
    if (!problem) {
      uniq.forEach((f) => {
        const pl = assign[f.name];
        if (!pl) return;
        const k = pl === "ig" ? key : (FB_KEY[key] || `${key}Fb`);
        if (!tryPut(k, f.rows, f.name, true)) problem = `«${f.name}» choca con otra serie de ${pl === "ig" ? "Instagram" : "Facebook"} ya cargada (${(origin[k] || []).join(", ")}).`;
      });
    }
    if (!problem) uniq.forEach((f) => {
      const pl = assign[f.name];
      if (pl) tryPut(pl === "ig" ? key : (FB_KEY[key] || `${key}Fb`), f.rows, f.name);
    });
    const done = !problem && files.every((f) => f.platform);
    conflicts.push({ key, label: uniq[0].label, files, problem, done });
  });

  /* ---- audiencia («Público»): misma regla que las series ----
     Un solo archivo (o varios idénticos / complementarios) → se usa tal cual.
     Varios con valores distintos en la misma sección → son de plataformas
     distintas: no se reporta ninguno hasta asignar Instagram / Facebook. */
  let audience = null, fbAudience = null;
  const auds = [];
  [...audienceFiles].filter((f) => hasAudience(f.audience))
    .sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name))
    .forEach((f) => { if (!auds.some((u) => compareAudience(u.audience, f.audience) === "identical")) auds.push(f); });
  const audClash = auds.some((a, i) => auds.some((b, j) => j > i && compareAudience(a.audience, b.audience) === "clash"));
  if (!audClash) {
    if (auds.length) {
      const fbOnly = auds.every((f) => assign[f.name] === "fb");
      const merged = mergeAudience(auds.map((f) => f.audience));
      if (fbOnly) fbAudience = merged; else audience = merged;
    }
  } else {
    const files = auds.map((f) => ({ name: f.name, detail: audDetail(f.audience), platform: assign[f.name] || null, suggested: suggestFor(f.name) }));
    const sugs = files.map((f) => f.suggested);
    if (sugs.some((x) => !x) || new Set(sugs).size !== sugs.length) files.forEach((f) => (f.suggested = null));
    let problem = null;
    auds.forEach((a, i) => auds.forEach((b, j) => {
      if (j > i && assign[a.name] && assign[a.name] === assign[b.name] && compareAudience(a.audience, b.audience) === "clash")
        problem = `«${a.name}» y «${b.name}» tienen valores distintos y no pueden ser ambos de ${assign[a.name] === "ig" ? "Instagram" : "Facebook"}.`;
    }));
    const done = !problem && files.every((f) => f.platform);
    if (done) {
      const ig = auds.filter((f) => assign[f.name] === "ig").map((f) => f.audience);
      const fb = auds.filter((f) => assign[f.name] === "fb").map((f) => f.audience);
      audience = ig.length ? mergeAudience(ig) : null;
      fbAudience = fb.length ? mergeAudience(fb) : null;
    }
    conflicts.push({ key: "audience", label: "Perfil de audiencia (Público)", files, problem, done, kind: "audience" });
  }

  return { series: out, conflicts, audience, fbAudience, suggestionsAvailable: conflicts.some((c) => !c.done && c.files.some((f) => f.suggested)) };
}
