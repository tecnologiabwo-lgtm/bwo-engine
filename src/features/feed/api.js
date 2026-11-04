/* Acceso a datos del Feed Planner. Mismas tablas y eventos que el Feed clásico. */
import { supabase, run } from "@/shared/lib/supabase";
import { statusPatch, eventForStatus } from "./logic.js";

const PAGE = 1000;
async function all(build) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const rows = await run(build().range(from, from + PAGE - 1));
    out.push(...rows); if (rows.length < PAGE) return out;
  }
}
async function byPosts(table, ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 150) out.push(...await all(() => supabase.from(table).select("*").in("post_id", ids.slice(i, i + 150)).order("created_at")));
  return out;
}

export async function loadFeed(clientId) {
  const [client, pillars, posts, stories, highlights] = await Promise.all([
    run(supabase.from("clients").select("*").eq("id", clientId).maybeSingle()),
    run(supabase.from("pillars").select("*").eq("client_id", clientId).order("sort")),
    all(() => supabase.from("posts").select("*").eq("client_id", clientId).eq("archived", false).order("pinned", { ascending: false }).order("sort")),
    run(supabase.from("stories").select("*").eq("client_id", clientId).order("sort")),
    run(supabase.from("highlights").select("*").eq("client_id", clientId).order("sort")),
  ]);
  const ids = posts.map((p) => p.id);
  const [events, corrections] = await Promise.all([byPosts("post_events", ids), byPosts("corrections", ids)]);
  for (const p of posts) { p.events = events.filter((e) => e.post_id === p.id); p.corrections = corrections.filter((c) => c.post_id === p.id); }
  return { client, pillars, posts, stories, highlights };
}

export const listArchived = (clientId) => all(() => supabase.from("posts").select("*").eq("client_id", clientId).eq("archived", true).order("scheduled_date", { ascending: false }));
export const logEvents = (ids, type, actor = "BigWay", note = null) => (ids.length ? run(supabase.from("post_events").insert(ids.map((id) => ({ post_id: id, type, actor, note })))) : null);

export async function savePost(post, original, { clientId, nextSort, actor }) {
  const row = { client_id: clientId, format: post.format, pillar_id: post.pillar_id || null, caption: post.caption, images: post.images,
    cover: post.cover || null, scheduled_date: post.scheduled_date || null, status: post.status, pinned: !!post.pinned };
  if (!original || original.status !== post.status) Object.assign(row, statusPatch(post.status, actor));
  let id = post.id;
  if (id) await run(supabase.from("posts").update(row).eq("id", id));
  else {
    id = (await run(supabase.from("posts").insert({ ...row, sort: nextSort }).select("id").single())).id;
    await logEvents([id], "created", actor);
  }
  if (original) {
    const mediaChanged = JSON.stringify(original.images || []) !== JSON.stringify(post.images || []) || original.cover !== post.cover;
    if (mediaChanged) await logEvents([id], "updated", actor, "Se cargó una versión nueva del archivo");
    else if ((original.caption || "") !== (post.caption || "")) await logEvents([id], "edited", actor, "Se editó el copy");
  }
  const ev = (!original || original.status !== post.status) && eventForStatus(post.status);
  if (ev) await logEvents([id], ev, actor);
  return id;
}

export async function bulkStatus(ids, status, actor) {
  await run(supabase.from("posts").update(statusPatch(status, actor)).in("id", ids));
  const ev = eventForStatus(status); if (ev) await logEvents(ids, ev, actor);
}
export async function archive(ids, archived, actor) {
  await run(supabase.from("posts").update({ archived }).in("id", ids));
  await logEvents(ids, archived ? "archived" : "restored", actor);
}
export const deletePost = (id) => run(supabase.from("posts").delete().eq("id", id));
export const setOrder = (changes) => Promise.all(changes.map(([id, sort]) => run(supabase.from("posts").update({ sort }).eq("id", id))));

/** Aprobación del cliente con sesión: queda registrado con su nombre. */
export const portalDecide = (ids, approve, text) => run(supabase.rpc("portal_feed_decide", { p_posts: ids, p_approve: approve, p_text: text || null }));

export const updateClient = (id, patch) => run(supabase.from("clients").update(patch).eq("id", id));
export const createClient = (row) => run(supabase.from("clients").insert(row).select().single());
export const addPillars = (rows) => run(supabase.from("pillars").insert(rows));
export const updatePillar = (id, patch) => run(supabase.from("pillars").update(patch).eq("id", id));
export const deletePillar = (id) => run(supabase.from("pillars").delete().eq("id", id));
export const addStory = (row) => run(supabase.from("stories").insert(row));
export const updateStory = (id, patch) => run(supabase.from("stories").update(patch).eq("id", id));
export const deleteStory = (id) => run(supabase.from("stories").delete().eq("id", id));
export const addHighlight = (row) => run(supabase.from("highlights").insert(row));
export const updateHighlight = (id, patch) => run(supabase.from("highlights").update(patch).eq("id", id));
export const deleteHighlight = (id) => run(supabase.from("highlights").delete().eq("id", id));

/* Enlaces públicos con caducidad y revocación */
export const listLinks = (clientId) => run(supabase.from("share_links").select("*").eq("client_id", clientId).order("created_at", { ascending: false }));
export const createLink = (clientId, label, days) => run(supabase.rpc("admin_create_share_link", { p_client: clientId, p_label: label, p_days: days || null }));
export const revokeLink = (id) => run(supabase.rpc("admin_revoke_share_link", { p_link: id }));
export const rotateMainLink = (clientId, days) => run(supabase.rpc("admin_rotate_share_token", { p_client: clientId, p_days: days || null }));
export const linkUrl = (token) => `${location.origin}/feed/cliente.html?token=${token}`;
