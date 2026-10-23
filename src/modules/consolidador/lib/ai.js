/**
 * Puente entre la app y el endpoint /api/analizar.
 * Envía SOLO el resumen agregado de la campaña seleccionada, nunca
 * los archivos ni filas individuales.
 */
export function construirPayload(campaign, { model, audiencia } = {}) {
  if (!campaign) return null;
  const r = (n, d = 2) => (n === null || n === undefined || !isFinite(n) ? null : +n.toFixed(d));
  const dimOut = (rows) => rows?.map((x) => ({ grupo: x.label, inversion: r(x.spend), impresiones: x.impressions, resultados: x.results, cpl: r(x.cpl) }));

  return {
    moneda: model?.currency || "USD",
    campania: campaign.name,
    objetivo: campaign.objective,
    estado: campaign.status,
    periodo: campaign.period,
    atribucion: campaign.attribution || null,
    totales: {
      inversion: r(campaign.spend), resultados: campaign.results, cpl: r(campaign.cpl),
      cpm: r(campaign.cpm), impresiones: campaign.impressions, alcance: campaign.reach,
      frecuencia: r(campaign.frequency), seguidores: campaign.igFollows,
      costoPorSeguidor: r(campaign.costPerFollower),
    },
    pacing: campaign.pacing ? { planificado: r(campaign.pacing.planned), real: r(campaign.pacing.actual), pct: r(campaign.pacing.pct, 0), dias: campaign.pacing.days } : null,
    desglose: {
      edad: dimOut(campaign.dims.age),
      sexo: dimOut(campaign.dims.gender),
      region: dimOut(campaign.dims.region),
      ubicacion: dimOut(campaign.dims.placement),
    },
    dias: campaign.dims.day?.map((d) => ({ dia: d.label, resultados: d.results, cpl: r(d.cpl), inversion: r(d.spend) })) || null,
    otrasCampanas: model?.objectives?.map((o) => ({ objetivo: o.objective, inversion: r(o.spend), resultados: o.results, cpl: r(o.cpl) })) || null,
    audiencia: audiencia ? { edadYSexo: audiencia.ageGender, ciudades: audiencia.cities?.slice(0, 6) } : null,
  };
}

export async function pedirAnalisis({ provider, model, metrics, question }) {
  const { supabase } = await import("@/lib/supabase");
  const { data: s } = await supabase.auth.getSession();
  const res = await fetch("/api/consolidador/analizar", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${s.session?.access_token || ""}` },
    body: JSON.stringify({ provider, model: model || undefined, metrics, question }),
  });
  const data = await res.json().catch(() => ({ error: `El servidor respondió ${res.status}. ¿Estás en «vercel dev» o en producción?` }));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}
