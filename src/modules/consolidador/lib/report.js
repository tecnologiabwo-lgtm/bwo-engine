/* ============================================================
   INFORME EJECUTIVO — generador de documento autocontenido
   Produce un HTML imprimible (→ PDF) con gráficos SVG dibujados
   a partir de los datos, tablas y una descripción de qué explica
   cada sección. Todo en el navegador; no inventa ninguna cifra.
   ============================================================ */

const P = { ink: "#1E1252", violet: "#6C3FBF", amber: "#F5A623", magenta: "#E91E8C", teal: "#00C9B7",
  slate: "#5A6C7A", mute: "#8A99A5", line: "#D6DDE2", paper: "#F4F6F7" };

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const nf = (n, d = 0) => (n === null || n === undefined || !isFinite(n) ? "—" : new Intl.NumberFormat("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n));
const mny = (n, cur) => (n === null || n === undefined || !isFinite(n) ? "—" : new Intl.NumberFormat("es-ES", { style: "currency", currency: cur || "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n));
const pc = (n, d = 1) => (n === null || n === undefined || !isFinite(n) ? "—" : nf(n, d) + " %");
const GEN = { male: "Hombres", female: "Mujeres", unknown: "N/D" };
const gl = (l) => GEN[String(l).toLowerCase()] || l;

/* ---------- gráficos SVG generados desde los datos ---------- */

/** Barras horizontales con etiqueta de valor y métrica secundaria. */
function svgBars(rows, { valueKey = "results", labelKey = "label", secondary = null, color = P.violet, cur = "USD", max = 12, fmtV = null } = {}) {
  const data = rows.slice(0, max);
  if (!data.length) return "";
  const w = 700, rowH = 26, padL = 165, padR = 130, top = 8;
  const h = top + data.length * rowH + 10;
  const maxV = Math.max(...data.map((d) => d[valueKey] || 0), 1);
  const bars = data.map((d, i) => {
    const y = top + i * rowH;
    const bw = Math.max(1, ((d[valueKey] || 0) / maxV) * (w - padL - padR));
    const raw = String(d[labelKey]);
    const lab = esc(raw.length > 26 ? raw.slice(0, 25) + "…" : raw);
    const sec = secondary ? esc(secondary(d)) : "";
    return `<text x="${padL - 8}" y="${y + 14}" text-anchor="end" font-size="11" fill="${P.ink}">${lab}</text>
<rect x="${padL}" y="${y + 4}" width="${bw}" height="15" fill="${color}" rx="2"/>
<text x="${padL + bw + 7}" y="${y + 15}" font-size="10.5" fill="${P.slate}">${fmtV ? esc(fmtV(d[valueKey])) : nf(d[valueKey])}${sec ? " · " + sec : ""}</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" style="max-height:${h}px" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
}

/** Línea temporal simple con eje base y máximo anotado. */
function svgLine(rows, { valueKey = "value", color = P.violet, label = "" } = {}) {
  const data = rows.filter((r) => r[valueKey] !== null && r[valueKey] !== undefined);
  if (data.length < 2) return "";
  const w = 700, h = 170, padL = 46, padR = 12, padT = 14, padB = 26;
  const maxV = Math.max(...data.map((d) => d[valueKey]));
  const minV = 0;
  const x = (i) => padL + (i / (data.length - 1)) * (w - padL - padR);
  const y = (v) => padT + (1 - (v - minV) / (maxV - minV || 1)) * (h - padT - padB);
  const pts = data.map((d, i) => `${x(i).toFixed(1)},${y(d[valueKey]).toFixed(1)}`).join(" ");
  const area = `${padL},${h - padB} ${pts} ${x(data.length - 1)},${h - padB}`;
  const first = data[0].date || data[0].label || "";
  const last = data[data.length - 1].date || data[data.length - 1].label || "";
  const grid = [0, 0.5, 1].map((f) => {
    const v = minV + f * (maxV - minV); const yy = y(v);
    return `<line x1="${padL}" y1="${yy}" x2="${w - padR}" y2="${yy}" stroke="${P.line}" stroke-width="1"/>
<text x="${padL - 6}" y="${yy + 3}" text-anchor="end" font-size="9" fill="${P.mute}">${nf(v)}</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" xmlns="http://www.w3.org/2000/svg">
${grid}<polygon points="${area}" fill="${color}" opacity="0.10"/>
<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2"/>
<text x="${padL}" y="${h - 8}" font-size="9" fill="${P.mute}">${esc(String(first).slice(5))}</text>
<text x="${w - padR}" y="${h - 8}" text-anchor="end" font-size="9" fill="${P.mute}">${esc(String(last).slice(5))}</text>
${label ? `<text x="${w - padR}" y="${padT}" text-anchor="end" font-size="10" fill="${P.slate}">${esc(label)}</text>` : ""}</svg>`;
}

/** Barras verticales de inversión + línea de resultados (ritmo diario). */
function svgDaily(days, cur, noResults = false) {
  const data = days.filter((d) => d.label);
  if (data.length < 2) return "";
  const w = 700, h = 200, padL = 44, padR = 40, padT = 14, padB = 28;
  const maxS = Math.max(...data.map((d) => d.spend || 0), 0.01);
  const maxR = Math.max(...data.map((d) => d.results || 0), 1);
  const bw = Math.max(2, (w - padL - padR) / data.length - 2);
  const x = (i) => padL + (i / data.length) * (w - padL - padR);
  const yS = (v) => padT + (1 - v / maxS) * (h - padT - padB);
  const yR = (v) => padT + (1 - v / maxR) * (h - padT - padB);
  const bars = data.map((d, i) => `<rect x="${x(i).toFixed(1)}" y="${yS(d.spend || 0).toFixed(1)}" width="${bw.toFixed(1)}" height="${(h - padB - yS(d.spend || 0)).toFixed(1)}" fill="${P.ink}" opacity="0.75"/>`).join("");
  const pts = noResults ? "" : data.map((d, i) => `${(x(i) + bw / 2).toFixed(1)},${yR(d.results || 0).toFixed(1)}`).join(" ");
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" xmlns="http://www.w3.org/2000/svg">
<line x1="${padL}" y1="${h - padB}" x2="${w - padR}" y2="${h - padB}" stroke="${P.line}"/>
${bars}${pts ? `<polyline points="${pts}" fill="none" stroke="${P.teal}" stroke-width="2"/>` : ""}
<text x="${padL}" y="${h - 8}" font-size="9" fill="${P.mute}">${esc(data[0].label.slice(5))}</text>
<text x="${w - padR}" y="${h - 8}" text-anchor="end" font-size="9" fill="${P.mute}">${esc(data[data.length - 1].label.slice(5))}</text>
<text x="${padL}" y="${padT - 2}" font-size="9" fill="${P.ink}">${noResults ? "Barras: inversión (sin resultados exportados)" : "Barras: inversión · Línea: resultados"}</text></svg>`;
}

/** Mapa de calor por día de semana. */
function svgHeat(hm) {
  if (!hm || !hm.cells.length) return "";
  const cols = hm.weeks.length, cw = 40, ch = 26, padL = 42, padT = 18;
  const w = padL + cols * cw + 8, h = padT + 7 * ch + 8;
  let out = "";
  hm.dowNames.forEach((name, dow) => {
    out += `<text x="${padL - 6}" y="${padT + dow * ch + 17}" text-anchor="end" font-size="10" fill="${P.slate}">${name}</text>`;
    hm.weeks.forEach((wk, ci) => {
      const c = hm.cells.find((x) => x.dow === dow && x.week === wk);
      const xx = padL + ci * cw, yy = padT + dow * ch;
      const a = c && hm.max ? 0.10 + 0.9 * (c.value / hm.max) : 0;
      out += `<rect x="${xx}" y="${yy + 2}" width="${cw - 3}" height="${ch - 4}" rx="2" fill="${c ? P.violet : "#EEF1F2"}" opacity="${c ? a.toFixed(2) : 1}"/>`;
      if (c && c.value) out += `<text x="${xx + (cw - 3) / 2}" y="${yy + 17}" text-anchor="middle" font-size="10" fill="${a > 0.55 ? "#fff" : P.ink}">${c.value}</text>`;
    });
  });
  hm.weeks.forEach((wk, ci) => { out += `<text x="${padL + ci * cw + (cw - 3) / 2}" y="${padT - 4}" text-anchor="middle" font-size="9" fill="${P.mute}">S${ci + 1}</text>`; });
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" style="max-width:${w}px" xmlns="http://www.w3.org/2000/svg">${out}</svg>`;
}

/* ---------- tablas ---------- */
function table(headers, rows, { totalRow = false } = {}) {
  if (!rows.length) return "";
  // columnas sin ningún dato (todas "—") se omiten: en un documento para el
  // cliente una columna vacía es ruido, y su ausencia ya se explica en Metodología.
  const keep = headers.map((_, i) => i === 0 || rows.some((r) => r[i] !== "—"));
  headers = headers.filter((_, i) => keep[i]);
  rows = rows.map((r) => r.filter((_, i) => keep[i]));
  const th = headers.map((h) => `<th${h.r ? ' class="r"' : ""}>${esc(h.label ?? h)}</th>`).join("");
  const tr = rows.map((r, ri) => `<tr${totalRow && ri === rows.length - 1 ? ' class="tot"' : ""}>${r.map((c, i) => `<td${headers[i]?.r ? ' class="r"' : ""}>${c}</td>`).join("")}</tr>`).join("");
  return `<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

/* ---------- descripciones por sección ---------- */
const DESC = {
  kpisCamp: "Cada indicador resume un aspecto distinto de la campaña. El costo por resultado es el indicador rector: traduce la inversión publicitaria a economía del negocio. La frecuencia anticipa el desgaste de la audiencia, y el pacing muestra si el presupuesto se ejecutó según lo planificado.",
  funnel: "Muestra cuántas personas distintas vieron los anuncios y cuántas terminaron convirtiendo. La distancia entre alcance y resultados indica cuánta atención se convirtió en acción.",
  daily: "El ritmo diario permite identificar qué días concentraron los mejores resultados y a qué costo. Los tramos de mayor eficiencia sirven como referencia para replicar creativos y ajustes en el siguiente ciclo.",
  age: "Distribuye los resultados por franja de edad y expone el costo por lead de cada una. Las franjas con costo por debajo del promedio son candidatas a recibir más presupuesto; las que gastan sin generar resultados son candidatas a exclusión.",
  gender: "Compara el rendimiento entre hombres y mujeres. Cuando la diferencia de costo es pequeña, conviene personalizar mensajes en lugar de excluir un grupo.",
  region: "Ordena las regiones por volumen de resultados e incorpora el alcance y la tasa de conversión sobre impresiones. Permite detectar territorios eficientes que aún operan con volumen bajo y podrían escalarse de forma controlada.",
  placement: "Compara el rendimiento entre las ubicaciones donde se muestran los anuncios. Determina qué formato debe guiar el diseño creativo: las ubicaciones verticales requieren piezas nativas, no adaptaciones de material horizontal.",
  heat: "Cruza los resultados por día de la semana. La intensidad del color representa el volumen de resultados y ayuda a detectar patrones de comportamiento semanal para ajustar la programación.",
  findCamp: "Hallazgos generados a partir de los datos de la campaña. Cada uno cierra con una acción concreta y la métrica que debe vigilarse para verificar su efecto.",
  kpisOrg: "Desempeño del contenido propio de la cuenta, no atribuible a la inversión publicitaria. Sirve como contexto: mide el alcance que la marca consigue por sí misma.",
  series: "Evolución diaria de cada métrica en su propia escala. Separar los ejes evita que las métricas de mayor volumen oculten el comportamiento de las demás.",
  audience: "Composición de la comunidad que sigue la cuenta. Conviene contrastarla con los segmentos que realmente convierten en la campaña: coincidencia y divergencia informan decisiones distintas.",
  posts: "Publicaciones ordenadas por alcance. Identificar qué piezas concentraron la atención permite reconocer temas y formatos que funcionan para replicarlos.",
  weekly: "Cuántas piezas subió la cuenta cada semana (lunes a domingo), separando publicaciones de feed (reels, carruseles e imágenes) de historias. La constancia de publicación sostiene el alcance orgánico: las semanas sin feed suelen coincidir con caídas de visualizaciones.",
  findOrg: "Hallazgos sobre el contenido orgánico, con su acción recomendada y la métrica de control correspondiente.",
};

/** Frase de ritmo de publicación para el resumen ejecutivo. */
function weeklySentence(w) {
  const parts = [];
  if (w.hasFeed) parts.push(`${nf(w.totals.feed)} publicaciones de feed (${nf(w.avgFeed, 1)} por semana)`);
  if (w.hasStories) parts.push(`${nf(w.totals.stories)} historias (${nf(w.avgStories, 1)} por semana)`);
  if (!parts.length) return "";
  return `<p><b>Contenido orgánico.</b> Entre ${esc(w.period.from)} y ${esc(w.period.to)} la cuenta subió ${parts.join(" y ")}.${!w.hasFeed ? " No se cargó el archivo de publicaciones de feed." : ""}${!w.hasStories ? " No se cargó el archivo de historias." : ""}</p>`;
}

const SEV = (f) => (f.sev === "buena" ? "A favor" : f.sev === "alta" ? "Prioridad alta" : "Atención");
function findingHtml(f) {
  return `<div class="find ${esc(f.sev)}"><div class="ftitle"><span class="sev">${SEV(f)}</span>${esc(f.title)}</div><p>${esc(f.text)}</p>${f.action ? `<div class="act"><b>${esc(f.action.do)}</b> → ${esc(f.action.on)} → vigilar ${esc(f.action.watch)}</div>` : ""}</div>`;
}

/** Barras apiladas por semana: feed (violeta) + historias (teal). */
function svgWeeks(weekly) {
  if (!weekly?.weeks?.length) return "";
  const data = weekly.weeks;
  const w = 700, rowH = 26, padL = 120, padR = 120, top = 8;
  const h = top + data.length * rowH + 22;
  const maxV = Math.max(...data.map((d) => d.feed + d.stories + d.other), 1);
  const sc = (v) => (v / maxV) * (w - padL - padR);
  const rows = data.map((d, i) => {
    const y = top + i * rowH;
    const f = sc(d.feed), s = sc(d.stories), o = sc(d.other);
    return `<text x="${padL - 8}" y="${y + 14}" text-anchor="end" font-size="11" fill="${P.ink}">${esc(d.label)}${d.partial ? " *" : ""}</text>
${f ? `<rect x="${padL}" y="${y + 4}" width="${f}" height="15" fill="${P.violet}"/>` : ""}
${s ? `<rect x="${padL + f}" y="${y + 4}" width="${s}" height="15" fill="${P.teal}"/>` : ""}
${o ? `<rect x="${padL + f + s}" y="${y + 4}" width="${o}" height="15" fill="${P.mute}"/>` : ""}
<text x="${padL + f + s + o + 7}" y="${y + 15}" font-size="10.5" fill="${P.slate}">${weekly.hasFeed ? `${d.feed} feed` : ""}${weekly.hasFeed && weekly.hasStories ? " · " : ""}${weekly.hasStories ? `${d.stories} historias` : ""}${d.other ? ` · ${d.other} otras` : ""}</text>`;
  }).join("");
  const ly = top + data.length * rowH + 12;
  const legend = `${weekly.hasFeed ? `<rect x="${padL}" y="${ly - 8}" width="10" height="10" fill="${P.violet}"/><text x="${padL + 14}" y="${ly + 1}" font-size="10" fill="${P.slate}">Publicaciones de feed</text>` : ""}
${weekly.hasStories ? `<rect x="${padL + 150}" y="${ly - 8}" width="10" height="10" fill="${P.teal}"/><text x="${padL + 164}" y="${ly + 1}" font-size="10" fill="${P.slate}">Historias</text>` : ""}`;
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" style="max-height:${h}px" xmlns="http://www.w3.org/2000/svg">${rows}${legend}</svg>`;
}

/* ============================================================
   GENERADOR PRINCIPAL
   El informe incluye TODAS las entidades del nivel de agrupación
   activo (campañas, conjuntos o anuncios): un comparativo por
   objetivo y luego una sección completa por cada entidad, con sus
   propios KPI, desgloses y hallazgos (con las ediciones del equipo).
   ============================================================ */
export function buildReportHtml({
  client, model, entities, levelLabel = "Campaña", levelPlural = "Campañas",
  // compatibilidad: una sola campaña
  campaign, kpis, findings, campEdits,
  organicFindings, orgEdits, series, posts, audience, fbAudience, organicKpis, weekly, heatmapFn,
}) {
  const cur = model?.currency || "USD";
  const today = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  const applyEdit = (f, i, edits) => ({ ...f, title: edits?.[i]?.title ?? f.title, text: edits?.[i]?.text ?? f.text });
  const ents = (entities && entities.length ? entities : campaign ? [{ c: campaign, kpis, findings, edits: campEdits }] : [])
    .filter((e) => e && e.c);
  const multi = ents.length > 1;
  const lvl = levelLabel.toLowerCase();
  const lvlP = levelPlural.toLowerCase();

  const sec = (title, desc, body, cls = "") => body ? `<section${cls ? ` class="${cls}"` : ""}><h2>${esc(title)}</h2><p class="desc">${esc(desc)}</p>${body}</section>` : "";
  const sub = (title, desc, body) => body ? `<section><h3 class="sub">${esc(title)}</h3><p class="desc">${esc(desc)}</p>${body}</section>` : "";

  /* --- periodo global: unión de los periodos de todas las entidades --- */
  const pers = [...ents.map((e) => e.c.period), weekly?.period].filter(Boolean);
  const pFrom = pers.map((p) => p.from).sort()[0];
  const pTo = pers.map((p) => p.to).sort().slice(-1)[0];
  const orgPeriod = weekly?.period ? `${weekly.period.from} a ${weekly.period.to}` : null;
  const period = pFrom ? `${pFrom} a ${pTo}` : orgPeriod || "Periodo no especificado";

  let html = `<div class="cover">
<div class="brand">BIG WAY OFFICES</div>
<h1>Informe de desempeño</h1>
<div class="client">${esc(client)}</div>
<div class="period">${esc(period)}</div>
<div class="meta">${ents.length ? `${ents.length} ${esc(ents.length === 1 ? lvl : lvlP)} · ` : ""}Generado el ${esc(today)}</div>
</div>`;

  /* --- índice (solo con varias entidades) --- */
  if (multi) {
    html += `<nav class="toc"><div class="toc-h">Contenido</div><ol>
<li><a href="#comparativo">Resumen ejecutivo y comparativo de ${esc(lvlP)}</a></li>
${ents.map((e, i) => `<li><a href="#ent-${i}">${esc(e.c.name)}</a> <span class="mute">· ${esc(e.c.objective)}</span></li>`).join("")}
${(organicKpis?.length || posts?.length || audience) ? `<li><a href="#organico">Contenido orgánico</a></li>` : ""}
<li><a href="#metodo">Metodología y alcance</a></li></ol></nav>`;
  }

  /* --- resumen ejecutivo --- */
  if (ents.length === 1) {
    const c = ents[0].c;
    html += `<section class="exec" id="comparativo">
<h2>Resumen ejecutivo</h2>
${c.resultsMissing
  ? `<p><b>Resultado principal.</b> ${esc(levelLabel)} «${esc(c.name)}» invirtió ${mny(c.spend, cur)}. Meta no exportó el indicador de resultado, por lo que no se reportan resultados ni costo por resultado: el dato no viene en el archivo, no equivale a cero.</p>`
  : `<p><b>Resultado principal.</b> ${esc(levelLabel)} «${esc(c.name)}» generó ${nf(c.results)} ${esc(c.objective.toLowerCase())} con una inversión de ${mny(c.spend, cur)}, a un costo por resultado de ${mny(c.cpl, cur)}.</p>`}
${c.frequency !== null && c.frequency !== undefined
  ? `<p>La entrega alcanzó ${nf(c.reach)} personas con ${nf(c.impressions)} impresiones, lo que sitúa la frecuencia en ${nf(c.frequency, 2)} impresiones por persona${c.frequency >= 2.2 ? ", por encima del umbral de rotación creativa recomendado" : ", dentro de un rango saludable"}.</p>`
  : (c.reach ? `<p>La entrega alcanzó ${nf(c.reach)} personas. La exportación no incluye impresiones, por lo que la frecuencia no puede calcularse.</p>` : "")}
${c.linkClicks ? `<p>Se registraron ${nf(c.linkClicks)} clics en el enlace (CTR ${pc(c.ctrLink, 2)}) a un costo de ${mny(c.cpc, cur)} por clic${c.clickToLead !== null && c.clickToLead !== undefined ? `; el ${pc(c.clickToLead, 1)} de esos clics terminó en un resultado` : ""}.</p>` : ""}
${c.pacing ? `<p>Se ejecutó ${pc(c.pacing.pct, 0)} del presupuesto planificado (${mny(c.pacing.actual, cur)} de ${mny(c.pacing.planned, cur)}) a lo largo de ${c.pacing.days} días.</p>` : ""}
${weekly ? weeklySentence(weekly) : ""}
</section>`;
  } else if (multi) {
    const objs = model?.objectives?.length ? model.objectives : [];
    const paras = objs.map((o) => {
      const list = ents.filter((e) => e.c.objective === o.objective).map((e) => e.c);
      if (!list.length) return "";
      const withRes = list.filter((c) => !c.resultsMissing && c.results > 0);
      const allMissing = list.every((c) => c.resultsMissing);
      const best = [...withRes].sort((a, b) => a.cpl - b.cpl)[0];
      const top = [...withRes].sort((a, b) => b.results - a.results)[0];
      const miss = list.filter((c) => c.resultsMissing);
      return `<p><b>${esc(o.objective)}.</b> ${list.length} ${esc(list.length === 1 ? lvl : lvlP)} con una inversión conjunta de ${mny(o.spend, cur)}${allMissing ? `; Meta no exportó el indicador de resultado, por lo que se reporta solo la inversión` : `, que generaron ${nf(o.results)} resultados a un costo global de ${mny(o.cpl, cur)} por resultado`}.${best && withRes.length > 1 ? ` El menor costo por resultado lo obtuvo «${esc(best.name)}» (${mny(best.cpl, cur)})${top && top.name !== best.name ? ` y el mayor volumen «${esc(top.name)}» (${nf(top.results)})` : ""}.` : ""}${miss.length && !allMissing ? ` ${miss.length === 1 ? `«${esc(miss[0].name)}» no trae` : `${miss.length} ${esc(lvlP)} no traen`} el indicador de resultado en la exportación: se reporta${miss.length === 1 ? "" : "n"} su inversión, no un cero.` : ""}</p>`;
    }).join("");
    html += `<section class="exec" id="comparativo">
<h2>Resumen ejecutivo</h2>
<p>Este informe cubre <b>${ents.length} ${esc(lvlP)}</b>. Cada objetivo se reporta por separado: los resultados de objetivos distintos no son comparables ni se suman entre sí.</p>
${paras}
${weekly ? weeklySentence(weekly) : ""}
</section>`;

    /* --- comparativo por objetivo --- */
    html += `<h1 class="part">Comparativo de ${esc(lvlP)}</h1>`;
    objs.forEach((o) => {
      const list = ents.filter((e) => e.c.objective === o.objective).map((e) => e.c);
      if (!list.length) return;
      const parentOf = (c) => [...(c.parentCampaigns || []), ...(c.parentAdsets || [])].filter((x) => x !== c.name).join(" › ");
      const rows = list.map((c, i) => [
        `<b><a href="#ent-${ents.findIndex((e) => e.c === c)}">${esc(c.name)}</a></b>${parentOf(c) ? `<div class="parent">${esc(parentOf(c))}</div>` : ""}`,
        mny(c.spend, cur),
        o.spend ? pc((c.spend / o.spend) * 100, 1) : "—",
        c.resultsMissing ? "<span class='mute'>sin datos</span>" : nf(c.results),
        c.resultsMissing ? "—" : c.results ? mny(c.cpl, cur) : "<span class='mute'>sin resultados</span>",
        mny(c.cpm, cur), nf(c.reach), nf(c.frequency, 2), pc(c.ctrLink, 2),
        c.pacing ? pc(c.pacing.pct, 0) : "—",
      ]);
      const allMissing = list.every((c) => c.resultsMissing);
      rows.push([
        `<b>Total ${esc(o.objective.toLowerCase())}</b>`, `<b>${mny(o.spend, cur)}</b>`, list.length > 1 ? "100 %" : "—",
        allMissing ? "<span class='mute'>sin datos</span>" : `<b>${nf(o.results)}</b>`, allMissing ? "—" : `<b>${mny(o.cpl, cur)}</b>`,
        mny(o.cpm, cur), "—", "—", "—", "—",
      ]);
      const tbl = table(
        [{ label: levelLabel }, { label: "Inversión", r: 1 }, { label: "% inv.", r: 1 }, { label: "Resultados", r: 1 }, { label: "Costo/result.", r: 1 }, { label: "CPM", r: 1 }, { label: "Alcance", r: 1 }, { label: "Frec.", r: 1 }, { label: "CTR", r: 1 }, { label: "Pacing", r: 1 }],
        rows, { totalRow: true }
      );
      const chart = allMissing ? "" : svgBars(list.filter((c) => !c.resultsMissing).map((c) => ({ label: c.name, results: c.results, cpl: c.cpl })),
        { secondary: (d) => d.cpl ? mny(d.cpl, cur) : "sin resultados", color: P.violet, max: 15 });
      html += sec(`${o.objective} · ${list.length} ${list.length === 1 ? lvl : lvlP}`,
        `Resultados, costo y entrega de cada ${lvl} del objetivo. El total suma inversión, resultados e impresiones; el alcance no se suma porque una misma persona puede haber visto ${levelLabel === "Campaña" ? "varias" : "varios"} ${lvlP}.`,
        chart + tbl);
    });
  }

  /* ============ BLOQUE POR ENTIDAD ============ */
  ents.forEach((e, idx) => {
    const c = e.c;
    const head = multi
      ? `<h1 class="part ent" id="ent-${idx}"><span class="ent-n">${esc(levelLabel)} ${idx + 1} de ${ents.length}</span>${esc(c.name)}</h1>
<div class="ent-meta">${esc(c.objective)}${c.period ? ` · ${esc(c.period.from)} a ${esc(c.period.to)}` : ""}${(c.parentCampaigns || []).filter((x) => x !== c.name).length ? ` · Campaña: ${esc(c.parentCampaigns.join(", "))}` : ""}${(c.parentAdsets || []).filter((x) => x !== c.name).length ? ` · Conjunto: ${esc(c.parentAdsets.join(", "))}` : ""}</div>`
      : `<h1 class="part" id="ent-0">${esc(levelPlural)}</h1>`;
    html += head;
    const S = multi ? sub : sec;

    // KPIs
    const kpiCards = (e.kpis || []).map((k) => `<div class="kpi"><div class="klab">${esc(k.label)}</div><div class="kval">${esc(k.value)}</div><div class="knote">${esc(k.note)}</div></div>`).join("");
    html += S("Indicadores del periodo", DESC.kpisCamp, kpiCards ? `<div class="kgrid">${kpiCards}</div>` : "");

    // Embudo
    html += S("Del alcance al resultado", DESC.funnel, svgBars(
      [{ label: "Impresiones", results: c.impressions }, { label: "Alcance", results: c.reach },
       { label: "Clics en el enlace", results: c.linkClicks }, { label: c.objective, results: c.resultsMissing ? null : c.results }]
        .filter((x) => x.results !== null && x.results !== undefined),
      { color: P.ink }
    ));

    // Ritmo diario
    if (c.dims.day?.length) {
      const best = [...c.dims.day].filter((d) => d.results > 0).sort((a, b) => a.cpl - b.cpl).slice(0, 3);
      html += S("Ritmo diario", DESC.daily, svgDaily(c.dims.day, cur, c.resultsMissing) +
        (best.length ? `<p class="note">Días de menor costo por resultado: ${best.map((d) => `${esc(d.label.slice(5))} (${mny(d.cpl, cur)})`).join(", ")}.</p>` : ""));
    }

    // Dimensiones
    [["age", "Resultados por edad", DESC.age], ["gender", "Resultados por sexo", DESC.gender], ["placement", "Resultados por ubicación", DESC.placement]]
      .forEach(([dim, title, desc]) => {
        const rows = c.dims[dim];
        if (!rows?.length) return;
        const disp = rows.map((r) => ({ ...r, label: dim === "gender" ? gl(r.label) : r.label }));
        // sin resultados exportados: el gráfico muestra inversión, no ceros
        const chart = c.resultsMissing
          ? svgBars(disp, { valueKey: "spend", fmtV: (v) => mny(v, cur), color: dim === "placement" ? P.teal : P.violet })
          : svgBars(disp, { secondary: (d) => d.cpl ? mny(d.cpl, cur) : "sin resultados", color: dim === "placement" ? P.teal : P.violet, cur });
        const tbl = table(
          [{ label: title.split(" por ")[1].replace(/^\w/, (x) => x.toUpperCase()) }, { label: "Inversión", r: 1 }, { label: "Impresiones", r: 1 }, { label: "Resultados", r: 1 }, { label: "Costo/result.", r: 1 }],
          disp.map((r) => [`<b>${esc(r.label)}</b>`, mny(r.spend, cur), nf(r.impressions), c.resultsMissing ? "—" : nf(r.results), c.resultsMissing ? "—" : r.results ? mny(r.cpl, cur) : "<span class='mute'>sin resultados</span>"])
        );
        html += S(title, desc, chart + tbl);
      });

    // Región
    if (c.dims.region?.length) {
      const rows = c.dims.region;
      const chart = c.resultsMissing
        ? svgBars(rows, { valueKey: "spend", fmtV: (v) => mny(v, cur), color: P.magenta })
        : svgBars(rows, { secondary: (d) => d.cpl ? mny(d.cpl, cur) : "sin resultados", color: P.magenta, cur });
      const tbl = table(
        [{ label: "Región" }, { label: "Inversión", r: 1 }, { label: "Impresiones", r: 1 }, { label: "Alcance", r: 1 }, { label: "Conversión", r: 1 }, { label: "Resultados", r: 1 }, { label: "Costo/result.", r: 1 }],
        rows.map((r) => [`<b>${esc(r.label)}</b>`, mny(r.spend, cur), nf(r.impressions), nf(r.reach), !c.resultsMissing && r.impressions ? pc((r.results / r.impressions) * 100, 2) : "—", c.resultsMissing ? "—" : nf(r.results), c.resultsMissing ? "—" : r.results ? mny(r.cpl, cur) : "<span class='mute'>sin resultados</span>"])
      );
      html += S("Desempeño por región", DESC.region, chart + tbl);
    }

    // Heatmap
    if (c.dims.day?.length && heatmapFn && !c.resultsMissing) {
      const hm = heatmapFn(c.dims.day.map((d) => ({ date: d.label, results: d.results })), "results");
      if (hm) html += S("Resultados por día de la semana", DESC.heat,
        svgHeat(hm) + `<p class="note">Totales por día: ${hm.byDow.map((d) => `${d.name} ${d.sum}`).join(" · ")}.</p>`);
    }

    // Hallazgos + decisiones
    const fs = (e.findings || []).map((f, i) => applyEdit(f, i, e.edits));
    if (fs.length) {
      const items = fs.map(findingHtml).join("");
      const decs = fs.filter((f) => f.action).slice(0, 5).map((f) => `<li><b>${esc(f.action.do)}</b> → ${esc(f.action.on)} → <span class="mute">vigilar ${esc(f.action.watch)}</span></li>`).join("");
      html += S(multi ? "Hallazgos" : "Hallazgos de campaña", DESC.findCamp, items + (decs ? `<h3>Decisiones para el próximo ciclo</h3><ol class="dec">${decs}</ol>` : ""));
    }
  });

  /* ============ BLOQUE ORGÁNICO ============ */
  const hasOrg = (organicKpis?.length || 0) > 0 || posts?.length || audience;
  if (hasOrg) {
    html += `<h1 class="part" id="organico">Contenido orgánico</h1>`;

    if (organicKpis?.length) {
      const cards = organicKpis.map((k) => `<div class="kpi"><div class="klab">${esc(k.label)}</div><div class="kval">${esc(k.value)}</div><div class="knote">${esc(k.note)}</div></div>`).join("");
      html += sec("Indicadores del contenido", DESC.kpisOrg, `<div class="kgrid">${cards}</div>`);
    }

    // Ritmo de publicación semanal
    if (weekly?.weeks?.length) {
      const fm = weekly.totals.formats;
      const hasFmt = (k) => fm[k] > 0;
      const head = [{ label: "Semana" }];
      if (weekly.hasFeed) { head.push({ label: "Feed", r: 1 }); ["reel", "carrusel", "imagen", "video"].filter(hasFmt).forEach((k) => head.push({ label: { reel: "Reels", carrusel: "Carruseles", imagen: "Imágenes", video: "Videos" }[k], r: 1 })); }
      if (weekly.hasStories) head.push({ label: "Historias", r: 1 });
      if (weekly.hasOther) head.push({ label: "Otras", r: 1 });
      head.push({ label: "Total", r: 1 });
      const rowOf = (lab, w, bold) => {
        const b = (x) => (bold ? `<b>${x}</b>` : x);
        const r = [lab];
        if (weekly.hasFeed) { r.push(b(nf(w.feed))); ["reel", "carrusel", "imagen", "video"].filter(hasFmt).forEach((k) => r.push(nf(w.formats[k]))); }
        if (weekly.hasStories) r.push(b(nf(w.stories)));
        if (weekly.hasOther) r.push(nf(w.other));
        r.push(b(nf(w.total)));
        return r;
      };
      const rows = weekly.weeks.map((w) => rowOf(`<span class="mono">${esc(w.label)}</span>${w.partial ? ` <span class="mute">(${w.days} d)</span>` : ""}`, w));
      rows.push(rowOf("<b>Total del periodo</b>", weekly.totals, true));
      const avg = [weekly.hasFeed ? `${nf(weekly.avgFeed, 1)} publicaciones de feed` : null, weekly.hasStories ? `${nf(weekly.avgStories, 1)} historias` : null].filter(Boolean).join(" y ");
      const notes = [
        avg ? `Promedio por semana: ${avg}.` : "",
        weekly.weeks.some((w) => w.partial) ? "Las semanas marcadas con días (d) quedan recortadas por el inicio o el fin del periodo." : "",
        !weekly.hasFeed ? "No se cargó el CSV de publicaciones de feed: esa columna no se reporta." : "",
        !weekly.hasStories ? "No se cargó el CSV de historias: esa columna no se reporta." : "",
        weekly.undated ? `${weekly.undated} publicaciones sin fecha no se pudieron ubicar en una semana.` : "",
      ].filter(Boolean).join(" ");
      html += sec("Ritmo de publicación semanal", DESC.weekly, svgWeeks(weekly) + table(head, rows, { totalRow: true }) + (notes ? `<p class="note">${esc(notes)}</p>` : ""));
    }

    // Series — Instagram y Facebook por separado, nunca combinadas
    const sSpecs = [["views", "Visualizaciones", P.ink], ["reach", "Alcance", P.violet], ["profileVisits", "Visitas al perfil", P.teal], ["followers", "Seguidores nuevos", P.amber],
      ["interactions", "Interacciones", P.magenta], ["linkClicks", "Clics en el enlace", P.slate], ["viewers", "Espectadores", P.magenta],
      ["fbViews", "Visualizaciones · Facebook", P.ink], ["fbReach", "Alcance · Facebook", P.violet], ["fbVisits", "Visitas · Facebook", P.teal], ["fbInteractions", "Interacciones · Facebook", P.magenta],
      ["fbFollowers", "Seguidores nuevos · Facebook", P.amber], ["fbLinkClicks", "Clics en el enlace · Facebook", P.slate], ["fbViewers", "Espectadores · Facebook", P.magenta]];
    const charts = sSpecs.filter(([k]) => series?.[k]?.length).map(([k, lab, col]) => {
      const tot = series[k].reduce((a, r) => a + r.value, 0);
      return `<div class="halfchart"><h4>${esc(lab)} <span class="mute">· total ${nf(tot)}</span></h4>${svgLine(series[k], { color: col })}</div>`;
    }).join("");
    if (charts) html += sec("Evolución diaria", DESC.series, `<div class="charts2">${charts}</div>`);

    // Audiencia — Instagram y Facebook en secciones separadas, nunca combinadas
    [[audience, fbAudience ? "Perfil de la audiencia · Instagram" : "Perfil de la audiencia", P.violet], [fbAudience, "Perfil de la audiencia · Facebook", P.ink]]
      .forEach(([a, title, col]) => {
        if (!a || !(a.ageGender?.length || a.cities?.length || a.countries?.length)) return;
        const rows = (a.ageGender || []).map((x) => ({ label: x.age, results: +(x.male + x.female).toFixed(1), male: x.male, female: x.female }));
        const chart = rows.length ? svgBars(rows, { secondary: (d) => `H ${nf(d.male, 1)}% · M ${nf(d.female, 1)}%`, color: col }) : "";
        const geo = [["cities", "Ciudad"], ["countries", "País"]].filter(([k]) => a[k]?.length)
          .map(([k, lab]) => table([{ label: lab }, { label: "Participación", r: 1 }], a[k].slice(0, 8).map((c) => [esc(c.label), pc(c.value)]))).join("");
        html += sec(title, DESC.audience, chart + (geo ? `<div class="charts2">${geo}</div>` : ""));
      });

    // Publicaciones
    if (posts?.length) {
      const top = [...posts].sort((a, b) => (b.reach || 0) - (a.reach || 0)).slice(0, 10);
      const tbl = table(
        [{ label: "Fecha" }, { label: "Tipo" }, { label: "Copy" }, { label: "Alcance", r: 1 }, { label: "Vistas", r: 1 }, { label: "Interacción", r: 1 }],
        top.map((p) => [
          `<span class="mono">${esc(p.date || "—")}</span>`,
          esc(String(p.type || "").replace(" de Instagram", "")),
          `<span class="copy">${esc((p.caption || "").slice(0, 110).replace(/\s+/g, " ")) || "<i>sin copy</i>"}</span>`,
          nf(p.reach), nf(p.views), nf(p.interactions),
        ])
      );
      html += sec("Publicaciones de mayor alcance", DESC.posts, tbl);
    }

    // Hallazgos orgánicos
    const ofs = (organicFindings || []).map((f, i) => applyEdit(f, i, orgEdits));
    if (ofs.length) {
      const items = ofs.map(findingHtml).join("");
      const decs = ofs.filter((f) => f.action).slice(0, 5).map((f) => `<li><b>${esc(f.action.do)}</b> → ${esc(f.action.on)} → <span class="mute">vigilar ${esc(f.action.watch)}</span></li>`).join("");
      html += sec("Hallazgos de contenido", DESC.findOrg, items + (decs ? `<h3>Decisiones para el próximo ciclo</h3><ol class="dec">${decs}</ol>` : ""));
    }
  }

  /* --- metodología --- */
  const otras = model?.objectives?.length > 1
    ? `<p>La cuenta registró ${model.objectives.length} objetivos distintos en el periodo cargado: ${model.objectives.map((o) => `${esc(o.objective)} (${nf(o.results)} resultados, ${mny(o.spend, cur)})`).join("; ")}. Los objetivos se reportan por separado: los resultados de campañas de mensajería no son comparables con los de generación de clientes potenciales.</p>` : "";
  html += `<section class="method" id="metodo"><h2>Metodología y alcance</h2>
<p class="desc">Cómo se calcularon las cifras de este informe y qué queda fuera de su alcance.</p>
<p>Todas las cifras provienen directamente de las exportaciones de Meta Ads Manager e Instagram Insights correspondientes al periodo indicado. El costo por resultado se calcula como inversión dividida entre resultados; el CPM como inversión dividida entre impresiones por mil; la frecuencia como impresiones dividida entre alcance.</p>
${otras}
${ents.length ? `<p>Las cifras de pauta se presentan a nivel de <b>${esc(lvl)}</b>. ${levelLabel === "Campaña" ? "Cada" : "Cada"} ${esc(lvl)} se suma una sola vez a partir de las filas más finas de la exportación, de modo que ningún resultado se cuenta dos veces entre campañas, conjuntos y anuncios. El alcance no se suma entre ${esc(lvlP)}: una misma persona puede haber visto ${levelLabel === "Campaña" ? "varias" : "varios"}.</p>` : ""}
<p><b>No se estiman, interpolan ni completan datos ausentes.</b> Cuando una métrica no está disponible en la exportación, se indica expresamente como «sin datos» junto con el archivo que la habilitaría.</p>
<p>Este informe no incorpora métricas comerciales posteriores al lead (contacto, cotización, venta cerrada), que residen en el CRM. La rentabilidad real de la inversión solo puede confirmarse al conectar ambas fuentes.</p>
<div class="foot">Big Way Offices · Informe de desempeño · ${esc(client)} · ${esc(today)}</div></section>`;

  /* --- documento completo --- */
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe de desempeño — ${esc(client)}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap');
*{box-sizing:border-box}
body{font-family:'Archivo',system-ui,sans-serif;color:#16202B;margin:0;padding:0 0 40px;background:#fff;font-size:13px;line-height:1.62;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.wrap{max-width:790px;margin:0 auto;padding:0 30px}
.mono{font-family:'IBM Plex Mono',monospace;font-size:11.5px}
.mute{color:${P.mute}}
.cover{background:${P.ink};color:#fff;padding:70px 40px 60px;margin-bottom:34px}
.cover .brand{font-size:11px;letter-spacing:.28em;color:${P.amber};font-weight:600;margin-bottom:26px}
.cover h1{font-size:33px;margin:0 0 18px;font-weight:800;letter-spacing:-.02em}
.cover .client{font-size:21px;font-weight:600;color:#fff}
.cover .period{font-size:14px;color:#B9C9D4;margin-top:5px}
.cover .meta{font-size:11.5px;color:#8FA3B2;margin-top:22px}
h1.part{font-size:23px;font-weight:800;color:${P.ink};margin:44px 0 4px;padding-bottom:9px;border-bottom:3px solid ${P.amber};letter-spacing:-.01em}
section{margin:26px 0 32px;page-break-inside:avoid}
h2{font-size:16px;font-weight:700;color:${P.ink};margin:0 0 5px}
h3{font-size:13.5px;font-weight:700;color:${P.ink};margin:22px 0 8px}
h4{font-size:12px;font-weight:600;margin:0 0 4px;color:${P.ink}}
.desc{color:${P.slate};font-size:12.5px;margin:0 0 15px;line-height:1.65}
.note{font-size:11.5px;color:${P.slate};margin:9px 0 0;font-style:italic}
.exec{background:${P.paper};border-left:4px solid ${P.amber};padding:20px 22px}
.exec p{margin:0 0 9px}.exec p:last-child{margin:0}
.kgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:1px;background:${P.line};border:1px solid ${P.line}}
.kpi{background:#fff;padding:12px 13px}
.klab{font-size:10.5px;font-weight:600;color:${P.slate};margin-bottom:5px}
.kval{font-size:20px;font-weight:800;letter-spacing:-.02em;color:${P.ink};line-height:1.1}
.knote{font-size:10px;color:${P.mute};margin-top:5px;line-height:1.4}
table{width:100%;border-collapse:collapse;font-size:11.5px;margin:14px 0 0}
th{text-align:left;font-size:9.5px;letter-spacing:.09em;text-transform:uppercase;color:${P.slate};font-weight:700;padding:7px 8px;border-bottom:2px solid ${P.line}}
td{padding:6px 8px;border-bottom:1px solid ${P.line}}
th.r,td.r{text-align:right;white-space:nowrap}
.copy{color:${P.slate};font-size:11px}
.charts2{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.halfchart{min-width:0}
.find{border-left:3px solid ${P.slate};padding:12px 15px;margin:0 0 10px;background:${P.paper};page-break-inside:avoid}
.find.alta{border-left-color:${P.magenta}}.find.media{border-left-color:${P.amber}}.find.buena{border-left-color:${P.teal}}
.ftitle{font-size:13px;font-weight:700;color:${P.ink};margin-bottom:4px}
.sev{font-size:9px;letter-spacing:.1em;text-transform:uppercase;background:#fff;border:1px solid ${P.line};color:${P.slate};padding:2px 6px;margin-right:8px;font-weight:600}
.find p{margin:0;font-size:12.5px;color:#2C3B49}
.act{margin-top:9px;padding-top:8px;border-top:1px dashed ${P.line};font-size:11px;color:${P.slate}}
.act b{color:${P.ink}}
ol.dec{margin:0;padding-left:20px;font-size:12.5px;line-height:1.95}
.toc{background:${P.paper};padding:16px 22px;margin:0 0 26px;font-size:12.5px}
.toc-h{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:${P.slate};font-weight:700;margin-bottom:6px}
.toc ol{margin:0;padding-left:20px;line-height:1.9}
.toc a,td a{color:${P.ink};text-decoration:none}
.parent{font-size:10px;color:${P.mute};margin-top:2px;font-weight:400}
tr.tot td{border-top:2px solid ${P.ink};background:${P.paper}}
h1.part.ent{font-size:20px;margin-top:52px}
.ent-n{display:block;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:${P.amber};font-weight:700;margin-bottom:4px}
.ent-meta{font-size:12px;color:${P.slate};margin:4px 0 8px}
h3.sub{font-size:14.5px;font-weight:700;color:${P.ink};margin:0 0 5px}
.method{background:${P.paper};padding:20px 22px;margin-top:34px}
.method p{margin:0 0 9px;font-size:12.5px}
.foot{margin-top:18px;padding-top:12px;border-top:1px solid ${P.line};font-size:10.5px;color:${P.mute}}
@media print{
  body{font-size:11.5px}
  .cover{padding:60px 40px;page-break-after:always}
  h1.part{page-break-before:always;margin-top:0}
  section{page-break-inside:avoid}
  .charts2{grid-template-columns:1fr 1fr}
}
@page{margin:14mm}
</style></head><body>
<div class="wrap">${html}</div>
</body></html>`;
}

/** Abre el informe en una ventana nueva lista para imprimir/guardar como PDF. */
export function openReport(html) {
  const w = window.open("", "_blank");
  if (!w) { alert("El navegador bloqueó la ventana emergente. Permite las ventanas emergentes para este sitio e inténtalo de nuevo."); return; }
  w.document.write(html);
  w.document.close();
}

/** Descarga el informe como archivo .html autocontenido. */
export function downloadReport(html, client) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `informe_${String(client).replace(/[^a-z0-9]+/gi, "_")}_${new Date().toISOString().slice(0, 10)}.html`;
  a.click();
  URL.revokeObjectURL(a.href);
}
