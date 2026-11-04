import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, AlertTriangle, CalendarClock, Hourglass, Wrench } from "lucide-react";
import { Card, Badge } from "@/shared/ui/primitives";
import { cn } from "@/shared/lib/utils";
import { STATUS, workload, monthGrid, isoDay, thumbOf } from "../logic.js";

const DOW = ["L", "M", "X", "J", "V", "S", "D"];
const dayName = (iso, o) => new Date(iso + "T12:00").toLocaleDateString("es-ES", o);

function Kpi({ icon: Icon, label, value, tone, hint }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-slate-400"><Icon className="size-4" style={{ color: tone }} />{label}</div>
      <div className="mt-1 text-2xl font-black text-white">{value}</div>
      {hint && <div className="text-[11px] text-slate-500">{hint}</div>}
    </Card>
  );
}

/** Barra apilada por estado: el alto es el volumen del día. */
function DayBar({ d, max, selected, today, onClick }) {
  const order = ["published", "approved", "pending", "changes", "draft"];
  return (
    <button onClick={onClick} className={cn("flex min-w-[46px] flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 transition", selected ? "bg-white/10 ring-1 ring-bwo-violet" : "hover:bg-white/5")}
      aria-label={`${dayName(d.date, { weekday: "long", day: "numeric", month: "long" })}: ${d.total} publicaciones, ${d.notReady} por preparar`}>
      <span className="text-[10px] font-bold text-white">{d.total || ""}</span>
      <div className="flex h-24 w-6 flex-col-reverse overflow-hidden rounded-md bg-white/5">
        {order.map((k) => d.byStatus[k] ? <div key={k} style={{ height: `${(d.byStatus[k] / max) * 100}%`, background: STATUS[k].color }} /> : null)}
      </div>
      {d.stories > 0 && <span className="text-[9px] text-bwo-amber">+{d.stories} hist.</span>}
      <span className={cn("text-[10px] uppercase", today ? "font-bold text-bwo-turquoise" : "text-slate-400")}>{dayName(d.date, { weekday: "short" }).slice(0, 3)}</span>
      <span className={cn("text-xs font-semibold", today ? "text-bwo-turquoise" : "text-slate-200")}>{Number(d.date.slice(8))}</span>
    </button>
  );
}

export default function CalendarView({ posts, stories, perWeek, isAdmin, onOpen, onCreate }) {
  const today = isoDay(new Date());
  const [sel, setSel] = useState(today);
  const [ym, setYm] = useState(() => { const d = new Date(); return [d.getFullYear(), d.getMonth()]; });
  const w = useMemo(() => workload(posts, stories, { from: today, days: 14, perWeek }), [posts, stories, perWeek, today]);
  const byDay = useMemo(() => { const m = new Map(); for (const p of posts) if (p.scheduled_date) { if (!m.has(p.scheduled_date)) m.set(p.scheduled_date, []); m.get(p.scheduled_date).push(p); } return m; }, [posts]);
  const grid = monthGrid(ym[0], ym[1]);
  const selPosts = byDay.get(sel) || [];
  const undated = posts.filter((p) => !p.scheduled_date);
  const s = w.summary;
  const move = (n) => setYm(([y, m]) => { const d = new Date(y, m + n, 1); return [d.getFullYear(), d.getMonth()]; });

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={CalendarClock} tone="#A78BFA" label="Próximos 7 días" value={s.next7}
          hint={s.target != null ? (s.gap >= 0 ? `Objetivo ${s.target}/semana cubierto` : `Faltan ${-s.gap} para el objetivo de ${s.target}`) : "publicaciones programadas"} />
        <Kpi icon={Wrench} tone="#F5A623" label={isAdmin ? "Por preparar (7 días)" : "En preparación (7 días)"} value={s.notReady7} hint="borradores, cambios y pendientes" />
        <Kpi icon={Hourglass} tone="#8B8FC7" label={isAdmin ? "Esperando al cliente" : "Esperan tu aprobación"} value={s.waitingClient7} hint="en los próximos 7 días" />
        <Kpi icon={AlertTriangle} tone="#E6197E" label="Atrasadas" value={s.overdue} hint={s.overdue ? "fecha pasada y sin aprobar" : "todo al día"} />
      </div>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div><div className="font-bold text-white">Carga de los próximos 14 días</div>
            <div className="text-xs text-slate-400">{s.emptyDays7} días sin contenido esta semana{s.busiest?.total ? ` · día más cargado: ${dayName(s.busiest.date, { weekday: "long", day: "numeric" })} (${s.busiest.total})` : ""}</div></div>
          <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">{Object.entries(STATUS).map(([k, st]) => <span key={k} className="inline-flex items-center gap-1"><i className="size-2 rounded-full" style={{ background: st.color }} />{isAdmin ? st.label : st.client}</span>)}</div>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {w.days.map((d) => <DayBar key={d.date} d={d} max={w.max} today={d.date === today} selected={d.date === sel} onClick={() => setSel(d.date)} />)}
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="p-3 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <button className="grid size-8 place-items-center rounded-lg bg-white/5" onClick={() => move(-1)} aria-label="Mes anterior"><ChevronLeft className="size-4" /></button>
            <div className="font-bold text-white first-letter:uppercase">{new Date(ym[0], ym[1], 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" })}</div>
            <button className="grid size-8 place-items-center rounded-lg bg-white/5" onClick={() => move(1)} aria-label="Mes siguiente"><ChevronRight className="size-4" /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-500">{DOW.map((d) => <div key={d}>{d}</div>)}</div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {grid.map((c) => { const ps = byDay.get(c.date) || []; const nr = ps.filter((p) => ["draft", "changes", "pending"].includes(p.status)).length; return (
              <button key={c.date} onClick={() => setSel(c.date)}
                className={cn("flex min-h-[74px] flex-col rounded-lg border p-1 text-left transition sm:min-h-[92px]", c.inMonth ? "border-white/10 bg-white/[0.03]" : "border-transparent opacity-40",
                  c.date === sel && "ring-1 ring-bwo-violet", c.date === today && "border-bwo-turquoise/60")}>
                <div className="flex items-center justify-between"><span className={cn("text-[11px] font-semibold", c.date === today ? "text-bwo-turquoise" : "text-slate-300")}>{c.day}</span>
                  {ps.length > 0 && <span className={cn("rounded px-1 text-[9px] font-bold", nr ? "bg-bwo-amber/20 text-amber-300" : "bg-bwo-turquoise/20 text-bwo-turquoiseLt")}>{ps.length}</span>}</div>
                <div className="mt-1 grid grid-cols-2 gap-0.5">
                  {ps.slice(0, 4).map((p) => <div key={p.id} className="relative aspect-square overflow-hidden rounded-sm bg-white/10">{thumbOf(p) && <img src={thumbOf(p)} alt="" className="size-full object-cover" />}<i className="absolute bottom-0 left-0 h-0.5 w-full" style={{ background: (STATUS[p.status] || STATUS.draft).color }} /></div>)}
                </div>
                {ps.length > 4 && <span className="mt-auto text-[9px] text-slate-400">+{ps.length - 4}</span>}
              </button>); })}
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <div className="font-bold text-white first-letter:uppercase">{dayName(sel, { weekday: "long", day: "numeric", month: "long" })}</div>
            {isAdmin && <button onClick={() => onCreate(sel)} className="inline-flex items-center gap-1 rounded-lg bg-bwo-violet px-2 py-1 text-xs font-semibold text-white"><Plus className="size-3.5" />Programar</button>}
          </div>
          {selPosts.length ? (
            <div className="space-y-2">{selPosts.map((p) => { const st = STATUS[p.status] || STATUS.draft; return (
              <button key={p.id} onClick={() => onOpen(p)} className="flex w-full items-center gap-3 rounded-xl bg-white/5 p-2 text-left hover:bg-white/10">
                <div className="size-12 shrink-0 overflow-hidden rounded bg-white/5">{thumbOf(p) && <img src={thumbOf(p)} alt="" className="size-full object-cover" />}</div>
                <div className="min-w-0 flex-1"><div className="truncate text-sm text-slate-200">{p.caption || "Sin copy"}</div>
                  <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: st.color }}>{isAdmin ? st.label : st.client}</span></div>
              </button>); })}</div>
          ) : <p className="text-sm text-slate-500">Nada programado este día.</p>}
          {undated.length > 0 && <>
            <div className="mb-2 mt-5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">Sin fecha <Badge color="slate">{undated.length}</Badge></div>
            <div className="grid grid-cols-4 gap-1">{undated.slice(0, 12).map((p) => <button key={p.id} onClick={() => onOpen(p)} className="aspect-square overflow-hidden rounded bg-white/5">{thumbOf(p) && <img src={thumbOf(p)} alt="" className="size-full object-cover" />}</button>)}</div>
          </>}
        </Card>
      </div>
    </div>
  );
}
