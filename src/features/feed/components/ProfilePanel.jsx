import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, Button, Field, Input, Textarea } from "@/shared/ui/primitives";
import { useToast } from "@/shared/ui/toast";
import { uploadImage, pickFiles } from "../media.js";
import * as api from "../api.js";

const FIELDS = [["name", "Nombre"], ["handle", "Usuario (@)"], ["category", "Categoría"], ["link", "Enlace"], ["followers", "Seguidores"], ["following", "Seguidos"]];

export default function ProfilePanel({ client, pillars, onChanged }) {
  const [d, setD] = useState(() => ({ ...client })); const [busy, setBusy] = useState(false); const toast = useToast();
  const set = (k) => (e) => setD((x) => ({ ...x, [k]: e.target.value }));
  const save = async () => {
    setBusy(true);
    try {
      const patch = Object.fromEntries([...FIELDS.map(([k]) => k), "bio", "photo"].map((k) => [k, d[k] || null]));
      patch.name = d.name || client.name;
      patch.archive_after_days = d.archive_after_days === "" || d.archive_after_days == null ? null : Number(d.archive_after_days);
      patch.frequency_per_week = d.frequency_per_week ? Number(d.frequency_per_week) : null;
      await api.updateClient(client.id, patch); toast("Perfil guardado"); onChanged();
    } catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  };
  const photo = async () => {
    const [f] = await pickFiles(); if (!f) return;
    try { const { url } = await uploadImage(client.id, f, { w: 320, h: 320, targetKB: 60 }); setD((x) => ({ ...x, photo: url })); } catch (e) { toast(e.message, "error"); }
  };
  const pillarAct = (fn) => fn().then(onChanged).catch((e) => toast(e.message, "error"));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="size-16 overflow-hidden rounded-full bg-white/10">{d.photo && <img src={d.photo} alt="" className="size-full object-cover" />}</div>
          <Button size="sm" variant="ghost" onClick={photo}>Cambiar foto</Button>
        </div>
        <div className="grid grid-cols-2 gap-3">{FIELDS.map(([k, l]) => <Field key={k} label={l}><Input value={d[k] || ""} onChange={set(k)} /></Field>)}</div>
        <Field label="Biografía"><Textarea value={d.bio || ""} onChange={set("bio")} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Publicaciones por semana"><Input type="number" min="0" value={d.frequency_per_week ?? ""} onChange={set("frequency_per_week")} /></Field>
          <Field label="Archivar publicadas tras (días)" hint="Vacío = nunca"><Input type="number" min="1" value={d.archive_after_days ?? ""} onChange={set("archive_after_days")} /></Field>
        </div>
        <Button loading={busy} onClick={save}>Guardar perfil</Button>
      </Card>
      <Card>
        <div className="mb-3 flex items-center justify-between"><div className="font-bold text-white">Pilares de contenido</div>
          <Button size="sm" variant="ghost" onClick={() => pillarAct(() => api.addPillars([{ client_id: client.id, name: "Nuevo pilar", color: "#6C3BF5", sort: pillars.length }]))}><Plus className="size-4" />Añadir</Button></div>
        <div className="space-y-2">
          {pillars.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              <input type="color" defaultValue={p.color} onBlur={(e) => e.target.value !== p.color && pillarAct(() => api.updatePillar(p.id, { color: e.target.value }))} className="size-8 cursor-pointer rounded border-0 bg-transparent" aria-label="Color" />
              <Input defaultValue={p.name} onBlur={(e) => e.target.value !== p.name && pillarAct(() => api.updatePillar(p.id, { name: e.target.value }))} />
              <Input type="number" className="w-20" placeholder="%" defaultValue={p.target_pct ?? ""} onBlur={(e) => pillarAct(() => api.updatePillar(p.id, { target_pct: e.target.value ? Number(e.target.value) : null }))} aria-label="Objetivo %" />
              <button className="text-slate-500 hover:text-red-300" onClick={() => confirm(`¿Eliminar el pilar "${p.name}"?`) && pillarAct(() => api.deletePillar(p.id))} aria-label="Eliminar pilar"><Trash2 className="size-4" /></button>
            </div>
          ))}
          {!pillars.length && <p className="text-sm text-slate-500">Sin pilares.</p>}
        </div>
      </Card>
    </div>
  );
}
