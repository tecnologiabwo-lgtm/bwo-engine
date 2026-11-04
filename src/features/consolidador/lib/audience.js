/* ============================================================
   AUDIENCIA — lectura del CSV «Público» de Meta
   - Trae hasta tres secciones (Edad y sexo, Principales ciudades,
     Principales países) en cualquier orden.
   - El ORDEN DE LAS COLUMNAS de «Edad y sexo» cambia entre archivos
     ("Hombres","Mujeres" o "Mujeres","Hombres"): se lee el encabezado,
     nunca se asume la posición.
   - Instagram y Facebook exportan este archivo con el mismo título y
     sin marcar la plataforma: la resolución IG/FB está en series.js.
   ============================================================ */

const normTxt = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const toNum = (s) => {
  const t = String(s ?? "").trim().replace(/%$/, "");
  if (t === "") return null;
  const v = Number(t.includes(",") && !t.includes(".") ? t.replace(",", ".") : t.replace(/,/g, ""));
  return Number.isFinite(v) ? v : null;
};

/** Divide una línea CSV simple (comillas dobles, coma). */
export function splitCsvLine(line) {
  const out = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

const SECTION = (t) => (t.startsWith("edad y sexo") ? "ageGender" : t.startsWith("principales ciudades") ? "cities" : t.startsWith("principales paises") ? "countries" : null);

export function isAudienceTitle(firstLine) {
  return !!SECTION(normTxt(String(firstLine).replace(/"/g, "")));
}

/** Parsea el texto ya decodificado. Devuelve { ageGender, cities, countries, genderOrder }. */
export function parseAudienceCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "" && !/^sep=/i.test(l.trim()));
  const audience = { ageGender: [], cities: [], countries: [] };
  let section = null, col = null; // col: { male, female } índices de columna
  for (let i = 0; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const t = normTxt(cells[0]);
    if (cells.length === 1 && SECTION(t)) { section = SECTION(t); col = null; continue; }
    // ciudades / países: una línea de etiquetas y otra de porcentajes — puede
    // tener una sola columna (p. ej. "Uruguay" / "100")
    if ((section === "cities" || section === "countries") && !audience[section].length) {
      const next = splitCsvLine(lines[i + 1] || "").map(toNum);
      if (next.length === cells.length && next.every((v) => v !== null) && cells.some((c) => toNum(c) === null)) {
        audience[section] = cells.map((l, k) => ({ label: l, value: next[k] })).filter((d) => d.label);
        i++;
        continue;
      }
    }
    if (cells.length === 1) { section = null; continue; } // sección desconocida (p. ej. «Principales páginas»)
    if (section === "ageGender") {
      if (!col) {
        // encabezado: "", "Hombres", "Mujeres" (en cualquier orden)
        const h = cells.map(normTxt);
        const m = h.findIndex((x) => x === "hombres" || x === "men" || x === "male");
        const f = h.findIndex((x) => x === "mujeres" || x === "women" || x === "female");
        if (m > 0 && f > 0) { col = { male: m, female: f }; continue; }
      }
      if (col && /^\d{2}-\d{2}$|^\d{2}\+$/.test(cells[0]))
        audience.ageGender.push({ age: cells[0], male: toNum(cells[col.male]) ?? 0, female: toNum(cells[col.female]) ?? 0 });
    }
  }
  return audience;
}

/** Huella para comparar dos archivos de audiencia por sección. */
const sig = (rows) => JSON.stringify(rows || []);
/** "identical" | "clash" (alguna sección presente en ambos difiere) | "compatible" (secciones complementarias) */
export function compareAudience(a, b) {
  let same = true, clash = false;
  ["ageGender", "cities", "countries"].forEach((k) => {
    const x = a?.[k] || [], y = b?.[k] || [];
    if (sig(x) !== sig(y)) same = false;
    if (x.length && y.length && sig(x) !== sig(y)) clash = true;
  });
  return same ? "identical" : clash ? "clash" : "compatible";
}

export function mergeAudience(list) {
  const out = { ageGender: [], cities: [], countries: [] };
  list.forEach((a) => ["ageGender", "cities", "countries"].forEach((k) => { if (!out[k].length && a?.[k]?.length) out[k] = a[k]; }));
  return out;
}

export const hasAudience = (a) => !!a && (a.ageGender?.length || a.cities?.length || a.countries?.length);
