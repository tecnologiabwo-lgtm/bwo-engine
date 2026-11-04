import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { History, Bug, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { useClient } from "@/features/clients/clientContext";
import { Badge, Button, Card, Empty, ErrorBox, Input, PageHeader, Select, Spinner } from "@/shared/ui/primitives";
import { cn } from "@/shared/lib/utils";
import { listAudit, listErrors, groupErrors, ENTITY_LABELS, ACTION_LABELS } from "./api.js";

const fmt = (s) => new Date(s).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const show = (v) => (v == null ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v)).slice(0, 160);
const VIA = { app: ["slate", "plataforma"], enlace: ["amber", "enlace público"], sistema: ["violet", "sistema"] };

function Changes({ changes, action }) {
  const entries = Object.entries(changes || {});
  if (!entries.length) return <span className="text-slate-500">sin detalle</span>;
  return (
    <div className="mt-2 space-y-1 rounded-lg bg-black/20 p-3 font-mono text-[11px]">
      {entries.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[140px_1fr] gap-2">
          <span className="text-slate-400">{k}</span>
          {action === "editar" || action === "estado"
            ? <span><s className="text-red-300/80">{show(v?.de)}</s> <span className="text-slate-500">→</span> <span className="text-emerald-300">{show(v?.a)}</span></span>
            : <span className="text-slate-200">{show(v)}</span>}
        </div>
      ))}
    </div>
  );
}

function AuditTab() {
  const { clients } = useClient();
  const [f, setF] = useState({ clientId: "", entity: "", actor: "", from: "", to: "" });
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(new Set());
  const [more, setMore] = useState(true);
  const load = async (append = false) => {
    try {
      const r = await listAudit({ ...f, before: append ? rows?.at(-1)?.id : undefined });
      setRows(append ? [...rows, ...r] : r); setMore(r.length === 100); setErr("");
    } catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(); }, [f.clientId, f.entity, f.from, f.to]);
  const names = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c.name])), [clients]);
  const toggle = (id) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div>
      <Card className="mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <Select value={f.clientId} onChange={(e) => setF({ ...f, clientId: e.target.value })}><option value="">Todos los clientes</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <Select value={f.entity} onChange={(e) => setF({ ...f, entity: e.target.value })}><option value="">Todo tipo de cambio</option>{Object.entries(ENTITY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
        <Input placeholder="Quién (nombre o correo)" value={f.actor} onChange={(e) => setF({ ...f, actor: e.target.value })} onKeyDown={(e) => e.key === "Enter" && load()} />
        <Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} aria-label="Desde" />
        <Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} aria-label="Hasta" />
      </Card>
      {err && <ErrorBox error={err} onRetry={() => load()} />}
      {!rows ? <Spinner /> : !rows.length ? <Empty icon={History} title="Sin movimientos con esos filtros" /> : (
        <Card className="divide-y divide-white/5 p-0">
          {rows.map((r) => {
            const isOpen = open.has(r.id), [tone, via] = VIA[r.via] || VIA.app;
            const label = r.changes?.status ? `${ENTITY_LABELS[r.entity] || r.entity}: ${show(r.changes.status.de)} → ${show(r.changes.status.a)}` : ENTITY_LABELS[r.entity] || r.entity;
            return (
              <div key={r.id} className="px-4 py-3 text-sm">
                <button className="flex w-full flex-wrap items-center gap-2 text-left" onClick={() => toggle(r.id)}>
                  {isOpen ? <ChevronDown className="size-4 text-slate-500" /> : <ChevronRight className="size-4 text-slate-500" />}
                  <span className="w-28 shrink-0 text-xs text-slate-500">{fmt(r.at)}</span>
                  <b className="text-white">{r.actor_name || "—"}</b>
                  <span className="text-slate-400">{ACTION_LABELS[r.action] || r.action}</span>
                  <span className="text-slate-200">{label}</span>
                  {r.client_id && <Badge color="slate">{names[r.client_id] || "cliente"}</Badge>}
                  <Badge color={tone}>{via}</Badge>
                </button>
                {isOpen && <Changes changes={r.changes} action={r.action} />}
              </div>
            );
          })}
        </Card>
      )}
      {rows?.length > 0 && more && <Button variant="ghost" className="mt-3" onClick={() => load(true)}>Cargar más</Button>}
    </div>
  );
}

function ErrorsTab() {
  const [days, setDays] = useState(7);
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(null);
  const load = async () => { try { setRows(await listErrors({ days })); setErr(""); } catch (e) { setErr(e.message); } };
  useEffect(() => { setRows(null); load(); }, [days]);
  const groups = useMemo(() => groupErrors(rows || []), [rows]);
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[1, 7, 30].map((d) => <Button key={d} size="sm" variant={days === d ? "primary" : "ghost"} onClick={() => setDays(d)}>{d === 1 ? "Últimas 24 h" : `${d} días`}</Button>)}
        <Button size="sm" variant="ghost" onClick={load}><RefreshCw className="size-3.5" />Actualizar</Button>
        {rows && <span className="text-xs text-slate-400">{rows.length} errores · {groups.length} distintos</span>}
      </div>
      {err && <ErrorBox error={err} onRetry={load} />}
      {!rows ? <Spinner /> : !groups.length ? <Empty icon={Bug} title="Sin errores registrados">Cuando algo falle en el navegador de alguien, aparecerá aquí con su detalle técnico.</Empty> : (
        <div className="space-y-2">
          {groups.map((g) => (
            <Card key={g.key} className="p-4">
              <button className="flex w-full flex-wrap items-start gap-3 text-left" onClick={() => setOpen(open === g.key ? null : g.key)}>
                <Badge color={g.count > 5 ? "red" : "amber"}>{g.count}×</Badge>
                <div className="min-w-0 flex-1">
                  <div className="break-words font-mono text-sm text-white">{g.message}</div>
                  <div className="mt-1 text-xs text-slate-400">Último {fmt(g.last)} · {g.users.size} usuario(s) · versión {g.release || "—"} · {[...g.urls].slice(0, 3).join(", ")}</div>
                </div>
              </button>
              {open === g.key && (
                <motion.pre initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 max-h-72 overflow-auto rounded-lg bg-black/30 p-3 text-[11px] text-slate-300">
                  {g.sample.stack || "(sin traza)"}{"\n\n"}{JSON.stringify(g.sample.context, null, 2)}{"\n"}{g.sample.user_agent}
                </motion.pre>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MonitoreoApp() {
  const [tab, setTab] = useState("audit");
  return (
    <div>
      <PageHeader eyebrow="Agencia" title="Auditoría y errores"
        subtitle="Quién aprobó, cambió o eliminó qué y cuándo —desde la plataforma, el Feed clásico o un enlace público— y los errores que ocurren en el navegador de los usuarios." />
      <div className="mb-5 flex gap-1" role="tablist">
        {[["audit", History, "Auditoría"], ["errors", Bug, "Errores en producción"]].map(([k, Icon, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold", tab === k ? "text-white" : "text-slate-400")}>
            {tab === k && <motion.span layoutId="mon-tab" className="absolute inset-0 rounded-lg bg-white/10" />}<Icon className="relative size-4" /><span className="relative">{l}</span>
          </button>
        ))}
      </div>
      {tab === "audit" ? <AuditTab /> : <ErrorsTab />}
    </div>
  );
}
