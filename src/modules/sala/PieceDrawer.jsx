import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { X, Check, RotateCcw, Pencil, Video, Trash2 } from "lucide-react";
import { supabase, run } from "@/lib/supabase";
import { fm, isVideo, steps, RANK, statusLabel, timing, ctaChecks, factRows, blocksDone } from "@/lib/sala";
import { shortDate, cn } from "@/lib/utils";
import { Badge, Button, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

export default function PieceDrawer({ p, comments, isAdmin, onClose, onEdit, onShoot, onDeleted }) {
  const toast = useToast();
  const [txt, setTxt] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { const k = (e) => e.key === "Escape" && onClose(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [onClose]);

  const call = async (fn, ok) => { setBusy(true); try { await fn(); if (ok) toast(ok); } catch (e) { toast(e.message.includes("acceso") || e.message.includes("permitida") ? "Tu acceso no permite esta acción." : e.message, "error"); } finally { setBusy(false); } };
  const setStatus = (s, note, ok) => call(() => run(supabase.rpc("sala_set_status", { p_piece: p.id, p_status: s, p_note: note || null })), ok || `Movida a «${statusLabel(s, p)}»`);
  const toggle = (field, key, value) => call(() => run(supabase.rpc("sala_toggle", { p_piece: p.id, p_field: field, p_key: String(key), p_value: value })));
  const choose = (i) => call(() => run(supabase.rpc("sala_choose", { p_piece: p.id, p_choice: p.choice === i ? null : i })), p.choice === i ? "Decisión retirada" : "Decisión guardada");
  const comment = () => { const t = txt.trim(); if (!t) return; call(async () => { await run(supabase.rpc("sala_comment", { p_piece: p.id, p_text: t })); setTxt(""); }, "Comentario publicado"); };
  const requestChanges = () => { const t = txt.trim(); if (!t) { toast("Escribe qué cambio necesitas antes de enviarlo.", "error"); return; } setStatus("cambios", t, "Cambios enviados"); setTxt(""); };
  const del = () => { if (confirm("¿Eliminar esta pieza y sus comentarios?")) call(async () => { await run(supabase.from("sala_pieces").delete().eq("id", p.id)); onDeleted(); }, "Pieza eliminada"); };

  const r = RANK[p.status] ?? 1, t = timing(p), checks = ctaChecks(p), facts = factRows(p);
  const blocks = p.blocks || [];
  const canDecide = ["aprobacion", "cambios", "aprobado"].includes(p.status);
  const next = isAdmin && ({ borrador: ["aprobacion", "Enviar a aprobación"], cambios: ["aprobacion", "Reenviar a aprobación"], aprobado: ["produccion", isVideo(p) ? "Enviar a grabación" : "Pasar a diseño"], produccion: [isVideo(p) ? "edicion" : "listo", isVideo(p) ? "Material entregado" : "Diseño listo"], edicion: ["listo", "Edición lista"], listo: ["publicado", "Marcar publicada"] }[p.status]);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="drTitle">
      <motion.div className="absolute inset-0 bg-black/55" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} />
      <motion.aside initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: "spring", bounce: 0, duration: 0.35 }}
        className="absolute inset-y-0 right-0 flex w-full max-w-[660px] flex-col border-l border-white/10 bg-bwo-inkDeep/95 shadow-2xl backdrop-blur-xl">
        <header className="flex items-start gap-3 border-b border-white/10 p-5">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: fm(p).c }}>{shortDate(p.date)} · {p.sub || fm(p).n}</div>
            <h2 id="drTitle" className="mt-1 text-xl font-extrabold text-white">{p.title}{p.num ? ` · #${p.num}` : ""}</h2>
            <div className="mt-1 text-xs text-slate-400">{statusLabel(p.status, p)}{t.late ? <b className="text-red-400"> · {t.late.n} vencida ({shortDate(t.late.due)})</b> : t.next && r < 6 ? ` · Próximo hito: ${t.next.n}, ${shortDate(t.next.due)}` : ""}</div>
          </div>
          {isAdmin && <Button size="sm" variant="ghost" onClick={onEdit} aria-label="Editar"><Pencil className="size-4" /></Button>}
          <button onClick={onClose} className="grid size-9 place-items-center rounded-full bg-white/10" aria-label="Cerrar"><X className="size-4" /></button>
        </header>
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div className="flex gap-1">{steps(p).map((s) => {
            const done = RANK[s] < r || p.status === "publicado", cur = (RANK[s] === r && p.status !== "cambios") || (p.status === "cambios" && s === "aprobacion");
            return <div key={s} className="min-w-0 flex-1"><i className={cn("block h-1.5 rounded-full", done ? "bg-emerald-400" : cur ? "bg-bwo-cerise" : "bg-white/10")} /><span className={cn("mt-1 block truncate text-[10px]", cur ? "text-white" : "text-slate-500")}>{statusLabel(s, p)}</span></div>;
          })}</div>

          <div className="flex flex-wrap gap-2">
            {canDecide && p.status !== "aprobado" && <Button variant="ok" onClick={() => setStatus("aprobado", null, "Guion aprobado")} loading={busy}><Check className="size-4" />Aprobar guion</Button>}
            {next && <Button onClick={() => setStatus(next[0])} loading={busy}>{next[1]}</Button>}
            {isVideo(p) && <Button variant="ghost" onClick={onShoot}><Video className="size-4" />Modo grabación</Button>}
          </div>

          {p.decision?.q && (
            <div className="rounded-xl bg-bwo-amber/10 p-4">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-bwo-amber">Decisión del cliente</div>
              <b className="text-sm text-white">{p.decision.q}</b>
              <div className="mt-2 space-y-2">{(p.decision.options || []).map((o, i) => (
                <button key={i} onClick={() => choose(i)} aria-pressed={p.choice === i}
                  className={cn("flex w-full items-start gap-2 rounded-lg border p-2.5 text-left text-sm", p.choice === i ? "border-emerald-400 bg-emerald-400/10" : "border-white/10 bg-white/5")}>
                  <Badge color={p.choice === i ? "turquoise" : "slate"}>{p.choice === i ? "Elegida" : String.fromCharCode(65 + i)}</Badge>{o}
                </button>))}</div>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {[["Público", p.audience], ["Dolor", p.pain], ["Intención", p.intent], ["Tono", p.tone], ["Montaje", p.setup], ["Utilería", p.props], ["Duración", p.dur_max ? `${p.dur_min || 0}–${p.dur_max} s` : null]].filter(([, v]) => v).map(([k, v]) => (
              <div key={k}><dt className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{k}</dt><dd className="text-slate-200">{v}</dd></div>
            ))}
            {p.visual && <div className="col-span-2"><dt className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Idea visual</dt><dd className="text-slate-200">{p.visual}</dd></div>}
          </dl>
          {!!p.gaps?.length && <div className="rounded-xl bg-white/5 p-3 text-sm"><div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Falta definir</div>{p.gaps.map((g) => <div key={g} className="text-slate-300">· {g}</div>)}</div>}

          <div>
            <div className="mb-2 flex items-baseline justify-between"><h3 className="text-sm font-bold text-white">{isVideo(p) ? "Guion por tomas" : "Contenido"}</h3><span className="text-xs text-slate-500">{blocksDone(p)}/{blocks.length} {isVideo(p) ? "grabadas" : "revisadas"}</span></div>
            <div className="space-y-2">{blocks.map((b, i) => {
              const on = !!(p.checks || {})[i];
              return (
                <div key={i} className={cn("grid grid-cols-[28px_minmax(0,1fr)] gap-3 rounded-xl border p-3", on ? "border-transparent bg-emerald-400/10" : "border-white/10")}>
                  <button disabled={!isAdmin} onClick={() => toggle("checks", i, !on)} aria-pressed={on} aria-label={`Marcar ${b.k}`}
                    className={cn("grid size-6 place-items-center rounded-md border-2 text-xs font-bold", on ? "border-emerald-400 bg-emerald-400 text-bwo-inkDeep" : "border-white/20", !isAdmin && "cursor-default")}>{on ? "✓" : ""}</button>
                  <div className="min-w-0">
                    <div className="text-xs font-bold" style={{ color: fm(p).c }}>{b.k}{b.t && <em className="ml-2 font-medium not-italic text-slate-500">{b.t}</em>}</div>
                    <div className="mt-0.5 whitespace-pre-wrap text-sm text-slate-100">{b.x}</div>
                    {b.v && <div className="mt-1 text-xs text-slate-400"><b className="text-slate-300">Visual:</b> {b.v}</div>}
                    {b.s && <div className="mt-1 text-xs text-slate-400"><b className="text-slate-300">Sticker:</b> {b.s}</div>}
                  </div>
                </div>);
            })}</div>
          </div>

          {!!checks.length && (
            <div className="space-y-2 rounded-xl bg-white/5 p-3 text-sm">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Antes de publicar · CTA «{p.cta?.value || "sin definir"}»</div>
              {checks.map((x) => x.auto
                ? <div key={x.k} className="flex items-center gap-2"><Badge color={x.ok ? "turquoise" : "red"}>{x.ok ? "Listo" : "Falta"}</Badge>{x.n}</div>
                : <label key={x.k} className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-emerald-400" checked={!!(p.cta_ready || {})[x.k]} disabled={!isAdmin} onChange={(e) => toggle("cta_ready", x.k, e.target.checked)} />{x.n}</label>)}
            </div>
          )}
          {!!facts.length && (
            <div className="space-y-1 rounded-xl bg-white/5 p-3 text-sm">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Cifras verificadas</div>
              {facts.map((f, i) => <div key={i} className="flex items-center gap-2"><Badge color={f.ok ? "turquoise" : "red"}>{f.ok ? "Cuadra" : "Revisar"}</Badge>{f.label}: {f.v == null ? "—" : f.v.toLocaleString("es-ES", { maximumFractionDigits: 1 })} {f.unit} (guion: {f.claim})</div>)}
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-bold text-white">Comentarios</h3>
            <div className="space-y-2">
              {comments.map((c) => (
                <div key={c.id} className={cn("rounded-xl p-3 text-sm", c.kind === "cambio" ? "bg-bwo-cerise/15" : "bg-white/5")}>
                  <div className="text-[11px] text-slate-400">{c.author_name || "—"} · {new Date(c.created_at).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{c.kind === "cambio" && " · Cambio pedido"}</div>
                  <div className="whitespace-pre-wrap text-slate-100">{c.text}</div>
                </div>
              ))}
              {!comments.length && <p className="text-xs text-slate-500">Sin comentarios todavía.</p>}
            </div>
            <Textarea className="mt-3" maxLength={2000} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Ej.: En la escena 3, cambiar «procura» por «compras internacionales»" />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={comment} loading={busy}>Comentar</Button>
              {canDecide && <Button variant="danger" size="sm" onClick={requestChanges} loading={busy}><RotateCcw className="size-3.5" />Pedir cambios</Button>}
            </div>
          </div>

          {isAdmin && (
            <div>
              <h3 className="mb-2 text-sm font-bold text-white">Mover estado</h3>
              <div className="flex flex-wrap gap-1.5">{["borrador", "aprobacion", "aprobado", "produccion", ...(isVideo(p) ? ["edicion"] : []), "listo", "publicado"].map((s) => (
                <Button key={s} size="sm" variant="ghost" disabled={s === p.status || busy} onClick={() => setStatus(s)}>{statusLabel(s, p)}</Button>))}
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-1 text-sm font-bold text-white">Historial</h3>
            <div className="space-y-0.5 text-xs text-slate-400">{[...(p.history || [])].reverse().map((h, i) => (
              <div key={i}>{new Date(h.at).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {statusLabel(h.s, p)} · {h.by}{h.role === "cliente" ? " (cliente)" : ""}{h.note ? ` · ${h.note}` : ""}</div>))}
              {!p.history?.length && "Sin movimientos."}
            </div>
          </div>
          {isAdmin && <button onClick={del} className="flex items-center gap-1 text-xs text-red-300 hover:text-red-200"><Trash2 className="size-3.5" />Eliminar pieza</button>}
        </div>
      </motion.aside>
    </div>
  );
}
