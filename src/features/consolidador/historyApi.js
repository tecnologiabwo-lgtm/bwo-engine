/* Acceso a datos del histórico mensual (tablas stats_months, ad_stats_monthly, organic_stats_monthly). */
import { supabase, run } from "@/shared/lib/supabase";

/** Guarda (o reemplaza) los meses detectados para un cliente. Cada mes se
 *  reemplaza completo, así volver a cargar un mes corregido no duplica nada. */
export async function saveMonths(clientId, split, { currency = "USD", level = "campaign", sources = [], note = null } = {}) {
  for (const month of split.months) {
    const ads = split.ads.filter((a) => a.month === month);
    const org = split.organic.filter((o) => o.month === month);
    const days = [...ads.map((a) => a.days || 0), ...org.map((o) => o.days || 0)];
    await run(supabase.from("stats_months").upsert({ client_id: clientId, month, currency, level, sources, note, saved_at: new Date().toISOString(),
      period_from: month, period_to: month.slice(0, 8) + String(Math.max(1, ...days)).padStart(2, "0") }, { onConflict: "client_id,month" }));
    await run(supabase.from("ad_stats_monthly").delete().eq("client_id", clientId).eq("month", month));
    await run(supabase.from("organic_stats_monthly").delete().eq("client_id", clientId).eq("month", month));
    if (ads.length) await run(supabase.from("ad_stats_monthly").insert(ads.map((a) => ({ ...a, client_id: clientId }))));
    if (org.length) await run(supabase.from("organic_stats_monthly").insert(org.map((o) => ({ ...o, client_id: clientId }))));
  }
}

export async function loadHistory(clientId) {
  const [months, ads, organic] = await Promise.all([
    run(supabase.from("stats_months").select("*").eq("client_id", clientId).order("month")),
    run(supabase.from("ad_stats_monthly").select("*").eq("client_id", clientId).order("month")),
    run(supabase.from("organic_stats_monthly").select("*").eq("client_id", clientId).order("month")),
  ]);
  return { months, ads, organic };
}

export const deleteMonth = async (clientId, month) => {
  await run(supabase.from("ad_stats_monthly").delete().eq("client_id", clientId).eq("month", month));
  await run(supabase.from("organic_stats_monthly").delete().eq("client_id", clientId).eq("month", month));
  await run(supabase.from("stats_months").delete().eq("client_id", clientId).eq("month", month));
};
