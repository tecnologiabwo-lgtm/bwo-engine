import { useState } from "react";
import { motion } from "motion/react";
import { X, Plus, Trash2, ArrowUp, ArrowDown, Wand2 } from "lucide-react";
import { supabase, run } from "@/lib/supabase";
import { FMT, EMPTY_PIECE, STRUCTURES, safeCalc } from "@/lib/sala";
import { Button, Field, Input, Select, Textarea, Badge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const TONES = ["Cercano", "Experto", "Inspirador", "Directo", "Humor", "Testimonial"];
const INTENTS = ["Educar", "Inspirar", "Entretener", "Vender", "Comunidad", "Autoridad"];

function List({ label, items, onChange, placeholder }) {
  return (
    <Field label={label}>
      <div className="space-y-1.5">
        {items.map((g, i) => (
          <div key={i} className="flex gap-2"><Input value={g} placeholder={placeholder} onChange={(e) => onChange(items.map((x, k) => (k === i ? e.target.value : x)))} />
            <Button size="sm" variant="ghost" onClick={() => onChange(items.filter((_, k) => k !== i))} aria-label="Quitar"><Trash2 className="size-3.5" /></Button></div>
        ))}
        <button onClick={() => onChange([...items, ""])} className="text-xs font-semibold text-bwo-violetLt">+ Agregar</button>
      </div>
    </Field>
  );
}

/** Formulario-plantilla de una pieza. Crear o editar sin escribir JSON. */
export default function PieceForm({ calendar, piece, onClose, onSaved }) {
  const toast = useToast();
  const [d, setD] = useState(() => ({ ...EMPTY_PIECE, date: calendar.month, ...(piece || {}), cta: { type: "", value: "", resource: "", ...(piece?.cta || {}) } }));
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const setBlock = (i, k, v) => set("blocks", d.blocks.map((b, j) => (j === i ? { ...b, [k]: v } : b)));
  const moveBlock = (i, dir) => { const b = [...d.blocks]; const j = i + dir; if (j < 0 || j >= b.length) return; [b[i], b[j]] = [b[j], b[i]]; set("blocks", b); };
  const useStructure = () => {
    if (d.blocks.some((b) => b.x) && !confirm("Esto reemplaza los bloques actuales por la estructura sugerida. ¿Continuar?")) return;
    set("blocks", (STRUCTURES[d.fmt] || STRUCTURES.reel).map((b) => ({ k: b.k, t: b.t || "", x: "", v: "", s: "" })));
  };

  const save = async (sendToApproval) => {
    if (!d.title.trim()) { toast("Ponle un título a la pieza", "error"); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) { toast("Fecha de publicación inválida", "error"); return; }
    if (!d.blocks.length) { toast("Agrega al menos un bloque de contenido", "error"); return; }
    setBusy(true);
    try {
      const row = {
        calendar_id: calendar.id, client_id: calendar.client_id, date: d.date, fmt: d.fmt, title: d.title.trim(),
        sub: d.sub || null, series: d.series || null, num: d.num ? +d.num : null, audience: d.audience || null, pain: d.pain || null,
        intent: d.intent || null, tone: d.tone || null, visual: d.visual || null, setup: d.setup || null, props: d.props || null,
        dur_min: d.dur_min ? +d.dur_min : null, dur_max: d.dur_max ? +d.dur_max : null,
        blocks: d.blocks, cta: d.cta?.type ? d.cta : {}, decision: d.decision?.q ? { q: d.decision.q, options: (d.decision.options || []).filter(Boolean) } : null,
        gaps: d.gaps.filter(Boolean), facts: d.facts.filter((f) => f.label), updated_at: new Date().toISOString(),
      };
      let id = piece?.id;
      if (id) await run(supabase.from("sala_pieces").update(row).eq("id", id));
      else id = (await run(supabase.from("sala_pieces").insert(row).select("id").single())).id;
      if (sendToApproval) await run(supabase.rpc("sala_set_status", { p_piece: id, p_status: "aprobacion", p_note: piece ? "Editado y enviado" : "Creado" }));
      toast(sendToApproval ? "Guion enviado a aprobación del cliente" : "Guardado como borrador");
      onSaved(id);
    } catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Editor de pieza">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="absolute inset-x-0 bottom-0 top-6 mx-auto flex max-w-4xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-bwo-inkDeep shadow-2xl sm:inset-y-6 sm:rounded-3xl">
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="text-lg font-extrabold text-white">{piece ? "Editar pieza" : "Nueva pieza"}</h2>
          <button onClick={onClose} className="grid size-9 place-items-center rounded-full bg-white/10" aria-label="Cerrar"><X className="size-4" /></button>
        </header>
        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          <section className="grid gap-3 sm:grid-cols-6">
            <Field label="Formato" className="sm:col-span-6">
              <div className="flex flex-wrap gap-2">{Object.entries(FMT).map(([k, f]) => (
                <button key={k} onClick={() => set("fmt", k)} className={cn("rounded-xl border px-3 py-1.5 text-xs font-bold", d.fmt === k ? "text-bwo-inkDeep" : "border-white/10 bg-white/5 text-slate-300")}
                  style={d.fmt === k ? { background: f.c, borderColor: f.c } : undefined}>{f.n}</button>))}
              </div>
            </Field>
            <Field label="Título *" className="sm:col-span-4"><Input value={d.title} onChange={(e) => set("title", e.target.value)} placeholder="Ej.: 3 errores al importar maquinaria" /></Field>
            <Field label="Fecha de publicación *" className="sm:col-span-2"><Input type="date" value={d.date} onChange={(e) => set("date", e.target.value)} /></Field>
            <Field label="Subtítulo / formato detallado" className="sm:col-span-2"><Input value={d.sub || ""} onChange={(e) => set("sub", e.target.value)} placeholder="Reel · vocero 30–35 s" /></Field>
            <Field label="Serie" className="sm:col-span-3"><Input value={d.series || ""} onChange={(e) => set("series", e.target.value)} /></Field>
            <Field label="N.º" className="sm:col-span-1"><Input type="number" min="1" value={d.num || ""} onChange={(e) => set("num", e.target.value)} /></Field>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 text-xs font-bold uppercase tracking-widest text-bwo-amber">Estrategia</div>
            <Field label="Público"><Input value={d.audience || ""} onChange={(e) => set("audience", e.target.value)} placeholder="Nuevo, recurrente, distribuidor…" /></Field>
            <Field label="Dolor que resuelve"><Input value={d.pain || ""} onChange={(e) => set("pain", e.target.value)} /></Field>
            <Field label="Intención"><Select value={d.intent || ""} onChange={(e) => set("intent", e.target.value)}><option value="">—</option>{INTENTS.map((x) => <option key={x}>{x}</option>)}</Select></Field>
            <Field label="Tono"><Select value={d.tone || ""} onChange={(e) => set("tone", e.target.value)}><option value="">—</option>{TONES.map((x) => <option key={x}>{x}</option>)}</Select></Field>
            <Field label="Idea visual" className="sm:col-span-2"><Textarea rows={2} value={d.visual || ""} onChange={(e) => set("visual", e.target.value)} /></Field>
          </section>

          <section className="grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-4 text-xs font-bold uppercase tracking-widest text-bwo-amber">Producción</div>
            <Field label="Montaje / locación" className="sm:col-span-2"><Input value={d.setup || ""} onChange={(e) => set("setup", e.target.value)} placeholder="Vocero en escritorio" /></Field>
            <Field label="Utilería"><Input value={d.props || ""} onChange={(e) => set("props", e.target.value)} /></Field>
            <Field label="Duración (s)"><div className="flex gap-1"><Input type="number" min="0" value={d.dur_min || ""} onChange={(e) => set("dur_min", e.target.value)} placeholder="mín" /><Input type="number" min="0" value={d.dur_max || ""} onChange={(e) => set("dur_max", e.target.value)} placeholder="máx" /></div></Field>
          </section>

          <section>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-bold uppercase tracking-widest text-bwo-amber">Guion · tomas / láminas</div>
              <Button size="sm" variant="ghost" onClick={useStructure}><Wand2 className="size-3.5" />Usar estructura sugerida para {FMT[d.fmt].n}</Button>
            </div>
            <div className="space-y-3">
              {d.blocks.map((b, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Badge color="violet">{i + 1}</Badge>
                    <Input className="h-8 py-1" value={b.k} onChange={(e) => setBlock(i, "k", e.target.value)} placeholder="Nombre (Hook, Lámina 2…)" />
                    <Input className="h-8 w-28 py-1" value={b.t || ""} onChange={(e) => setBlock(i, "t", e.target.value)} placeholder="0–3 s" />
                    <Button size="sm" variant="ghost" onClick={() => moveBlock(i, -1)} aria-label="Subir"><ArrowUp className="size-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => moveBlock(i, 1)} aria-label="Bajar"><ArrowDown className="size-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => set("blocks", d.blocks.filter((_, j) => j !== i))} aria-label="Quitar"><Trash2 className="size-3.5" /></Button>
                  </div>
                  <Textarea rows={3} value={b.x} onChange={(e) => setBlock(i, "x", e.target.value)} placeholder="Texto / lo que se dice o se lee" />
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Input value={b.v || ""} onChange={(e) => setBlock(i, "v", e.target.value)} placeholder="Visual / toma" />
                    <Input value={b.s || ""} onChange={(e) => setBlock(i, "s", e.target.value)} placeholder="Sticker / texto en pantalla" />
                  </div>
                </div>
              ))}
              <Button size="sm" variant="ghost" onClick={() => set("blocks", [...d.blocks, { k: `Bloque ${d.blocks.length + 1}`, t: "", x: "", v: "", s: "" }])}><Plus className="size-3.5" />Agregar bloque</Button>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-3 text-xs font-bold uppercase tracking-widest text-bwo-amber">Llamado a la acción</div>
            <Field label="Tipo"><Select value={d.cta.type || ""} onChange={(e) => set("cta", { ...d.cta, type: e.target.value })}><option value="">Sin CTA verificable</option><option value="palabra">Palabra clave (comentario/DM)</option><option value="whatsapp">WhatsApp de ventas</option></Select></Field>
            {d.cta.type && <Field label={d.cta.type === "palabra" ? "Palabra clave" : "Texto / enlace"}><Input value={d.cta.value || ""} onChange={(e) => set("cta", { ...d.cta, value: e.target.value })} /></Field>}
            {d.cta.type === "palabra" && <Field label="Recurso prometido"><Input value={d.cta.resource || ""} onChange={(e) => set("cta", { ...d.cta, resource: e.target.value })} placeholder="Guía PDF, catálogo…" /></Field>}
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 text-xs font-bold uppercase tracking-widest text-bwo-amber">Para el cliente</div>
            <Field label="Decisión que debe tomar el cliente (opcional)" className="sm:col-span-2"><Input value={d.decision?.q || ""} onChange={(e) => set("decision", { options: ["", ""], ...(d.decision || {}), q: e.target.value })} placeholder="¿Grabamos en oficina o en almacén?" /></Field>
            {d.decision?.q && <div className="sm:col-span-2"><List label="Opciones" items={d.decision.options || []} onChange={(o) => set("decision", { ...d.decision, options: o })} placeholder="Opción" /></div>}
            <List label="Datos que faltan en el guion" items={d.gaps} onChange={(g) => set("gaps", g)} placeholder="Ej.: precio del flete" />
            <Field label="Cifras a verificar">
              <div className="space-y-2">
                {d.facts.map((f, i) => {
                  const v = safeCalc(f.calc);
                  const upd = (k, val) => set("facts", d.facts.map((x, j) => (j === i ? { ...x, [k]: val } : x)));
                  return (
                    <div key={i} className="grid grid-cols-[1fr_1fr_70px_60px_auto] gap-1.5">
                      <Input className="h-8 py-1 text-xs" value={f.label} onChange={(e) => upd("label", e.target.value)} placeholder="Dato" />
                      <Input className="h-8 py-1 font-mono text-xs" value={f.calc} onChange={(e) => upd("calc", e.target.value)} placeholder="60*50*50/6000" title={v == null ? "Fórmula inválida" : `= ${v}`} />
                      <Input className="h-8 py-1 text-xs" type="number" value={f.claim} onChange={(e) => upd("claim", +e.target.value)} placeholder="Guion" />
                      <Input className="h-8 py-1 text-xs" value={f.unit || ""} onChange={(e) => upd("unit", e.target.value)} placeholder="kg" />
                      <Button size="sm" variant="ghost" onClick={() => set("facts", d.facts.filter((_, j) => j !== i))}><Trash2 className="size-3.5" /></Button>
                    </div>
                  );
                })}
                <button onClick={() => set("facts", [...d.facts, { label: "", calc: "", claim: "", unit: "" }])} className="text-xs font-semibold text-bwo-violetLt">+ Agregar cifra</button>
              </div>
            </Field>
          </section>
        </div>
        <footer className="flex flex-wrap justify-end gap-2 border-t border-white/10 px-5 py-4">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="ghost" onClick={() => save(false)} loading={busy}>Guardar borrador</Button>
          <Button onClick={() => save(true)} loading={busy}>Guardar y enviar al cliente</Button>
        </footer>
      </motion.div>
    </div>
  );
}
