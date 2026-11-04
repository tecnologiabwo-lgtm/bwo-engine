import { useEffect, useState } from "react";
import { ImagePlus, Trash2, ArrowLeft, ArrowRight, Archive } from "lucide-react";
import { Modal, Button, Field, Input, Textarea, Select, Badge } from "@/shared/ui/primitives";
import { useToast } from "@/shared/ui/toast";
import { FORMATS, STATUS, EVENTS, canClientAct } from "../logic.js";
import { uploadImage, pickFiles } from "../media.js";

const fmtDate = (s) => new Date(s).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function Timeline({ post }) {
  const items = [...(post.events || []).map((e) => ({ at: e.created_at, ...(EVENTS[e.type] || { label: e.type, ico: "•", color: "#6F75A0" }), who: e.actor, note: e.note })),
    ...(post.corrections || []).map((c) => ({ at: c.created_at, label: "Corrección", ico: "✎", color: "#F5A623", who: c.author, note: c.text }))]
    .sort((a, b) => a.at.localeCompare(b.at));
  if (!items.length) return <p className="text-xs text-slate-500">Sin movimientos todavía.</p>;
  return (
    <ol className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2 text-xs">
          <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[10px] text-white" style={{ background: it.color }}>{it.ico}</span>
          <div><span className="font-semibold text-slate-200">{it.label}</span> <span className="text-slate-500">· {it.who} · {fmtDate(it.at)}</span>
            {it.note && <div className="mt-0.5 whitespace-pre-line text-slate-300">{it.note}</div>}</div>
        </li>
      ))}
    </ol>
  );
}

function Media({ images, onChange, editable, clientId, format }) {
  const [i, setI] = useState(0); const [busy, setBusy] = useState(false); const toast = useToast();
  const f = FORMATS[format] || FORMATS.post_v;
  const max = format === "carousel" ? 20 : 1;
  const add = async () => {
    const files = (await pickFiles({ multiple: max > 1 })).slice(0, max - (max > 1 ? images.length : 0));
    if (!files.length) return;
    setBusy(true);
    try {
      const urls = [];
      for (const file of files) urls.push((await uploadImage(clientId, file, { w: f.w, h: f.h })).url);
      onChange(max > 1 ? [...images, ...urls] : urls); setI(max > 1 ? images.length : 0);
    } catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  };
  const cur = images[Math.min(i, images.length - 1)];
  return (
    <div>
      <div className="relative overflow-hidden rounded-xl bg-white/5" style={{ aspectRatio: f.aspect }}>
        {cur ? <img src={cur} alt="" className="size-full object-cover" /> : <div className="grid size-full place-items-center text-sm text-slate-500">Sin imagen</div>}
        {images.length > 1 && <>
          <button className="absolute left-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white" onClick={() => setI((i - 1 + images.length) % images.length)} aria-label="Anterior"><ArrowLeft className="size-4" /></button>
          <button className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white" onClick={() => setI((i + 1) % images.length)} aria-label="Siguiente"><ArrowRight className="size-4" /></button>
          <span className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 text-[11px] text-white">{Math.min(i, images.length - 1) + 1}/{images.length}</span>
        </>}
      </div>
      {editable && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" loading={busy} onClick={add} disabled={max > 1 && images.length >= max}><ImagePlus className="size-4" />{max > 1 ? "Añadir imágenes" : images.length ? "Reemplazar" : "Subir imagen"}</Button>
          {cur && <Button size="sm" variant="ghost" onClick={() => { onChange(images.filter((_, k) => k !== Math.min(i, images.length - 1))); setI(0); }}><Trash2 className="size-4" />Quitar</Button>}
          <span className="self-center text-[11px] text-slate-500">{f.px} · se comprime a WebP</span>
        </div>
      )}
    </div>
  );
}

/** Admin: editor completo. Cliente: vista previa + aprobar / pedir cambios. */
export default function PostModal({ post, open, onClose, isAdmin, pillars, clientId, onSave, onDelete, onArchive, onDecide }) {
  const [d, setD] = useState(post); const [busy, setBusy] = useState(false); const [note, setNote] = useState("");
  useEffect(() => { setD(post); setNote(""); }, [post]);
  if (!open || !d) return null;
  const set = (k) => (v) => setD((x) => ({ ...x, [k]: v?.target ? v.target.value : v }));
  const act = async (fn) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };
  const st = STATUS[d.status] || STATUS.draft;

  const footer = isAdmin ? <>
    {d.id && <Button variant="ghost" onClick={() => act(() => onArchive(d))}><Archive className="size-4" />Archivar</Button>}
    {d.id && <Button variant="danger" onClick={() => confirm("¿Eliminar esta publicación de forma definitiva?") && act(() => onDelete(d))}><Trash2 className="size-4" />Eliminar</Button>}
    <Button loading={busy} onClick={() => act(() => onSave(d))}>Guardar</Button>
  </> : canClientAct(post) ? <>
    <Button variant="amber" loading={busy} disabled={!note.trim()} onClick={() => act(() => onDecide([post.id], false, note))}>Pedir cambios</Button>
    <Button variant="ok" loading={busy} onClick={() => act(() => onDecide([post.id], true, note))}>Aprobar</Button>
  </> : null;

  return (
    <Modal open={open} onClose={onClose} wide title={isAdmin ? (d.id ? "Editar publicación" : "Nueva publicación") : "Revisar publicación"} footer={footer}>
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Media images={d.images || []} editable={isAdmin} clientId={clientId} format={d.format} onChange={set("images")} />
        <div className="space-y-3">
          {isAdmin ? <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Formato"><Select value={d.format} onChange={set("format")}>{Object.entries(FORMATS).map(([k, f]) => <option key={k} value={k}>{f.label} · {f.ratio}</option>)}</Select></Field>
              <Field label="Estado"><Select value={d.status} onChange={set("status")}>{Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}</Select></Field>
              <Field label="Pilar"><Select value={d.pillar_id || ""} onChange={set("pillar_id")}><option value="">Sin pilar</option>{pillars.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
              <Field label="Fecha"><Input type="date" value={d.scheduled_date || ""} onChange={set("scheduled_date")} /></Field>
            </div>
            <Field label="Copy"><Textarea rows={7} value={d.caption || ""} onChange={set("caption")} placeholder="Texto de la publicación, hashtags…" /></Field>
            <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={!!d.pinned} onChange={(e) => set("pinned")(e.target.checked)} />Fijada arriba del feed</label>
          </> : <>
            <div className="flex flex-wrap items-center gap-2"><span className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: st.color }}>{st.ico} {st.client}</span>
              {d.scheduled_date && <Badge color="slate">{d.scheduled_date.split("-").reverse().join("/")}</Badge>}<Badge color="slate">{(FORMATS[d.format] || FORMATS.post_v).label}</Badge></div>
            <p className="whitespace-pre-line text-sm text-slate-200">{d.caption || <span className="text-slate-500">Sin copy</span>}</p>
            {canClientAct(post) && <Field label="Comentario" hint="Obligatorio para pedir cambios; opcional al aprobar."><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="¿Qué te gustaría ajustar?" /></Field>}
          </>}
          {d.id && <div><div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Historial</div><Timeline post={post} /></div>}
        </div>
      </div>
    </Modal>
  );
}
