import { supabase, run } from "@/shared/lib/supabase";

export const ENTITY_LABELS = {
  posts: "Publicación", clients: "Cliente", pillars: "Pilar", stories: "Historia", highlights: "Destacada",
  sala_pieces: "Guion", sala_calendars: "Calendario de la Sala", quotes: "Cotización", price_catalog: "Precio",
  app_settings: "Ajuste", client_members: "Acceso", profiles: "Usuario", reports: "Reporte",
  share_links: "Enlace público", stats_months: "Histórico mensual",
};
export const ACTION_LABELS = { crear: "creó", editar: "editó", estado: "cambió el estado de", eliminar: "eliminó" };

export async function listAudit({ clientId, entity, actor, from, to, limit = 100, before } = {}) {
  let q = supabase.from("audit_log").select("*").order("id", { ascending: false }).limit(limit);
  if (clientId) q = q.eq("client_id", clientId);
  if (entity) q = q.eq("entity", entity);
  if (actor) q = q.ilike("actor_name", `%${actor.replace(/[%_]/g, "")}%`);
  if (from) q = q.gte("at", from);
  if (to) q = q.lte("at", `${to}T23:59:59`);
  if (before) q = q.lt("id", before);
  return run(q);
}

export const listErrors = ({ days = 7 } = {}) =>
  run(supabase.from("client_errors").select("*").gte("at", new Date(Date.now() - days * 864e5).toISOString()).order("at", { ascending: false }).limit(500));

/** Agrupa errores iguales (mismo mensaje y versión) para ver qué falla más. */
export function groupErrors(rows) {
  const m = new Map();
  for (const r of rows) {
    const k = `${r.message}␟${r.release || ""}`;
    const g = m.get(k) || { key: k, message: r.message, release: r.release, count: 0, users: new Set(), first: r.at, last: r.at, sample: r, urls: new Set() };
    g.count++; if (r.user_id) g.users.add(r.user_id); if (r.url) g.urls.add(r.url);
    if (r.at < g.first) g.first = r.at; if (r.at > g.last) { g.last = r.at; g.sample = r; }
    m.set(k, g);
  }
  return [...m.values()].sort((a, b) => b.last.localeCompare(a.last));
}
