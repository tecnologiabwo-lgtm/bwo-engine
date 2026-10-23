import { fm, isVideo, timing, statusLabel, STATUS_COLOR, RANK, issues, factRows, blocksDone, todayISO, diffDays } from "@/lib/sala";
import { shortDate, cn, parseDate } from "@/lib/utils";
import { Badge, Button, Card, Empty } from "@/components/ui/primitives";
import { CalendarX2 } from "lucide-react";

export function Flags({ p }) {
  const t = timing(p);
  return (
    <span className="flex flex-wrap gap-1">
      {t.late && <Badge color="red">Atrasada</Badge>}
      {!t.late && t.soon && RANK[p.status] < 6 && <Badge color="amber">Vence {shortDate(t.next.due)}</Badge>}
      {p.decision?.q && p.choice == null && <Badge color="amber">Decidir</Badge>}
      {p.status === "cambios" && <Badge color="cerise">Cambios pedidos</Badge>}
      {!!p.gaps?.length && <Badge color="slate">Datos faltantes</Badge>}
    </span>
  );
}

export function Row({ p, extra, onOpen }) {
  return (
    <button onClick={() => onOpen(p.id)} className="grid w-full grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left hover:border-white/20" style={{ borderLeft: `3px solid ${fm(p).c}` }}>
      <span className="text-xs font-semibold text-white">{shortDate(p.date)}<small className="block font-medium" style={{ color: fm(p).c }}>{fm(p).n}</small></span>
      <span className="min-w-0"><b className="block truncate text-sm text-white">{p.title}{p.num ? ` · #${p.num}` : ""}</b><span className="block truncate text-xs text-slate-400">{extra || statusLabel(p.status, p)}</span></span>
      <Flags p={p} />
    </button>
  );
}

function Section({ title, sub, items, empty, extra, onOpen }) {
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-baseline justify-between"><h3 className="text-sm font-bold text-white">{title}</h3><span className="text-xs text-slate-500">{items.length}</span></div>
      {sub && <p className="mb-2 text-xs text-slate-500">{sub}</p>}
      <div className="space-y-2">{items.length ? items.map((p) => <Row key={p.id} p={p} onOpen={onOpen} extra={extra?.(p)} />) : <p className="text-xs text-slate-500">{empty}</p>}</div>
    </Card>
  );
}

export function TodayView({ list, isAdmin, onOpen }) {
  const today = todayISO();
  const late = list.filter((p) => timing(p).late);
  const toApprove = list.filter((p) => p.status === "aprobacion");
  const decisions = list.filter((p) => p.decision?.q && p.choice == null);
  const toShoot = list.filter((p) => isVideo(p) && p.status === "produccion");
  const changes = list.filter((p) => p.status === "cambios");
  const week = list.filter((p) => { const d = diffDays(p.date, today); return d >= 0 && d <= 6; });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {isAdmin && <Section title="Atrasadas" sub="Piezas que no llegaron a su hito a tiempo." items={late} empty="Nada atrasado." onOpen={onOpen} extra={(p) => { const t = timing(p).late; return `${t.n} debía estar el ${shortDate(t.due)}`; }} />}
      <Section title={isAdmin ? "Esperando aprobación del cliente" : "Por aprobar"} sub={isAdmin ? "" : "Abre cada guion, revísalo y apruébalo o pide cambios."} items={toApprove} empty="No hay guiones esperando aprobación." onOpen={onOpen} extra={(p) => `Se publica el ${shortDate(p.date)}`} />
      <Section title="Decisiones pendientes" items={decisions} empty="No hay decisiones abiertas." onOpen={onOpen} extra={(p) => p.decision.q} />
      <Section title={isAdmin ? "Por grabar" : "Te toca grabar"} items={toShoot} empty="No hay grabaciones pendientes." onOpen={onOpen} extra={(p) => `${p.setup || "Vocero"}${p.dur_max ? ` · ${p.dur_min || 0}–${p.dur_max} s` : ""}`} />
      {isAdmin && <Section title="Cambios pedidos" sub="Revisa el comentario, ajusta y reenvía a aprobación." items={changes} empty="Ningún cambio pendiente." onOpen={onOpen} />}
      <Section title="Se publica esta semana" items={week} empty="Nada programado en los próximos 7 días." onOpen={onOpen} extra={(p) => `${statusLabel(p.status, p)} · ${shortDate(p.date)}`} />
    </div>
  );
}

export function CalendarView({ list, calendar, onOpen }) {
  const [y, m] = calendar.month.split("-").map(Number);
  const first = new Date(y, m - 1, 1), last = new Date(y, m, 0);
  // También muestra piezas fuera del mes del calendario: se amplía el rango a sus fechas
  const dates = list.map((p) => p.date).sort();
  const lo = dates[0] && parseDate(dates[0]) < first ? parseDate(dates[0]) : first;
  const hi = dates.length && parseDate(dates.at(-1)) > last ? parseDate(dates.at(-1)) : last;
  const start = new Date(lo); start.setDate(lo.getDate() - ((lo.getDay() + 6) % 7));
  const end = new Date(hi); end.setDate(hi.getDate() + (6 - ((hi.getDay() + 6) % 7)));
  const byDay = {}; list.forEach((p) => (byDay[p.date] = byDay[p.date] || []).push(p));
  const ms = {}; (calendar.milestones || []).forEach((x) => (ms[x.date] = ms[x.date] || []).push(x.label));
  const today = todayISO();
  const cells = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    cells.push({ k, n: d.getDate(), out: d.getMonth() !== m - 1 });
  }
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[860px] grid-cols-7 gap-1.5">
        {["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"].map((d) => <div key={d} className="px-1 text-[11px] font-bold tracking-widest text-slate-500">{d}</div>)}
        {cells.map((c) => (
          <div key={c.k} className={cn("flex min-h-[104px] flex-col gap-1 rounded-lg border p-1.5", c.out ? "border-dashed border-white/10 opacity-60" : "border-white/10 bg-white/[0.03]", c.k === today && "border-bwo-cerise")}>
            <div className="flex justify-between text-xs font-bold text-slate-300">{c.n}{c.k === today && <span className="text-bwo-cerise">Hoy</span>}</div>
            {(ms[c.k] || []).map((x) => <div key={x} className="text-[10px] font-bold text-bwo-amber">{x}</div>)}
            {(byDay[c.k] || []).map((p) => (
              <button key={p.id} onClick={() => onOpen(p.id)} className="flex items-start gap-1.5 rounded-md border border-white/10 bg-bwo-inkDeep/60 px-1.5 py-1 text-left text-[11px] leading-tight hover:border-white/30" style={{ borderLeft: `3px solid ${fm(p).c}` }}>
                <span className="mt-1 size-2 shrink-0 rounded-full" style={{ background: timing(p).late ? "#EF4444" : STATUS_COLOR[p.status] }} />
                <span className="min-w-0"><b className="block text-[10px]" style={{ color: fm(p).c }}>{fm(p).n}</b>{p.title}{p.num ? ` #${p.num}` : ""}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function BoardView({ list, onOpen }) {
  const cols = [["Borrador", ["borrador"]], ["Aprobación", ["aprobacion", "cambios"]], ["Aprobado", ["aprobado"]], ["Producción", ["produccion", "edicion"]], ["Listo", ["listo"]], ["Publicado", ["publicado"]]];
  return (
    <div className="grid auto-cols-[minmax(220px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2">
      {cols.map(([n, ss]) => {
        const items = list.filter((p) => ss.includes(p.status));
        return (
          <div key={n} className="flex flex-col gap-2 rounded-xl bg-white/[0.04] p-2.5">
            <h3 className="flex justify-between px-1 text-sm font-bold text-white">{n}<span className="text-slate-500">{items.length}</span></h3>
            {items.map((p) => (
              <button key={p.id} onClick={() => onOpen(p.id)} className="flex flex-col gap-1 rounded-lg border border-white/10 bg-bwo-inkDeep/60 p-2.5 text-left hover:border-white/25" style={{ borderLeft: `3px solid ${fm(p).c}` }}>
                <span className="flex justify-between text-[11px] text-slate-400"><span>{shortDate(p.date)}</span><span>{fm(p).n}</span></span>
                <span className="text-sm font-semibold text-white">{p.title}{p.num ? ` · #${p.num}` : ""}</span>
                <Flags p={p} />
              </button>
            ))}
            {!items.length && <p className="px-1 text-xs text-slate-500">Sin piezas</p>}
          </div>
        );
      })}
    </div>
  );
}

export function ShootView({ list, onOpen, onShoot }) {
  const reels = list.filter(isVideo);
  if (!reels.length) return <Empty icon={CalendarX2} title="Este calendario no tiene piezas de video" />;
  const groups = {};
  reels.forEach((p) => (groups[p.setup || "Sin montaje definido"] = groups[p.setup || "Sin montaje definido"] || []).push(p));
  const total = reels.reduce((a, p) => a + (p.dur_max || 0), 0);
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">{reels.length} reels · hasta {Math.floor(total / 60)} min {total % 60} s de video final · agrupados por montaje para grabar en una sola sesión</p>
      {Object.entries(groups).map(([setup, ps]) => {
        const props = [...new Set(ps.map((p) => p.props).filter(Boolean))];
        return (
          <Card key={setup} className="p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div><h3 className="font-bold text-white">{setup}</h3><p className="text-xs text-slate-400">{ps.length} {ps.length === 1 ? "pieza" : "piezas"}{props.length ? ` · Llevar: ${props.join("; ")}` : ""}</p></div>
              <Button size="sm" onClick={() => onShoot(ps.map((p) => p.id))}>Grabar este montaje</Button>
            </div>
            {ps.map((p) => {
              const n = (p.blocks || []).length, d = blocksDone(p);
              return (
                <div key={p.id} className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3 border-t border-white/10 py-2.5">
                  <span className="text-xs font-semibold text-slate-300">{shortDate(p.date)}</span>
                  <span className="min-w-0 text-sm"><b className="text-white">{p.title}{p.num ? ` · #${p.num}` : ""}</b>
                    <span className="block text-xs text-slate-400">{statusLabel(p.status, p)}{p.dur_max ? ` · ${p.dur_min || 0}–${p.dur_max} s` : ""} · {d}/{n} tomas</span>
                    {p.decision?.q && p.choice == null && <span className="block text-xs text-bwo-amber">Falta decidir: {p.decision.q}</span>}
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-white/10"><span className="block h-full bg-bwo-cerise" style={{ width: `${n ? (d / n) * 100 : 0}%` }} /></span>
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => onOpen(p.id)}>Ver guion</Button>
                </div>
              );
            })}
          </Card>
        );
      })}
    </div>
  );
}

export function QualityView({ list, calendar, onOpen }) {
  const iss = issues(list);
  const order = { late: 0, warn: 1, info: 2 };
  const tone = { late: "red", warn: "amber", info: "slate" };
  const group = (types, title, sub) => {
    const it = iss.filter((i) => types.includes(i.type)).sort((a, b) => order[a.sev] - order[b.sev] || a.p.date.localeCompare(b.p.date));
    return (
      <Card className="p-4">
        <h3 className="text-sm font-bold text-white">{title}</h3>{sub && <p className="mb-2 text-xs text-slate-500">{sub}</p>}
        {it.length ? it.map((i, k) => (
          <div key={k} className="flex items-start gap-3 border-t border-white/10 py-2 first:border-0">
            <Badge color={tone[i.sev]}>{shortDate(i.p.date)}</Badge>
            <div className="min-w-0 flex-1 text-sm"><b className="text-white">{i.p.title} · {i.t}</b><span className="block text-xs text-slate-400">{i.d}</span></div>
            <button className="text-xs font-bold text-bwo-ceriseLt" onClick={() => onOpen(i.p.id)}>Abrir</button>
          </div>
        )) : <p className="text-xs text-slate-500">Todo en orden.</p>}
      </Card>
    );
  };
  const series = {};
  list.forEach((p) => { if (p.series && p.num) (series[p.series] = series[p.series] || []).push(p.num); });
  const facts = list.flatMap((p) => factRows(p).map((f) => ({ p, f })));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {group(["plazo"], "Plazos", "Hitos calculados hacia atrás desde la fecha de publicación.")}
      {group(["cta"], "Promesas de los CTA", "Si el CTA promete algo, el recurso y la automatización deben existir antes de publicar.")}
      {group(["decision", "vacio"], "Decisiones y datos faltantes")}
      <Card className="p-4"><h3 className="text-sm font-bold text-white">Cifras del contenido</h3>
        {facts.length ? facts.map(({ p, f }, k) => (
          <div key={k} className="flex items-start gap-3 border-t border-white/10 py-2 first:border-0 text-sm">
            <Badge color={f.ok ? "turquoise" : "red"}>{f.ok ? "Cuadra" : "Revisar"}</Badge>
            <span className="flex-1"><b className="text-white">{f.label}</b><span className="block text-xs text-slate-400">Guion: {f.claim} {f.unit} · Cálculo: {f.v == null ? "—" : f.v.toLocaleString("es-ES", { maximumFractionDigits: 1 })} {f.unit} · {p.title}</span></span>
          </div>
        )) : <p className="text-xs text-slate-500">Sin cifras registradas.</p>}
      </Card>
      <Card className="p-4"><h3 className="text-sm font-bold text-white">Continuidad de series</h3>
        {Object.keys(series).length ? Object.entries(series).map(([s, nums]) => {
          const max = Math.max(...nums), miss = []; for (let i = 1; i <= max; i++) if (!nums.includes(i)) miss.push(i);
          return <div key={s} className="flex gap-3 border-t border-white/10 py-2 first:border-0 text-sm"><Badge color={miss.length ? "amber" : "turquoise"}>{nums.length} partes</Badge><span><b className="text-white">{s}</b><span className="block text-xs text-slate-400">{miss.length ? `Falta: #${miss.join(", #")} (¿publicada el mes anterior?)` : `Numeración completa #1–#${max}`}</span></span></div>;
        }) : <p className="text-xs text-slate-500">No hay series numeradas.</p>}
      </Card>
      <Card className="p-4"><h3 className="text-sm font-bold text-white">Hitos externos</h3>
        {(calendar.milestones || []).length ? calendar.milestones.map((m, k) => (
          <div key={k} className="flex gap-3 border-t border-white/10 py-2 first:border-0 text-sm"><Badge color="slate">{shortDate(m.date)}</Badge><span className="text-white">{m.label}</span></div>
        )) : <p className="text-xs text-slate-500">Sin hitos registrados.</p>}
      </Card>
    </div>
  );
}
