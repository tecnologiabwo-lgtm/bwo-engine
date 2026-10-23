import { useEffect, useState } from "react";
import { UserPlus, X, Shield, Eye, Link as LinkIcon, Check, Ban, Hourglass, RotateCcw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase, run } from "@/lib/supabase";
import { Badge, Button, Card, ErrorBox, Input, PageHeader, Select, Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

export default function ClientesApp() {
  const { profile, reload } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [email, setEmail] = useState({});
  const [pick, setPick] = useState({});   // usuario pendiente → cliente elegido

  const load = async () => {
    try {
      const [clients, members, profiles] = await Promise.all([
        run(supabase.from("clients").select("id, name, handle, photo, share_token").order("name")),
        run(supabase.from("client_members").select("client_id, user_id")),
        run(supabase.from("profiles").select("*").order("created_at", { ascending: false })),
      ]);
      setData({ clients, members, profiles }); setErr("");
    } catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(); }, []);

  const add = async (clientId) => {
    const e = (email[clientId] || "").trim();
    if (!e) return;
    try {
      const r = await run(supabase.rpc("admin_set_member", { p_client: clientId, p_email: e, p_add: true }));
      if (r === "no_user") { toast("Ese correo aún no tiene cuenta. Pídele que se registre en la página de acceso.", "error"); return; }
      if (r === "not_active") { toast("Esa cuenta aún no está verificada. Apruébala primero en «Solicitudes de registro».", "error"); return; }
      setEmail((x) => ({ ...x, [clientId]: "" })); toast("Acceso concedido"); load(); reload();
    } catch (er) { toast(er.message, "error"); }
  };
  const remove = async (clientId, mail) => {
    try { await run(supabase.rpc("admin_set_member", { p_client: clientId, p_email: mail, p_add: false })); toast("Acceso retirado"); load(); }
    catch (er) { toast(er.message, "error"); }
  };
  const setRole = async (p, role) => {
    if (!confirm(`¿Cambiar a ${p.email} a ${role === "admin" ? "Administrador (agencia)" : "Espectador (cliente)"}?`)) return;
    try { await run(supabase.rpc("admin_set_role", { p_user: p.id, p_role: role })); toast("Rol actualizado"); load(); }
    catch (er) { toast(er.message, "error"); }
  };
  const review = async (p, approve, client = null) => {
    if (approve && !client && !confirm(`¿Aprobar a ${p.email} sin vincularlo a ningún cliente? No verá datos hasta que le des acceso.`)) return;
    if (!approve && !confirm(`¿Rechazar el registro de ${p.email}? La cuenta quedará bloqueada.`)) return;
    try { await run(supabase.rpc("admin_review_signup", { p_user: p.id, p_approve: approve, p_client: approve ? client || null : null })); toast(approve ? "Registro verificado" : "Registro rechazado"); load(); }
    catch (er) { toast(er.message, "error"); }
  };
  const setStatus = async (p, st) => {
    if (!confirm(st === "blocked" ? `¿Suspender el acceso de ${p.email}? Se cerrará su sesión en minutos.` : `¿Reactivar a ${p.email}?`)) return;
    try { await run(supabase.rpc("admin_set_status", { p_user: p.id, p_status: st })); toast(st === "blocked" ? "Acceso suspendido" : "Acceso reactivado"); load(); }
    catch (er) { toast(er.message, "error"); }
  };
  const copyLink = (c) => navigator.clipboard.writeText(`${location.origin}/feed/cliente.html?token=${c.share_token}`).then(() => toast("Link público del feed copiado"), () => toast("No se pudo copiar", "error"));

  if (err) return <ErrorBox error={`No se pudieron cargar los clientes: ${err}. ¿Se aplicó la migración 0005?`} onRetry={load} />;
  if (!data) return <Spinner />;
  const byId = new Map(data.profiles.map((p) => [p.id, p]));
  const pending = data.profiles.filter((p) => p.status === "pending");
  const guess = (p) => data.clients.find((c) => p.company && c.name.toLowerCase().includes(p.company.toLowerCase().slice(0, 6)))?.id || "";
  return (
    <div>
      <PageHeader eyebrow="Agencia" title="Clientes y accesos"
        subtitle="Los clientes se crean en el Feed Planner. Aquí decides qué usuarios (espectadores) ven cada cliente en su portal: feed, guiones, reportes, cotizador y calculadora." />
      {pending.length > 0 && (
        <Card className="mb-8 border-bwo-amber/30">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white"><Hourglass className="size-4 text-bwo-amber" />Solicitudes de registro <Badge color="amber">{pending.length}</Badge></div>
          <p className="mb-3 text-xs text-slate-400">Verifica que la persona pertenezca a la empresa que indica antes de aprobar. Al aprobar, elige el cliente que podrá ver.</p>
          <div className="divide-y divide-white/5">
            {pending.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <div className="min-w-[220px] flex-1">
                  <div className="font-semibold text-white">{p.full_name || "Sin nombre"} · <span className="text-bwo-amber">{p.company || "sin empresa"}</span></div>
                  <div className="text-xs text-slate-400">{p.email}{p.phone ? ` · ${p.phone}` : ""} · {new Date(p.created_at).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                  {p.note && <div className="mt-1 text-xs italic text-slate-300">«{p.note}»</div>}
                </div>
                <Select className="h-9 w-56 py-1 text-xs" value={pick[p.id] ?? guess(p)} onChange={(e) => setPick((x) => ({ ...x, [p.id]: e.target.value }))}>
                  <option value="">— Vincular a cliente —</option>
                  {data.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
                <Button size="sm" variant="ok" onClick={() => review(p, true, pick[p.id] ?? guess(p))}><Check className="size-3.5" />Aprobar</Button>
                <Button size="sm" variant="ghost" onClick={() => review(p, false)}><Ban className="size-3.5" />Rechazar</Button>
              </div>
            ))}
          </div>
        </Card>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        {data.clients.map((c) => {
          const ms = data.members.filter((m) => m.client_id === c.id).map((m) => byId.get(m.user_id)).filter(Boolean);
          return (
            <Card key={c.id}>
              <div className="mb-3 flex items-center gap-3">
                <div className="size-10 overflow-hidden rounded-full bg-white/10">{c.photo && <img src={c.photo} alt="" className="size-full object-cover" />}</div>
                <div className="min-w-0 flex-1"><div className="font-bold text-white">{c.name}</div><div className="text-xs text-slate-400">@{c.handle}</div></div>
                {c.share_token && <Button size="sm" variant="ghost" onClick={() => copyLink(c)} title="Link público del feed (sin login)"><LinkIcon className="size-3.5" /></Button>}
              </div>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {ms.length ? ms.map((p) => (
                  <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-white/10 py-1 pl-3 pr-1 text-xs text-slate-200">
                    {p.full_name || p.email}
                    <button onClick={() => remove(c.id, p.email)} className="grid size-5 place-items-center rounded-full hover:bg-white/20" aria-label={`Quitar a ${p.email}`}><X className="size-3" /></button>
                  </span>
                )) : <span className="text-xs text-slate-500">Nadie del cliente tiene acceso todavía.</span>}
              </div>
              <div className="flex gap-2">
                <Input type="email" placeholder="correo@cliente.com" value={email[c.id] || ""} onChange={(e) => setEmail((x) => ({ ...x, [c.id]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && add(c.id)} />
                <Button onClick={() => add(c.id)}><UserPlus className="size-4" />Dar acceso</Button>
              </div>
            </Card>
          );
        })}
      </div>

      <h2 className="mb-3 mt-10 text-lg font-bold text-white">Usuarios y roles</h2>
      <Card className="divide-y divide-white/5 p-0">
        {data.profiles.filter((p) => p.status !== "pending").map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <div className="min-w-0 flex-1"><div className="font-semibold text-white">{p.full_name || p.email}</div><div className="text-xs text-slate-400">{p.email}</div></div>
            {p.status && p.status !== "active" && <Badge color={p.status === "blocked" ? "red" : "amber"}>{p.status === "blocked" ? "Suspendido" : "Pendiente"}</Badge>}
            <Badge color={p.role === "admin" ? "violet" : "turquoise"}>{p.role === "admin" ? <><Shield className="size-3" />Administrador</> : <><Eye className="size-3" />Espectador</>}</Badge>
            {p.last_seen && <span className="text-[11px] text-slate-500">activo {new Date(p.last_seen).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}
            {p.id !== profile.id && p.status === "active" && <Button size="sm" variant="ghost" onClick={() => setRole(p, p.role === "admin" ? "viewer" : "admin")}>{p.role === "admin" ? "Pasar a espectador" : "Hacer administrador"}</Button>}
            {p.id !== profile.id && p.status === "active" && <Button size="sm" variant="ghost" onClick={() => setStatus(p, "blocked")}><Ban className="size-3.5" />Suspender</Button>}
            {p.id !== profile.id && p.status === "blocked" && <Button size="sm" variant="ghost" onClick={() => setStatus(p, "active")}><RotateCcw className="size-3.5" />Reactivar</Button>}
          </div>
        ))}
      </Card>
      <p className="mt-3 text-xs text-slate-500">Los clientes se registran en la página de acceso («Crear cuenta»). Su cuenta queda pendiente hasta que la apruebes aquí; solo entonces ven los datos del cliente al que los vincules.</p>
    </div>
  );
}
