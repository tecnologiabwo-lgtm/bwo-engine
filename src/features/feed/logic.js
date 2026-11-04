/* Lógica del Feed Planner (sin React ni Supabase) — probada en test/feed.mjs.
   Mismas reglas y formatos de datos que el Feed clásico y el aislado, para que
   las tres versiones convivan sobre la misma base. */

export const FORMATS = {
  post_sq: { label: "Publicación cuadrada", short: "Publicación", ratio: "1:1", px: "1080×1080", w: 1080, h: 1080, aspect: 1, icon: "▢", kind: "post" },
  post_v: { label: "Publicación vertical", short: "Publicación", ratio: "4:5", px: "1080×1350", w: 1080, h: 1350, aspect: 4 / 5, icon: "▯", kind: "post" },
  post_h: { label: "Publicación horizontal", short: "Publicación", ratio: "1.91:1", px: "1080×566", w: 1080, h: 566, aspect: 1.91, icon: "▭", kind: "post" },
  carousel: { label: "Carrusel", short: "Carrusel", ratio: "4:5 · máx 20", px: "1080×1350", w: 1080, h: 1350, aspect: 4 / 5, icon: "▤", kind: "carousel" },
  reel: { label: "Reel", short: "Reel", ratio: "9:16", px: "1080×1920", w: 1080, h: 1920, aspect: 9 / 16, icon: "▶", kind: "reel" },
};
export const STATUS = {
  draft: { label: "Borrador", client: "En preparación", color: "#6F75A0", ico: "✎" },
  pending: { label: "Pendiente", client: "Pendiente de tu aprobación", color: "#8B8FC7", ico: "⏳" },
  changes: { label: "Cambios pedidos", client: "Cambios solicitados", color: "#F5A623", ico: "↺" },
  approved: { label: "Aprobado", client: "Aprobado", color: "#22D3C5", ico: "✓" },
  published: { label: "Publicado", client: "Publicado", color: "#6C3BF5", ico: "●" },
};
export const EVENTS = {
  created: { label: "Publicación creada", ico: "✚", color: "#6F75A0" },
  sent: { label: "Enviada al cliente", ico: "📤", color: "#8B8FC7" },
  changes: { label: "Cambios solicitados", ico: "↺", color: "#F5A623" },
  updated: { label: "Archivo actualizado", ico: "🖼", color: "#4A8CFF" },
  edited: { label: "Contenido editado", ico: "✎", color: "#4A8CFF" },
  approved: { label: "Aprobada", ico: "✓", color: "#22D3C5" },
  published: { label: "Publicada", ico: "●", color: "#6C3BF5" },
  archived: { label: "Archivada", ico: "🗄", color: "#6F75A0" },
  restored: { label: "Restaurada", ico: "↩", color: "#6F75A0" },
};
export const DEFAULT_PILLARS = [
  { name: "Educar", color: "#6C3BF5" }, { name: "Inspirar", color: "#22D3C5" }, { name: "Entretener", color: "#F5A623" },
  { name: "Vender", color: "#E6197E" }, { name: "Comunidad", color: "#4A8CFF" },
];

/* Cuadrícula limitada a 6 filas × 3 columnas */
export const ROWS = 6, COLS = 3, PAGE_CELLS = ROWS * COLS;

export const sortPosts = (posts) => [...posts].sort((a, b) => (Number(!!b.pinned) - Number(!!a.pinned)) || ((a.sort ?? 0) - (b.sort ?? 0)));
export const thumbOf = (p) => (p.format === "reel" && p.cover ? p.cover : (p.images || [])[0] || p.cover || "");
export const formatOf = (p) => FORMATS[p.format] || FORMATS.post_v;

export function paginate(list, page) {
  const pages = Math.max(1, Math.ceil(list.length / PAGE_CELLS));
  const p = Math.min(Math.max(0, page | 0), pages - 1);
  return { items: list.slice(p * PAGE_CELLS, (p + 1) * PAGE_CELLS), page: p, pages, offset: p * PAGE_CELLS, total: list.length };
}

/** Reordenar dentro de una página: inserta el tramo en el orden completo y
 *  devuelve solo los pares [id, sort] que cambiaron. */
export function reorderPage(allSorted, offset, pageIdsInNewOrder) {
  const ids = allSorted.map((p) => p.id);
  const merged = [...ids.slice(0, offset), ...pageIdsInNewOrder, ...ids.slice(offset + pageIdsInNewOrder.length)];
  const current = new Map(allSorted.map((p) => [p.id, p.sort]));
  return { order: merged, changes: merged.map((id, i) => [id, i]).filter(([id, i]) => current.get(id) !== i) };
}

/** Campos que acompañan un cambio de estado (igual que el Feed clásico). */
export function statusPatch(status, actor = "BigWay") {
  const patch = { status };
  if (status === "approved") { patch.approved_at = new Date().toISOString(); patch.approved_by = actor; }
  else if (status !== "published") { patch.approved_at = null; patch.approved_by = null; }
  return patch;
}
export const eventForStatus = (s) => (s === "pending" ? "sent" : ["approved", "published", "changes"].includes(s) ? s : null);
export const canClientAct = (p) => ["pending", "changes"].includes(p.status);

export function stats(posts, pillars) {
  const byStatus = Object.fromEntries(Object.keys(STATUS).map((k) => [k, posts.filter((p) => p.status === k).length]));
  const byPillar = pillars.map((pl) => ({ ...pl, n: posts.filter((p) => p.pillar_id === pl.id).length }));
  const dated = posts.map((p) => p.scheduled_date).filter(Boolean).sort();
  let perWeek = null;
  if (dated.length > 1) { const span = (new Date(dated.at(-1)) - new Date(dated[0])) / 864e5; perWeek = span > 0 ? dated.length / (span / 7) : dated.length; }
  return { byStatus, byPillar, perWeek };
}

export const handleClean = (v) => String(v || "").replace(/[^a-z0-9._]/gi, "").toLowerCase();
