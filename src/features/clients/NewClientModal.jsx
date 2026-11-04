import { useState } from "react";
import { Modal, Button, Field, Input, Textarea } from "@/shared/ui/primitives";
import { useToast } from "@/shared/ui/toast";
import { supabase, run } from "@/shared/lib/supabase";
import { useAuth } from "@/features/auth/auth";
import { useClient } from "@/features/clients/clientContext";
import { DEFAULT_PILLARS, handleClean } from "@/features/feed/logic.js";

const EMPTY = { name: "", handle: "", category: "", bio: "", link: "", followers: "", frequency_per_week: 3, pillars: true };

/** Alta de un cliente nuevo. Queda disponible en todos los módulos
 *  (Feed, Sala, Reportes, Histórico) y en el Feed clásico. */
export default function NewClientModal({ open, onClose, onCreated }) {
  const [f, setF] = useState(EMPTY); const [busy, setBusy] = useState(false);
  const toast = useToast(); const { reload } = useAuth(); const { choose } = useClient();
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const handle = f.handle ? handleClean(f.handle) : handleClean(f.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, ""));

  const save = async () => {
    setBusy(true);
    try {
      const c = await run(supabase.from("clients").insert({
        name: f.name.trim(), handle, category: f.category.trim() || null, bio: f.bio.trim() || null, link: f.link.trim() || null,
        followers: f.followers.trim() || "0", frequency_per_week: Number(f.frequency_per_week) || 3,
      }).select().single());
      if (f.pillars) await run(supabase.from("pillars").insert(DEFAULT_PILLARS.map((p, i) => ({ ...p, client_id: c.id, sort: i }))));
      await reload(); choose(c.id);
      toast(`Cliente «${c.name}» creado`);
      setF(EMPTY); onCreated?.(c); onClose();
    } catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nuevo cliente"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button loading={busy} disabled={!f.name.trim() || !handle} onClick={save}>Crear cliente</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre de la empresa *" className="sm:col-span-2"><Input autoFocus value={f.name} onChange={set("name")} placeholder="Herrajes del Oriente" /></Field>
        <Field label="Usuario de Instagram *" hint={handle ? `Se guardará como @${handle}` : "Sin @"}><Input value={f.handle} onChange={set("handle")} placeholder="herrajesdeloriente" /></Field>
        <Field label="Categoría"><Input value={f.category} onChange={set("category")} placeholder="Ferretería · Importación" /></Field>
        <Field label="Biografía" className="sm:col-span-2"><Textarea rows={3} value={f.bio} onChange={set("bio")} placeholder="Lo que dice su perfil de Instagram" /></Field>
        <Field label="Enlace de la bio"><Input value={f.link} onChange={set("link")} placeholder="wa.me/58412… o su web" /></Field>
        <Field label="Seguidores"><Input value={f.followers} onChange={set("followers")} placeholder="1.250" /></Field>
        <Field label="Publicaciones por semana"><Input type="number" min="1" max="21" value={f.frequency_per_week} onChange={set("frequency_per_week")} /></Field>
      </div>
      <label className="mt-4 flex items-start gap-2 text-sm text-slate-300">
        <input type="checkbox" className="mt-1" checked={f.pillars} onChange={set("pillars")} />
        <span>Crear los pilares de contenido base (Educar, Inspirar, Entretener, Vender, Comunidad). Puedes editarlos luego en Feed → Perfil y pilares.</span>
      </label>
      <p className="mt-3 text-xs text-slate-500">La foto de perfil se sube después en Feed → Perfil y pilares. Para darle acceso a la persona del cliente, usa «Invitar por correo».</p>
    </Modal>
  );
}
