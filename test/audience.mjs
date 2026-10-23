/* Audiencia («Público»): lectura por encabezado y separación Instagram / Facebook.
   Datos sintéticos (ningún dato de cliente). */
import { parseAudienceCsv, compareAudience } from "../src/modules/consolidador/lib/audience.js";
import { resolveSeries } from "../src/modules/consolidador/lib/series.js";

let PASS = 0, FAIL = 0; const fails = [];
const check = (scn, label, cond, detail = "") => { if (cond) PASS++; else { FAIL++; fails.push(`[${scn}] ${label} ${detail}`); } };
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const AGES = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
const q = (a) => a.map((x) => `"${x}"`).join(",");
function makeCsv(R, { menFirst, sections, ag, cities, countries }) {
  const parts = { ageGender: () => [`"Edad y sexo"`, menFirst ? q(["", "Hombres", "Mujeres"]) : q(["", "Mujeres", "Hombres"]),
      ...ag.map((r) => q([r.age, ...(menFirst ? [r.male, r.female] : [r.female, r.male])]))].join("\n"),
    cities: () => [`"Principales ciudades"`, q(cities.map((c) => c.label)), q(cities.map((c) => c.value))].join("\n"),
    countries: () => [`"Principales países"`, q(countries.map((c) => c.label)), q(countries.map((c) => c.value))].join("\n") };
  return "sep=,\n" + sections.map((k) => parts[k]()).join("\n\n") + "\n";
}
const series = (name, key, label, vals) => ({ name, key, label, rows: vals.map((v, i) => ({ date: `2026-09-${String(i + 1).padStart(2, "0")}`, value: v })) });

/* --- lectura: el orden Hombres/Mujeres no importa --- */
for (let seed = 1; seed <= 300; seed++) {
  const R = rng(seed);
  const ag = AGES.map((age) => ({ age, male: Math.round(R() * 300) / 10, female: Math.round(R() * 300) / 10 }));
  const cities = Array.from({ length: 1 + Math.floor(R() * 9) }, (_, i) => ({ label: `Ciudad ${i}, Estado, País`, value: Math.round(R() * 300) / 10 }));
  const countries = Array.from({ length: 1 + Math.floor(R() * 9) }, (_, i) => ({ label: `País ${i}`, value: Math.round(R() * 900) / 10 }));
  const all = ["ageGender", "cities", "countries"].sort(() => R() - 0.5);
  const sections = all.slice(0, 1 + Math.floor(R() * 3));
  const menFirst = R() < 0.5;
  const a = parseAudienceCsv(makeCsv(R, { menFirst, sections, ag, cities, countries }));
  const id = `#${seed} ${menFirst ? "H,M" : "M,H"} ${sections}`;
  if (sections.includes("ageGender")) {
    check(id, "6 rangos", a.ageGender.length === 6);
    check(id, "hombres/mujeres según encabezado", a.ageGender.every((r, i) => r.male === ag[i].male && r.female === ag[i].female), JSON.stringify(a.ageGender[0]) + " vs " + JSON.stringify(ag[0]));
  } else check(id, "sin edad", a.ageGender.length === 0);
  check(id, "ciudades", sections.includes("cities") ? JSON.stringify(a.cities) === JSON.stringify(cities) : !a.cities.length);
  check(id, "países", sections.includes("countries") ? JSON.stringify(a.countries) === JSON.stringify(countries) : !a.countries.length);
}

/* --- resolución IG / FB --- */
const AG1 = AGES.map((age, i) => ({ age, male: i, female: i + 10 }));
const AG2 = AGES.map((age, i) => ({ age, male: i + 5, female: i + 1 }));
const A1 = { ageGender: AG1, cities: [{ label: "Valencia", value: 24.2 }], countries: [{ label: "Venezuela", value: 76.5 }] };
const A2 = { ageGender: AG2, cities: [], countries: [{ label: "Venezuela", value: 62 }] };
// evidencia: sin sufijo = Facebook, (1) = Instagram (como en los paquetes reales)
const EV = [series("Seguidores.csv", "fbFollowers", "Seg FB", [1, 2]), series("Seguidores (1).csv", "followers", "Seg IG", [3, 4])];

{ const r = resolveSeries([], {}, [{ name: "Público.csv", audience: A1 }]);
  check("uno", "un archivo → audiencia", r.audience && compareAudience(r.audience, A1) === "identical" && !r.fbAudience && !r.conflicts.length); }
{ const r = resolveSeries([], {}, [{ name: "Público.csv", audience: A1 }, { name: "Público (1).csv", audience: A1 }]);
  check("idénticos", "cuentan una vez, sin conflicto", r.audience && !r.conflicts.length); }
{ const r = resolveSeries([], {}, [{ name: "a.csv", audience: { ageGender: AG1, cities: [], countries: [] } }, { name: "b.csv", audience: { ageGender: [], cities: A1.cities, countries: [] } }]);
  check("complementarios", "se unen", r.audience && r.audience.ageGender.length === 6 && r.audience.cities.length === 1 && !r.conflicts.length); }
{ const r = resolveSeries(EV, {}, [{ name: "Público.csv", audience: A2 }, { name: "Público (1).csv", audience: A1 }]);
  const c = r.conflicts.find((x) => x.key === "audience");
  check("choque", "no se reporta sin asignar", !r.audience && !r.fbAudience && c && !c.done);
  check("choque", "sugerencia por sufijo", c.files.find((f) => f.name === "Público.csv").suggested === "fb" && c.files.find((f) => f.name === "Público (1).csv").suggested === "ig");
  check("choque", "sugerencias disponibles", r.suggestionsAvailable); }
{ const r = resolveSeries(EV, { "Público.csv": "fb", "Público (1).csv": "ig" }, [{ name: "Público.csv", audience: A2 }, { name: "Público (1).csv", audience: A1 }]);
  check("asignado", "IG y FB separados", compareAudience(r.audience, A1) === "identical" && compareAudience(r.fbAudience, A2) === "identical");
  check("asignado", "conflicto resuelto", r.conflicts.find((x) => x.key === "audience").done); }
{ const r = resolveSeries(EV, { "Público.csv": "ig", "Público (1).csv": "ig" }, [{ name: "Público.csv", audience: A2 }, { name: "Público (1).csv", audience: A1 }]);
  const c = r.conflicts.find((x) => x.key === "audience");
  check("misma plataforma", "bloqueado con explicación", !c.done && c.problem && !r.audience); }
{ const r = resolveSeries([], {}, [{ name: "Público.csv", audience: A2 }, { name: "Público (1).csv", audience: A1 }]);
  check("sin evidencia", "sin sugerencia", r.conflicts[0].files.every((f) => !f.suggested)); }
{ const r = resolveSeries([], { "Público.csv": "fb" }, [{ name: "Público.csv", audience: A2 }]);
  check("uno FB", "asignado a Facebook", !r.audience && compareAudience(r.fbAudience, A2) === "identical"); }

console.log(`AUDIENCIA IG/FB · VERIFICACIONES: ${PASS + FAIL} · OK: ${PASS} · FALLOS: ${FAIL}`);
fails.slice(0, 30).forEach((f) => console.log("  ✗ " + f));
if (FAIL) process.exit(1);
