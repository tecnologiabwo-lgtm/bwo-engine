import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, LayoutGrid, Plus, RefreshCw, Send, CheckCheck, Archive, Undo2, Maximize2 } from "lucide-react";
import { useAuth } from "@/features/auth/auth";
import { useClient } from "@/features/clients/clientContext";
import { Button, Card, Empty, ErrorBox, PageHeader, Textarea, Modal } from "@/shared/ui/primitives";
import { GridSkeleton, ListSkeleton } from "@/shared/ui/skeleton";
import { useToast } from "@/shared/ui/toast";
import { cn } from "@/shared/lib/utils";
import { STATUS, PAGE_CELLS, sortPosts, paginate, reorderPage, stats, thumbOf, canClientAct } from "./logic.js";
import * as api from "./api.js";
import ProfileHeader from "./components/ProfileHeader.jsx";
import FeedGrid from "./components/FeedGrid.jsx";
import PostModal from "./components/PostModal.jsx";
import StoriesBar from "./components/StoriesBar.jsx";
import SharePanel from "./components/SharePanel.jsx";
import ProfilePanel from "./components/ProfilePanel.jsx";

/* Feed Planner en React. Usa las mismas tablas, estados y eventos que el Feed
   clásico (/feed/panel.html, /feed/cliente.html) y el aislado, así que las tres
   versiones conviven; el clásico sigue disponible con el botón "Versión clásica". */
const MODE_KEY = "bwo.feed.mode";

function Classic({ isAdmin, client }) {
  const ref = useRef(null); const [h, setH] = useState(820);
  useEffect(() => { const fit = () => setH(Math.max(640, innerHeight - 40)); fit(); addEventListener("resize", fit); return () => removeEventListener("resize", fit); }, []);
  if (!isAdmin && !client?.share_token) return <Empty icon={LayoutGrid} title="Tu feed aún no está disponible">Big Way Offices todavía no ha preparado la vista de tu feed.</Empty>;
  const src = isAdmin ? "/feed/panel.html" : `/feed/cliente.html?token=${encodeURIComponent(client.share_token)}`;
  return <>
    <div className="mb-2 flex justify-end gap-2">
      <Button size="sm" variant="ghost" onClick={() => ref.current?.requestFullscreen?.()}><Maximize2 className="size-4" />Pantalla completa</Button>
      <Button size="sm" variant="ghost" onClick={() => open(src, "_blank", "noopener")}><ExternalLink className="size-4" />Abrir aparte</Button>
    </div>
    <iframe ref={ref} key={src} src={src} title="Feed Planner clásico" className="w-full rounded-2xl border border-white/10 bg-[#0D0E24]" style={{ height: h }} />
  </>;
}

function Tabs({ value, onChange, items }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03] p-1" role="tablist">
      {items.map(([k, l]) => <button key={k} role="tab" aria-selected={value === k} onClick={() => onChange(k)}
        className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition", value === k ? "bg-bwo-violet text-white" : "text-slate-400 hover:text-white")}>{l}</button>)}
    </div>
  );
}

function Calendar({ posts, onOpen }) {
  const groups = useMemo(() => {
    const m = new Map();
    for (const p of [...posts].sort((a, b) => (a.scheduled_date || "9").localeCompare(b.scheduled_date || "9"))) {
      const k = p.scheduled_date ? p.scheduled_date.slice(0, 7) : "sin-fecha";
      if (!m.has(k)) m.set(k, []); m.get(k).push(p);
    }
    return [...m];
  }, [posts]);
  if (!posts.length) return <Empty icon={LayoutGrid} title="Sin publicaciones" />;
  return (
    <div className="space-y-5">
      {groups.map(([k, list]) => (
        <div key={k}>
          <div className="mb-2 text-sm font-bold capitalize text-white">{k === "sin-fecha" ? "Sin fecha" : new Date(k + "-01T12:00").toLocaleDateString("es-ES", { month: "long", year: "numeric" })}</div>
          <div className="divide-y divide-white/5 rounded-xl border border-white/10">
            {list.map((p) => { const st = STATUS[p.status] || STATUS.draft; return (
              <button key={p.id} onClick={() => onOpen(p)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white/5">
                <div className="size-12 shrink-0 overflow-hidden rounded bg-white/5">{thumbOf(p) && <img src={thumbOf(p)} alt="" className="size-full object-cover" />}</div>
                <div className="w-24 shrink-0 text-xs text-slate-400">{p.scheduled_date ? p.scheduled_date.split("-").reverse().join("/") : "—"}</div>
                <div className="min-w-0 flex-1 truncate text-sm text-slate-200">{p.caption || "Sin copy"}</div>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: st.color }}>{st.label}</span>
              </button>); })}
          </div>
        </div>
      ))}
    </div>
  );
}

function ArchiveTab({ clientId, actor, onChanged }) {
  const [list, setList] = useState(null); const toast = useToast();
  const load = useCallback(() => api.listArchived(clientId).then(setList).catch((e) => toast(e.message, "error")), [clientId, toast]);
  useEffect(() => { load(); }, [load]);
  if (!list) return <ListSkeleton rows={4} />;
  if (!list.length) return <Empty icon={Archive} title="Archivo vacío">Las publicaciones archivadas aparecerán aquí.</Empty>;
  return (
    <div className="grid grid-cols-3 gap-1 sm:grid-cols-6">
      {list.map((p) => (
        <div key={p.id} className="group relative aspect-[4/5] overflow-hidden bg-white/5">
          {thumbOf(p) && <img src={thumbOf(p)} alt="" className="size-full object-cover opacity-70" />}
          <button onClick={() => api.archive([p.id], false, actor).then(() => { toast("Restaurada"); load(); onChanged(); })}
            className="absolute inset-x-1 bottom-1 hidden items-center justify-center gap-1 rounded bg-black/70 py-1 text-[11px] text-white group-hover:flex"><Undo2 className="size-3" />Restaurar</button>
        </div>
      ))}
    </div>
  );
}

function ReactFeed({ client, isAdmin, actor }) {
  const toast = useToast();
  const [data, setData] = useState(null); const [err, setErr] = useState("");
  const [tab, setTab] = useState("feed"); const [page, setPage] = useState(0);
  const [filter, setFilter] = useState("all"); const [selected, setSelected] = useState(new Set());
  const [editing, setEditing] = useState(null); const [bulkNote, setBulkNote] = useState(null);

  const load = useCallback(async () => {
    try { setErr(""); setData(await api.loadFeed(client.id)); } catch (e) { setErr(e.message); }
  }, [client.id]);
  useEffect(() => { setData(null); setSelected(new Set()); setPage(0); load(); }, [load]);

  const visible = useMemo(() => (data ? sortPosts(isAdmin ? data.posts : data.posts.filter((p) => p.status !== "draft")) : []), [data, isAdmin]);
  const filtered = filter === "all" ? visible : visible.filter((p) => p.status === filter);
  const pg = paginate(filtered, page);
  const st = data && stats(visible, data.pillars);
  const sel = [...selected];
  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const done = async (msg) => { toast(msg); setSelected(new Set()); setEditing(null); await load(); };
  const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message, "error"); } };

  const reorder = guard(async (pageIds) => {
    const { order, changes } = reorderPage(visible, pg.offset, pageIds);
    const idx = new Map(order.map((id, i) => [id, i]));
    setData((d) => ({ ...d, posts: d.posts.map((p) => (idx.has(p.id) ? { ...p, sort: idx.get(p.id) } : p)) }));
    await api.setOrder(changes);
  });
  const save = guard(async (post) => {
    const original = data.posts.find((p) => p.id === post.id);
    await api.savePost(post, original, { clientId: client.id, nextSort: Math.max(-1, ...data.posts.map((p) => p.sort ?? 0)) + 1, actor });
    await done("Publicación guardada");
  });
  const decide = guard(async (ids, approve, text) => { await api.portalDecide(ids, approve, text); setBulkNote(null); await done(approve ? "¡Aprobado! Gracias" : "Cambios enviados a Big Way"); });
  const bulk = guard(async (status, msg) => { await api.bulkStatus(sel, status, actor); await done(msg); });

  if (err) return <ErrorBox error={err} onRetry={load} />;
  if (!data) return <div className="mx-auto max-w-[720px]"><ListSkeleton rows={2} /><GridSkeleton cells={PAGE_CELLS} /></div>;

  const tabs = [["feed", "Feed"], ["calendario", "Calendario"], ...(isAdmin ? [["archivo", "Archivo"], ["enlaces", "Enlaces públicos"], ["perfil", "Perfil y pilares"]] : [])];
  const clientActionable = sel.filter((id) => canClientAct(data.posts.find((p) => p.id === id) || {}));

  return (
    <div>
      <Tabs value={tab} onChange={setTab} items={tabs} />
      {tab === "feed" && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,720px)_1fr]">
          <div className="mx-auto w-full max-w-[720px]">
            <ProfileHeader client={data.client || client} postsCount={visible.length} />
            <StoriesBar client={client} stories={data.stories} highlights={data.highlights} isAdmin={isAdmin} onChanged={load} />
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              {[["all", "Todas", visible.length], ...Object.entries(STATUS).filter(([k]) => isAdmin || k !== "draft").map(([k, s]) => [k, isAdmin ? s.label : s.client, st.byStatus[k]])].map(([k, l, n]) => (
                <button key={k} onClick={() => { setFilter(k); setPage(0); }} className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", filter === k ? "border-bwo-violet bg-bwo-violet/25 text-white" : "border-white/10 text-slate-400 hover:text-white")}>{l} · {n}</button>
              ))}
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="ghost" onClick={load} aria-label="Recargar"><RefreshCw className="size-4" /></Button>
                {isAdmin && <Button size="sm" onClick={() => setEditing({ format: "post_v", status: "draft", images: [], caption: "", pinned: false })}><Plus className="size-4" />Nueva</Button>}
              </div>
            </div>
            {sel.length > 0 && (
              <div className="sticky top-2 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-bwo-turquoise/30 bg-bwo-ink/95 px-3 py-2 text-sm text-white shadow-xl backdrop-blur">
                <b>{sel.length} seleccionadas</b>
                {isAdmin ? <>
                  <Button size="sm" variant="ghost" onClick={() => bulk("pending", "Enviadas a aprobación")}><Send className="size-4" />Enviar al cliente</Button>
                  <Button size="sm" variant="ok" onClick={() => bulk("approved", "Marcadas como aprobadas")}><CheckCheck className="size-4" />Aprobar</Button>
                  <Button size="sm" variant="ghost" onClick={() => bulk("published", "Marcadas como publicadas")}>Publicadas</Button>
                  <Button size="sm" variant="ghost" onClick={guard(async () => { await api.archive(sel, true, actor); await done("Archivadas"); })}><Archive className="size-4" />Archivar</Button>
                </> : <>
                  <Button size="sm" variant="ok" disabled={!clientActionable.length} onClick={() => decide(clientActionable, true, null)}><CheckCheck className="size-4" />Aprobar {clientActionable.length}</Button>
                  <Button size="sm" variant="amber" disabled={!clientActionable.length} onClick={() => setBulkNote("")}>Pedir cambios</Button>
                </>}
                <button className="ml-auto text-xs text-slate-400 underline" onClick={() => setSelected(new Set())}>Quitar selección</button>
              </div>
            )}
            {filtered.length ? <FeedGrid page={pg} pillars={data.pillars} selected={selected} onToggle={toggle} onOpen={setEditing} onReorder={reorder} onPage={setPage}
              sortable={isAdmin && filter === "all"} selectable={isAdmin || visible.some(canClientAct)} />
              : <Empty icon={LayoutGrid} title={visible.length ? "Nada con este filtro" : "Aún no hay publicaciones"} />}
            {isAdmin && filter !== "all" && <p className="mt-2 text-center text-[11px] text-slate-500">Para reordenar arrastrando, vuelve al filtro "Todas".</p>}
          </div>
          <aside className="space-y-3">
            <Card>
              <div className="mb-2 text-sm font-bold text-white">Resumen</div>
              <div className="grid grid-cols-2 gap-2 text-xs">{Object.entries(STATUS).filter(([k]) => isAdmin || k !== "draft").map(([k, s]) => (
                <div key={k} className="rounded-lg bg-white/5 px-2 py-1.5"><span style={{ color: s.color }}>{s.ico}</span> {isAdmin ? s.label : s.client}<div className="text-lg font-extrabold text-white">{st.byStatus[k]}</div></div>))}</div>
              {st.perWeek != null && <p className="mt-2 text-xs text-slate-400">Ritmo planificado: <b className="text-white">{st.perWeek.toFixed(1)}</b> por semana{client.frequency_per_week ? ` (objetivo ${client.frequency_per_week})` : ""}.</p>}
            </Card>
            {data.pillars.length > 0 && <Card>
              <div className="mb-2 text-sm font-bold text-white">Pilares</div>
              {st.byPillar.map((p) => { const pct = visible.length ? Math.round((p.n / visible.length) * 100) : 0; return (
                <div key={p.id} className="mb-2 text-xs"><div className="flex justify-between text-slate-300"><span>{p.name}</span><span>{pct}%{p.target_pct ? ` / ${p.target_pct}%` : ""}</span></div>
                  <div className="mt-1 h-1.5 rounded bg-white/10"><div className="h-full rounded" style={{ width: `${pct}%`, background: p.color }} /></div></div>); })}
            </Card>}
          </aside>
        </div>
      )}
      {tab === "calendario" && <Calendar posts={visible} onOpen={setEditing} />}
      {tab === "archivo" && <ArchiveTab clientId={client.id} actor={actor} onChanged={load} />}
      {tab === "enlaces" && <SharePanel client={data.client || client} onChanged={load} />}
      {tab === "perfil" && <ProfilePanel key={data.client?.id} client={data.client || client} pillars={data.pillars} onChanged={load} />}

      <PostModal open={!!editing} post={editing} onClose={() => setEditing(null)} isAdmin={isAdmin} pillars={data.pillars} clientId={client.id}
        onSave={save} onDecide={decide}
        onDelete={guard(async (p) => { await api.deletePost(p.id); await done("Eliminada"); })}
        onArchive={guard(async (p) => { await api.archive([p.id], true, actor); await done("Archivada"); })} />
      <Modal open={bulkNote != null} onClose={() => setBulkNote(null)} title={`Pedir cambios en ${clientActionable.length} publicaciones`}
        footer={<Button variant="amber" disabled={!bulkNote?.trim()} onClick={() => decide(clientActionable, false, bulkNote)}>Enviar</Button>}>
        <Textarea rows={4} value={bulkNote || ""} onChange={(e) => setBulkNote(e.target.value)} placeholder="Describe qué te gustaría cambiar" autoFocus />
      </Modal>
    </div>
  );
}

export default function FeedApp() {
  const { isAdmin, profile } = useAuth();
  const { client } = useClient();
  const [mode, setMode] = useState(() => { try { return localStorage.getItem(MODE_KEY) || "react"; } catch { return "react"; } });
  const pick = (m) => { setMode(m); try { localStorage.setItem(MODE_KEY, m); } catch {} };
  const actor = profile?.full_name || profile?.email || "BigWay";
  return (
    <div>
      <PageHeader title={isAdmin ? "Feed Planner" : "Tu feed"}
        subtitle={isAdmin ? "Planifica, ordena (6 filas × 3 columnas por página) y envía publicaciones a aprobación." : "Revisa cómo se verá tu feed y aprueba o pide cambios."}
        actions={<div className="flex rounded-xl border border-white/10 p-0.5 text-xs">
          {[["react", "Nueva versión"], ["clasico", "Versión clásica"]].map(([k, l]) => <button key={k} onClick={() => pick(k)} className={cn("rounded-lg px-3 py-1.5 font-semibold", mode === k ? "bg-white/10 text-white" : "text-slate-400")}>{l}</button>)}
        </div>} />
      {!client ? <Empty icon={LayoutGrid} title="Elige un cliente" />
        : mode === "clasico" ? <Classic isAdmin={isAdmin} client={client} />
        : <ReactFeed key={client.id} client={client} isAdmin={isAdmin} actor={actor} />}
    </div>
  );
}
