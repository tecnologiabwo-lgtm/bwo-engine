import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { LineChart, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { useAuth } from "@/features/auth/auth";
import { useClient } from "@/features/clients/clientContext";
import { AnimatedNumber, PriceWithDiff } from "@/shared/ui/number";
import { Badge, Button, Card, Empty, ErrorBox, PageHeader, Spinner } from "@/shared/ui/primitives";
import { useToast } from "@/shared/ui/toast";
import { money, num, cn } from "@/shared/lib/utils";
import { rollup } from "./lib/stats.js";
import { loadHistory, deleteMonth } from "./historyApi.js";

const G = [["month", "Mensual"], ["quarter", "Trimestral"], ["year", "Anual"]];
const INT = { maximumFractionDigits: 0 };
const ORG_LABELS = { reach: "Alcance", views: "Visualizaciones", profileVisits: "Visitas al perfil", followers: "Seguidores nuevos", interactions: "Interacciones", linkClicks: "Clics en el enlace", viewers: "Espectadores", visits: "Visitas" };

function Delta({ v, inverse = false, label }) {
  if (v == null) return <span className="text-[11px] text-slate-500">{label}: sin dato</span>;
  const good = inverse ? v < 0 : v > 0;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold", good ? "text-emerald-300" : v === 0 ? "text-slate-400" : "text-red-300")}>
      {v >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}{(v * 100).toFixed(1)}% {label}
    </span>
  );
}

export default function HistoricoApp() {
  const { isAdmin } = useAuth();
  const { clientId, client } = useClient();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [g, setG] = useState("month");
  const [sel, setSel] = useState(null);

  const load = async () => { try { setData(await loadHistory(clientId)); setErr(""); } catch (e) { setErr(e.message); } };
  useEffect(() => { setData(null); setSel(null); load(); }, [clientId]);
  const periods = useMemo(() => (data ? rollup(data.ads, data.organic, g) : []), [data, g]);
  useEffect(() => { if (periods.length && !periods.some((p) => p.key === sel)) setSel(periods.at(-1).key); }, [periods, sel]);
  const cur = periods.find((p) => p.key === sel);
  const currency = data?.months?.at(-1)?.currency || "USD";
  const m$ = (n) => money(n).replace("$", currency === "USD" ? "$" : `${currency} `);
  const maxSpend = Math.max(1, ...periods.map((p) => p.spend));
  const maxCpl = Math.max(1, ...periods.map((p) => p.cpl || 0));

  const remove = async (month) => {
    if (!confirm(`¿Eliminar ${month.slice(0, 7)} del histórico de ${client?.name}?`)) return;
    try { await deleteMonth(clientId, month); toast("Mes eliminado del histórico"); load(); } catch (e) { toast(e.message, "error"); }
  };

  if (err) return <ErrorBox error={`No se pudo cargar el histórico: ${err}`} onRetry={load} />;
  if (!data) return <Spinner variant="page" />;
  return (
    <div>
      <PageHeader eyebrow={client?.name} title="Histórico de resultados"
        subtitle={isAdmin ? "Meses guardados desde el Consolidador (Publicar → Guardar en el histórico). Revisa por mes, trimestre o año y compara con el período anterior y con el mismo período del año pasado." : "Evolución de tu inversión y resultados en Meta, mes a mes, por trimestre y por año."}
        actions={<div className="flex gap-1 rounded-xl bg-white/5 p-1">{G.map(([k, l]) => (
          <button key={k} onClick={() => setG(k)} className={cn("relative rounded-lg px-3 py-1.5 text-xs font-bold", g === k ? "text-bwo-inkDeep" : "text-slate-300")}>
            {g === k && <motion.span layoutId="hist-g" className="absolute inset-0 rounded-lg bg-white" />}<span className="relative">{l}</span>
          </button>))}</div>} />

      {!periods.length ? <Empty icon={LineChart} title="Aún no hay meses guardados">{isAdmin ? "En el Consolidador, carga los archivos del mes y en «Publicar» usa «Guardar en el histórico»." : "Pronto verás aquí la evolución de tus resultados."}</Empty> : (<>
        <Card className="mb-5 p-4">
          <div className="mb-2 flex items-baseline justify-between text-xs text-slate-400"><span>Inversión por período (barras) y costo por resultado (punto)</span><span>Toca un período para ver su detalle</span></div>
          <div className="flex h-40 items-end gap-2 overflow-x-auto pb-1">
            {periods.map((p) => (
              <button key={p.key} onClick={() => setSel(p.key)} className="group flex h-full min-w-[46px] flex-1 flex-col items-center justify-end gap-1" title={`${p.label}: ${m$(p.spend)} · CPL ${p.cpl == null ? "—" : m$(p.cpl)}`}>
                <div className="relative flex w-full flex-1 items-end">
                  <motion.div className={cn("w-full rounded-t-md", p.key === sel ? "bg-bwo-cerise" : "bg-bwo-violet/60 group-hover:bg-bwo-violet")} initial={{ height: 0 }} animate={{ height: `${(p.spend / maxSpend) * 100}%` }} transition={{ type: "spring", bounce: 0, duration: 0.6 }} />
                  {p.cpl != null && <span className="absolute left-1/2 size-2 -translate-x-1/2 rounded-full bg-bwo-amber ring-2 ring-bwo-inkDeep" style={{ bottom: `${(p.cpl / maxCpl) * 100}%` }} />}
                </div>
                <span className={cn("whitespace-nowrap text-[10px]", p.key === sel ? "font-bold text-white" : "text-slate-500")}>{p.label}{!p.complete && "*"}</span>
              </button>
            ))}
          </div>
          {periods.some((p) => !p.complete) && <p className="mt-1 text-[11px] text-slate-500">* Período con meses faltantes en el histórico.</p>}
        </Card>

        {cur && (<>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-extrabold text-white">{cur.label}</h2>
            {!cur.complete && <Badge color="amber">{cur.months} de {g === "year" ? 12 : g === "quarter" ? 3 : 1} meses</Badge>}
            {cur.prorated && <Badge color="slate">incluye cifras estimadas por días</Badge>}
          </div>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="p-4"><div className="text-[11px] uppercase tracking-widest text-slate-400">Inversión</div>
              {cur.vsPrev?.spend != null ? <PriceWithDiff value={cur.spend} diff={cur.vsPrev.spend} size="text-2xl" className="mt-1 text-white" /> : <AnimatedNumber value={cur.spend} className="text-2xl font-black text-white" />}
              <div className="mt-1"><Delta v={cur.vsYear?.spend} label="vs. año anterior" /></div></Card>
            <Card className="p-4"><div className="text-[11px] uppercase tracking-widest text-slate-400">Resultados</div>
              <AnimatedNumber value={cur.results} format={INT} className="text-2xl font-black text-bwo-turquoise" />
              <div className="mt-1 flex flex-col"><Delta v={cur.vsPrev?.results} label="vs. anterior" /><Delta v={cur.vsYear?.results} label="vs. año anterior" /></div></Card>
            <Card className="p-4"><div className="text-[11px] uppercase tracking-widest text-slate-400">Costo por resultado</div>
              <div className="text-2xl font-black text-white">{cur.cpl == null ? "—" : <AnimatedNumber value={cur.cpl} />}</div>
              <div className="mt-1 flex flex-col"><Delta v={cur.vsPrev?.cpl} inverse label="vs. anterior" /><Delta v={cur.vsYear?.cpl} inverse label="vs. año anterior" /></div></Card>
            <Card className="p-4"><div className="text-[11px] uppercase tracking-widest text-slate-400">Impresiones</div>
              <AnimatedNumber value={cur.impressions} format={INT} className="text-2xl font-black text-white" />
              <div className="text-xs text-slate-500">CPM {cur.cpm == null ? "—" : m$(cur.cpm)} · alcance sumado {num(cur.reach)}</div></Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
            <Card className="overflow-x-auto p-0">
              <div className="px-4 pt-4 text-sm font-bold text-white">Campañas del período</div>
              <table className="mt-2 w-full min-w-[560px] text-sm">
                <thead><tr className="text-left text-[11px] uppercase tracking-widest text-slate-500">{["Entidad", "Objetivo", "Inversión", "Resultados", "Costo/res."].map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}</tr></thead>
                <tbody>{cur.entities.map((e) => (
                  <tr key={e.entity} className="border-t border-white/5"><td className="px-4 py-2 font-semibold text-white">{e.entity}</td><td className="px-4 text-slate-400">{e.objective || "—"}</td>
                    <td className="px-4 tabular-nums">{m$(e.spend)}</td><td className="px-4 tabular-nums">{num(e.results)}</td><td className="px-4 tabular-nums">{e.cpl == null ? "—" : m$(e.cpl)}</td></tr>))}
                  {!cur.entities.length && <tr><td className="px-4 py-3 text-slate-500" colSpan={5}>Sin pauta en este período.</td></tr>}
                </tbody>
              </table>
            </Card>
            <div className="space-y-5">
              <Card><div className="mb-2 text-sm font-bold text-white">Por objetivo</div>
                {Object.entries(cur.byObjective).map(([k, v]) => (
                  <div key={k} className="flex justify-between border-t border-white/5 py-2 text-sm first:border-0"><span className="text-slate-300">{k}</span><span className="tabular-nums text-white">{m$(v.spend)} · {num(v.results)} res. · {v.cpl == null ? "—" : m$(v.cpl)}</span></div>))}
              </Card>
              <Card><div className="mb-2 text-sm font-bold text-white">Orgánico</div>
                {Object.keys(cur.organic).length ? Object.entries(cur.organic).sort().map(([k, v]) => {
                  const [pl, metric] = k.split(".");
                  return <div key={k} className="flex justify-between border-t border-white/5 py-2 text-sm first:border-0"><span className="text-slate-300">{ORG_LABELS[metric] || metric} <span className="text-slate-500">· {pl === "facebook" ? "Facebook" : "Instagram"}</span></span><span className="tabular-nums text-white">{num(v)}</span></div>;
                }) : <p className="text-xs text-slate-500">Sin métricas orgánicas guardadas.</p>}
              </Card>
            </div>
          </div>
        </>)}

        <Card className="mt-5 overflow-x-auto p-0">
          <div className="px-4 pt-4 text-sm font-bold text-white">Todos los períodos</div>
          <table className="mt-2 w-full min-w-[640px] text-sm">
            <thead><tr className="text-left text-[11px] uppercase tracking-widest text-slate-500">{["Período", "Inversión", "Resultados", "Costo/res.", "vs. anterior", "vs. año anterior"].map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}</tr></thead>
            <tbody>{[...periods].reverse().map((p) => (
              <tr key={p.key} onClick={() => setSel(p.key)} className={cn("cursor-pointer border-t border-white/5 hover:bg-white/5", p.key === sel && "bg-white/[0.06]")}>
                <td className="px-4 py-2 font-semibold text-white">{p.label}{!p.complete && "*"}</td><td className="px-4 tabular-nums">{m$(p.spend)}</td><td className="px-4 tabular-nums">{num(p.results)}</td>
                <td className="px-4 tabular-nums">{p.cpl == null ? "—" : m$(p.cpl)}</td><td className="px-4"><Delta v={p.vsPrev?.spend} label="" /></td><td className="px-4"><Delta v={p.vsYear?.spend} label="" /></td>
              </tr>))}</tbody>
          </table>
        </Card>

        {isAdmin && (
          <Card className="mt-5">
            <div className="mb-2 text-sm font-bold text-white">Meses guardados</div>
            <div className="flex flex-wrap gap-2">{data.months.map((m) => (
              <span key={m.month} className="inline-flex items-center gap-2 rounded-full bg-white/10 py-1 pl-3 pr-1 text-xs text-slate-200" title={`Guardado ${new Date(m.saved_at).toLocaleString("es-ES")} · ${(m.sources || []).join(", ")}`}>
                {m.month.slice(0, 7)}<button onClick={() => remove(m.month)} className="grid size-5 place-items-center rounded-full hover:bg-white/20" aria-label={`Eliminar ${m.month}`}><Trash2 className="size-3" /></button>
              </span>))}</div>
          </Card>
        )}
      </>)}
    </div>
  );
}
