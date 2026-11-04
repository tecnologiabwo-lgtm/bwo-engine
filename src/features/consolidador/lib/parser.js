/* ============================================================
   PARSER v2 — Consolidador Meta Ads (Big Way Offices)
   Unifica dos formatos de export de Meta:
     A) "Raw Data Report" del trimestre: una hoja, dimensiones
        anidadas (edad + sexo + día) con filas "All".
     B) "Meta report": un archivo por dimensión (edad, sexo,
        región, ubicación, día) con encabezado en fila 3.
   Además CSV de Instagram Insights y el CSV de campañas (con
   presupuesto). Todo corre en el navegador; sin red.
   ============================================================ */

export const norm = (s) =>
  String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();

export const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  const s = String(v).replace(/[^\d,.\-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
};

const excelDate = (n) => new Date(Math.round((n - 25569) * 86400000)).toISOString().slice(0, 10);
export const toDay = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && v > 20000 && v < 90000) return excelDate(v);
  const m = String(v).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
};

/* dimensión reconocida a partir del encabezado de la 2ª columna */
const DIM_BY_HEADER = {
  edad: "age", sexo: "gender", genero: "gender", region: "region",
  ubicacion: "placement", "plataforma y ubicacion": "placement", dia: "day",
};

/* traducción de tipo de resultado → objetivo legible */
export function objectiveOf(resultType) {
  const t = norm(resultType);
  if (t.includes("leadgen") || t.includes("cliente") || t.includes("formulario")) return "Clientes potenciales";
  if (t.includes("conversaci") || t.includes("mensaj") || t.includes("messaging")) return "Mensajería";
  if (t.includes("link_click") || t.includes("clic")) return "Tráfico";
  if (t.includes("post_engagement") || t.includes("interacc")) return "Interacción";
  if (t.includes("reach") || t.includes("alcance")) return "Alcance";
  if (t.includes("video")) return "Reproducciones";
  return resultType ? String(resultType).slice(0, 40) : "Sin indicador de resultado";
}

/* Las tres columnas de identidad que Meta puede incluir en un export.
   A diferencia de antes, ahora se capturan TODAS las que estén presentes
   en la hoja — no se descarta ninguna — para poder reagrupar entre
   niveles después sin volver a leer el archivo. */
const NAME_COLS = [
  ["nombre de la campana", "campaignName"],
  ["nombre del conjunto de anuncios", "adsetName"],
  ["nombre del anuncio", "adName"],
];

const COLMAP = [
  ["estado de la entrega", "status"],
  ["nivel de la entrega", "level"],
  ["tipo de resultado", "resultType"],
  ["indicador de resultado", "resultType"],
  ["resultados", "results"],
  ["costo por resultado", "cpr"],
  ["costo por resultados", "cpr"],
  ["impresiones", "impressions"],
  ["alcance", "reach"],
  ["frecuencia", "frequency"],
  ["ctr (todos)", "ctrAll"],
  ["clics en el enlace", "linkClicks"],
  ["cpc (costo por clic en el enlace)", "cpc"],
  ["seguimientos de instagram", "igFollows"],
];

/* --- lee una hoja (array de arrays) y devuelve filas normalizadas --- */
function parseSheetGrid(grid) {
  // localizar la fila de encabezado: contiene alguna columna de identidad
  // (campaña, conjunto de anuncios o anuncio — cualquiera confirma la fila)
  const hIdx = grid.findIndex((r) => (r || []).some((c) => {
    const n = norm(c);
    return NAME_COLS.some(([k]) => n.startsWith(k));
  }));
  if (hIdx === -1) return null;
  const header = grid[hIdx].map((c) => norm(c));

  // localizar TODAS las columnas de identidad presentes (no solo una)
  const nameColByField = {}; // field -> índice de columna
  NAME_COLS.forEach(([key, field]) => {
    const idx = header.findIndex((h) => h === key || h.startsWith(key));
    if (idx !== -1) nameColByField[field] = idx;
  });
  if (!Object.keys(nameColByField).length) return null;
  const nameColSet = new Set(Object.values(nameColByField));

  // detectar dimensión: la 2ª columna con nombre reconocido de dimensión
  // (nunca alguna de las columnas de identidad)
  let dimension = "campaign", dimCol = -1;
  header.forEach((h, i) => {
    if (!nameColSet.has(i) && dimCol === -1 && DIM_BY_HEADER[h]) { dimension = DIM_BY_HEADER[h]; dimCol = i; }
  });

  // mapa de columnas → campos, más detección de moneda del gasto.
  // Regla: coincidencia EXACTA primero; la primera columna que reclama
  // un campo se lo queda (evita que "Resultados (iniciales)" pise a "Resultados").
  const map = {}; const used = new Set(); let currency = "USD";
  const claim = (i, field) => { if (!used.has(field)) { map[i] = field; used.add(field); } };
  Object.entries(nameColByField).forEach(([field, i]) => { map[i] = field; used.add(field); });
  header.forEach((h, i) => {
    if (nameColSet.has(i)) return;
    if (i === dimCol) { map[i] = "dim"; return; }
    const gasto = h.match(/^importe gastado(?: \(([a-z]{3})\))?/);
    if (gasto) { claim(i, "spend"); if (gasto[1]) currency = gasto[1].toUpperCase(); return; }
    const exact = COLMAP.find(([k]) => h === k);
    if (exact) { claim(i, exact[1]); return; }
    const pre = COLMAP.find(([k]) => h.startsWith(k) && !h.includes("(inicial"));
    if (pre) claim(i, pre[1]);
  });

  const rows = [];
  for (let r = hIdx + 1; r < grid.length; r++) {
    const raw = grid[r] || [];
    if (!raw.some((c) => c !== null && c !== undefined && c !== "")) continue;
    const o = { dimension };
    Object.entries(map).forEach(([i, k]) => {
      const v = raw[i];
      if (["campaignName", "adsetName", "adName", "status", "level", "resultType", "dim"].includes(k)) {
        o[k] = v === null || v === undefined || v === "" ? null : String(v).trim();
      } else o[k] = num(v);
    });
    // la fila necesita al menos una identidad no vacía para ser útil
    if (!o.campaignName && !o.adsetName && !o.adName) continue;
    // "All" en una columna de identidad significa "todos" (resumen del nivel
    // superior), NO un nombre real — se normaliza a null para no confundir la
    // granularidad. Sin esto, una fila resumen con adName="All" se tomaría
    // erróneamente como nivel anuncio y se contaría dos veces.
    const notAll = (v) => (v && norm(v) !== "all" ? v : null);
    o.campaignName = notAll(o.campaignName);
    o.adsetName = notAll(o.adsetName);
    o.adName = notAll(o.adName);
    if (!o.campaignName && !o.adsetName && !o.adName) continue;
    // GRANULARIDAD REAL DE ESTA FILA según qué identidades reales tiene llenas.
    o.rowLevel = o.adName ? "ad" : (o.adsetName ? "adset" : "campaign");
    // clave de agrupación que incluye la RUTA jerárquica completa, para que
    // dos entidades con el mismo nombre pero distinto padre no colisionen
    // (en algunas cuentas campaña/conjunto/anuncio comparten el mismo texto).
    o.entityKey = [o.campaignName, o.adsetName, o.adName].filter(Boolean).join(" ▸ ");
    // valor de la dimensión y si es fila "All"
    o.dimValue = dimCol === -1 ? "All" : (o.dim ?? "All");
    o.isAll = norm(o.dimValue) === "all";
    if (dimension === "day" && !o.isAll) o.day = toDay(o.dimValue);
    rows.push(o);
  }
  return { rows, currency, dimension };
}

/* --- API: procesa un workbook (ArrayBuffer) con SheetJS --- */
export function parseWorkbook(XLSX, buf) {
  const wb = XLSX.read(buf, { type: "array" });
  // preferir "Raw Data Report"; si no, la primera hoja con datos
  const order = wb.SheetNames.slice().sort((a, b) =>
    (norm(b).includes("raw data") ? 1 : 0) - (norm(a).includes("raw data") ? 1 : 0));
  for (const name of order) {
    const grid = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: false });
    const res = parseSheetGrid(grid);
    if (res && res.rows.length) return { ...res, sheet: name };
  }
  return null;
}

/* --- API: CSV de campañas (trae presupuesto y atribución) --- */
export function parseCampaignsCsv(Papa, text) {
  const res = Papa.parse(text, { header: true, skipEmptyLines: true });
  const out = [];
  res.data.forEach((r) => {
    const o = {}; Object.entries(r).forEach(([k, v]) => (o[norm(k)] = v));
    const campaignName = o["nombre de la campana"] ? String(o["nombre de la campana"]).trim() : null;
    const adsetName = o["nombre del conjunto de anuncios"] ? String(o["nombre del conjunto de anuncios"]).trim() : null;
    const adName = o["nombre del anuncio"] ? String(o["nombre del anuncio"]).trim() : null;
    if (!campaignName && !adsetName && !adName) return;
    out.push({
      campaignName, adsetName, adName,
      status: o["entrega de la campana"] || null,
      resultType: o["indicador de resultado"] || null,
      results: num(o["resultados"]),
      cpr: num(o["costo por resultados"] ?? o["costo por resultado"]),
      spend: num(o["importe gastado (usd)"] ?? o["importe gastado"]),
      impressions: num(o["impresiones"]),
      reach: num(o["alcance"]),
      budget: num(o["presupuesto del conjunto de anuncios"]),
      budgetType: o["tipo de presupuesto del conjunto de anuncios"] || null,
      attribution: o["configuracion de atribucion"] || null,
      from: toDay(o["inicio del informe"]),
      to: toDay(o["fin del informe"]),
    });
  });
  return out;
}

/* ============================================================
   MODELO — dos etapas.

   1) buildBaseEntities: construye la unidad más fina disponible
      (anuncio si hay nombre de anuncio; si no, conjunto de anuncios;
      si no, campaña), sin agregar hacia ningún nivel todavía. Cada
      entidad conserva sus tres nombres (los que existan) para poder
      reagruparla después.

   2) groupEntities: colapsa las entidades base al nivel pedido
      (campaña | conjunto de anuncios | anuncio), sumando UNA SOLA VEZ
      cada entidad base — nunca se vuelve a sumar un total ya agregado,
      así que no hay solapamiento posible entre niveles.
   ============================================================ */

/* Suma que preserva "sin datos": si ningún sumando trae el dato, el
   resultado sigue siendo null (se muestra "—"), nunca un 0 inventado.
   Se usa para métricas que no todos los exports incluyen. */
const addN = (a, b) => (b === null || b === undefined ? a : (a === null || a === undefined ? b : a + b));
const OPT = ["impressions", "reach", "linkClicks"]; // métricas opcionales según el export

const LEVEL_FIELD = { campaign: "campaignName", adset: "adsetName", ad: "adName" };
export const LEVEL_LABEL = { campaign: "Campaña", adset: "Conjunto de anuncios", ad: "Anuncio" };
const LEVEL_ORDER = ["campaign", "adset", "ad"]; // de más ancho a más fino

export function buildBaseEntities(allRows, campaignsCsv = []) {
  const levelRank = { campaign: 0, adset: 1, ad: 2 };

  // Ruta jerárquica canónica de una fila: [campaña, conjunto, anuncio] con los
  // nombres reales que tenga (los ausentes quedan como null). Dos filas de la
  // misma entidad comparten la misma ruta hasta su nivel de granularidad.
  const pathOf = (r) => [r.campaignName || null, r.adsetName || null, r.adName || null];
  const pathKey = (p) => p.filter(Boolean).join(" ▸ ");

  // ---- 1) Filas RESUMEN (total de una entidad): dimension==="campaign" o
  //         fila "All" de un desglose. Cada una ancla una entidad al nivel de
  //         granularidad que su propia ruta indique. Si para una misma ruta
  //         hay resúmenes en varios archivos, se conserva UNO (mismo total),
  //         evitando el doble conteo aunque el nombre se repita entre niveles. ---
  const summaryRows = allRows.filter((r) => r.dimension === "campaign" || r.isAll);
  const ents = new Map(); // pathKey → entidad base
  summaryRows.forEach((r) => {
    const key = r.entityKey; // ya es la ruta jerárquica completa
    const prev = ents.get(key);
    const cand = {
      key, path: pathOf(r), rowLevel: r.rowLevel,
      campaignName: r.campaignName ?? null, adsetName: r.adsetName ?? null, adName: r.adName ?? null,
      status: r.status, resultType: r.resultType, objective: objectiveOf(r.resultType),
      spend: r.spend || 0, results: r.results || 0,
      impressions: r.impressions ?? null, reach: r.reach ?? null, linkClicks: r.linkClicks ?? null,
      igFollows: r.igFollows || 0,
      // Meta deja la celda vacía (no en 0) cuando la campaña no tiene indicador
      // de resultado: se marca como "sin datos" para no afirmar que dio cero.
      resultsMissing: r.results === null || r.results === undefined,
      dims: {},
    };
    // Si el export no trae "Clics en el enlace" pero sí CPC e inversión, los
    // clics se derivan exactamente (inversión ÷ CPC). Solo se acepta si da un
    // entero (tolerancia por redondeo de Meta); si no, se deja sin datos.
    if (cand.linkClicks === null && r.cpc > 0 && r.spend > 0) {
      const d = r.spend / r.cpc;
      if (Math.abs(d - Math.round(d)) < 0.02) { cand.linkClicks = Math.round(d); cand.linkClicksDerived = true; }
    }
    // conservar el resumen más informativo por ruta (mayor volumen / con estado)
    let win = prev, lose = cand;
    if (!prev || (r.status && !prev.status) || (r.results || 0) > (prev.results || 0) || (r.spend || 0) > (prev.spend || 0)) {
      cand.dims = prev?.dims || {};
      ents.set(key, cand);
      win = cand; lose = prev;
    }
    // el mismo resumen suele llegar en varios archivos (base, edad, región…) con
    // columnas distintas: se completan entre sí los campos que a uno le falten,
    // siempre que describan el mismo total (mismos resultados e inversión).
    if (win && lose && win !== lose && (win.results || 0) === (lose.results || 0) && Math.abs((win.spend || 0) - (lose.spend || 0)) < 0.01) {
      ["impressions", "reach", "linkClicks"].forEach((k) => { if (win[k] === null && lose[k] !== null) win[k] = lose[k]; });
      if (lose.linkClicksDerived && win.linkClicks === lose.linkClicks) win.linkClicksDerived = true;
      if (!win.status && lose.status) win.status = lose.status;
      if (!win.igFollows && lose.igFollows) win.igFollows = lose.igFollows;
      if (!win.resultType && lose.resultType) { win.resultType = lose.resultType; win.objective = lose.objective; }
    }
  });

  // ---- REGLA DE ENTIDADES HOJA ----
  // Un mismo export puede traer el total de la campaña Y el de cada conjunto
  // (o anuncio): son los mismos resultados vistos a distinto nivel. Solo se
  // cuentan las entidades más finas de cada rama; un resumen que tiene
  // resúmenes por debajo es redundante para el conteo. Así nunca se suma dos
  // veces lo mismo, sin importar cuántos niveles traiga el archivo.
  const SEP = " ▸ ";
  const isAncestorKey = (a, b) => b.startsWith(a + SEP);
  const summaryKeys = [...ents.keys()];
  const higherSummaries = new Map(); // resúmenes descartados del conteo (solo referencia)
  summaryKeys.forEach((k) => {
    if (summaryKeys.some((o) => o !== k && isAncestorKey(k, o))) { higherSummaries.set(k, ents.get(k)); ents.delete(k); }
  });
  const leafKeys = () => [...ents.keys()];
  // hoja que corresponde a una ruta: la propia o el ancestro hoja más largo
  const leafFor = (key) => {
    if (ents.has(key)) return ents.get(key);
    const anc = leafKeys().filter((k) => isAncestorKey(k, key)).sort((a, b) => b.length - a.length)[0];
    return anc ? ents.get(anc) : null;
  };
  const hasLeafBelow = (key) => leafKeys().some((k) => isAncestorKey(key, k));

  // Desgloses sin ningún resumen relacionado (ni propio, ni ancestro, ni
  // descendiente): se reconstruye el total de esa entidad sumando una de sus
  // dimensiones (todas suman lo mismo), para no perder la entidad.
  const dimAllRows = allRows.filter((r) => !r.isAll && r.dimension !== "campaign");
  const byPathDim = new Map();
  dimAllRows.forEach((r) => {
    const dm = byPathDim.get(r.entityKey) || {};
    (dm[r.dimension] = dm[r.dimension] || []).push(r);
    byPathDim.set(r.entityKey, dm);
  });
  byPathDim.forEach((dims, key) => {
    if (leafFor(key) || hasLeafBelow(key) || higherSummaries.has(key)) return;
    const firstDim = Object.values(dims).sort((a, b) => b.length - a.length)[0];
    const s0 = firstDim[0];
    const tot = firstDim.reduce((acc, r) => {
      acc.spend += r.spend || 0; acc.results += r.results || 0;
      OPT.forEach((k) => (acc[k] = addN(acc[k], r[k])));
      return acc;
    }, { spend: 0, results: 0, impressions: null, reach: null, linkClicks: null });
    ents.set(key, {
      key, path: pathOf(s0), rowLevel: s0.rowLevel,
      campaignName: s0.campaignName ?? null, adsetName: s0.adsetName ?? null, adName: s0.adName ?? null,
      status: s0.status, resultType: s0.resultType, objective: objectiveOf(s0.resultType),
      spend: tot.spend, results: tot.results, impressions: tot.impressions, reach: tot.reach, linkClicks: tot.linkClicks, igFollows: 0,
      resultsMissing: false, dims: {}, _reconstructed: true,
    });
  });

  // enriquecer con presupuesto/atribución del CSV — por el nombre más específico común
  ents.forEach((e) => {
    const csv = campaignsCsv.find((x) =>
      (e.adName && x.adName && norm(x.adName) === norm(e.adName)) ||
      (e.adsetName && x.adsetName && norm(x.adsetName) === norm(e.adsetName)) ||
      (e.campaignName && x.campaignName && norm(x.campaignName) === norm(e.campaignName))
    );
    if (csv) { e.budget = csv.budget; e.budgetType = csv.budgetType; e.attribution = csv.attribution; e.from = csv.from; e.to = csv.to; }
  });

  // ---- 2) adjuntar desgloses a su hoja ----
  // Filas de desglose de un nivel SUPERIOR a las hojas (p. ej. edad del total
  // de la campaña cuando también viene edad por conjunto) duplican lo que ya
  // traen las hojas: se guardan aparte y solo se usan si las hojas no traen
  // esa dimensión (ver groupEntities).
  const ancestorDims = new Map(); // key → { entity-like path, dims }
  const addTo = (dimsObj, r) => {
    const d = (dimsObj[r.dimension] = dimsObj[r.dimension] || new Map());
    const dkey = r.dimension === "day" ? (r.day || r.dimValue) : r.dimValue;
    if (norm(dkey) === "unknown" && !(r.results || r.spend)) return;
    const cur = d.get(dkey) || { label: dkey, spend: 0, results: 0, impressions: null, reach: null, linkClicks: null };
    cur.spend += r.spend || 0; cur.results += r.results || 0;
    OPT.forEach((k) => (cur[k] = addN(cur[k], r[k])));
    d.set(dkey, cur);
  };
  dimAllRows.forEach((r) => {
    const leaf = leafFor(r.entityKey);
    if (leaf) { addTo(leaf.dims, r); return; }
    if (hasLeafBelow(r.entityKey)) {
      const a = ancestorDims.get(r.entityKey) || { key: r.entityKey, campaignName: r.campaignName, adsetName: r.adsetName, adName: r.adName, dims: {} };
      addTo(a.dims, r); ancestorDims.set(r.entityKey, a);
    }
  });

  const entities = [...ents.values()];

  // recuperar metadatos (estado/atribución) que solo viven en filas de nivel
  // más ancho — NO afecta ninguna cifra, solo etiquetas.
  const metaByCamp = new Map();
  allRows.forEach((r) => {
    if (r.campaignName && (r.status || r.attribution)) {
      const m = metaByCamp.get(r.campaignName) || {};
      if (r.status && !m.status) m.status = r.status;
      if (r.attribution && !m.attribution) m.attribution = r.attribution;
      metaByCamp.set(r.campaignName, m);
    }
  });
  entities.forEach((e) => {
    const m = e.campaignName && metaByCamp.get(e.campaignName);
    if (m) { if (!e.status) e.status = m.status; if (!e.attribution) e.attribution = m.attribution; }
  });

  // niveles disponibles para agrupar: cualquier nivel para el que TODAS las
  // entidades tengan nombre (así el rollup nunca pierde ni inventa entidades).
  // un nivel se ofrece si al menos una entidad trae ese nombre; las que no lo
  // traen se agrupan como "sin desglose" de su campaña (nunca se inventan).
  const availableLevels = LEVEL_ORDER.filter((lvl) => entities.some((e) => e[LEVEL_FIELD[lvl]]));
  // el nivel base es el más fino disponible
  const baseLevelName = availableLevels[availableLevels.length - 1] || "campaign";

  return { entities, availableLevels, baseLevel: baseLevelName, ancestorDims: [...ancestorDims.values()], higherSummaries: [...higherSummaries.values()] };
}

/** Fusiona varios mapas de desglose (Map<label, {spend,results,impressions,reach}>)
 *  en uno solo, sumando cada bucket coincidente exactamente una vez por origen. */
function mergeDimMaps(dimsList, dimension) {
  const merged = new Map();
  dimsList.forEach((dims) => {
    const m = dims?.[dimension];
    if (!m) return;
    m.forEach((v, k) => {
      const cur = merged.get(k) || { label: v.label, spend: 0, results: 0, impressions: null, reach: null, linkClicks: null };
      cur.spend += v.spend; cur.results += v.results;
      OPT.forEach((f) => (cur[f] = addN(cur[f], v[f])));
      merged.set(k, cur);
    });
  });
  return merged;
}

/** Colapsa las entidades base al nivel pedido. Cada entidad base se suma
 *  exactamente una vez — el resultado nunca solapa con otro nivel porque
 *  siempre parte de las mismas entidades finas, nunca de un total ya agregado. */
export function groupEntities(base, level, currency) {
  const field = LEVEL_FIELD[level];
  const groups = new Map();
  base.entities.forEach((e) => {
    const name = e[field] ?? (level !== "campaign" && e.campaignName
      ? `${e.campaignName} · sin desglose por ${LEVEL_LABEL[level].toLowerCase()}`
      : `Sin ${LEVEL_LABEL[level].toLowerCase()}`);
    const g = groups.get(name) || { name, members: [], spend: 0, results: 0, impressions: null, reach: null, linkClicks: null, igFollows: 0, missingAll: true, derived: false };
    if (!e.resultsMissing) g.missingAll = false;
    if (e.linkClicksDerived) g.derived = true;
    g.members.push(e);
    g.spend += e.spend; g.results += e.results;
    OPT.forEach((k) => (g[k] = addN(g[k], e[k])));
    g.igFollows += e.igFollows;
    groups.set(name, g);
  });

  const campaigns = [...groups.values()].map((g) => {
    // representante para status/objective/resultType/atribución: el miembro
    // con mayor gasto (el más informativo cuando difieren entre miembros)
    const rep = [...g.members].sort((a, b) => b.spend - a.spend)[0];
    // El alcance NO es sumable (una persona puede ver varios conjuntos/anuncios).
    // Con un solo miembro, es el suyo. Con varios, se usa el alcance que Meta
    // reporta para ese nivel si el archivo lo trae; si no, la suma queda marcada
    // como posible sobreestimación.
    let reachNote = null;
    if (g.members.length > 1) {
      const hs = (base.higherSummaries || []).find((x) => x[field] === g.name &&
        (level === "campaign" ? !x.adsetName && !x.adName : level === "adset" ? !x.adName : true));
      if (hs && hs.reach !== null && hs.reach !== undefined) { g.reach = hs.reach; reachNote = "meta"; }
      else if (g.reach !== null) reachNote = "suma";
    }
    const dims = {};
    ["age", "gender", "region", "placement", "day"].forEach((dim) => {
      // Si Meta trae el desglose propio del nivel agrupado (p. ej. edad del
      // total de la campaña), se prefiere: es exacto, incluido el alcance, que
      // no se puede obtener sumando conjuntos. Si no, se fusionan las hojas.
      const anc = g.members.length > 1 && base.ancestorDims?.find((x) => x[field] === g.name &&
        (level === "campaign" ? !x.adsetName && !x.adName : level === "adset" ? !x.adName : true));
      let m = (anc && anc.dims[dim]) || mergeDimMaps(g.members.map((e) => e.dims), dim);
      if (m.size) {
        dims[dim] = [...m.values()]
          .map((x) => ({ ...x, cpl: x.results ? x.spend / x.results : null }))
          .sort((a, b) => (dim === "day" ? String(a.label).localeCompare(String(b.label)) : b.spend - a.spend));
      }
    });

    let period = null;
    if (dims.day?.length) {
      const ds = dims.day.map((x) => x.label).filter(Boolean).sort();
      period = { from: ds[0], to: ds[ds.length - 1] };
    } else if (rep.from) period = { from: rep.from, to: rep.to };

    const budgetDaily = g.members.reduce((sum, e) => sum + (e.budget && norm(e.budgetType).startsWith("diario") ? e.budget : 0), 0) || null;
    const pacing = (budgetDaily && period) ? (() => {
      const days = Math.round((new Date(period.to) - new Date(period.from)) / 86400000) + 1;
      const planned = budgetDaily * days;
      return { planned, actual: g.spend, days, pct: planned ? (g.spend / planned) * 100 : null };
    })() : null;

    return {
      name: g.name, level, status: rep.status, objective: rep.objective, resultType: rep.resultType,
      memberCount: g.members.length,
      // jerarquía superior real (para ubicar un conjunto/anuncio en su campaña)
      parentCampaigns: level === "campaign" ? [] : [...new Set(g.members.map((e) => e.campaignName).filter(Boolean))],
      parentAdsets: level === "ad" ? [...new Set(g.members.map((e) => e.adsetName).filter(Boolean))] : [],
      spend: g.spend, results: g.results, impressions: g.impressions, reach: g.reach, igFollows: g.igFollows,
      linkClicks: g.linkClicks, linkClicksDerived: g.derived, reachNote,
      resultsMissing: g.missingAll,
      ctrLink: g.linkClicks !== null && g.impressions ? (g.linkClicks / g.impressions) * 100 : null,
      cpc: g.linkClicks ? g.spend / g.linkClicks : null,
      clickToLead: g.linkClicks && !g.missingAll ? (g.results / g.linkClicks) * 100 : null,
      cpl: g.results ? g.spend / g.results : null,
      cpm: g.impressions ? (g.spend / g.impressions) * 1000 : null,
      frequency: g.reach && g.impressions !== null ? g.impressions / g.reach : null,
      costPerFollower: g.igFollows ? g.spend / g.igFollows : null,
      budgetDaily, attribution: rep.attribution, period, pacing, dims,
    };
  }).sort((a, b) => b.spend - a.spend);

  // rollup por objetivo (para titulares) — igual que antes, ahora sobre
  // las entidades ya agrupadas al nivel elegido
  const objMap = new Map();
  campaigns.forEach((c) => {
    const o = objMap.get(c.objective) || { objective: c.objective, campaigns: [], spend: 0, results: 0, impressions: null, reach: null, linkClicks: null, igFollows: 0 };
    o.campaigns.push(c.name);
    o.spend += c.spend; o.results += c.results; o.igFollows += c.igFollows;
    OPT.forEach((k) => (o[k] = addN(o[k], c[k])));
    objMap.set(c.objective, o);
  });
  const objectives = [...objMap.values()].map((o) => ({
    ...o,
    cpl: o.results ? o.spend / o.results : null,
    cpm: o.impressions ? (o.spend / o.impressions) * 1000 : null,
    frequency: o.reach && o.impressions !== null ? o.impressions / o.reach : null,
  })).sort((a, b) => b.spend - a.spend);

  return { currency, level, campaigns, objectives };
}

/** API principal: parsea + agrupa en un solo llamado. `level` es el nivel
 *  pedido por el usuario; si esos datos no tienen ese nivel disponible,
 *  cae automáticamente al disponible más fino sin fallar en silencio —
 *  `effectiveLevel` en el resultado indica cuál se usó realmente. */
export function buildModel(allRows, currency, campaignsCsv = [], level = "campaign") {
  const base = buildBaseEntities(allRows, campaignsCsv);
  const effectiveLevel = base.availableLevels.includes(level)
    ? level
    : base.availableLevels[base.availableLevels.length - 1] ?? "campaign";
  const grouped = groupEntities(base, effectiveLevel, currency);
  return { ...grouped, effectiveLevel, availableLevels: base.availableLevels, requestedLevel: level };
}
