import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { FileBarChart, Trash2, Printer } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useClient } from "@/lib/clientContext";
import { supabase, run } from "@/lib/supabase";
import { money, num, cn } from "@/lib/utils";
import { AnimatedNumber, PriceWithDiff } from "@/components/ui/number";
import { Badge, Button, Card, Empty, ErrorBox, PageHeader, Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

const INT = { maximumFractionDigits: 0 };
const sum = (arr, k) => arr.reduce((a, c) => a + (Number(c[k]) || 0), 0);
const fmtPeriod = (r) => `${new Date(r.period_from + "T12:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" })} – ${new Date(r.period_to + "T12:00").toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}`;

/** Totales del reporte a partir del snapshot guardado por el Consolidador. */
function totals(data) {
  const c = data?.campaigns || [];
  const spend = sum(c, "spend"), results = sum(c, "results"), impressions = sum(c, "impressions");
  const series = data?.series || {};
  const s = (k) => (series[k] || []).reduce((a, r) => a + (Number(r.value) || 0), 0);
  return { spend, results, impressions, cpl: results ? spend / results : null, cpm: impressions ? (spend / impressions) * 1000 : null,
    reach: s("reach"), followers: s("followers"), interactions: s("interactions"), campaigns: c };
}

/** Markdown mínimo y seguro: títulos ##, viñetas y negritas. Sin HTML del usuario. */
function Analysis({ text }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed text-slate-200">
      {text.split("\n").map((line, i) => {
        const parts = line.replace(/^[-*]\s+/, "").split(/(\*\*[^*]+\*\*)/g).map((p, k) => p.startsWith("**") ? <b key={k} className="text-white">{p.slice(2, -2)}</b> : p);
        if (/^##\s+/.test(line)) return <h3 key={i} className="pt-2 text-base font-bold text-white">{line.replace(/^##\s+/, "")}</h3>;
        if (/^[-*]\s+/.test(line)) return <div key={i} className="flex gap-2"><span className="text-bwo-cerise">•</span><span>{parts}</span></div>;
        return line.trim() ? <p key={i}>{parts}</p> : null;
      })}
    </div>
  );
}

export default function ReportesApp() {
  const { isAdmin } = useAuth();
  const { clientId, client } = useClient();
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [sel, setSel] = useState(null);

  const load = async () => {
    try {
      const r = await run(supabase.from("reports").select("*").eq("client_id", clientId).order("period_from", { ascending: false }));
      setRows(r); setSel((s) => (r.some((x) => x.id === s) ? s : r[0]?.id || null)); setErr("");
    } catch (e) { setErr(e.message); setRows([]); }
  };
  useEffect(() => { setRows(null); load(); }, [clientId]);

  const idx = rows?.findIndex((r) => r.id === sel) ?? -1;
  const cur = idx >= 0 ? rows[idx] : null;
  const prev = idx >= 0 ? rows[idx + 1] : null;
  const t = useMemo(() => (cur ? totals(cur.data) : null), [cur]);
  const tp = useMemo(() => (prev ? totals(prev.data) : null), [prev]);
  const diff = (a, b) => (b ? (a - b) / b : 0);

  const del = async () => {
    if (!confirm("¿Eliminar este reporte del portal del cliente?")) return;
    try { await run(supabase.from("reports").delete().eq("id", cur.id)); toast("Reporte eliminado"); load(); } catch (e) { toast(e.message, "error"); }
  };

  if (err) return <ErrorBox error={`No se pudieron cargar los reportes: ${err}`} onRetry={load} />;
  if (!rows) return <Spinner />;
  return (
    <div>
      <PageHeader eyebrow={client?.name} title={isAdmin ? "Reportes publicados" : "Mis reportes"}
        subtitle={isAdmin ? "Lo que cada cliente ve en su portal. Se publican desde el Consolidador → Publicar." : "Resultados de tu inversión en Meta Ads y del contenido orgánico, período a período."}
        actions={cur && <>
          <Button size="sm" variant="ghost" onClick={() => window.print()}><Printer className="size-4" />Imprimir</Button>
          {isAdmin && <Button size="sm" variant="ghost" onClick={del}><Trash2 className="size-4" />Eliminar</Button>}
        </>} />
      {!rows.length ? <Empty icon={FileBarChart} title="Aún no hay reportes">{isAdmin ? "Publica uno desde el Consolidador." : "Cuando BWO publique tu primer reporte, lo verás aquí."}</Empty> : (
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <div className="space-y-1.5">
            {rows.map((r) => (
              <button key={r.id} onClick={() => setSel(r.id)} className={cn("relative w-full rounded-xl px-3 py-2.5 text-left text-sm", r.id === sel ? "text-white" : "text-slate-400 hover:bg-white/5")}>
                {r.id === sel && <motion.span layoutId="rep-pill" className="absolute inset-0 rounded-xl border border-white/15 bg-white/10" />}
                <span className="relative block font-semibold">{fmtPeriod(r)}</span>
                <span className="relative block text-[11px] text-slate-500">Publicado {new Date(r.published_at).toLocaleDateString("es-ES")}</span>
              </button>
            ))}
          </div>
          {cur && t && (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Card className="p-4"><div className="text-[11px] uppercase tracking-widest text-slate-400">Inversión</div>
                  {tp ? <PriceWithDiff value={t.spend} diff={diff(t.spend, tp.spend)} size="text-2xl" className="mt-1 text-white" /> : <AnimatedNumber value={t.spend} className="text-2xl font-black text-white" />}</Card>
                <Card className="p-4"><div className="text-[11px] uppercase tracking-widest text-slate-400">Resultados</div><AnimatedNumber value={t.results} format={INT} className="text-2xl font-black text-bwo-turquoise" />
                  {tp && <div className="text-xs text-slate-500">antes {num(tp.results)}</div>}</Card>
                <Card className="p-4"><div className="text-[11px] uppercase tracking-widest text-slate-400">Costo por resultado</div><div className="text-2xl font-black text-white">{t.cpl == null ? "—" : <AnimatedNumber value={t.cpl} />}</div>
                  {tp?.cpl && t.cpl && <Badge color={t.cpl <= tp.cpl ? "turquoise" : "red"}>{t.cpl <= tp.cpl ? "▼" : "▲"} {Math.abs(diff(t.cpl, tp.cpl) * 100).toFixed(1)}% vs. período anterior</Badge>}</Card>
                <Card className="p-4"><div className="text-[11px] uppercase tracking-widest text-slate-400">Impresiones</div><AnimatedNumber value={t.impressions} format={INT} className="text-2xl font-black text-white" />
                  <div className="text-xs text-slate-500">CPM {money(t.cpm)}</div></Card>
              </div>
              {cur.analysis && <Card><div className="mb-2 text-xs font-bold uppercase tracking-widest text-bwo-amber">Lectura del período</div><Analysis text={cur.analysis} /></Card>}
              {!!t.campaigns.length && (
                <Card className="overflow-x-auto p-0">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead><tr className="text-left text-[11px] uppercase tracking-widest text-slate-500">{["Campaña", "Objetivo", "Inversión", "Resultados", "Costo/res.", "Alcance"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
                    <tbody>{t.campaigns.map((c, i) => (
                      <tr key={i} className="border-t border-white/5">
                        <td className="px-4 py-2.5 font-semibold text-white">{c.name}</td><td className="px-4 text-slate-400">{c.objective || "—"}</td>
                        <td className="px-4 tabular-nums">{money(c.spend)}</td><td className="px-4 tabular-nums">{num(c.results)}</td>
                        <td className="px-4 tabular-nums">{money(c.cpl)}</td><td className="px-4 tabular-nums">{num(c.reach)}</td>
                      </tr>))}</tbody>
                  </table>
                </Card>
              )}
              {(t.reach > 0 || t.followers > 0) && (
                <div className="grid gap-3 sm:grid-cols-3">
                  {[["Alcance orgánico", t.reach], ["Seguidores nuevos", t.followers], ["Interacciones", t.interactions]].map(([l, v]) => (
                    <Card key={l} className="p-4"><div className="text-[11px] uppercase tracking-widest text-slate-400">{l}</div><AnimatedNumber value={v} format={INT} className="text-2xl font-black text-white" /></Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
