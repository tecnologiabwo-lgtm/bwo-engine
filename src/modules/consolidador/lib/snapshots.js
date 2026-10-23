/* ============================================================
   SNAPSHOTS v2.3 — persistencia sin backend
   - Serializa el estado agregado (no los archivos originales)
   - Cifrado opcional con contraseña (AES-GCM + PBKDF2)
   - Merge de varios snapshots del mismo cliente para consolidar
     mes/trimestre/semestre/año a partir de meses individuales
   ============================================================ */

const SIG = "BWO-SNAP";      // firma que confirma que el .json es un snapshot
const SIG_ENC = "BWO-ENC";   // firma para paquetes cifrados
const VERSION = 1;

/* ---------- serialización ---------- */

/** Convierte el estado activo en un objeto plano listo para JSON. */
export function snapshotOf(client, ds, model) {
  return {
    sig: SIG, version: VERSION,
    createdAt: new Date().toISOString(),
    client,
    currency: ds.currency,
    // nivel de agrupación con el que se generó este snapshot (campaign|adset|ad)
    // — necesario para que el histórico nunca mezcle niveles distintos sin avisar
    level: model?.effectiveLevel || "campaign",
    // series orgánicas: solo pares fecha/valor
    series: Object.fromEntries(Object.entries(ds.series || {}).map(([k, rows]) => [k, rows.map((r) => ({ date: r.date, value: r.value }))])),
    audience: ds.audience || null,
    fbAudience: ds.fbAudience || null,
    posts: (ds.posts || []).map((p) => ({ id: p.id, type: p.type, date: p.date, reach: p.reach, views: p.views, saves: p.saves, caption: (p.caption || "").slice(0, 140) })),
    // pauta: guardamos las campañas ya procesadas por buildModel
    // (nombre, objetivo, totales, desgloses, período, pacing)
    campaigns: (model?.campaigns || []).map((c) => ({
      name: c.name, level: c.level, memberCount: c.memberCount, status: c.status, objective: c.objective, resultType: c.resultType,
      spend: c.spend, results: c.results, impressions: c.impressions, reach: c.reach, igFollows: c.igFollows,
      cpl: c.cpl, cpm: c.cpm, frequency: c.frequency, costPerFollower: c.costPerFollower,
      budgetDaily: c.budgetDaily, attribution: c.attribution || null,
      period: c.period, pacing: c.pacing,
      dims: Object.fromEntries(Object.entries(c.dims || {}).map(([d, rows]) => [d, rows.map((x) => ({ label: x.label, spend: x.spend, results: x.results, impressions: x.impressions, reach: x.reach, cpl: x.cpl }))])),
    })),
  };
}

/** Valida y devuelve el snapshot; lanza si no lo es. */
export function validateSnapshot(obj) {
  if (!obj || obj.sig !== SIG) throw new Error("El archivo no es un snapshot de BWO.");
  if (obj.version > VERSION) throw new Error(`Snapshot de versión ${obj.version}, esta app soporta hasta ${VERSION}.`);
  if (!obj.client) throw new Error("Snapshot sin cliente asignado.");
  return obj;
}

/* ---------- cifrado opcional ----------
   Usa Web Crypto (disponible en el navegador y en Node 18+). */

async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const material = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" },
    material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
  );
}
/* Base64 por bloques: String.fromCharCode(...bytes) sobre todo el arreglo
   revienta la pila con snapshots de más de ~100 KB. */
const b64 = {
  to: (b) => {
    const bytes = new Uint8Array(b); let out = "";
    for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(out);
  },
  from: (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)),
};

export async function encryptSnapshot(snap, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(snap)));
  return { sig: SIG_ENC, version: VERSION, client: snap.client, createdAt: snap.createdAt, salt: b64.to(salt), iv: b64.to(iv), data: b64.to(cipher) };
}

export async function decryptSnapshot(pkg, password) {
  if (pkg.sig !== SIG_ENC) throw new Error("El archivo no está cifrado por BWO.");
  const key = await deriveKey(password, b64.from(pkg.salt));
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64.from(pkg.iv) }, key, b64.from(pkg.data));
    return validateSnapshot(JSON.parse(new TextDecoder().decode(plain)));
  } catch { throw new Error("Contraseña incorrecta o archivo dañado."); }
}

export const isSnapshot = (o) => o?.sig === SIG;
export const isEncrypted = (o) => o?.sig === SIG_ENC;

/* ---------- merge de múltiples snapshots del MISMO cliente ----------
   Sirve para consolidar mes/trimestre/semestre/año a partir de
   varios snapshots mensuales. Nunca mezcla clientes distintos.
   Regla clave: los períodos NO deben solaparse. Si dos snapshots
   cubren días en común, esto lo detecta y devuelve advertencia. */

/** Devuelve { campaigns, series, audience, posts, warnings } consolidado. */
export function mergeSnapshots(snaps) {
  if (!snaps.length) return null;
  const clients = new Set(snaps.map((s) => s.client));
  if (clients.size > 1) throw new Error(`Los snapshots pertenecen a clientes distintos: ${[...clients].join(", ")}.`);
  const warnings = [];

  // ---- coherencia de nivel: nunca mezclar campaña/conjunto/anuncio sin avisar ----
  const LEVEL_LABEL_ES = { campaign: "campaña", adset: "conjunto de anuncios", ad: "anuncio" };
  const levelsUsed = new Set(snaps.map((s) => s.level || "campaign"));
  if (levelsUsed.size > 1) {
    warnings.push(`Los snapshots cargados fueron exportados con distinto nivel de agrupación (${[...levelsUsed].map((l) => LEVEL_LABEL_ES[l] || l).join(", ")}). El consolidado mezcla nombres de niveles distintos — revisa con qué nivel se publicó cada mes antes de interpretar los totales.`);
  }

  // ---- pauta: agrupar por nombre+objetivo (misma campaña en dos meses = dos entradas separadas si tienen períodos distintos)
  // preferencia: si dos snapshots traen la MISMA campaña con el MISMO período,
  // conservamos una (probablemente son la misma exportación duplicada); si tienen
  // períodos distintos, quedan como filas independientes con sus períodos.
  const campKey = (c) => `${c.name}||${c.objective}||${c.period?.from || ""}→${c.period?.to || ""}`;
  const campMap = new Map();
  snaps.forEach((s) => (s.campaigns || []).forEach((c) => {
    const k = campKey(c);
    if (!campMap.has(k)) campMap.set(k, { ...c });
  }));
  const campaigns = [...campMap.values()].sort((a, b) => (a.period?.from || "").localeCompare(b.period?.from || ""));

  // ---- solapamiento de períodos por campaña (por nombre) ----
  const byName = new Map();
  campaigns.forEach((c) => { const a = byName.get(c.name) || []; a.push(c); byName.set(c.name, a); });
  byName.forEach((arr, name) => {
    for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
      const [a, b] = [arr[i], arr[j]];
      if (a.period && b.period && !(a.period.to < b.period.from || b.period.to < a.period.from)) {
        warnings.push(`«${name}» tiene períodos solapados entre snapshots (${a.period.from}→${a.period.to} y ${b.period.from}→${b.period.to}). Puede haber doble conteo.`);
      }
    }
  });

  // ---- series orgánicas: unión por fecha; si un mismo día aparece en dos snapshots, es solapamiento
  const series = {}; const orgDupes = {};
  snaps.forEach((s) => Object.entries(s.series || {}).forEach(([k, rows]) => {
    series[k] = series[k] || {}; orgDupes[k] = orgDupes[k] || 0;
    rows.forEach((r) => {
      if (series[k][r.date] !== undefined && series[k][r.date] !== r.value) orgDupes[k]++;
      series[k][r.date] = r.value;
    });
  }));
  const seriesOut = {};
  Object.entries(series).forEach(([k, m]) => (seriesOut[k] = Object.entries(m).map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date))));
  Object.entries(orgDupes).forEach(([k, n]) => { if (n) warnings.push(`Serie «${k}»: ${n} día(s) con valores distintos entre snapshots; se conservó el último cargado.`); });

  // ---- audiencia y posts: nos quedamos con la más reciente / la unión
  const audience = snaps.slice().reverse().find((s) => s.audience)?.audience || null;
  const fbAudience = snaps.slice().reverse().find((s) => s.fbAudience)?.fbAudience || null;
  const seen = new Set();
  const posts = [];
  snaps.forEach((s) => (s.posts || []).forEach((p) => { if (!seen.has(p.id)) { seen.add(p.id); posts.push(p); } }));

  return {
    client: snaps[0].client, currency: snaps[0].currency || "USD",
    campaigns, series: seriesOut, audience, fbAudience, posts,
    sources: snaps.map((s) => ({ createdAt: s.createdAt, campaigns: s.campaigns?.length || 0 })),
    warnings,
  };
}
