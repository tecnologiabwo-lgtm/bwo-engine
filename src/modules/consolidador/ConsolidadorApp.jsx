import React, { useState, useMemo, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Cell, ScatterChart, Scatter, ZAxis, LineChart,
  Sankey, Layer, Rectangle,
} from "recharts";
import { parseWorkbook, parseCampaignsCsv, buildModel, norm, num, toDay, LEVEL_LABEL } from "./lib/parser.js";
import { INTERVALS, bucketRows, heatmap, sankey } from "./lib/viz.js";
import { snapshotOf, validateSnapshot, encryptSnapshot, decryptSnapshot, mergeSnapshots, isSnapshot, isEncrypted } from "./lib/snapshots.js";
import { buildReportHtml, openReport, downloadReport } from "./lib/report.js";
import { resolveSeries, FB_KEY } from "./lib/series.js";
import { weeklyPosts } from "./lib/organic.js";
import { parseAudienceCsv, isAudienceTitle } from "./lib/audience.js";
import { motion, AnimatePresence } from "motion/react";
import { Money, Diff } from "./ui/Money.jsx";
import { Pills, TabPanel, PILLS_CSS } from "./ui/Pills.jsx";
import { construirPayload, pedirAnalisis } from "./lib/ai.js";
import { supabase } from "@/lib/supabase";
import { useClient } from "@/lib/clientContext";

/* ============================================================
   CONSOLIDADOR META ADS v2 — Big Way Offices
   - Procesa dos formatos de export de Meta (trimestre y "Meta report")
   - Desgloses por edad, sexo, región y ubicación
   - Separa objetivos (leads vs mensajería) y calcula pacing
   - Todo corre en el navegador; nada se sube a un servidor
   ============================================================ */

const C = {
  ink: "#0F1E2B", steel: "#1B3247", slate: "#5A6C7A", mute: "#8A99A5",
  line: "#D6DDE2", paper: "#EDF0F1", card: "#FFFFFF",
  amber: "#E39B2E", rust: "#C2492C", sea: "#1F7A6B", sky: "#2E6E9E",
};

const SERIES_TITLES = {
  "alcance": { key: "reach", label: "Alcance" },
  "visualizaciones": { key: "views", label: "Visualizaciones" },
  "visitas al perfil de instagram": { key: "profileVisits", label: "Visitas al perfil" },
  "seguidores de instagram": { key: "followers", label: "Seguidores nuevos" },
  "interacciones con el contenido": { key: "interactions", label: "Interacciones" },
  "clics en el enlace de instagram": { key: "linkClicks", label: "Clics en el enlace" },
  // Variantes de Facebook: la cuenta puede traer página de Facebook conectada
  // además de Instagram. Se mantienen en claves separadas a propósito — nunca
  // se suman a las de Instagram, para no mezclar el origen del dato.
  "visitas de facebook": { key: "fbVisits", label: "Visitas (Facebook)" },
  "seguidores de facebook": { key: "fbFollowers", label: "Seguidores nuevos (Facebook)" },
  "clics en el enlace de facebook": { key: "fbLinkClicks", label: "Clics en el enlace (Facebook)" },
  "espectadores": { key: "viewers", label: "Espectadores" },
};


// gráficos independientes de Facebook (cada uno con su propia escala)
const FB_CHARTS = [
  ["fbViews", "Visualizaciones", "#1B3247"], ["fbReach", "Alcance", "#2E6E9E"],
  ["fbVisits", "Visitas", "#1F7A6B"], ["fbInteractions", "Interacciones", "#C2492C"],
  ["fbFollowers", "Seguidores nuevos", "#E39B2E"], ["fbLinkClicks", "Clics en el enlace", "#5A6C7A"],
  ["fbViewers", "Espectadores", "#C2492C"],
];

const DIM_LABELS = { age: "Edad", gender: "Sexo", region: "Región", placement: "Ubicación", heatmap: "Mapa de calor" };
const GENDER_ES = { male: "Hombres", female: "Mujeres", unknown: "N/D" };

/* ---------- formato ---------- */
const money = (n, cur = "USD") =>
  n === null || n === undefined || !isFinite(n) ? "—"
    : new Intl.NumberFormat("es-ES", { style: "currency", currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const int = (n) => (n === null || n === undefined || !isFinite(n) ? "—" : new Intl.NumberFormat("es-ES").format(Math.round(n)));
const dec = (n, d = 2) => (n === null || n === undefined || !isFinite(n) ? "—" : new Intl.NumberFormat("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n));
const pct = (n, d = 1) => (n === null || n === undefined || !isFinite(n) ? "—" : dec(n, d) + " %");
const glabel = (g) => GENDER_ES[norm(g)] || g;

/* ---------- lectura de archivos auxiliares ---------- */
function decodeText(buf) {
  const b = new Uint8Array(buf);
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder("utf-16le").decode(buf);
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder("utf-16be").decode(buf);
  return new TextDecoder("utf-8").decode(buf).replace(/^\uFEFF/, "");
}
function parseInsightsCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "").filter((l) => !/^sep=/i.test(l.trim()));
  if (!lines.length) return { kind: "empty" };
  const title = norm(lines[0].replace(/"/g, ""));
  // «Público»: lectura con encabezado (el orden Hombres/Mujeres cambia entre archivos)
  if (isAudienceTitle(lines[0])) return { kind: "audience", audience: parseAudienceCsv(text) };
  const meta = SERIES_TITLES[title];
  const hIdx = lines.findIndex((l) => norm(l).includes("fecha"));
  if (!meta || hIdx === -1) return { kind: "unknown", title };
  const rows = [];
  for (let i = hIdx + 1; i < lines.length; i++) {
    const cells = Papa.parse(lines[i]).data[0] || [];
    const d = toDay(cells[0]); const v = num(cells[1]);
    if (d && v !== null) rows.push({ date: d, value: v });
  }
  return { kind: "series", metric: meta.key, label: meta.label, rows };
}
/** Fecha de "Hora de publicación". Meta exporta MM/DD/YYYY HH:MM.
    Si el primer número supera 12, es DD/MM (algunos locales). */
function postDate(v) {
  if (!v) return null;
  const m = String(v).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    let [, a, b, y] = m;
    const A = +a, B = +b;
    const mo = A > 12 ? B : A;   // si el primero >12, el mes es el segundo
    const da = A > 12 ? A : B;
    return `${y}-${String(mo).padStart(2, "0")}-${String(da).padStart(2, "0")}`;
  }
  return toDay(v);
}

/** Exportación de leads del CRM (Clientify u otro). Contiene datos personales
 *  (nombre, correo, teléfono): se leen SOLO para contar y agrupar. Ningún dato
 *  personal se guarda en el estado, ni se muestra, ni entra en snapshots o
 *  informes. El correo se usa de forma transitoria para contar contactos únicos. */
function parseLeadsCsv(text) {
  const res = Papa.parse(text, { header: true, skipEmptyLines: true });
  const leads = [];
  res.data.forEach((r) => {
    const o = {}; Object.entries(r).forEach(([k, v]) => (o[norm(k)] = v));
    const raw = String(o["fecha de creacion"] || "").trim();
    const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); // MM/DD/AAAA
    const date = m ? `${m[3]}-${String(m[1]).padStart(2, "0")}-${String(m[2]).padStart(2, "0")}` : null;
    leads.push({
      date,
      form: (o["formulario"] || "").trim() || "Sin formulario",
      origin: (o["origen"] || "").trim() || "Sin origen",
      channel: (o["canal"] || "").trim() || "Sin canal",
      stage: (o["etapa"] || "").trim() || "Sin etapa",
      owner: (o["propietario"] || "").trim() || "Sin propietario",
      _id: norm(o["correo electronico"] || "") || norm(o["telefono"] || o["numero de whatsapp"] || "") || null, // transitorio
    });
  });
  return leads;
}

/** Agrega leads en conteos. Devuelve solo números y categorías, sin _id. */
function aggregateLeads(leads) {
  if (!leads.length) return null;
  const count = (k) => Object.entries(leads.reduce((a, l) => ((a[l[k]] = (a[l[k]] || 0) + 1), a), {}))
    .map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n);
  const ids = leads.map((l) => l._id).filter(Boolean);
  const dates = leads.map((l) => l.date).filter(Boolean).sort();
  const byDay = Object.entries(leads.reduce((a, l) => (l.date && (a[l.date] = (a[l.date] || 0) + 1), a), {}))
    .map(([date, n]) => ({ date, n })).sort((a, b) => a.date.localeCompare(b.date));
  return {
    total: leads.length,
    unique: ids.length ? new Set(ids).size : null,
    from: dates[0] || null, to: dates[dates.length - 1] || null,
    byForm: count("form"), byOrigin: count("origin"), byChannel: count("channel"),
    byStage: count("stage"), byOwner: count("owner"), byDay,
  };
}

function parsePostsCsv(text) {
  const res = Papa.parse(text, { header: true, skipEmptyLines: true });
  return res.data.map((r) => {
    const o = {}; Object.entries(r).forEach(([k, v]) => (o[norm(k)] = v));
    const likes = num(o["me gusta"]);
    const comments = num(o["comentarios"]);
    const shares = num(o["veces que se compartio"]);
    const saves = num(o["veces que se guardo"]);
    const replies = num(o["respuestas"]);
    // interacción total: suma de lo que exista en este archivo
    const parts = [likes, comments, shares, saves, replies].filter((x) => x !== null);
    return {
      id: o["identificador de la publicacion"],
      account: o["nombre de usuario de la cuenta"] || "",
      type: o["tipo de publicacion"] || "Sin tipo",
      caption: (o["descripcion"] || "").trim(),
      date: postDate(o["hora de publicacion"]),
      link: o["enlace permanente"] || "",
      views: num(o["visualizaciones"]),
      reach: num(o["alcance"]),
      likes, comments, shares, saves, replies,
      navigation: num(o["navegacion"]),
      profileVisits: num(o["visitas al perfil"]),
      follows: num(o["seguimientos"]),
      stickerTaps: num(o["toques en stickers"]),
      interactions: parts.length ? parts.reduce((a, b) => a + b, 0) : null,
    };
  }).filter((r) => r.id);
}


const LEVEL_PLURAL = { Campaña: "Campañas", "Conjunto de anuncios": "Conjuntos de anuncios", Anuncio: "Anuncios" };

/* ---------- KPIs de una entidad (campaña, conjunto o anuncio) ---------- */
// Función pura: la usa la vista (entidad seleccionada) y el informe ejecutivo
// (todas las entidades del nivel activo), así ambos muestran exactamente lo mismo.
function buildKpis(sel, model, cur, levelLabel) {
  const cplDiff = (() => {
    if (!sel || sel.resultsMissing || !sel.cpl || !model) return null;
    const o = model.objectives.find((x) => x.objective === sel.objective);
    if (!o || o.campaigns.length < 2 || !o.cpl) return null;
    return { value: sel.cpl / o.cpl - 1, label: `vs. CPL global de ${levelLabel === "Campaña" ? "las" : "los"} ${o.campaigns.length} ${(LEVEL_PLURAL[levelLabel] || levelLabel).toLowerCase()} del objetivo (${money(o.cpl, cur)})` };
  })();

  return sel ? [
    { code: "01", label: sel.objective, value: sel.resultsMissing ? "sin datos" : int(sel.results), note: sel.resultsMissing ? `Meta no exportó resultados para ${levelLabel === "Campaña" ? "esta campaña" : levelLabel === "Anuncio" ? "este anuncio" : "este conjunto"}` : "Resultados del objetivo", tone: "sea", warn: sel.resultsMissing },
    { code: "02", label: "Costo por resultado", money: sel.resultsMissing ? undefined : sel.cpl, diff: cplDiff, value: sel.resultsMissing ? "sin datos" : money(sel.cpl, cur), note: sel.resultsMissing ? "No calculable sin resultados" : "Indicador rector", tone: "amber", big: true, warn: sel.resultsMissing },
    { code: "03", label: "Inversión", money: sel.spend, value: money(sel.spend, cur), note: sel.period ? `${sel.period.from} a ${sel.period.to}` : "Periodo cargado", tone: "ink" },
    { code: "04", label: "Pacing", value: sel.pacing ? pct(sel.pacing.pct, 0) : "sin datos", note: sel.pacing ? `${money(sel.pacing.actual, cur)} de ${money(sel.pacing.planned, cur)}` : "Requiere el CSV con presupuesto", tone: "sky", warn: !sel.pacing },
    { code: "05", label: "CPM", money: sel.cpm, value: money(sel.cpm, cur), note: "Precio por mil impresiones", tone: "ink" },
    { code: "06", label: "Alcance", value: int(sel.reach), note: sel.reachNote === "suma" ? `Suma de ${sel.memberCount} partes: puede contar personas repetidas` : `Frecuencia ${dec(sel.frequency, 2)}`, tone: "sky", warn: sel.reachNote === "suma" },
    { code: "07", label: "Impresiones", value: int(sel.impressions), note: "Total del periodo", tone: "ink" },
    { code: "08", label: "Leads por día", value: sel.resultsMissing ? "sin datos" : sel.dims.day ? dec(sel.results / sel.dims.day.length, 2) : "sin datos", note: sel.resultsMissing ? "Sin resultados exportados" : sel.dims.day ? `${sel.dims.day.length} días activos` : "Sube el desglose por día", tone: "sea", warn: sel.resultsMissing || !sel.dims.day },
    { code: "09", label: "Seguidores", value: int(sel.igFollows), note: sel.igFollows ? `${money(sel.costPerFollower, cur)} c/u` : "Desde pauta", tone: "sea" },
    ...(sel.linkClicks !== null && sel.linkClicks !== undefined ? [
      { code: "", label: "CTR del enlace", value: sel.ctrLink === null ? "sin datos" : pct(sel.ctrLink, 2), note: `${int(sel.linkClicks)} clics en el enlace${sel.linkClicksDerived ? " · calculados del CPC de Meta" : ""}`, tone: "sky" },
      { code: "", label: "Costo por clic", money: sel.cpc, value: money(sel.cpc, cur), note: sel.clickToLead === null ? "Sin resultados para medir conversión" : `Conversión clic → resultado ${pct(sel.clickToLead, 1)}`, tone: "ink" },
    ] : []),
    { code: "10", label: "Segmentos activos", value: sel.dims.region ? int(sel.dims.region.filter((r) => r.spend > 0).length) : "sin datos", note: sel.dims.region ? "Regiones con entrega" : "Sube el desglose por región", tone: "ink", warn: !sel.dims.region },
  ].map((k, i) => ({ ...k, code: String(i + 1).padStart(2, "0") })) : [];

}

/* ---------- motor de hallazgos (orgánico) ---------- */
function buildOrganicFindings(series, posts, audience) {
  const f = [];
  const sum = (k) => (series[k] || []).reduce((a, r) => a + r.value, 0);
  const days = (k) => (series[k] || []).length;

  // alcance y visualizaciones
  if (series.reach?.length) {
    const total = sum("reach"), d = days("reach");
    const avg = total / d;
    const best = [...series.reach].sort((a, b) => b.value - a.value)[0];
    f.push({
      sev: "buena", title: "Alcance del periodo",
      text: `${int(total)} personas alcanzadas en ${d} días (promedio ${int(avg)}/día). El pico fue el ${best.date} con ${int(best.value)}.`,
      action: { do: "Revisar qué se publicó el día de mayor alcance", on: best.date, watch: "Alcance diario" },
    });
  }

  // ratio visualizaciones / alcance
  if (series.views?.length && series.reach?.length) {
    const v = sum("views"), r = sum("reach");
    const ratio = r ? v / r : null;
    if (ratio) f.push({
      sev: ratio < 1.2 ? "media" : "buena",
      title: ratio < 1.2 ? "Poca repetición de visualización" : "Buen nivel de repetición",
      text: `Cada persona alcanzada generó ${dec(ratio, 2)} visualizaciones (${int(v)} vistas sobre ${int(r)} alcanzadas).`,
      action: { do: ratio < 1.2 ? "Probar formatos que inviten a ver más de una vez" : "Sostener el formato que genera repetición", on: "Contenido orgánico", watch: "Vistas ÷ alcance" },
    });
  }

  // conversión a perfil
  if (series.profileVisits?.length && series.reach?.length) {
    const pv = sum("profileVisits"), r = sum("reach");
    const rate = r ? (pv / r) * 100 : null;
    f.push({
      sev: rate < 1 ? "media" : "buena",
      title: "Tasa de visita al perfil",
      text: `${int(pv)} visitas al perfil sobre ${int(r)} personas alcanzadas: ${pct(rate, 2)}.`,
      action: { do: rate < 1 ? "Reforzar el llamado a visitar el perfil en los primeros segundos" : "Mantener el llamado actual", on: "Contenido orgánico", watch: "Visitas ÷ alcance" },
    });
  }

  // seguidores
  if (series.followers?.length) {
    const total = sum("followers"), d = days("followers");
    f.push({
      sev: "buena", title: "Crecimiento de seguidores",
      text: `${int(total)} seguidores nuevos en ${d} días con registro (${dec(total / d, 2)} por día).`,
      action: { do: "Contrastar con los seguidores ganados desde pauta", on: "Cuenta de Instagram", watch: "Seguidores/día" },
    });
  }

  // publicaciones
  if (posts?.length) {
    const withReach = posts.filter((p) => p.reach !== null);
    if (withReach.length) {
      const best = [...withReach].sort((a, b) => b.reach - a.reach)[0];
      const byType = {};
      withReach.forEach((p) => {
        const t = p.type.replace(" de Instagram", "");
        byType[t] = byType[t] || { n: 0, reach: 0, inter: 0 };
        byType[t].n++; byType[t].reach += p.reach || 0; byType[t].inter += p.interactions || 0;
      });
      const ranked = Object.entries(byType).map(([t, v]) => ({ t, avg: v.reach / v.n, n: v.n })).sort((a, b) => b.avg - a.avg);
      if (ranked.length > 1) f.push({
        sev: "buena", title: "Formato con mejor alcance promedio",
        text: `${ranked[0].t} promedia ${int(ranked[0].avg)} de alcance en ${ranked[0].n} publicaciones, frente a ${int(ranked[ranked.length - 1].avg)} de ${ranked[ranked.length - 1].t}.`,
        action: { do: "Priorizar este formato en el calendario", on: ranked[0].t, watch: "Alcance promedio por formato" },
      });
      f.push({
        sev: "buena", title: "Publicación con mayor alcance",
        text: `La del ${best.date} alcanzó ${int(best.reach)} personas con ${int(best.interactions)} interacciones.`,
        action: { do: "Analizar hook y tema para replicarlo", on: best.date, watch: "Alcance por publicación" },
      });
    }
    const noInter = posts.filter((p) => p.interactions === 0 && p.reach > 0);
    if (noInter.length >= 3) f.push({
      sev: "media", title: "Publicaciones sin interacción",
      text: `${noInter.length} publicaciones tuvieron alcance pero ninguna interacción. Llegan pero no mueven a la acción.`,
      action: { do: "Añadir pregunta o llamado explícito al cierre", on: `${noInter.length} publicaciones`, watch: "Interacciones por publicación" },
    });
  }

  // audiencia vs conversión
  if (audience?.ageGender?.length) {
    const top = [...audience.ageGender].sort((a, b) => (b.male + b.female) - (a.male + a.female))[0];
    f.push({
      sev: "buena", title: "Franja dominante de la comunidad",
      text: `El grupo ${top.age} concentra la mayor parte de los seguidores (${pct(top.male + top.female)}). Compáralo con la franja que mejor convierte en pauta.`,
      action: { do: "Verificar si la comunidad coincide con quien compra", on: top.age, watch: "Edad de la comunidad vs CPL por edad" },
    });
  }

  const order = { alta: 0, media: 1, buena: 2 };
  return f.sort((a, b) => order[a.sev] - order[b.sev]);
}

/* ---------- motor de hallazgos (por campaña) ---------- */
function buildFindings(c, cur) {
  if (c && c.resultsMissing) {
    const out = [{
      sev: "media", title: "Campaña sin indicador de resultado",
      text: `Meta no exportó «Tipo de resultado» ni «Resultados» para «${c.name}» (${money(c.spend, cur)} invertidos). No significa que haya dado cero: el dato no viene en el archivo.`,
      action: { do: "Revisar el objetivo de la campaña en Ads Manager y volver a exportar con la columna de resultados", on: c.name, watch: "Tipo de resultado" },
    }];
    if (c.linkClicks) out.push({
      sev: "buena", title: "Clics en el enlace",
      text: `La campaña generó ${int(c.linkClicks)} clics en el enlace a ${money(c.cpc, cur)} cada uno (CTR ${pct(c.ctrLink, 2)})${c.linkClicksDerived ? ", calculados a partir del CPC que reporta Meta" : ""}.`,
      action: { do: "Contrastar estos clics con las conversaciones o leads registrados", on: c.name, watch: "Costo por clic" },
    });
    return out;
  }
  if (!c) return [];
  const f = [];
  const dimName = { age: "edad", gender: "sexo", region: "región", placement: "ubicación" };

  // segmentos sin retorno (por cada dimensión disponible)
  ["age", "gender", "region", "placement"].forEach((dim) => {
    const rows = c.dims[dim]; if (!rows) return;
    const dead = rows.filter((s) => s.results === 0 && s.spend > 0).sort((a, b) => b.spend - a.spend);
    const deadSpend = dead.reduce((a, s) => a + s.spend, 0);
    if (deadSpend > 0 && c.spend > 0) {
      const share = (deadSpend / c.spend) * 100;
      if (share >= 5)
        f.push({
          sev: share >= 12 ? "alta" : "media",
          title: `Inversión sin retorno por ${dimName[dim]}`,
          text: `${money(deadSpend, cur)} (${dec(share, 0)} % del gasto) fue a ${dead.length} segmentos de ${dimName[dim]} sin un solo lead. El mayor: ${labelOf(dead[0], dim)} con ${money(dead[0].spend, cur)}.`,
          action: { do: `Excluir por ${dimName[dim]}`, on: dead.slice(0, 3).map((d) => labelOf(d, dim)).join(", "), watch: "CPL y volumen de leads" },
        });
    }
  });

  // mejor y peor ubicación
  if (c.dims.placement) {
    const withLeads = c.dims.placement.filter((p) => p.results > 0).sort((a, b) => a.cpl - b.cpl);
    if (withLeads.length >= 2) {
      const best = withLeads[0], worst = withLeads[withLeads.length - 1];
      f.push({
        sev: "buena", title: "Ubicación más eficiente",
        text: `${best.label} rinde a ${money(best.cpl, cur)} por lead con ${int(best.results)} resultados; ${worst.label} es la más cara a ${money(worst.cpl, cur)}.`,
        action: { do: "Priorizar presupuesto y diseño vertical 9:16", on: best.label, watch: "Participación de leads por ubicación" },
      });
    }
  }

  // mejor segmento de edad
  if (c.dims.age) {
    const win = c.dims.age.filter((s) => s.results >= 2).sort((a, b) => a.cpl - b.cpl)[0];
    if (win) f.push({
      sev: "buena", title: "Franja de edad más rentable",
      text: `${win.label} produce leads a ${money(win.cpl, cur)}, por debajo del promedio de la campaña (${money(c.cpl, cur)}).`,
      action: { do: "Subir presupuesto sobre esta franja", on: win.label, watch: "CPL del segmento" },
    });
  }

  // frecuencia
  if (c.frequency !== null) {
    if (c.frequency >= 2.2) f.push({
      sev: c.frequency >= 3 ? "alta" : "media", title: "Señal de saturación",
      text: `La frecuencia es ${dec(c.frequency, 2)} impresiones por persona. A partir de 2,2 conviene rotar creativos antes de que suba el CPL.`,
      action: { do: "Rotar creativos y ampliar público", on: c.name, watch: "Frecuencia semanal" },
    });
    else f.push({
      sev: "buena", title: "Audiencia sin saturar",
      text: `Frecuencia de ${dec(c.frequency, 2)}, por debajo del umbral de riesgo. Hay margen para escalar inversión.`,
      action: { do: "Aumentar presupuesto de forma escalonada", on: c.name, watch: "Frecuencia y CPM" },
    });
  }

  // pacing
  if (c.pacing) {
    const p = c.pacing.pct;
    if (p < 85 || p > 115) f.push({
      sev: "media", title: p > 115 ? "Sobreejecución de presupuesto" : "Subejecución de presupuesto",
      text: `Se ejecutó ${money(c.pacing.actual, cur)} de ${money(c.pacing.planned, cur)} planificados (${dec(p, 0)} %) en ${c.pacing.days} días.`,
      action: { do: p > 115 ? "Revisar presupuesto diario o duración" : "Verificar aprobación y entrega del anuncio", on: "Conjunto de anuncios", watch: "Gasto diario vs presupuesto" },
    });
  }

  // días eficientes
  if (c.dims.day) {
    const days = c.dims.day.filter((d) => d.results > 0);
    if (days.length >= 5) {
      const best = [...days].sort((a, b) => a.cpl - b.cpl).slice(0, 3);
      f.push({
        sev: "buena", title: "Días más eficientes",
        text: `Los mejores días fueron ${best.map((d) => d.label.slice(5)).join(", ")}, con CPL entre ${money(best[0].cpl, cur)} y ${money(best[best.length - 1].cpl, cur)}.`,
        action: { do: "Auditar qué creativo/ajuste estuvo activo esos días", on: best.map((d) => d.label.slice(5)).join(", "), watch: "Leads/día y CPL" },
      });
    }
  }

  // seguidores
  if (c.igFollows > 0) f.push({
    sev: "buena", title: "Crecimiento de comunidad desde pauta",
    text: `La inversión sumó ${int(c.igFollows)} seguidores a ${money(c.costPerFollower, cur)} cada uno, un activo que permanece tras la campaña.`,
    action: { do: "Reportar como valor adicional al CPL", on: "Cuenta de Instagram", watch: "Seguidores por mes" },
  });

  const order = { alta: 0, media: 1, buena: 2 };
  return f.sort((a, b) => order[a.sev] - order[b.sev]);
}
function labelOf(s, dim) { return dim === "gender" ? glabel(s.label) : s.label; }

/* ============================================================ */
export default function ConsolidadorMetaAds() {
  const emptyDS = () => ({ adRows: [], campaignsCsv: [], seriesFiles: [], audienceFiles: [], platformAssign: {}, crmLeads: null, audience: null, posts: [], files: [], currency: "USD" });
  const [store, setStore] = useState({ clients: { "Cliente 1": emptyDS() }, active: "Cliente 1" });
  const active = store.active;
  const ds = store.clients[active] || emptyDS();
  const { adRows, campaignsCsv, posts, files, currency } = ds;
  const crmLeads = ds.crmLeads || null;

  // ---- Series orgánicas derivadas de los archivos, con detección de conflictos.
  // Meta exporta Instagram y Facebook con el MISMO título en algunas métricas
  // (p. ej. "Visualizaciones", "Interacciones con el contenido") y sin ninguna
  // marca de plataforma dentro del archivo. Si dos archivos de la misma métrica
  // traen valores distintos para los mismos días, NO se elige uno en silencio:
  // la métrica queda en espera hasta que el usuario asigna la plataforma.
  // La audiencia («Público») sigue la misma regla: Instagram y Facebook se
  // exportan con el mismo título; con dos archivos distintos se asigna la plataforma.
  const { series, conflicts: seriesConflicts, audience: resolvedAud, fbAudience } = useMemo(
    () => resolveSeries(ds.seriesFiles || [], ds.platformAssign || {},
      ds.audienceFiles || (ds.audience ? [{ name: "Público.csv", audience: ds.audience }] : [])),
    [ds.seriesFiles, ds.platformAssign, ds.audienceFiles, ds.audience]
  );
  const audience = resolvedAud;
  const pendingConflicts = seriesConflicts.filter((c) => !c.done);
  const applySuggestions = () => setStore((prev) => {
    const d = prev.clients[prev.active]; const pa = { ...(d.platformAssign || {}) };
    pendingConflicts.forEach((c) => c.files.forEach((f) => { if (f.suggested && !pa[f.name]) pa[f.name] = f.suggested; }));
    return { ...prev, clients: { ...prev.clients, [prev.active]: { ...d, platformAssign: pa } } };
  });
  const assignPlatform = (fileName, platform) => setStore((prev) => {
    const d = prev.clients[prev.active];
    return { ...prev, clients: { ...prev.clients, [prev.active]: { ...d, platformAssign: { ...(d.platformAssign || {}), [fileName]: platform } } } };
  });

  const [selName, setSelName] = useState(null);
  const [dimTab, setDimTab] = useState("age");
  const [skDim, setSkDim] = useState("placement");
  const [resTab, setResTab] = useState("campanas");
  const [diagTab, setDiagTab] = useState("campanas");
  const [groupBy, setGroupByRaw] = useState("campaign"); // "campaign" | "adset" | "ad"
  const setGroupBy = (lvl) => { setGroupByRaw(lvl); setSelName(null); };
  const [campEdits, setCampEdits] = useState({});
  const [orgEdits, setOrgEdits] = useState({});
  const [postSort, setPostSort] = useState({ key: "reach", dir: "desc" });
  const [postLimit, setPostLimit] = useState(10);
  const [intv, setIntv] = useState("month");
  const [hmMetric, setHmMetric] = useState("results");
  const [tab, setTab] = useState("resumen");
  const [navHover, setNavHover] = useState(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [ai, setAi] = useState({ provider: "anthropic", model: "", question: "", texto: "", error: "", busy: false });
  const { clients: engineClients, clientId: activeEngineClient } = useClient();
  const [pub, setPub] = useState({ clientId: activeEngineClient || "", analysis: "", busy: false, error: "", done: "" });
  const inputRef = useRef(null);
  const histRef = useRef(null);
  const [history, setHistory] = useState([]); // snapshots cargados del histórico (mismo cliente)
  const [histWarn, setHistWarn] = useState([]);

  async function exportSnapshot() {
    const s = snapshotOf(active, { ...ds, series, audience, fbAudience }, model);
    let outObj = s, filename = `bwo_${active.replace(/[^a-z0-9]+/gi, "_")}_${new Date().toISOString().slice(0,10)}.json`;
    const pwd = window.prompt("Clave para cifrar el archivo (opcional, deja vacío para exportar sin cifrar):");
    if (pwd) { outObj = await encryptSnapshot(s, pwd); filename = filename.replace(".json", ".enc.json"); }
    const blob = new Blob([JSON.stringify(outObj, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
  }

  // Si el cliente activo conserva el nombre genérico ("Cliente 1"), se pide el
  // nombre real antes de generar el informe: ese texto va en la portada que ve el cliente.
  function ensureClientName() {
    if (!/^Cliente \d+$/.test(active)) return active;
    const n = (window.prompt("¿Nombre del cliente para la portada del informe?", "") || "").trim();
    if (!n || n === active) return active;
    setStore((prev) => {
      if (prev.clients[n]) return prev;
      const clients = { ...prev.clients, [n]: prev.clients[prev.active] };
      delete clients[prev.active];
      return { clients, active: n };
    });
    return n;
  }

  // El informe incluye TODAS las entidades del nivel activo (no solo la
  // seleccionada), cada una con sus KPI, hallazgos y ediciones propias.
  function makeReport(clientName = active) {
    const entities = campaigns.map((c) => ({
      c,
      kpis: c === sel ? kpis : buildKpis(c, model, cur, levelLabel),
      findings: c === sel ? findings : buildFindings(c, cur),
      edits: campEdits[entKey(c)],
    }));
    return buildReportHtml({
      client: clientName, model, entities,
      levelLabel, levelPlural: LEVEL_PLURAL[levelLabel] || levelLabel,
      organicFindings, orgEdits,
      series, posts, audience, fbAudience, organicKpis, weekly, heatmapFn: heatmap,
    });
  }

  async function importHistory(fileList) {
    setBusy(true); const items = []; const warns = [];
    for (const f of Array.from(fileList)) {
      try {
        const text = await f.text(); let obj = JSON.parse(text);
        if (isEncrypted(obj)) {
          const pwd = window.prompt(`Clave para «${f.name}»:`); if (!pwd) { warns.push(`${f.name}: cancelado.`); continue; }
          obj = await decryptSnapshot(obj, pwd);
        } else if (!isSnapshot(obj)) { warns.push(`${f.name}: no es un snapshot de BWO.`); continue; }
        else validateSnapshot(obj);
        items.push(obj);
      } catch (e) { warns.push(`${f.name}: ${e.message}`); }
    }
    if (items.length) {
      // asegurar mismo cliente que el activo, o cambiar de cliente si el histórico es de otro
      const targetClient = items[0].client;
      if (items.some((x) => x.client !== targetClient)) { warns.push("Se cargaron snapshots de clientes distintos; se filtraron al primero."); }
      const filtered = items.filter((x) => x.client === targetClient);
      // no mezclar con snapshots ya cargados de otro cliente
      const prev = history.filter((h) => h.client === targetClient);
      const combined = [...prev, ...filtered];
      try {
        const merged = mergeSnapshots(combined);
        setHistory(combined); setHistWarn([...warns, ...(merged?.warnings || [])]);
        // si el cliente activo es distinto, cambiarlo (crear si hace falta)
        if (targetClient !== active) {
          setStore((prev2) => prev2.clients[targetClient] ? { ...prev2, active: targetClient } : { clients: { ...prev2.clients, [targetClient]: emptyDS() }, active: targetClient });
          setSelName(null);
        }
      } catch (e) { warns.push(e.message); setHistWarn(warns); }
    } else setHistWarn(warns);
    setBusy(false);
  }

  // Período del reporte: unión de los períodos de TODAS las entidades (antes se
  // tomaba solo el de la seleccionada y se creaban duplicados al cambiar de selección).
  function reportPeriod() {
    const ps = (model?.campaigns || []).map((c) => c.period).filter((p) => p?.from && p?.to);
    if (!ps.length) { const t = new Date().toISOString().slice(0, 10); return { from: t, to: t }; }
    return { from: ps.map((p) => p.from).sort()[0], to: ps.map((p) => p.to).sort().at(-1) };
  }
  async function publishSnapshot() {
    if (!pub.clientId || !model) return;
    setPub((p) => ({ ...p, busy: true, error: "", done: "" }));
    try {
      const target = engineClients.find((c) => c.id === pub.clientId);
      const snap = snapshotOf(target?.name || active, { ...ds, series, audience, fbAudience }, model);
      const period = reportPeriod();
      const { error } = await supabase.from("reports").upsert({
        client_id: pub.clientId, period_from: period.from, period_to: period.to,
        title: `Reporte ${period.from} → ${period.to}`, data: snap, analysis: pub.analysis || null,
        published_at: new Date().toISOString(),
      }, { onConflict: "client_id,period_from,period_to" });
      if (error) throw new Error(error.message);
      setPub((p) => ({ ...p, busy: false, done: `Publicado para ${target?.name} (${period.from} → ${period.to}). Si ya existía ese período, se reemplazó.` }));
    } catch (e) { setPub((p) => ({ ...p, busy: false, error: e.message })); }
  }

    const merged = useMemo(() => (history.length ? mergeSnapshots(history) : null), [history]);
  const histDaily = useMemo(() => (merged ? merged.campaigns.flatMap((c) => c.dims.day || []).map((d) => ({ ...d, date: d.label })) : []), [merged]);
  const histByInterval = useMemo(() => (histDaily.length ? bucketRows(histDaily, intv) : []), [histDaily, intv]);

  const model = useMemo(
    () => (adRows.length ? buildModel(adRows, currency, campaignsCsv, groupBy) : null),
    [adRows, currency, campaignsCsv, groupBy]
  );
  // si el nivel pedido no existe en los datos cargados, el modelo cae al
  // disponible más fino automáticamente (model.effectiveLevel lo indica)
  const activeLevel = model?.effectiveLevel || groupBy;
  const levelLabel = LEVEL_LABEL[activeLevel] || "Campaña";
  const campaigns = model?.campaigns || [];
  const sel = useMemo(() => {
    if (!campaigns.length) return null;
    return campaigns.find((c) => c.name === selName)
      || campaigns.find((c) => Object.keys(c.dims).length) || campaigns[0];
  }, [campaigns, selName]);
  const findings = useMemo(() => buildFindings(sel, currency), [sel, currency]);
  const cur = currency;
  // Las ediciones de hallazgos se guardan por entidad (nivel + nombre), no por
  // posición: así cada campaña/conjunto/anuncio conserva las suyas al cambiar
  // de selección y el informe aplica a cada una las que le corresponden.
  const entKey = (c) => `${activeLevel}::${c.name}`;
  const selEdits = (sel && campEdits[entKey(sel)]) || {};
  const setSelEdits = (upd) => {
    if (!sel) return;
    const k = entKey(sel);
    setCampEdits((p) => ({ ...p, [k]: typeof upd === "function" ? upd(p[k] || {}) : upd }));
  };

  const handleFiles = useCallback(async (list) => {
    setBusy(true);
    const report = [];
    let newRows = [], newCsv = null, cur2 = null;
    const seriesFiles = []; const audienceFiles = []; let newPosts = null;
    const newLeads = [];

    for (const file of Array.from(list)) {
      try {
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
          const parsed = parseWorkbook(XLSX, buf);
          if (parsed) {
            newRows.push(...parsed.rows); cur2 = parsed.currency;
            const lv = parsed.rows.some((x) => x.rowLevel === "ad") ? "ad" : parsed.rows.some((x) => x.rowLevel === "adset") ? "adset" : "campaign";
            const nivel = { campaign: "campaña", adset: "conjunto de anuncios", ad: "anuncio" }[lv];
            report.push({ name: file.name, kind: `Pauta — desglose por ${DIM_LABELS[parsed.dimension] || "campaña"}`, detail: `${parsed.rows.length} filas · nivel: ${nivel} · hoja «${parsed.sheet}»`, ok: true });
          } else report.push({ name: file.name, kind: "Excel sin datos de pauta", detail: "No se encontró «Nombre de la campaña»", ok: false });
          continue;
        }
        const text = decodeText(buf);
        const head = norm(text.slice(0, 400));
        if (head.includes("nombre de la campana") && head.includes("inicio del informe")) {
          newCsv = parseCampaignsCsv(Papa, text);
          report.push({ name: file.name, kind: "Listado de campañas (con presupuesto)", detail: `${newCsv.length} campañas`, ok: true });
          continue;
        }
        if (head.includes("identificador de la publicacion")) {
          const ps = parsePostsCsv(text);
          // varios archivos de publicaciones (feed + historias) se SUMAN, sin duplicar por id
          const seen = new Set((newPosts || []).map((x) => x.id));
          newPosts = [...(newPosts || []), ...ps.filter((x) => !seen.has(x.id))];
          report.push({ name: file.name, kind: "Publicaciones orgánicas", detail: `${ps.length} publicaciones`, ok: true });
          continue;
        }
        if (head.includes("fecha de creacion") && head.includes("formulario")) {
          const ls = parseLeadsCsv(text);
          newLeads.push(...ls);
          report.push({ name: file.name, kind: "Leads del CRM", detail: `${ls.length} leads · datos personales no se muestran ni se guardan`, ok: true });
          continue;
        }
        const r = parseInsightsCsv(text);
        if (r.kind === "series") {
          seriesFiles.push({ name: file.name, key: r.metric, label: r.label, rows: r.rows });
          report.push({ name: file.name, kind: `Serie diaria — ${r.label}`, detail: `${r.rows.length} días · total ${int(r.rows.reduce((a, x) => a + x.value, 0))}`, ok: true });
        }
        else if (r.kind === "audience") {
          audienceFiles.push({ name: file.name, audience: r.audience });
          report.push({ name: file.name, kind: "Perfil de audiencia", detail: [r.audience.ageGender.length ? `${r.audience.ageGender.length} rangos de edad` : "sin edad y sexo", `${r.audience.cities.length} ciudades`, `${r.audience.countries.length} países`].join(" · "), ok: true });
        }
        else if (r.kind === "empty") report.push({ name: file.name, kind: "Archivo vacío", detail: "Meta lo exportó sin filas", ok: false });
        else report.push({ name: file.name, kind: "Formato no reconocido", detail: r.title || "Sin título", ok: false });
      } catch (e) {
        report.push({ name: file.name, kind: "Error de lectura", detail: String(e.message || e).slice(0, 90), ok: false });
      }
    }

    setStore((prev) => {
      // Cada nueva ACCIÓN de carga reemplaza los datos anteriores del cliente
      // activo (los archivos soltados juntos en esta acción sí se combinan entre
      // sí). Así nunca se solapan estadísticas de cargas distintas — p. ej. no
      // se mezcla agosto con julio ni un reporte con otro. El histórico entre
      // meses se maneja aparte, con snapshots (.json), no acumulando archivos.
      const base = emptyDS();
      // los _id transitorios de leads se descartan aquí: solo quedan agregados
      const crmLeads = aggregateLeads(newLeads);
      newLeads.length = 0;
      const merged = {
        ...base,
        adRows: newRows,
        campaignsCsv: newCsv || [],
        posts: newPosts || [],
        audience: null,
        audienceFiles,
        files: report,
        currency: cur2 || base.currency,
        seriesFiles,
        platformAssign: {},
        crmLeads,
      };
      return { ...prev, clients: { ...prev.clients, [prev.active]: merged } };
    });
    // una carga nueva reemplaza los datos: las ediciones de la carga anterior
    // no deben aplicarse a otro reporte que comparta nombres de campaña
    setCampEdits({}); setOrgEdits({}); setSelName(null);
    setBusy(false);
  }, [active]);

  const reset = () => setStore((prev) => ({ ...prev, clients: { ...prev.clients, [prev.active]: emptyDS() } }));
  const addClient = () => {
    const n = (window.prompt("Nombre del nuevo cliente:") || "").trim();
    if (!n) return;
    setStore((prev) => prev.clients[n] ? { ...prev, active: n } : { clients: { ...prev.clients, [n]: emptyDS() }, active: n });
    setSelName(null);
  };
  const switchClient = (n) => { setStore((prev) => ({ ...prev, active: n })); setSelName(null); setCampEdits({}); setOrgEdits({}); };

  const hasAny = files.length > 0;

  /* ---------- KPIs de la entidad seleccionada ---------- */
  const kpis = useMemo(() => buildKpis(sel, model, cur, levelLabel), [sel, model, cur, levelLabel]);

  const funnel = sel ? [
    { step: "Impresiones", value: sel.impressions },
    { step: "Personas alcanzadas", value: sel.reach },
    { step: "Clics en el enlace", value: sel.linkClicks },
    { step: sel.objective, value: sel.resultsMissing ? null : sel.results },
  ].filter((f) => f.value !== null && f.value !== undefined) : [];
  const FUNNEL_COLORS = [C.steel, C.sky, C.sea, C.amber];

  const organicDaily = useMemo(() => {
    const dates = new Set();
    Object.values(series).forEach((rows) => rows.forEach((r) => dates.add(r.date)));
    return [...dates].sort().map((d) => {
      const o = { date: d };
      Object.entries(series).forEach(([k, rows]) => { const hit = rows.find((r) => r.date === d); o[k] = hit ? hit.value : null; });
      return o;
    });
  }, [series]);

  // Ritmo de publicación: semanas lunes–domingo dentro del periodo orgánico
  // cargado (fechas de las series de Insights); si no hay series, el rango
  // de las propias publicaciones.
  const weekly = useMemo(() => {
    if (!posts.length) return null;
    const range = organicDaily.length ? { from: organicDaily[0].date, to: organicDaily[organicDaily.length - 1].date } : null;
    return weeklyPosts(posts, range);
  }, [posts, organicDaily]);

  const tabs = [["resumen", "Resumen"], ["campanas", "Campañas"], ["desgloses", "Desgloses"], ["graficos", "Gráficos"], ["organico", "Orgánico"], ["historico", "Histórico"], ["diagnostico", "Diagnóstico"], ["admin", "Publicar"], ["archivos", "Archivos"]];
  const dimData = sel?.dims[dimTab] || [];
  const dimHasImp = dimData.some((x) => x.impressions !== null && x.impressions !== undefined);
  const dimHasReach = dimData.some((x) => x.reach !== null && x.reach !== undefined);

  const sortedPosts = useMemo(() => {
    const { key, dir } = postSort; const mul = dir === "desc" ? -1 : 1;
    return [...posts].sort((a, b) => {
      const av = a[key], bv = b[key];
      if (typeof av === "string" || typeof bv === "string") return mul * String(av || "").localeCompare(String(bv || ""));
      const an = av === null || av === undefined ? -Infinity : av;
      const bn = bv === null || bv === undefined ? -Infinity : bv;
      return mul * (an - bn);
    });
  }, [posts, postSort]);

  const organicKpis = useMemo(() => {
    const out = []; const sum = (k) => (series[k] || []).reduce((a, r) => a + r.value, 0);
    const d = (k) => (series[k] || []).length;
    if (series.views?.length) out.push({ code: "01", label: "Visualizaciones", value: int(sum("views")), note: `${d("views")} días · ${int(sum("views") / d("views"))}/día`, tone: "ink" });
    if (series.reach?.length) out.push({ code: "02", label: "Alcance", value: int(sum("reach")), note: `${d("reach")} días · ${int(sum("reach") / d("reach"))}/día`, tone: "sky", big: true });
    if (series.profileVisits?.length) out.push({ code: "03", label: "Visitas al perfil", value: int(sum("profileVisits")), note: series.reach?.length ? `${pct((sum("profileVisits") / sum("reach")) * 100, 2)} del alcance` : `${d("profileVisits")} días`, tone: "sea" });
    if (series.followers?.length) out.push({ code: "04", label: "Seguidores nuevos", value: int(sum("followers")), note: `${dec(sum("followers") / d("followers"), 2)} por día con registro · ${d("followers")} días`, tone: "sea" });
    if (series.interactions?.length) out.push({ code: "05", label: "Interacciones", value: int(sum("interactions")), note: series.reach?.length ? `${pct((sum("interactions") / sum("reach")) * 100, 2)} del alcance` : `${d("interactions")} días`, tone: "amber" });
    if (series.linkClicks?.length) out.push({ code: String(out.length + 1).padStart(2, "0"), label: "Clics en el enlace", value: int(sum("linkClicks")), note: `${d("linkClicks")} días registrados`, tone: "sea" });
    if (series.viewers?.length) out.push({ code: String(out.length + 1).padStart(2, "0"), label: "Espectadores", value: int(sum("viewers")), note: `${d("viewers")} días · reproducción de video`, tone: "amber" });
    // Métricas de Facebook: siempre con la etiqueta explícita, nunca combinadas
    // con las de Instagram — son orígenes de dato distintos.
    if (series.fbViews?.length) out.push({ code: String(out.length + 1).padStart(2, "0"), label: "Visualizaciones (Facebook)", value: int(sum("fbViews")), note: `${d("fbViews")} días`, tone: "sky" });
    if (series.fbReach?.length) out.push({ code: String(out.length + 1).padStart(2, "0"), label: "Alcance (Facebook)", value: int(sum("fbReach")), note: `${d("fbReach")} días`, tone: "sky" });
    if (series.fbViewers?.length) out.push({ code: String(out.length + 1).padStart(2, "0"), label: "Espectadores (Facebook)", value: int(sum("fbViewers")), note: `${d("fbViewers")} días`, tone: "sky" });
    if (series.fbInteractions?.length) out.push({ code: String(out.length + 1).padStart(2, "0"), label: "Interacciones (Facebook)", value: int(sum("fbInteractions")), note: `${d("fbInteractions")} días`, tone: "sky" });
    if (series.fbVisits?.length) out.push({ code: String(out.length + 1).padStart(2, "0"), label: "Visitas (Facebook)", value: int(sum("fbVisits")), note: `${d("fbVisits")} días registrados`, tone: "sky" });
    if (series.fbFollowers?.length) out.push({ code: String(out.length + 1).padStart(2, "0"), label: "Seguidores nuevos (Facebook)", value: int(sum("fbFollowers")), note: `${dec(sum("fbFollowers") / d("fbFollowers"), 2)} por día`, tone: "sky" });
    if (series.fbLinkClicks?.length) out.push({ code: String(out.length + 1).padStart(2, "0"), label: "Clics en el enlace (Facebook)", value: int(sum("fbLinkClicks")), note: `${d("fbLinkClicks")} días registrados`, tone: "sky" });
    if (posts.length) {
      const wr = posts.filter((p) => p.reach !== null);
      if (weekly?.hasFeed) out.push({ code: String(out.length + 1).padStart(2, "0"), label: "Publicaciones de feed", value: int(weekly.totals.feed), note: `${dec(weekly.avgFeed, 1)} por semana · ${[["reel", "reels"], ["carrusel", "carruseles"], ["imagen", "imágenes"], ["video", "videos"]].filter(([k]) => weekly.totals.formats[k]).map(([k, l]) => `${weekly.totals.formats[k]} ${l}`).join(", ")}`, tone: "ink" });
      if (weekly?.hasStories) out.push({ code: String(out.length + 1).padStart(2, "0"), label: "Historias", value: int(weekly.totals.stories), note: `${dec(weekly.avgStories, 1)} por semana`, tone: "ink" });
      if (!weekly) out.push({ code: String(out.length + 1).padStart(2, "0"), label: "Publicaciones", value: int(posts.length), note: "Sin fecha de publicación para agrupar por semana", tone: "ink" });
      if (wr.length) out.push({ code: String(out.length + 1).padStart(2, "0"), label: "Alcance promedio", value: int(wr.reduce((a, p) => a + p.reach, 0) / wr.length), note: "Por publicación", tone: "sky" });
      const wi = posts.filter((p) => p.interactions !== null);
      if (wi.length) out.push({ code: String(out.length + 1).padStart(2, "0"), label: "Interacción total", value: int(wi.reduce((a, p) => a + p.interactions, 0)), note: `${dec(wi.reduce((a, p) => a + p.interactions, 0) / wi.length, 1)} por publicación`, tone: "amber" });
    }
    return out;
  }, [series, posts, weekly]);

  const organicFindings = useMemo(() => buildOrganicFindings(series, posts, audience), [series, posts, audience]);

  const adDaily = useMemo(() => sel?.dims.day
    ? sel.dims.day.map((d) => ({ date: d.label, spend: d.spend, results: d.results, impressions: d.impressions, reach: d.reach }))
    : [], [sel]);
  const adByInterval = useMemo(() => (adDaily.length ? bucketRows(adDaily, intv) : []), [adDaily, intv]);
  const skAvail = useMemo(() => ["placement", "gender", "age", "region"].filter((d) => model?.campaigns.some((c) => c.dims[d]?.length)), [model]);
  const skDimEff = skAvail.includes(skDim) ? skDim : (skAvail[0] || skDim);
  const sk = useMemo(() => (model && model.campaigns.some((c) => c.results > 0) ? sankey(model.campaigns, skDimEff) : null), [model, skDimEff]);

  // opciones de métrica para el mapa de calor: leads (pauta) y series orgánicas disponibles
  const hmOptions = useMemo(() => {
    const opts = [];
    if (adDaily.length) opts.push({ key: "results", label: "Leads (pauta)", rows: adDaily, field: "results" });
    const org = { reach: "Alcance", views: "Visualizaciones", profileVisits: "Visitas al perfil", interactions: "Interacciones" };
    Object.entries(org).forEach(([k, lab]) => { if (series[k]?.length) opts.push({ key: k, label: `${lab} (orgánico)`, rows: series[k].map((r) => ({ date: r.date, value: r.value })), field: "value" }); });
    return opts;
  }, [adDaily, series]);
  const hmSel = hmOptions.find((o) => o.key === hmMetric) || hmOptions[0];
  const hm = useMemo(() => (hmSel ? heatmap(hmSel.rows, hmSel.field) : null), [hmSel]);

  return (
    <div className="cma">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

.cma{--ink:${C.ink};--steel:${C.steel};--slate:${C.slate};--mute:${C.mute};--line:${C.line};--paper:${C.paper};--card:${C.card};--amber:${C.amber};--rust:${C.rust};--sea:${C.sea};--sky:${C.sky};
font-family:'Archivo',system-ui,sans-serif;background:var(--paper);color:var(--ink);min-height:100%;padding:0 0 64px;-webkit-font-smoothing:antialiased}
.cma *{box-sizing:border-box}
.mono{font-family:'IBM Plex Mono',ui-monospace,monospace}

/* cinta de carga — el elemento firma */
.tape{height:10px;background:repeating-linear-gradient(115deg,var(--amber) 0 16px,var(--ink) 16px 32px)}
.hdr{background:var(--ink);color:#fff;padding:26px 28px 22px}
.hdr h1{margin:0;font-size:25px;font-weight:800;letter-spacing:-.02em}
.eyebrow{font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--amber);font-weight:600;margin-bottom:9px}
.hdr p{margin:7px 0 0;color:#9FB2C0;font-size:13px;max-width:62ch;line-height:1.55}
.hdrbar{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;flex-wrap:wrap}
.stamp{border:1px solid rgba(255,255,255,.28);padding:9px 13px;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#B9C9D4;white-space:nowrap}

.wrap{max-width:1180px;margin:0 auto;padding:0 20px}
.nav{display:flex;gap:2px;background:var(--steel);overflow-x:auto}
.nav button{flex:0 0 auto;background:none;border:0;color:#9FB2C0;padding:13px 20px;font-family:inherit;font-size:12.5px;font-weight:600;letter-spacing:.04em;cursor:pointer;border-bottom:3px solid transparent}
.nav button:hover{color:#fff}
.nav button[data-on="1"]{color:#fff}
.nav button{position:relative}
.nav-lab{position:relative;z-index:1}
.nav-hov{position:absolute;inset:0;background:rgba(255,255,255,.045);z-index:0}
.nav-ind{position:absolute;inset:0;background:rgba(255,255,255,.07);border-bottom:3px solid var(--amber);z-index:0}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.mdiff-wrap{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:9px}
.mdiff{display:inline-flex;align-items:center;gap:3px;padding:2px 9px;color:#fff;font-size:12.5px;font-weight:700}
.mdiff-label{font-size:10.5px;color:var(--mute);line-height:1.35}
.nav button:focus-visible{outline:2px solid var(--amber);outline-offset:-2px}

.drop{margin:28px 0;background:var(--card);border:2px dashed var(--line);padding:44px 24px;text-align:center;transition:.15s}
.drop[data-drag="1"]{border-color:var(--amber);background:#FFFBF3}
.drop h2{margin:0 0 8px;font-size:17px;font-weight:700}
.drop p{margin:0 auto 18px;color:var(--slate);font-size:13px;max-width:56ch;line-height:1.6}
.btn{font-family:inherit;font-weight:600;font-size:13px;border:0;padding:11px 22px;cursor:pointer;background:var(--ink);color:#fff}
.btn:hover{background:var(--steel)}
.btn.ghost{background:none;color:var(--slate);border:1px solid var(--line)}
.btn.ghost:hover{background:#fff;color:var(--ink)}
.btn:focus-visible{outline:2px solid var(--amber);outline-offset:2px}
.row{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}

.sect{margin:30px 0}
.sect>h3{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--slate);font-weight:700;margin:0 0 4px;display:flex;align-items:center;gap:10px}
.sect>h3:after{content:"";flex:1;height:1px;background:var(--line)}
.sub{color:var(--slate);font-size:12.5px;margin:0 0 16px;line-height:1.6;max-width:78ch}

.kgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(212px,1fr));gap:1px;background:var(--line);border:1px solid var(--line)}
.k{background:var(--card);padding:16px 17px 15px;position:relative}
.k.big{grid-column:span 2}
.k .code{font-size:10px;color:var(--mute);letter-spacing:.1em}
.k .lab{font-size:12px;font-weight:600;color:var(--slate);margin:5px 0 9px}
.k .val{font-size:27px;font-weight:800;letter-spacing:-.03em;line-height:1}
.k.big .val{font-size:38px}
.k .note{font-size:11px;color:var(--mute);margin-top:8px;line-height:1.45}
.k .note.warn{color:var(--rust)}
.k[data-tone="amber"]{border-top:3px solid var(--amber)}
.k[data-tone="sea"]{border-top:3px solid var(--sea)}
.k[data-tone="sky"]{border-top:3px solid var(--sky)}
.k[data-tone="ink"]{border-top:3px solid var(--line)}

.card{background:var(--card);border:1px solid var(--line);padding:18px 18px 8px;margin-bottom:16px}
.card h4{margin:0 0 3px;font-size:14px;font-weight:700}
.card .cap{margin:0 0 14px;font-size:11.5px;color:var(--slate);line-height:1.5}
.two{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:820px){.two{grid-template-columns:1fr}.k.big{grid-column:span 1}}

table{width:100%;border-collapse:collapse;font-size:12.5px}
th{text-align:left;font-size:10px;letter-spacing:.11em;text-transform:uppercase;color:var(--slate);font-weight:700;padding:9px 10px;border-bottom:2px solid var(--line);white-space:nowrap}
td{padding:9px 10px;border-bottom:1px solid var(--line)}
tbody tr:hover{background:#F7F9FA}
.r{text-align:right;font-variant-numeric:tabular-nums}
.tag{display:inline-block;font-size:10px;letter-spacing:.08em;text-transform:uppercase;padding:2px 7px;border:1px solid var(--line);color:var(--slate)}
.tag.on{border-color:var(--sea);color:var(--sea)}
.tag.off{border-color:var(--mute);color:var(--mute)}

.find{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--slate);padding:15px 17px;margin-bottom:10px}
.find[data-sev="alta"]{border-left-color:var(--rust)}
.find[data-sev="media"]{border-left-color:var(--amber)}
.find[data-sev="buena"]{border-left-color:var(--sea)}
.find .ft{font-size:13.5px;font-weight:700;margin:0 0 5px;display:flex;gap:9px;align-items:center}
.find .sev{font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;padding:2px 7px;background:var(--paper);color:var(--slate)}
.find p{margin:0;font-size:12.5px;color:var(--steel);line-height:1.62}
.act{margin-top:11px;padding-top:11px;border-top:1px dashed var(--line);font-size:11px;display:flex;gap:9px;flex-wrap:wrap;align-items:center}
.act b{background:var(--ink);color:#fff;padding:3px 8px;font-weight:600}
.act span{color:var(--slate)}
.arrow{color:var(--amber);font-weight:700}

.note-box{background:#FFF8EC;border:1px solid #F0DDB8;padding:14px 16px;font-size:12.5px;color:#6B4E17;line-height:1.6;margin-bottom:16px}
.empty{background:var(--card);border:1px solid var(--line);padding:40px 24px;text-align:center;color:var(--slate);font-size:13px;line-height:1.6}
.fld{font-family:inherit;font-size:12.5px;padding:9px 11px;border:1px solid var(--line);background:#fff;color:var(--ink)}
.fld:focus{outline:2px solid var(--amber);outline-offset:-1px}
.btn:disabled{opacity:.45;cursor:not-allowed}
.ai-out{white-space:pre-wrap;font-family:'Archivo',sans-serif;font-size:13px;line-height:1.7;color:var(--steel);margin:14px 0 0;padding:15px 16px;background:var(--paper);border-left:3px solid var(--amber)}
@media print{.nav,.drop,.btn{display:none}.cma{background:#fff}}
.selbar{display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--line);padding:11px 16px;margin-bottom:20px}
.sellab{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--slate);font-weight:700;white-space:nowrap}
.selbar .fld{flex:1;min-width:0}
.clientbar{display:flex;align-items:center;gap:12px;background:var(--ink);color:#fff;padding:11px 16px;margin:0 0 4px;flex-wrap:wrap}
.clientbar .sellab{color:var(--amber)}
.clientbar .fld{min-width:180px}
.clientbar .hint{font-size:11px;color:#9FB2C0;flex:1;min-width:180px}
.pills{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}
.rep-hint{margin:12px 0 0;font-size:11.5px;color:var(--slate)}
${PILLS_CSS}
.wk-chips{display:flex;gap:10px;flex-wrap:wrap}
.wk-chip{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid var(--line);padding:10px 16px;font-size:12px;color:var(--slate);line-height:1.35}
.wk-chip b{color:var(--ink)}
.wk-chip[data-k="feed"]{border-left:4px solid var(--steel)}
.wk-chip[data-k="story"]{border-left:4px solid var(--sea)}
.wk-chip[data-k="miss"]{border-left:4px solid var(--rust)}
.wk-n{font-size:26px;font-weight:700;color:var(--ink);letter-spacing:-.02em}
tr.tot td{border-top:2px solid var(--ink);background:var(--paper)}
.pill{font-family:inherit;font-size:12px;font-weight:600;padding:7px 15px;border:1px solid var(--line);background:#fff;color:var(--slate);cursor:pointer}
.pill:hover:not(:disabled){border-color:var(--steel);color:var(--ink)}
.pill.on{background:var(--ink);color:#fff;border-color:var(--ink)}
.pill.on:hover,.pill.on:focus{color:#fff;border-color:var(--ink)}
.conflict{background:#FFF7EA;border:1px solid #F0D6A8;border-left:4px solid var(--amber);padding:16px 18px;margin:0 0 20px}
.conflict-h{font-weight:700;font-size:14px;color:var(--ink);margin-bottom:6px}
.conflict p{font-size:12.5px;color:var(--steel);margin:0 0 12px;line-height:1.6;max-width:90ch}
.conflict-row{padding:10px 0;border-top:1px dashed #EBCB93}
.conflict-row b{font-size:13px;color:var(--ink)}
.conflict-file{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:7px;font-size:12px}
.conflict-file .mute{color:var(--slate)}
.conflict-btns{display:flex;gap:6px;margin-left:auto}
.conflict-btns .pill{padding:5px 12px;font-size:11.5px}
.conflict-sug{display:flex;gap:14px;align-items:center;flex-wrap:wrap;background:#fff;border:1px solid #F0D6A8;padding:10px 12px;margin:0 0 10px;font-size:12px;color:var(--steel)}
.conflict-sug span{flex:1;min-width:240px}
.conflict-badge{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--sea);border:1px solid var(--sea);padding:2px 7px}
.conflict-problem{font-size:12px;color:var(--rust);margin-top:5px}

.pill:disabled{opacity:.4;cursor:not-allowed}
.ghosts{display:flex;gap:18px;flex-wrap:wrap;margin:6px 2px 4px;padding-top:12px;border-top:1px dashed var(--line)}
.ghost{font-size:11.5px;color:var(--mute)}
.ghost em{color:var(--slate);font-style:normal}
`}</style>

      <div className="tape" />
      <header className="hdr">
        <div className="wrap">
          <div className="hdrbar">
            <div>
              <div className="eyebrow">Big Way Offices · Reporte de campaña</div>
              <h1>Consolidador Meta Ads</h1>
              <p>Carga las exportaciones de Ads Manager (cualquier formato) y de Instagram Insights. Todo se procesa en tu navegador y no sale de este dispositivo.</p>
            </div>
            <div className="stamp mono">{sel?.period ? `${sel.period.from} → ${sel.period.to}` : "Sin periodo cargado"}</div>
          </div>
        </div>
      </header>

      <nav className="nav">
        <div className="wrap" style={{ display: "flex", gap: 2 }}>
          {tabs.map(([id, label]) => (
            <button key={id} data-on={tab === id ? "1" : "0"} onClick={() => setTab(id)}
              onMouseEnter={() => setNavHover(id)} onMouseLeave={() => setNavHover(null)}>
              {navHover === id && tab !== id && (
                <motion.span layoutId="cons-nav-hover" className="nav-hov"
                  transition={{ type: "spring", stiffness: 520, damping: 38 }} />
              )}
              {tab === id && (
                <motion.span layoutId="cons-nav-indicator" className="nav-ind"
                  transition={{ type: "spring", stiffness: 420, damping: 30, mass: 0.8 }} />
              )}
              <span className="nav-lab">{label}</span>
            </button>
          ))}
        </div>
      </nav>

      <div className="wrap">
        <div className="clientbar">
          <span className="sellab">Cliente</span>
          <select className="fld" value={active} onChange={(e) => switchClient(e.target.value)}>
            {Object.keys(store.clients).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <button className="btn ghost" onClick={addClient}>+ Nuevo cliente</button>
          <span className="hint">Asigna cada carga a un cliente. Los datos no se mezclan entre clientes.</span>
        </div>
        <div className="drop" data-drag={drag ? "1" : "0"}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}>
          <h2>{busy ? "Procesando archivos…" : hasAny ? "Cargar un reporte nuevo" : "Arrastra aquí los archivos de Meta"}</h2>
          <p>Acepta el <b>.xlsx</b> de Ads Manager (resumen o desglose por edad, sexo, región, ubicación o día), el <b>.csv</b> de campañas con presupuesto, y los <b>.csv</b> de Instagram Insights en UTF-16. Suelta todos los de un mismo reporte a la vez: {hasAny ? "una carga nueva reemplaza la anterior, no se acumulan." : "se combinan entre sí."}</p>
          <div className="row">
            <button className="btn" onClick={() => inputRef.current?.click()}>Seleccionar archivos</button>
            <button className="btn ghost" onClick={() => histRef.current?.click()}>Cargar histórico (.json)</button>
            {sel && <button className="btn ghost" onClick={exportSnapshot}>Exportar snapshot</button>}
            {hasAny && <button className="btn ghost" onClick={reset}>Empezar de nuevo</button>}
            {(sel || organicKpis.length > 0) && <button className="btn" onClick={() => { const n = ensureClientName(); openReport(makeReport(n)); }}>Informe ejecutivo</button>}
            {(sel || organicKpis.length > 0) && <button className="btn ghost" onClick={() => { const n = ensureClientName(); downloadReport(makeReport(n), n); }}>Descargar informe</button>}
          </div>
          {campaigns.length > 0 && (
            <p className="rep-hint">El informe incluye {campaigns.length === 1 ? `1 ${levelLabel.toLowerCase()}` : `${levelLabel === "Campaña" ? "las" : "los"} ${campaigns.length} ${(LEVEL_PLURAL[levelLabel] || levelLabel).toLowerCase()}`} del nivel «{levelLabel}», cada {levelLabel === "Campaña" ? "una" : "uno"} con sus KPI, desgloses y hallazgos{model?.availableLevels?.length > 1 ? ". Cambia «Agrupar por» para exportar otro nivel." : "."}</p>
          )}
          <input ref={inputRef} type="file" multiple accept=".csv,.xlsx,.xls" style={{ display: "none" }}
            onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
          <input ref={histRef} type="file" multiple accept=".json" style={{ display: "none" }}
            onChange={(e) => { importHistory(e.target.files); e.target.value = ""; }} />
        </div>

        {pendingConflicts.length > 0 && (
          <div className="conflict">
            <div className="conflict-h">Asigna la plataforma de {pendingConflicts.length === 1 ? "una métrica" : `${pendingConflicts.length} métricas`} antes de leer el orgánico</div>
            <p>Meta exporta Instagram y Facebook con el mismo título y sin indicar la plataforma dentro del archivo. Estos archivos traen valores distintos para los mismos días, así que la herramienta no elige uno por su cuenta: la métrica no se reporta hasta que indiques de qué plataforma es cada archivo.</p>
            {pendingConflicts.some((c) => c.files.some((f) => f.suggested)) && (
              <div className="conflict-sug">
                <span>Los archivos de este paquete que sí indican su plataforma (seguidores, visitas, clics) muestran cómo se nombró la descarga. Con ese patrón hay una sugerencia para cada archivo.</span>
                <button className="btn" onClick={applySuggestions}>Aplicar sugerencias</button>
              </div>
            )}
            {pendingConflicts.map((c) => (
              <div key={c.key} className="conflict-row">
                <b>{c.label}</b>
                {c.problem && <div className="conflict-problem">{c.problem}</div>}
                {c.files.map((f) => (
                  <div key={f.name} className="conflict-file">
                    <span className="mono">{f.name}</span>
                    <span className="mute">{f.detail ?? `${int(f.total)} en ${f.days} días`}</span>
                    {f.suggested && !f.platform && <span className="conflict-badge">sugerido: {f.suggested === "ig" ? "Instagram" : "Facebook"}</span>}
                    <span className="conflict-btns">
                      <button className={"pill" + (f.platform === "ig" ? " on" : "")} onClick={() => assignPlatform(f.name, "ig")}>Instagram</button>
                      <button className={"pill" + (f.platform === "fb" ? " on" : "")} onClick={() => assignPlatform(f.name, "fb")}>Facebook</button>
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {model && tab !== "archivos" && (
          <div className="selbar" style={{ flexWrap: "wrap" }}>
            <span className="sellab">Agrupar por</span>
            <Pills label="Agrupar por" style={{ margin: 0 }} value={activeLevel} onChange={setGroupBy}
              options={["campaign", "adset", "ad"].map((lvl) => ({
                key: lvl, disabled: !model.availableLevels.includes(lvl),
                title: !model.availableLevels.includes(lvl) ? "Ningún archivo cargado trae este nivel de nombre" : undefined,
                label: <>{LEVEL_LABEL[lvl]}{!model.availableLevels.includes(lvl) && " ·"}</>,
              }))} />
            {model.requestedLevel !== model.effectiveLevel && (
              <span style={{ fontSize: 11, color: C.rust }}>
                Sin datos a nivel {LEVEL_LABEL[model.requestedLevel].toLowerCase()} — mostrando {levelLabel.toLowerCase()}
              </span>
            )}
            {sel && campaigns.length > 1 && (
              <>
                <span className="sellab" style={{ marginLeft: 8 }}>{levelLabel}</span>
                <select className="fld" style={{ flex: 1, minWidth: 180 }} value={sel.name} onChange={(e) => setSelName(e.target.value)}>
                  {campaigns.map((c) => <option key={c.name} value={c.name}>{c.name} — {c.objective}</option>)}
                </select>
              </>
            )}
          </div>
        )}

        {!hasAny && <div className="empty">Nada cargado todavía. El reporte se construye solo con los datos que subas: ninguna cifra se estima ni se rellena.</div>}

        <TabPanel k={"tab-" + tab}>
        {/* RESUMEN */}
        {hasAny && tab === "resumen" && (
          <Pills label="Resumen" style={{ marginBottom: 18 }} value={resTab} onChange={setResTab}
            options={[{ key: "campanas", label: "Campañas" }, { key: "organico", label: "Orgánico" }]} />
        )}

        <TabPanel k={"res-" + resTab} y={6}>
        {hasAny && tab === "resumen" && resTab === "organico" && (
          organicKpis.length ? (
            <div className="sect">
              <h3>KPI del periodo · Orgánico</h3>
              <p className="sub">Actividad de la cuenta de Instagram. No es atribuible a la pauta: es el desempeño del contenido propio.</p>
              <div className="kgrid">
                {organicKpis.map((k) => (
                  <div className={"k" + (k.big ? " big" : "")} key={k.code} data-tone={k.tone}>
                    <div className="code mono">{k.code}</div><div className="lab">{k.label}</div>
                    <div className="val">{k.value}</div><div className={"note" + (k.warn ? " warn" : "")}>{k.note}</div>
                  </div>
                ))}
              </div>
              {weekly && (
                <div style={{ marginTop: 22 }}>
                  <h3>Publicaciones e historias por semana</h3>
                  <WeeklyPosts weekly={weekly} compact />
                </div>
              )}
              <p className="sub" style={{ marginTop: 14 }}>El detalle de series diarias, audiencia y publicaciones está en la pestaña Orgánico.</p>
            </div>
          ) : <div className="note-box">Aún no hay datos orgánicos. Sube los CSV de Instagram Insights (alcance, visualizaciones, visitas, seguidores) y el CSV de publicaciones.</div>
        )}

        {hasAny && tab === "resumen" && resTab === "campanas" && (!sel ? (
          <div className="note-box">Aún no hay datos de pauta. Sube un <b>.xlsx</b> de Ads Manager para calcular los KPI; los CSV de Insights alimentan la pestaña Orgánico.</div>
        ) : (
          <>
            <div className="sect">
              <h3>KPI del periodo · {sel.objective} <span style={{ color: C.mute, fontWeight: 400 }}>({levelLabel.toLowerCase()})</span></h3>
              <p className="sub">Los indicadores reflejan la campaña seleccionada. Lo que no viene en la exportación se muestra como «sin datos», nunca se estima.</p>
              <div className="kgrid">
                {kpis.map((k) => (
                  <div className={"k" + (k.big ? " big" : "")} key={k.code} data-tone={k.tone}>
                    <div className="code mono">{k.code}</div><div className="lab">{k.label}</div>
                    <div className="val">{k.money !== undefined && k.money !== null ? <Money value={k.money} cur={cur} /> : k.value}</div>
                    {k.diff && <Diff diff={k.diff.value} goodWhen="lower" label={k.diff.label} />}
                    <div className={"note" + (k.warn ? " warn" : "")}>{k.note}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="sect">
              <h3>Recorrido de la inversión</h3>
              <div className="two">
                <div className="card">
                  <h4>Del alcance al resultado</h4>
                  <p className="cap">Cuántas personas se alcanzaron y cuántas terminaron en un resultado del objetivo.</p>
                  <ResponsiveContainer width="100%" height={230}>
                    <BarChart data={funnel} layout="vertical" margin={{ left: 8, right: 34 }}>
                      <CartesianGrid horizontal={false} stroke={C.line} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: C.slate }} />
                      <YAxis dataKey="step" type="category" width={140} tick={{ fontSize: 11, fill: C.steel }} />
                      <Tooltip formatter={(v) => int(v)} />
                      <Bar dataKey="value" radius={[0, 2, 2, 0]}>{funnel.map((e, i) => <Cell key={i} fill={i === funnel.length - 1 ? C.amber : FUNNEL_COLORS[i]} />)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="card">
                  <h4>Ritmo diario</h4>
                  <p className="cap">{sel.dims.day ? "Inversión (barras) y resultados (línea) día a día." : "Sube el desglose por día para ver el ritmo."}</p>
                  {sel.dims.day ? (
                    <ResponsiveContainer width="100%" height={230}>
                      <ComposedChart data={sel.dims.day} margin={{ left: 0, right: 8 }}>
                        <CartesianGrid stroke={C.line} vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.slate }} minTickGap={26} tickFormatter={(v) => String(v).slice(5)} />
                        <YAxis yAxisId="l" tick={{ fontSize: 11, fill: C.slate }} />
                        <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: C.sea }} allowDecimals={false} />
                        <Tooltip formatter={(v, n) => (n === "Inversión" ? money(v, cur) : int(v))} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar yAxisId="l" dataKey="spend" name="Inversión" fill={C.steel} />
                        {!sel.resultsMissing && <Line yAxisId="r" type="monotone" dataKey="results" name="Resultados" stroke={C.sea} strokeWidth={2} dot={false} />}
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : <div style={{ height: 230, display: "flex", alignItems: "center", justifyContent: "center", color: C.mute, fontSize: 13 }}>Sin desglose por día</div>}
                </div>
              </div>
            </div>

            <div className="sect">
              <h3>Hallazgos principales</h3>
              {findings.slice(0, 3).map((f, i) => <Finding key={i} f={f} />)}
              {findings.length > 3 && <button className="btn ghost" onClick={() => setTab("diagnostico")}>Ver los {findings.length} hallazgos</button>}
            </div>
          </>
        ))}
        </TabPanel>

        {/* CAMPAÑAS */}
        {hasAny && tab === "campanas" && (model ? (
          <>
            {model.objectives.map((o) => (
              <div className="sect" key={o.objective}>
                <h3>{o.objective}</h3>
                <p className="sub">{o.campaigns.length} {(o.campaigns.length === 1 ? levelLabel : LEVEL_PLURAL[levelLabel] || levelLabel).toLowerCase()} · {money(o.spend, cur)} · {o.campaigns.every((n) => campaigns.find((c) => c.name === n)?.resultsMissing) ? "resultados sin datos" : `${int(o.results)} resultados · CPL ${money(o.cpl, cur)}`}. Los objetivos se muestran por separado para no mezclar leads con mensajería.</p>
                <div className="card" style={{ padding: 0 }}>
                  <table>
                    <thead><tr><th>{levelLabel}</th><th>Estado</th><th className="r">Inversión</th><th className="r">Resultados</th><th className="r">CPL</th><th className="r">CPM</th><th className="r">Alcance</th><th className="r">Frec.</th></tr></thead>
                    <tbody>
                      {campaigns.filter((c) => c.objective === o.objective).map((c) => (
                        <tr key={c.name} onClick={() => { setSelName(c.name); setTab("resumen"); }} style={{ cursor: "pointer" }}>
                          <td style={{ fontWeight: 600 }}>{c.name}</td>
                          <td><span className={"tag " + (["active", "completed"].includes(norm(c.status)) ? "on" : "off")}>{c.status || "—"}</span></td>
                          <td className="r">{money(c.spend, cur)}</td>
                          <td className="r" style={{ color: c.resultsMissing ? C.mute : undefined }}>{c.resultsMissing ? "sin datos" : int(c.results)}</td>
                          <td className="r" style={{ fontWeight: 700, color: c.results ? C.ink : C.mute }}>{c.resultsMissing ? "—" : c.results ? money(c.cpl, cur) : "sin resultados"}</td>
                          <td className="r">{money(c.cpm, cur)}</td>
                          <td className="r">{int(c.reach)}</td>
                          <td className="r">{dec(c.frequency, 2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            <p className="sub" style={{ marginTop: -6 }}>Agrupado por {levelLabel.toLowerCase()}. Toca una fila para verla en detalle.</p>
          </>
        ) : !crmLeads && <div className="empty">Sube el .xlsx de Ads Manager para ver esta sección.</div>)}

        {hasAny && tab === "campanas" && crmLeads && (() => {
          // periodo de la pauta cargada, para comparar con las fechas de los leads
          const ps = (model?.campaigns || []).map((c) => c.period).filter(Boolean);
          const pFrom = ps.map((p) => p.from).sort()[0], pTo = ps.map((p) => p.to).sort().slice(-1)[0];
          const overlap = pFrom && crmLeads.from ? !(crmLeads.to < pFrom || crmLeads.from > pTo) : null;
          const metaLeads = (model?.campaigns || []).filter((c) => c.objective === "Clientes potenciales" && !c.resultsMissing).reduce((a, c) => a + c.results, 0);
          // comparar solo dentro del periodo común: leads del CRM fuera del rango de la pauta no son comparables
          const inPeriod = overlap ? crmLeads.byDay.filter((d) => d.date >= pFrom && d.date <= pTo).reduce((a, d) => a + d.n, 0) : null;
          const partial = overlap && (crmLeads.from < pFrom || crmLeads.to > pTo);
          const Mini = ({ title, rows }) => (
            <div className="card" style={{ padding: 0 }}>
              <table><thead><tr><th>{title}</th><th className="r">Leads</th><th className="r">%</th></tr></thead>
                <tbody>{rows.map((r) => <tr key={r.label}><td>{r.label}</td><td className="r">{int(r.n)}</td><td className="r">{pct((r.n / crmLeads.total) * 100, 0)}</td></tr>)}</tbody></table>
            </div>
          );
          return (
            <div className="sect">
              <h3>Leads registrados en el CRM</h3>
              <p className="sub">Conteos agregados de las exportaciones de leads. Los datos personales (nombre, correo, teléfono) se leen solo para contar y no se muestran, no se guardan ni entran en el informe ni en los snapshots.</p>
              {partial && (
                <div className="note-box">Los leads del CRM van del <b>{crmLeads.from} al {crmLeads.to}</b> y la pauta del <b>{pFrom} al {pTo}</b>. Solo se comparan los <b>{int(inPeriod)}</b> leads registrados dentro del periodo de la pauta; los demás quedan fuera de la comparación.</div>
              )}
              {overlap === false && (
                <div className="note-box">Los leads del CRM son del <b>{crmLeads.from} al {crmLeads.to}</b> y la pauta cargada es del <b>{pFrom} al {pTo}</b>: los periodos no coinciden, así que estas cifras no son comparables con los resultados de Meta.</div>
              )}
              <div className="kgrid" style={{ marginBottom: 16 }}>
                <div className="k" data-tone="sea"><div className="lab">Leads en el CRM</div><div className="val">{int(crmLeads.total)}</div><div className="note">{crmLeads.from} a {crmLeads.to}</div></div>
                <div className="k" data-tone="ink"><div className="lab">Contactos únicos</div><div className="val">{crmLeads.unique === null ? "sin datos" : int(crmLeads.unique)}</div><div className="note">{crmLeads.unique !== null && crmLeads.unique < crmLeads.total ? `${int(crmLeads.total - crmLeads.unique)} registros repetidos` : "Sin duplicados"}</div></div>
                <div className="k" data-tone="amber"><div className="lab">Sin asignar</div><div className="val">{int(crmLeads.byOwner.filter((o) => /unassigned|sin propietario|sin asignar/i.test(o.label)).reduce((a, o) => a + o.n, 0))}</div><div className="note">Leads sin propietario comercial</div></div>
                {overlap === true && <div className="k" data-tone="sky"><div className="lab">CRM vs Meta en {pFrom.slice(5)} a {pTo.slice(5)}</div><div className="val">{int(inPeriod)} / {int(metaLeads)}</div><div className="note">Leads en el CRM / leads que reporta Meta, mismo periodo. Los formularios del CRM pueden no corresponder 1 a 1 con las campañas.</div></div>}
              </div>
              <div className="two">
                <Mini title="Formulario" rows={crmLeads.byForm} />
                <Mini title="Etapa" rows={crmLeads.byStage} />
                <Mini title="Origen" rows={crmLeads.byOrigin} />
                <Mini title="Canal" rows={crmLeads.byChannel} />
              </div>
              {crmLeads.byDay.length > 1 && (
                <div className="card" style={{ marginTop: 16 }}>
                  <h4>Leads por día de registro</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={crmLeads.byDay} margin={{ left: 0, right: 8 }}>
                      <CartesianGrid stroke={C.line} vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: C.slate }} tickFormatter={(v) => v.slice(5)} />
                      <YAxis tick={{ fontSize: 10, fill: C.slate }} allowDecimals={false} />
                      <Tooltip formatter={(v) => int(v)} />
                      <Bar dataKey="n" name="Leads" fill={C.sea} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          );
        })()}

        {/* DESGLOSES */}
        {hasAny && tab === "desgloses" && (sel ? (
          <>
            <div className="sect">
              <h3>Desgloses de «{sel.name}» <span style={{ color: C.mute, fontWeight: 400, fontSize: 13 }}>({levelLabel.toLowerCase()})</span></h3>
              <Pills label="Desglose" value={dimTab} onChange={setDimTab}
                options={["age", "gender", "region", "placement", "heatmap"].map((d) => {
                  const off = d === "heatmap" ? !sel.dims.day : !sel.dims[d];
                  return { key: d, disabled: off, label: <>{DIM_LABELS[d]}{off && " ·"}</> };
                })} />
              {dimTab === "heatmap" ? (
                sel.dims.day ? (
                  <div className="card">
                    <h4>Resultados por día de semana</h4>
                    <p className="cap">Intensidad = leads. Los recuadros vacíos son días sin entrega. Meta no exporta la hora en estos archivos, así que el detalle por hora no está disponible.</p>
                    <HeatGrid hm={heatmap(sel.dims.day.map((d) => ({ date: d.label, results: d.results })), "results")} />
                  </div>
                ) : <div className="empty">Sube el desglose por día para ver el mapa de calor.</div>
              ) : !sel.dims[dimTab] ? (
                <div className="empty">Esta campaña no tiene desglose por {DIM_LABELS[dimTab].toLowerCase()}. Sube ese export desde Ads Manager.</div>
              ) : (
                <>
                  <div className="card">
                    <h4>{dimTab === "placement" ? "Resultados por ubicación" : dimTab === "region" ? "Regiones por volumen de leads" : `Resultados por ${DIM_LABELS[dimTab].toLowerCase()}`}</h4>
                    <p className="cap">{sel.resultsMissing ? "Barras = inversión: Meta no exportó resultados para esta entidad, así que no se grafican ceros." : "Barras = resultados. El costo por resultado de cada grupo está en la tabla de abajo."}</p>
                    <ResponsiveContainer width="100%" height={Math.max(220, Math.min(dimData.length, 12) * 30 + 40)}>
                      <BarChart data={dimData.slice(0, 12)} layout="vertical" margin={{ left: 8, right: 90 }}>
                        <CartesianGrid horizontal={false} stroke={C.line} />
                        <XAxis type="number" tick={{ fontSize: 11, fill: C.slate }} />
                        <YAxis dataKey="label" type="category" width={dimTab === "region" ? 130 : 150} tick={{ fontSize: 11, fill: C.steel }} tickFormatter={(v) => dimTab === "gender" ? glabel(v) : String(v).slice(0, 22)} />
                        <Tooltip formatter={(v, n) => n === "Resultados" ? int(v) : money(v, cur)} labelFormatter={(l) => dimTab === "gender" ? glabel(l) : l} />
                        <Bar dataKey={sel.resultsMissing ? "spend" : "results"} name={sel.resultsMissing ? "Inversión" : "Resultados"} fill={sel.resultsMissing ? C.steel : C.sea} radius={[0, 2, 2, 0]}
                          label={{ position: "right", fontSize: 10, fill: C.slate, formatter: (v) => "" }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="card" style={{ padding: 0 }}>
                    <table>
                      <thead><tr><th>{DIM_LABELS[dimTab]}</th><th className="r">Inversión</th>{dimHasImp && <th className="r">Impres.</th>}{dimHasReach && <th className="r">Alcance</th>}{dimTab === "region" && dimHasImp && <th className="r" title="Resultados ÷ impresiones">Conv./impr.</th>}<th className="r">Resultados</th><th className="r">CPL</th><th>Lectura</th></tr></thead>
                      <tbody>
                        {dimData.map((s) => {
                          const bad = !sel.resultsMissing && s.results === 0 && s.spend > 0;
                          const good = s.results > 0 && sel.cpl && s.cpl < sel.cpl;
                          return (
                            <tr key={s.label}>
                              <td style={{ fontWeight: 600 }}>{dimTab === "gender" ? glabel(s.label) : s.label}</td>
                              <td className="r">{money(s.spend, cur)}</td>
                              {dimHasImp && <td className="r">{int(s.impressions)}</td>}
                              {dimHasReach && <td className="r">{int(s.reach)}</td>}
                              {dimTab === "region" && dimHasImp && <td className="r">{s.impressions ? pct((s.results / s.impressions) * 100, 2) : "—"}</td>}
                              <td className="r">{sel.resultsMissing ? "sin datos" : int(s.results)}</td>
                              <td className="r" style={{ fontWeight: 700, color: bad ? C.rust : good ? C.sea : C.ink }}>{bad || sel.resultsMissing ? "—" : money(s.cpl, cur)}</td>
                              <td style={{ fontSize: 11.5, color: C.slate }}>{sel.resultsMissing ? "Sin resultados exportados" : bad ? "Sin retorno: candidato a exclusión" : good ? "Bajo el promedio" : "Sobre el promedio"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </>
        ) : <div className="empty">Sube el .xlsx de Ads Manager para ver esta sección.</div>)}

        {/* GRÁFICOS */}
        {hasAny && tab === "graficos" && (sel ? (
          <>
            <div className="sect">
              <h3>Embudo de conversión</h3>
              <p className="sub">Solo etapas con datos reales. Las que dependen de fuentes que no tienes se muestran vacías, no se estiman.</p>
              <div className="card">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={funnel} layout="vertical" margin={{ left: 8, right: 40 }}>
                    <CartesianGrid horizontal={false} stroke={C.line} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: C.slate }} />
                    <YAxis dataKey="step" type="category" width={150} tick={{ fontSize: 11, fill: C.steel }} />
                    <Tooltip formatter={(v) => int(v)} />
                    <Bar dataKey="value" radius={[0, 2, 2, 0]}>{funnel.map((e, i) => <Cell key={i} fill={i === funnel.length - 1 ? C.amber : FUNNEL_COLORS[i]} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="ghosts">
                  {(sel.linkClicks === null || sel.linkClicks === undefined) && <span className="ghost">Clics · sin datos <em>(exporta la columna «Clics en el enlace»)</em></span>}
                  <span className="ghost">Ventas · sin datos <em>(requiere conexión al CRM)</em></span>
                </div>
              </div>
            </div>

            <div className="sect">
              <h3>Mapa de calor por día de semana</h3>
              {hmOptions.length ? (
                <>
                  <Pills label="Métrica del mapa de calor" value={hmSel?.key} onChange={setHmMetric}
                    options={hmOptions.map((o) => ({ key: o.key, label: o.label }))} />
                  <p className="sub">Intensidad = valor del día. Meta no entrega la hora en estos exports, así que el detalle por hora no está disponible.</p>
                  {hm && <div className="card"><HeatGrid hm={hm} /></div>}
                </>
              ) : <div className="empty">Sube un desglose por día (pauta) o series de Instagram para ver el mapa de calor.</div>}
            </div>

            <div className="sect">
              <h3>Flujo objetivo → campaña → desglose</h3>
              <Pills label="Dimensión del Sankey" value={skDimEff} onChange={setSkDim}
                options={[["placement","Ubicación"],["gender","Sexo"],["age","Edad"],["region","Región"]].map(([k, lab]) => ({
                  key: k, disabled: !skAvail.includes(k),
                  title: !skAvail.includes(k) ? "Este desglose no viene en los archivos cargados" : undefined,
                  label: <>{lab}{!skAvail.includes(k) && " ·"}</>,
                }))} />
              <p className="sub">El ancho de cada banda es el número de resultados. Objetivos separados: los leads nunca se mezclan con mensajería. Si una campaña no tiene el desglose seleccionado, las bandas terminan en la campaña.</p>
              {sk && sk.links.length ? (
                <div className="card">
                  <ResponsiveContainer width="100%" height={Math.max(300, sk.nodes.length * 26)}>
                    <Sankey data={sk} nodePadding={16} nodeWidth={11} linkCurvature={0.5} margin={{ left: 4, right: 150, top: 12, bottom: 12 }}
                      node={<SankNodeEl maxDepth={sk.maxDepth} />} link={{ stroke: C.sky, strokeOpacity: 0.22 }}>
                      <Tooltip formatter={(v) => int(v)} />
                    </Sankey>
                  </ResponsiveContainer>
                </div>
              ) : <div className="empty">Se necesita al menos una campaña con resultados y su desglose por ubicación o región.</div>}
            </div>

            <div className="sect">
              <h3>Gráficos que requieren datos adicionales</h3>
              <p className="sub">No se construyen porque los datos que necesitan no están en las exportaciones actuales. Aparecen aquí para que sepas exactamente qué haría falta.</p>
              <div className="card" style={{ padding: 0 }}>
                <table>
                  <thead><tr><th>Gráfico</th><th>Requiere</th></tr></thead>
                  <tbody>
                    <tr><td style={{ fontWeight: 600 }}>Cascada (ingreso → beneficio neto)</td><td style={{ color: C.slate }}>Ingresos, costos y comisiones desde el CRM o contabilidad. Meta no los tiene.</td></tr>
                    <tr><td style={{ fontWeight: 600 }}>Radar multi-canal</td><td style={{ color: C.slate }}>Datos de otros canales (Google, TikTok). Aquí solo hay Meta.</td></tr>
                    <tr><td style={{ fontWeight: 600 }}>Embudo hasta ventas</td><td style={{ color: C.slate }}>Ventas cerradas por lead desde el CRM, y clics de anuncio para la etapa de clic.</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : <div className="empty">Sube el .xlsx de Ads Manager para ver los gráficos.</div>)}

        {/* ORGÁNICO */}
        {hasAny && tab === "organico" && (
          <>
            {weekly && (
              <div className="sect">
                <h3>Ritmo de publicación semanal</h3>
                <p className="sub">Cuántas publicaciones de feed (reels, carruseles, imágenes) e historias subió la cuenta cada semana, de lunes a domingo. Se cuenta solo lo que viene en los CSV de publicaciones.</p>
                <WeeklyPosts weekly={weekly} />
              </div>
            )}
            {(adDaily.length > 0 || Object.keys(series).length > 0) && (
              <div className="sect">
                <h3>Agregación por intervalo</h3>
                <Pills label="Intervalo" value={intv} onChange={setIntv}
                  options={Object.entries(INTERVALS).map(([k, lab]) => ({ key: k, label: lab }))} />
                {adByInterval.length > 0 && (
                  <div className="card" style={{ padding: 0 }}>
                    <table>
                      <thead><tr><th>Intervalo (pauta)</th><th className="r">Inversión</th><th className="r">Resultados</th><th className="r">CPL</th><th className="r">Cobertura</th></tr></thead>
                      <tbody>{adByInterval.map((b) => (
                        <tr key={b.key}><td style={{ fontWeight: 600 }}>{b.label}</td><td className="r">{money(b.spend, cur)}</td><td className="r">{int(b.results)}</td><td className="r">{money(b.cpl, cur)}</td>
                          <td className="r" style={{ color: b.partial ? C.rust : C.sea }}>{b.daysWith}/{b.span} d{b.partial ? " · parcial" : ""}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
                <p className="sub" style={{ marginTop: 8 }}>Los intervalos muestran solo los días realmente cargados. Un trimestre, semestre o año incompleto se marca como «parcial»; nunca se rellenan días que no existen.</p>
              </div>
            )}
            {organicDaily.length > 0 && (
              <div className="sect">
                <h3>Actividad diaria de la cuenta</h3>
                <p className="sub">Datos de Instagram Insights. No son atribuibles a la pauta: sirven de contexto, no de resultado de campaña. Cada métrica tiene su propio eje para no distorsionar las proporciones.</p>
                <div className="two">
                  {series.views && <div className="card">
                    <h4>Visualizaciones</h4>
                    <p className="cap">Total: {int(series.views.reduce((a, r) => a + r.value, 0))} · {series.views.length} días</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={organicDaily} margin={{ left: 0, right: 8 }}>
                        <CartesianGrid stroke={C.line} vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: C.slate }} minTickGap={30} tickFormatter={(v) => v.slice(5)} />
                        <YAxis tick={{ fontSize: 10, fill: C.slate }} />
                        <Tooltip formatter={(v) => int(v)} />
                        <Line type="monotone" dataKey="views" name="Visualizaciones" stroke={C.steel} strokeWidth={2} dot={false} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>}
                  {series.reach && <div className="card">
                    <h4>Alcance</h4>
                    <p className="cap">Total: {int(series.reach.reduce((a, r) => a + r.value, 0))} · {series.reach.length} días</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={organicDaily} margin={{ left: 0, right: 8 }}>
                        <CartesianGrid stroke={C.line} vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: C.slate }} minTickGap={30} tickFormatter={(v) => v.slice(5)} />
                        <YAxis tick={{ fontSize: 10, fill: C.slate }} />
                        <Tooltip formatter={(v) => int(v)} />
                        <Line type="monotone" dataKey="reach" name="Alcance" stroke={C.sky} strokeWidth={2} dot={false} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>}
                  {series.profileVisits && <div className="card">
                    <h4>Visitas al perfil</h4>
                    <p className="cap">Total: {int(series.profileVisits.reduce((a, r) => a + r.value, 0))} · {series.profileVisits.length} días</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={organicDaily} margin={{ left: 0, right: 8 }}>
                        <CartesianGrid stroke={C.line} vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: C.slate }} minTickGap={30} tickFormatter={(v) => v.slice(5)} />
                        <YAxis tick={{ fontSize: 10, fill: C.slate }} />
                        <Tooltip formatter={(v) => int(v)} />
                        <Line type="monotone" dataKey="profileVisits" name="Visitas al perfil" stroke={C.sea} strokeWidth={2} dot={false} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>}
                  {series.followers && <div className="card">
                    <h4>Seguidores nuevos</h4>
                    <p className="cap">Total: {int(series.followers.reduce((a, r) => a + r.value, 0))} · {series.followers.length} días</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={organicDaily} margin={{ left: 0, right: 8 }}>
                        <CartesianGrid stroke={C.line} vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: C.slate }} minTickGap={30} tickFormatter={(v) => v.slice(5)} />
                        <YAxis tick={{ fontSize: 10, fill: C.slate }} allowDecimals={false} />
                        <Tooltip formatter={(v) => int(v)} />
                        <Line type="monotone" dataKey="followers" name="Seguidores nuevos" stroke={C.amber} strokeWidth={2} dot={false} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>}
                  {series.viewers && <div className="card">
                    <h4>Espectadores</h4>
                    <p className="cap">Total: {int(series.viewers.reduce((a, r) => a + r.value, 0))} · {series.viewers.length} días</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={organicDaily} margin={{ left: 0, right: 8 }}>
                        <CartesianGrid stroke={C.line} vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: C.slate }} minTickGap={30} tickFormatter={(v) => v.slice(5)} />
                        <YAxis tick={{ fontSize: 10, fill: C.slate }} />
                        <Tooltip formatter={(v) => int(v)} />
                        <Line type="monotone" dataKey="viewers" name="Espectadores" stroke={C.rust} strokeWidth={2} dot={false} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>}
                  {FB_CHARTS.filter(([k]) => series[k]?.length).map(([k, lab, col]) => (
                    <div className="card" key={k}>
                      <h4>{lab} <span style={{ color: C.mute, fontWeight: 400 }}>· Facebook</span></h4>
                      <p className="cap">Total: {int(series[k].reduce((a, r) => a + r.value, 0))} · {series[k].length} días · nunca se suma a Instagram</p>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={organicDaily} margin={{ left: 0, right: 8 }}>
                          <CartesianGrid stroke={C.line} vertical={false} />
                          <XAxis dataKey="date" tick={{ fontSize: 9, fill: C.slate }} minTickGap={30} tickFormatter={(v) => v.slice(5)} />
                          <YAxis tick={{ fontSize: 10, fill: C.slate }} allowDecimals={false} />
                          <Tooltip formatter={(v) => int(v)} />
                          <Line type="monotone" dataKey={k} name={`${lab} (Facebook)`} stroke={col} strokeWidth={2} dot={false} connectNulls />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {audience && <AudienceBlock a={audience} title={fbAudience ? "Perfil de la audiencia · Instagram" : "Perfil de la audiencia"} />}
            {fbAudience && <AudienceBlock a={fbAudience} title="Perfil de la audiencia · Facebook" fb />}
            {posts.length > 0 && (
              <div className="sect">
                <h3>Publicaciones</h3>
                <p className="sub">{posts.length} publicaciones cargadas. Toca cualquier columna para reordenar. Las métricas vacías son las que Meta no reporta para ese tipo de publicación.</p>
                <div className="card" style={{ padding: 0, overflowX: "auto" }}>
                  <table>
                    <thead><tr>
                      {[["date","Fecha"],["type","Tipo"],["caption","Copy"],["reach","Alcance"],["views","Vistas"],["interactions","Interacción"],["likes","Me gusta"],["comments","Coment."],["shares","Compart."],["saves","Guard."],["follows","Seguim."]].map(([k, lab]) => (
                        <th key={k} className={["date","type","caption"].includes(k) ? "" : "r"} style={{ cursor: "pointer", whiteSpace: "nowrap", color: postSort.key === k ? C.ink : undefined }}
                          onClick={() => setPostSort((p) => ({ key: k, dir: p.key === k && p.dir === "desc" ? "asc" : "desc" }))}>
                          {lab}{postSort.key === k ? (postSort.dir === "desc" ? " ↓" : " ↑") : ""}
                        </th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {sortedPosts.slice(0, postLimit).map((p) => (
                        <tr key={p.id}>
                          <td className="mono" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{p.date || "—"}</td>
                          <td><span className="tag">{p.type.replace(" de Instagram", "")}</span></td>
                          <td style={{ maxWidth: 330, minWidth: 200, color: C.steel, fontSize: 12 }}>
                            {p.caption ? (
                              p.link ? <a href={p.link} target="_blank" rel="noopener noreferrer" style={{ color: C.steel, textDecoration: "none" }} title={p.caption}>{p.caption.slice(0, 95).replace(/\s+/g, " ")}{p.caption.length > 95 ? "…" : ""}</a>
                                : <span title={p.caption}>{p.caption.slice(0, 95).replace(/\s+/g, " ")}{p.caption.length > 95 ? "…" : ""}</span>
                            ) : <span style={{ color: C.mute, fontStyle: "italic" }}>sin copy</span>}
                          </td>
                          <td className="r">{int(p.reach)}</td>
                          <td className="r">{int(p.views)}</td>
                          <td className="r" style={{ fontWeight: 600 }}>{int(p.interactions)}</td>
                          <td className="r">{int(p.likes)}</td>
                          <td className="r">{int(p.comments)}</td>
                          <td className="r">{int(p.shares)}</td>
                          <td className="r">{int(p.saves)}</td>
                          <td className="r">{int(p.follows)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {posts.length > postLimit && (
                  <div style={{ marginTop: 10 }}>
                    <button className="btn ghost" onClick={() => setPostLimit((n) => n + 20)}>Ver más ({posts.length - postLimit} restantes)</button>
                  </div>
                )}
              </div>
            )}
            {organicDaily.length === 0 && !audience && !fbAudience && posts.length === 0 && <div className="empty">No hay datos orgánicos cargados. Sube los CSV de Instagram Insights.</div>}
          </>
        )}

        {/* HISTÓRICO */}
        {hasAny && tab === "historico" && (
          history.length === 0 ? (
            <div className="empty">
              Aquí ves el consolidado histórico del cliente activo cargando snapshots exportados en meses anteriores. Usa el botón «Cargar histórico (.json)» arriba. Cada snapshot puede estar cifrado con clave del cliente.
            </div>
          ) : (
            <>
              <div className="sect">
                <h3>Snapshots cargados</h3>
                <p className="sub">{history.length} archivo(s) · cliente «{merged?.client}». La consolidación agrega los días de todos los snapshots sin duplicar; los solapamientos se avisan más abajo.</p>
                <div className="card" style={{ padding: 0 }}>
                  <table>
                    <thead><tr><th>Snapshot</th><th className="r">Campañas</th><th className="r">Creado</th></tr></thead>
                    <tbody>{merged.sources.map((s, i) => (
                      <tr key={i}><td>#{i + 1}</td><td className="r">{s.campaigns}</td><td className="r mono" style={{ fontSize: 11 }}>{s.createdAt.slice(0, 10)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
                {histWarn.length > 0 && (
                  <div className="note-box" style={{ marginTop: 12 }}>
                    <b>Avisos:</b>
                    <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>{histWarn.map((w, i) => <li key={i} style={{ marginBottom: 3 }}>{w}</li>)}</ul>
                  </div>
                )}
              </div>

              <div className="sect">
                <h3>Consolidado por intervalo</h3>
                <Pills label="Intervalo" value={intv} onChange={setIntv}
                  options={Object.entries(INTERVALS).map(([k, lab]) => ({ key: k, label: lab }))} />
                {histByInterval.length > 0 ? (
                  <div className="card" style={{ padding: 0 }}>
                    <table>
                      <thead><tr><th>{INTERVALS[intv]}</th><th className="r">Inversión</th><th className="r">Resultados</th><th className="r">CPL</th><th className="r">Cobertura</th></tr></thead>
                      <tbody>{histByInterval.map((b) => (
                        <tr key={b.key}><td style={{ fontWeight: 600 }}>{b.label}</td><td className="r">{money(b.spend, cur)}</td><td className="r">{int(b.results)}</td><td className="r">{money(b.cpl, cur)}</td>
                          <td className="r" style={{ color: b.partial ? C.rust : C.sea }}>{b.daysWith}/{b.span} d{b.partial ? " · parcial" : ""}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                ) : <div className="empty">Los snapshots cargados no contienen desglose por día. Vuelve a exportarlos incluyendo el archivo diario de Meta.</div>}
                <p className="sub" style={{ marginTop: 10 }}>Las cifras son la suma exacta de los días presentes en los snapshots. Si un mes/trimestre está incompleto, aparece marcado como «parcial»: nunca se rellenan días que no existen.</p>
              </div>

              <div className="sect">
                <h3>Campañas del período consolidado</h3>
                <div className="card" style={{ padding: 0 }}>
                  <table>
                    <thead><tr><th>Campaña</th><th>Objetivo</th><th className="r">Período</th><th className="r">Inversión</th><th className="r">Resultados</th><th className="r">CPL</th></tr></thead>
                    <tbody>{merged.campaigns.map((c, i) => (
                      <tr key={i}><td style={{ fontWeight: 600 }}>{c.name}</td><td>{c.objective}</td><td className="r mono" style={{ fontSize: 11 }}>{c.period ? `${c.period.from} → ${c.period.to}` : "—"}</td><td className="r">{money(c.spend, cur)}</td><td className="r">{int(c.results)}</td><td className="r">{money(c.cpl, cur)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>

              <div className="sect">
                <button className="btn ghost" onClick={() => { setHistory([]); setHistWarn([]); }}>Vaciar histórico</button>
              </div>
            </>
          )
        )}

        {/* DIAGNÓSTICO */}
        {hasAny && tab === "diagnostico" && (
          <Pills label="Diagnóstico" style={{ marginBottom: 18 }} value={diagTab} onChange={setDiagTab}
            options={[{ key: "campanas", label: "Campañas" }, { key: "organico", label: "Orgánico" }]} />
        )}

        <TabPanel k={"diag-" + diagTab} y={6}>
        {hasAny && tab === "diagnostico" && diagTab === "organico" && (
          organicFindings.length ? (
            <>
              <div className="sect">
                <h3>Hallazgos · Orgánico</h3>
                <p className="sub">Generados por reglas sobre las series de Instagram y las publicaciones cargadas. Puedes editar cualquiera antes de llevarlo al reporte.</p>
                {organicFindings.map((f, i) => (
                  <EditableFinding key={i} f={f} idx={i} edits={orgEdits} setEdits={setOrgEdits} />
                ))}
              </div>
              <div className="sect">
                <h3>Decisiones · Orgánico</h3>
                <div className="card" style={{ padding: "18px 20px 20px" }}>
                  <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.9, color: C.steel }}>
                    {organicFindings.filter((f) => f.action).slice(0, 5).map((f, i) => (
                      <li key={i}><b>{f.action.do}</b> <span className="arrow">→</span> {f.action.on} <span className="arrow">→</span> <span style={{ color: C.slate }}>vigilar {f.action.watch}</span></li>
                    ))}
                  </ol>
                </div>
              </div>
            </>
          ) : <div className="empty">No hay datos orgánicos cargados. Sube los CSV de Instagram Insights y de publicaciones.</div>
        )}

        {hasAny && tab === "diagnostico" && diagTab === "campanas" && (sel ? (
          <>
            <div className="sect">
              <h3>Hallazgos · {sel.name} <span style={{ color: C.mute, fontWeight: 400, fontSize: 13 }}>({levelLabel.toLowerCase()})</span></h3>
              <p className="sub">Generados por reglas sobre los datos cargados. Ninguno se apoya en supuestos ni en promedios de industria. Puedes editar cualquiera antes de llevarlo al reporte.</p>
              {findings.map((f, i) => (
                <EditableFinding key={sel.name + i} f={f} idx={i} edits={selEdits} setEdits={setSelEdits} />
              ))}
            </div>
            <div className="sect">
              <h3>Análisis con modelo de lenguaje</h3>
              <p className="sub">Se envía solo el resumen agregado en pantalla — nunca los archivos ni filas individuales. Aun así, esos datos salen de tu navegador hacia el proveedor que elijas.</p>
              <div className="card" style={{ padding: "18px 20px 20px" }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                  <select className="fld" value={ai.provider} onChange={(e) => setAi({ ...ai, provider: e.target.value })}>
                    <option value="anthropic">Claude (Anthropic)</option><option value="google">Gemini (Google)</option><option value="openai">GPT (OpenAI)</option>
                  </select>
                  <input className="fld" style={{ width: 190 }} placeholder="Modelo (opcional)" title="Vacío = el modelo configurado en el servidor" value={ai.model} onChange={(e) => setAi({ ...ai, model: e.target.value })} />
                  <input className="fld" style={{ flex: 1, minWidth: 220 }} placeholder="Pregunta específica (opcional)" value={ai.question} onChange={(e) => setAi({ ...ai, question: e.target.value })} />
                  <button className="btn" disabled={ai.busy} onClick={async () => {
                    setAi((a) => ({ ...a, busy: true, error: "", texto: "" }));
                    try {
                      const metrics = construirPayload(sel, { model, audiencia: audience });
                      const r = await pedirAnalisis({ provider: ai.provider, model: ai.model, metrics, question: ai.question });
                      setAi((a) => ({ ...a, busy: false, texto: r.texto }));
                    } catch (e) { setAi((a) => ({ ...a, busy: false, error: String(e.message || e) })); }
                  }}>{ai.busy ? "Analizando…" : "Generar análisis"}</button>
                </div>
                {ai.error && <div style={{ color: C.rust, fontSize: 12.5 }}>{ai.error}</div>}
                {ai.texto && <pre className="ai-out">{ai.texto}</pre>}
                {!ai.texto && !ai.error && !ai.busy && <p style={{ margin: 0, fontSize: 12, color: C.mute }}>El modelo recibe las mismas reglas del reporte: sin benchmarks de industria, sin cifras inventadas, cada afirmación con su dato.</p>}
              </div>
            </div>
            <div className="sect">
              <h3>Decisiones para el próximo ciclo</h3>
              <div className="card" style={{ padding: "18px 20px 20px" }}>
                <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.9, color: C.steel }}>
                  {findings.filter((f) => f.action).slice(0, 5).map((f, i) => (
                    <li key={i}><b>{f.action.do}</b> <span className="arrow">→</span> {f.action.on} <span className="arrow">→</span> <span style={{ color: C.slate }}>vigilar {f.action.watch}</span></li>
                  ))}
                </ol>
              </div>
            </div>
          </>
        ) : <div className="empty">Sube el .xlsx de Ads Manager para generar el diagnóstico.</div>)}
        </TabPanel>

        {/* PUBLICAR AL PORTAL */}
        {hasAny && tab === "admin" && (
          <div className="sect">
            <h3>Publicar al portal del cliente</h3>
            <p className="sub">El reporte se guarda en BWO Engine y el cliente lo ve en «Mis reportes» al iniciar sesión. Los accesos se gestionan en «Clientes y accesos».</p>
            <div className="card" style={{ padding: "18px 20px" }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, alignItems: "flex-end" }}>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: C.slate, marginBottom: 4 }}>Cliente destino</div>
                  <select className="fld" value={pub.clientId} onChange={(e) => setPub({ ...pub, clientId: e.target.value, done: "" })}>
                    <option value="">— Selecciona —</option>
                    {engineClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <button className="btn" disabled={!pub.clientId || pub.busy || !model} onClick={publishSnapshot}>{pub.busy ? "Publicando…" : "Publicar al portal"}</button>
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: C.slate, marginBottom: 4 }}>Análisis para el cliente (editable)</div>
                <textarea className="fld" rows={6} style={{ width: "100%", fontFamily: "inherit", fontSize: 13, lineHeight: 1.7, resize: "vertical" }}
                  placeholder="Escribe aquí el análisis que verá el cliente. Puedes usar el texto generado por la IA como base y editarlo."
                  value={pub.analysis} onChange={(e) => setPub({ ...pub, analysis: e.target.value })} />
              </div>
              {pub.done && <div style={{ color: C.sea, fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{pub.done}</div>}
              {pub.error && <div style={{ color: C.rust, fontSize: 12.5, marginBottom: 6 }}>{pub.error}</div>}
              <p className="sub" style={{ margin: 0 }}>Período: {model ? `${reportPeriod().from} → ${reportPeriod().to}` : "—"} (abarca todas las {levelLabel.toLowerCase()}s cargadas). Si ya existe un reporte para ese período, se reemplaza.</p>
            </div>
          </div>
        )}

        {/* ARCHIVOS */}
        {hasAny && tab === "archivos" && (
          <div className="sect">
            <h3>Archivos procesados</h3>
            <p className="sub">Qué reconoció la app en cada archivo. Lo que aparece en rojo no entra en ningún cálculo.</p>
            <div className="card" style={{ padding: 0 }}>
              <table>
                <thead><tr><th>Archivo</th><th>Reconocido como</th><th>Detalle</th></tr></thead>
                <tbody>{files.map((f, i) => (
                  <tr key={i}><td className="mono" style={{ fontSize: 11.5 }}>{f.name}</td><td style={{ color: f.ok ? C.ink : C.rust, fontWeight: 600 }}>{f.kind}</td><td style={{ color: C.slate, fontSize: 11.5 }}>{f.detail}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}
        </TabPanel>
      </div>
    </div>
  );
}

function HeatGrid({ hm }) {
  const cell = (v) => {
    if (!hm.max) return "transparent";
    const a = 0.08 + 0.92 * (v / hm.max);
    return `rgba(31,122,107,${a.toFixed(3)})`;
  };
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: `44px repeat(${hm.weeks.length}, 1fr)`, gap: 4, minWidth: 320 }}>
        <div />
        {hm.weeks.map((w, i) => <div key={w} style={{ fontSize: 10, color: "#8A99A5", textAlign: "center" }}>S{i + 1}</div>)}
        {hm.dowNames.map((name, dow) => (
          <React.Fragment key={dow}>
            <div style={{ fontSize: 11, color: "#5A6C7A", display: "flex", alignItems: "center", fontWeight: 600 }}>{name}</div>
            {hm.weeks.map((w) => {
              const c = hm.cells.find((x) => x.dow === dow && x.week === w);
              return <div key={w} title={c ? `${c.date}: ${c.value}` : ""} style={{ height: 30, borderRadius: 3, background: c ? cell(c.value) : "#F2F4F5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: c && c.value / hm.max > 0.55 ? "#fff" : "#5A6C7A" }}>{c && c.value ? c.value : ""}</div>;
            })}
          </React.Fragment>
        ))}
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
        {hm.byDow.map((d) => <span key={d.dow} style={{ fontSize: 11, color: "#5A6C7A" }}>{d.name} <b style={{ color: "#0F1E2B" }}>{d.sum}</b></span>)}
      </div>
    </div>
  );
}

function SankNodeEl({ x, y, width, height, payload, maxDepth }) {
  const left = payload.depth === maxDepth;
  return (
    <Layer>
      <Rectangle x={x} y={y} width={width} height={height} fill="#1B3247" fillOpacity={0.9} />
      <text x={left ? x - 6 : x + width + 6} y={y + height / 2} textAnchor={left ? "end" : "start"} dominantBaseline="middle" fontSize={10.5} fill="#1B3247">{payload.name}</text>
    </Layer>
  );
}

/* ---------- perfil de audiencia (Instagram o Facebook, nunca combinados) ---------- */
function AudienceBlock({ a, title, fb = false }) {
  const geo = [["cities", "Principales ciudades", "Para validar si la segmentación geográfica está bien puesta."], ["countries", "Principales países", "Dónde está la comunidad fuera del mercado principal."]]
    .filter(([k]) => a[k]?.length);
  return (
    <div className="sect">
      <h3>{title}</h3>
      <p className="sub">Porcentaje de seguidores{fb ? " de la página de Facebook" : ""}. Compáralo con los segmentos que realmente convierten en Desgloses.{fb ? " Nunca se combina con la audiencia de Instagram." : ""}</p>
      <div className="two">
        {a.ageGender?.length > 0 && (
          <div className="card">
            <h4>Edad y sexo</h4><p className="cap">Distribución de la comunidad, no de los leads.</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={a.ageGender} margin={{ left: 0, right: 8 }}>
                <CartesianGrid stroke={C.line} vertical={false} />
                <XAxis dataKey="age" tick={{ fontSize: 11, fill: C.slate }} /><YAxis tick={{ fontSize: 11, fill: C.slate }} unit="%" />
                <Tooltip formatter={(v) => pct(v)} /><Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="male" name="Hombres" fill={C.steel} /><Bar dataKey="female" name="Mujeres" fill={C.amber} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {geo.map(([k, lab, cap]) => (
          <div className="card" key={k}>
            <h4>{lab}</h4><p className="cap">{cap}</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={a[k].slice(0, 8)} layout="vertical" margin={{ left: 8, right: 20 }}>
                <CartesianGrid horizontal={false} stroke={C.line} />
                <XAxis type="number" tick={{ fontSize: 11, fill: C.slate }} unit="%" />
                <YAxis dataKey="label" type="category" width={150} tick={{ fontSize: 10, fill: C.steel }} tickFormatter={(v) => String(v).split(",")[0]} />
                <Tooltip formatter={(v) => pct(v)} /><Bar dataKey="value" fill={fb ? C.steel : C.sky} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- ritmo de publicación semanal (feed vs historias) ---------- */
const FMT_LABEL = { reel: "Reels", carrusel: "Carruseles", imagen: "Imágenes", video: "Videos" };
function WeeklyPosts({ weekly, compact = false }) {
  if (!weekly) return null;
  const fmts = Object.keys(FMT_LABEL).filter((k) => weekly.totals.formats[k] > 0);
  const data = weekly.weeks.map((w) => ({ ...w, name: w.label }));
  return (
    <div className="weekly">
      <div className="wk-chips">
        {weekly.hasFeed && <div className="wk-chip" data-k="feed"><span className="wk-n mono">{weekly.totals.feed}</span><span>publicaciones de feed<br /><b>{dec(weekly.avgFeed, 1)}</b> por semana</span></div>}
        {weekly.hasStories && <div className="wk-chip" data-k="story"><span className="wk-n mono">{weekly.totals.stories}</span><span>historias<br /><b>{dec(weekly.avgStories, 1)}</b> por semana</span></div>}
        {!weekly.hasFeed && <div className="wk-chip" data-k="miss"><span>Feed: <b>sin datos</b><br />no se cargó el CSV de publicaciones</span></div>}
        {!weekly.hasStories && <div className="wk-chip" data-k="miss"><span>Historias: <b>sin datos</b><br />no se cargó el CSV de historias</span></div>}
        <div className="wk-chip" data-k="span"><span className="wk-n mono">{weekly.weeks.length}</span><span>semanas<br />{weekly.period.from.slice(5)} → {weekly.period.to.slice(5)}</span></div>
      </div>
      {!compact && (
        <div className="card" style={{ marginTop: 12 }}>
          <ResponsiveContainer width="100%" height={Math.max(160, 34 * data.length + 40)}>
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid horizontal={false} stroke={C.line} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: C.slate }} />
              <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11, fill: C.steel }} />
              <Tooltip formatter={(v) => int(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {weekly.hasFeed && <Bar dataKey="feed" stackId="a" name="Feed" fill={C.steel} />}
              {weekly.hasStories && <Bar dataKey="stories" stackId="a" name="Historias" fill={C.sea} />}
              {weekly.hasOther && <Bar dataKey="other" stackId="a" name="Otras" fill={C.mute} />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="card" style={{ padding: 0, marginTop: 12, overflowX: "auto" }}>
        <table>
          <thead><tr>
            <th>Semana (lun–dom)</th>
            {weekly.hasFeed && <th className="r">Feed</th>}
            {weekly.hasFeed && !compact && fmts.map((k) => <th key={k} className="r" style={{ fontWeight: 500 }}>{FMT_LABEL[k]}</th>)}
            {weekly.hasStories && <th className="r">Historias</th>}
            {weekly.hasOther && <th className="r">Otras</th>}
            <th className="r">Total</th>
          </tr></thead>
          <tbody>
            {weekly.weeks.map((w) => (
              <tr key={w.key}>
                <td className="mono" style={{ fontSize: 12 }}>{w.label}{w.partial && <span style={{ color: C.mute }}> · {w.days} d</span>}</td>
                {weekly.hasFeed && <td className="r" style={{ fontWeight: 600 }}>{w.feed}</td>}
                {weekly.hasFeed && !compact && fmts.map((k) => <td key={k} className="r" style={{ color: C.slate }}>{w.formats[k]}</td>)}
                {weekly.hasStories && <td className="r" style={{ fontWeight: 600 }}>{w.stories}</td>}
                {weekly.hasOther && <td className="r">{w.other}</td>}
                <td className="r">{w.total}</td>
              </tr>
            ))}
            <tr className="tot">
              <td><b>Total</b></td>
              {weekly.hasFeed && <td className="r"><b>{weekly.totals.feed}</b></td>}
              {weekly.hasFeed && !compact && fmts.map((k) => <td key={k} className="r">{weekly.totals.formats[k]}</td>)}
              {weekly.hasStories && <td className="r"><b>{weekly.totals.stories}</b></td>}
              {weekly.hasOther && <td className="r">{weekly.totals.other}</td>}
              <td className="r"><b>{weekly.totals.total}</b></td>
            </tr>
          </tbody>
        </table>
      </div>
      {(weekly.weeks.some((w) => w.partial) || weekly.undated > 0) && (
        <p className="sub" style={{ marginTop: 8 }}>
          {weekly.weeks.some((w) => w.partial) && "Las semanas con «d» quedan recortadas por el inicio o el fin del periodo. "}
          {weekly.undated > 0 && `${weekly.undated} publicaciones sin fecha no se ubican en ninguna semana.`}
        </p>
      )}
    </div>
  );
}

function EditableFinding({ f, idx, edits, setEdits }) {
  const e = edits[idx] || {};
  const [open, setOpen] = React.useState(false);
  const title = e.title ?? f.title;
  const text = e.text ?? f.text;
  const edited = e.title !== undefined || e.text !== undefined;
  return (
    <div className="find" data-sev={f.sev}>
      <div className="ft">
        <span className="sev">{f.sev === "buena" ? "a favor" : f.sev === "alta" ? "prioridad alta" : "atención"}</span>
        {title}
        {edited && <span style={{ fontSize: 10, color: "#E39B2E", letterSpacing: ".1em", textTransform: "uppercase" }}>editado</span>}
        <button className="btn ghost" style={{ marginLeft: "auto", fontSize: 11, padding: "3px 10px" }} onClick={() => setOpen((o) => !o)}>{open ? "Cerrar" : "Editar"}</button>
      </div>
      {open ? (
        <div style={{ marginTop: 8 }}>
          <input className="fld" style={{ width: "100%", marginBottom: 8, fontWeight: 600 }} value={title}
            onChange={(ev) => setEdits((p) => ({ ...p, [idx]: { ...p[idx], title: ev.target.value } }))} />
          <textarea className="fld" rows={3} style={{ width: "100%", fontFamily: "inherit", fontSize: 12.5, lineHeight: 1.6, resize: "vertical" }} value={text}
            onChange={(ev) => setEdits((p) => ({ ...p, [idx]: { ...p[idx], text: ev.target.value } }))} />
          {edited && <button className="btn ghost" style={{ marginTop: 8, fontSize: 11, padding: "4px 10px" }}
            onClick={() => setEdits((p) => { const n = { ...p }; delete n[idx]; return n; })}>Restaurar original</button>}
        </div>
      ) : <p>{text}</p>}
      {f.action && !open && (<div className="act"><b>{f.action.do}</b><span className="arrow">→</span><span>{f.action.on}</span><span className="arrow">→</span><span>vigilar {f.action.watch}</span></div>)}
    </div>
  );
}

function Finding({ f }) {
  return (
    <div className="find" data-sev={f.sev}>
      <div className="ft"><span className="sev">{f.sev === "buena" ? "a favor" : f.sev === "alta" ? "prioridad alta" : "atención"}</span>{f.title}</div>
      <p>{f.text}</p>
      {f.action && (<div className="act"><b>{f.action.do}</b><span className="arrow">→</span><span>{f.action.on}</span><span className="arrow">→</span><span>vigilar {f.action.watch}</span></div>)}
    </div>
  );
}
