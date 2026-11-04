import { useCallback, useEffect, useState } from "react";
import { Mail, Send, RotateCcw } from "lucide-react";
import { supabase, run } from "@/shared/lib/supabase";
import { Badge, Button, Card, Field, Input, Select } from "@/shared/ui/primitives";
import { useToast } from "@/shared/ui/toast";

const when = (s) => new Date(s).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const stateOf = (i) => i.accepted_at ? ["Aceptada", "turquoise"] : i.revoked_at ? ["Revocada", "red"] : i.send_error ? ["Error de envío", "red"]
  : new Date(i.expires_at) < new Date() ? ["Caducada", "amber"] : i.sent_at ? ["Enviada", "violet"] : ["Sin enviar", "slate"];

/** Invitar por correo (Resend vía la Edge Function invite-client). */
export default function InvitePanel({ clients, onDone }) {
  const toast = useToast();
  const [f, setF] = useState({ email: "", full_name: "", client_id: "", role: "viewer" });
  const [busy, setBusy] = useState(false); const [list, setList] = useState([]);
  const load = useCallback(() => run(supabase.from("invitations").select("*").order("created_at", { ascending: false }).limit(12)).then(setList).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const send = async (payload = f) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-client", { body: { ...payload, client_id: payload.client_id || null } });
      if (error) { let m = error.message; try { m = (await error.context.json()).error || m; } catch {} throw new Error(m); }
      toast(data.existing ? "Ya tenía cuenta: le dimos acceso y le avisamos por correo" : "Invitación enviada");
      setF({ email: "", full_name: "", client_id: payload.client_id, role: "viewer" }); load(); onDone?.();
    } catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  };
  const byId = Object.fromEntries(clients.map((c) => [c.id, c.name]));

  return (
    <Card className="mb-8">
      <div className="mb-1 flex items-center gap-2 text-sm font-bold text-white"><Mail className="size-4 text-bwo-turquoise" />Invitar por correo</div>
      <p className="mb-3 text-xs text-slate-400">Le llega un correo de Big Way con un enlace para crear su contraseña. Entra ya verificada y vinculada al cliente; no tienes que aprobarla después.</p>
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto_auto] md:items-end">
        <Field label="Correo"><Input type="email" value={f.email} onChange={set("email")} placeholder="gerente@cliente.com" /></Field>
        <Field label="Nombre"><Input value={f.full_name} onChange={set("full_name")} placeholder="Luis Pérez" /></Field>
        <Field label="Cliente"><Select value={f.client_id} onChange={set("client_id")}><option value="">— Elige —</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label="Rol"><Select value={f.role} onChange={set("role")}><option value="viewer">Cliente</option><option value="admin">Agencia</option></Select></Field>
        <Button loading={busy} disabled={!f.email || (f.role === "viewer" && !f.client_id)} onClick={() => send()}><Send className="size-4" />Invitar</Button>
      </div>
      {list.length > 0 && (
        <div className="mt-4 divide-y divide-white/5 text-sm">
          {list.map((i) => { const [t, c] = stateOf(i); return (
            <div key={i.id} className="flex flex-wrap items-center gap-2 py-2">
              <div className="min-w-0 flex-1"><span className="font-semibold text-slate-200">{i.full_name || i.email}</span> <span className="text-xs text-slate-500">· {i.email} · {byId[i.client_id] || "Agencia"} · {when(i.created_at)}</span>
                {i.send_error && <div className="text-[11px] text-red-300">{i.send_error}</div>}</div>
              <Badge color={c}>{t}</Badge>
              {!i.accepted_at && <Button size="sm" variant="ghost" loading={busy} onClick={() => send({ email: i.email, full_name: i.full_name, client_id: i.client_id, role: i.role })}><RotateCcw className="size-3.5" />Reenviar</Button>}
            </div>); })}
        </div>
      )}
    </Card>
  );
}
