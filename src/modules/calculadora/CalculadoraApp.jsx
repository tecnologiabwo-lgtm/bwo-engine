import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Link2, Unlink, Printer } from "lucide-react";
import { automation, funnel, roi } from "@/lib/roi";
import { money, num, cn } from "@/lib/utils";
import { AnimatedNumber, PriceWithDiff } from "@/components/ui/number";
import { Button, Card, PageHeader } from "@/components/ui/primitives";

const PRESETS = {
  demo: { label: "Ejemplo captura (50 acc.)", actions: 50, minutes: 2, salary: 18000 },
  pyme: { label: "Pyme, 1 mes", actions: 1500, minutes: 2, salary: 18000 },
  agencia: { label: "Agencia, 1 mes", actions: 6000, minutes: 3, salary: 24000 },
};
const PCT = { style: "percent", maximumFractionDigits: 1 };
const INT = { style: "decimal", maximumFractionDigits: 0 };

function NumField({ label, hint, value, onChange, suffix, step = 1, min = 0, max }) {
  return (
    <label className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-dashed border-white/10 py-3 last:border-0">
      <span className="text-sm font-medium text-slate-200">{label}{hint && <small className="block text-xs font-normal text-slate-500">{hint}</small>}</span>
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 focus-within:border-bwo-violet">
        <input type="number" value={value} min={min} max={max} step={step} onChange={(e) => onChange(e.target.value === "" ? 0 : +e.target.value)}
          className="w-24 bg-transparent py-2 text-right font-mono text-sm font-bold text-white outline-none" />
        {suffix && <span className="text-xs text-slate-400">{suffix}</span>}
      </span>
    </label>
  );
}
const Out = ({ k, sub, children, big }) => (
  <div className="flex items-baseline justify-between gap-3 border-b border-white/10 py-3 last:border-0">
    <span className="text-sm text-slate-300">{k}{sub && <small className="block text-xs text-slate-500">{sub}</small>}</span>
    <span className={cn("text-right font-mono font-bold text-white", big ? "text-3xl text-bwo-turquoise" : "text-lg")}>{children}</span>
  </div>
);

export default function CalculadoraApp() {
  const [tab, setTab] = useState(0);
  const [a, setA] = useState({ actions: 1500, minutes: 2, salary: 18000, weeklyHours: 40 });
  const [preset, setPreset] = useState("pyme");
  const [f, setF] = useState({ leads: 1000, ticket: 500, base: { r: 80, q: 50, w: 30 }, up: { r: 95, q: 60, w: 35 } });
  const [r, setR] = useState({ setup: 1500, monthly: 100, margin: 30, savings: 400, sales: 5 });
  const [linked, setLinked] = useState(false);   // arranca con los valores del documento; un clic lo conecta a las pestañas 1 y 2

  const auto = useMemo(() => automation(a), [a]);
  const fb = useMemo(() => funnel(f.leads, f.base), [f]);
  const fu = useMemo(() => funnel(f.leads, f.up), [f]);
  const deltaSales = fu.won - fb.won;
  const deltaRev = deltaSales * f.ticket;
  // Pestañas conectadas: por defecto el ROI toma el ahorro (pestaña 1) y las ventas extra (pestaña 2)
  const savings = linked ? auto.savings : r.savings;
  const sales = linked ? deltaSales : r.sales;
  const res = useMemo(() => roi({ setup: r.setup, monthly: r.monthly, savings, sales, ticket: f.ticket, margin: r.margin }), [r, savings, sales, f.ticket]);

  const setStage = (which, k, v) => setF((x) => ({ ...x, [which]: { ...x[which], [k]: Math.max(0, Math.min(100, v)) } }));
  const tabs = ["Ahorro por automatización", "Simulador de embudo", "ROI y recuperación"];
  const maxAcc = Math.max(1, ...res.curve.map((c) => Math.abs(c.acc)));

  return (
    <div>
      <PageHeader eyebrow="Academia BigWay · Clientify" title="El CRM se paga solo. Demostrémoslo con tus números."
        subtitle="Tres calculadoras conectadas: lo que ahorras automatizando y las ventas extra del embudo alimentan el ROI. Todo en USD."
        actions={<Button variant="ghost" size="sm" onClick={() => window.print()}><Printer className="size-4" />Imprimir</Button>} />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Ahorro mensual", <AnimatedNumber key="a" value={auto.savings} />, "text-bwo-turquoise"],
          ["Ingresos extra / mes", <AnimatedNumber key="b" value={deltaRev} />, "text-bwo-ceriseLt"],
          ["Beneficio mensual neto", <AnimatedNumber key="c" value={res.benefit} />, "text-white"],
          ["Recuperación", isFinite(res.payback) ? <AnimatedNumber key="d" value={res.payback} format={{ maximumFractionDigits: 1 }} suffix=" meses" /> : "No se paga", "text-bwo-amber"],
        ].map(([l, v, c]) => (
          <Card key={l} className="p-4"><div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{l}</div><div className={cn("mt-1 text-2xl font-black", c)}>{v}</div></Card>
        ))}
      </div>

      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-white/10" role="tablist">
        {tabs.map((t, i) => (
          <button key={t} role="tab" aria-selected={tab === i} onClick={() => setTab(i)}
            className={cn("relative whitespace-nowrap px-4 py-3 text-sm font-semibold", tab === i ? "text-white" : "text-slate-400 hover:text-slate-200")}>
            <span className="mr-2 font-mono text-[11px] text-slate-500">0{i + 1}</span>{t}
            {tab === i && <motion.span layoutId="calc-tab" className="absolute inset-x-2 -bottom-px h-0.5 bg-bwo-cerise" />}
          </button>
        ))}
      </div>

      {tab === 0 && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <div className="mb-3 flex flex-wrap gap-2">
              {Object.entries(PRESETS).map(([k, p]) => (
                <button key={k} onClick={() => { setPreset(k); setA((x) => ({ ...x, actions: p.actions, minutes: p.minutes, salary: p.salary })); }}
                  className={cn("rounded-full px-3 py-1 text-xs font-semibold", preset === k ? "bg-bwo-cerise text-white" : "bg-white/5 text-slate-300")}>{p.label}</button>
              ))}
            </div>
            <NumField label="Acciones automatizadas" hint="bot + automatizaciones + plantillas, en el mes" value={a.actions} step={10} onChange={(v) => { setPreset(null); setA({ ...a, actions: v }); }} />
            <NumField label="Minutos por acción manual" hint="responder, calificar, agendar" value={a.minutes} step={0.5} suffix="min" onChange={(v) => setA({ ...a, minutes: v })} />
            <NumField label="Salario bruto anual" hint="de quien atendería manualmente" value={a.salary} step={500} suffix="USD" onChange={(v) => setA({ ...a, salary: v })} />
            <NumField label="Jornada semanal" value={a.weeklyHours} min={1} suffix="h/sem" onChange={(v) => setA({ ...a, weeklyHours: v })} />
          </Card>
          <Card>
            <Out k="Ahorro en el mes" sub="horas evitadas × costo por hora" big><AnimatedNumber value={auto.savings} /></Out>
            <Out k="Horas evitadas"><AnimatedNumber value={auto.hours} format={{ maximumFractionDigits: 1 }} suffix=" h" /></Out>
            <Out k="Jornadas completas" sub="a 8 h por día"><AnimatedNumber value={auto.days} format={{ maximumFractionDigits: 1 }} /></Out>
            <Out k="Equivale a" sub="meses laborales de un empleado"><AnimatedNumber value={auto.months} format={{ maximumFractionDigits: 2 }} /></Out>
            <Out k="Costo por hora" sub="salario ÷ (horas/sem × 52)"><AnimatedNumber value={auto.rate} /></Out>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              {[[1, "Mes"], [3, "Trimestre"], [12, "Año"]].map(([m, l]) => (
                <div key={m} className="rounded-xl bg-white/5 p-3"><div className="text-slate-400">{l}</div><div className="font-mono text-base font-bold text-white">{money(auto.savings * m)}</div><div className="text-slate-500">{num(auto.hours * m)} h</div></div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === 1 && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <NumField label="Prospectos recibidos" hint="mensuales" value={f.leads} step={10} onChange={(v) => setF({ ...f, leads: v })} />
            <NumField label="Ticket promedio" hint="por venta ganada" value={f.ticket} step={10} suffix="USD" onChange={(v) => setF({ ...f, ticket: v })} />
            <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-2 text-sm">
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Tasa</span><span className="text-[11px] font-bold uppercase text-slate-500">Base</span><span className="text-[11px] font-bold uppercase text-slate-500">Mejorado</span>
              {[["r", "Respondidos", "del total"], ["q", "Calificados", "sobre respondidos"], ["w", "Ganados", "sobre calificados"]].map(([k, l, h]) => (
                <div key={k} className="contents">
                  <span className="text-slate-200">{l}<small className="block text-xs text-slate-500">{h}</small></span>
                  {["base", "up"].map((w) => (
                    <span key={w} className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2">
                      <input type="number" min={0} max={100} value={f[w][k]} onChange={(e) => setStage(w, k, +e.target.value || 0)} className="w-12 bg-transparent py-1.5 text-right font-mono font-bold text-white outline-none" /><span className="text-xs text-slate-400">%</span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <div className="mb-4 space-y-2">
              {[["Prospectos", f.leads], ["Respondidos", fu.resp], ["Calificados", fu.qual], ["Ganados", fu.won]].map(([l, n], i) => (
                <div key={l} className="grid grid-cols-[96px_1fr_64px] items-center gap-3 text-sm">
                  <span className="text-slate-300">{l}</span>
                  <div className="h-6 overflow-hidden rounded-md bg-white/5"><motion.div className="h-full rounded-md" animate={{ width: `${Math.max(2, (n / Math.max(1, f.leads)) * 100)}%` }} transition={{ type: "spring", bounce: 0, duration: 0.6 }}
                    style={{ background: i === 3 ? "#E6197E" : "linear-gradient(90deg,#22D3C5,#6C3BF5)" }} /></div>
                  <span className="text-right font-mono font-bold tabular-nums"><AnimatedNumber value={Math.round(n)} format={INT} /></span>
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-white/5 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Ingresos mensuales con mejoras</div>
              <PriceWithDiff value={fu.won * f.ticket} diff={fb.won ? (fu.won - fb.won) / fb.won : 0} size="text-3xl" className="mt-1 text-white" />
            </div>
            <Out k="Ingresos adicionales / mes" sub="mejorado − base"><AnimatedNumber value={deltaRev} /></Out>
            <Out k="Ventas adicionales / mes"><AnimatedNumber value={deltaSales} format={{ maximumFractionDigits: 1, signDisplay: "always" }} /></Out>
            <Out k="Conversión total"><span className="text-slate-400"><AnimatedNumber value={fb.conv} format={PCT} /></span> → <AnimatedNumber value={fu.conv} format={PCT} className="text-bwo-turquoise" /></Out>
          </Card>
        </div>
      )}

      {tab === 2 && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <NumField label="Inversión inicial" hint="implementación BigWay" value={r.setup} step={50} suffix="USD" onChange={(v) => setR({ ...r, setup: v })} />
            <NumField label="Costo mensual" hint="licencia Clientify + Meta + IA" value={r.monthly} step={10} suffix="USD" onChange={(v) => setR({ ...r, monthly: v })} />
            <NumField label="Margen bruto" hint="sobre cada venta nueva" value={r.margin} max={100} suffix="%" onChange={(v) => setR({ ...r, margin: Math.min(100, v) })} />
            <button onClick={() => { if (linked) setR({ ...r, savings: Math.round(auto.savings), sales: Math.round(deltaSales * 10) / 10 }); setLinked(!linked); }}
              className="my-3 inline-flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10">
              {linked ? <Link2 className="size-4 text-bwo-turquoise" /> : <Unlink className="size-4 text-bwo-amber" />}
              {linked ? "Conectado a las pestañas 1 y 2 · cambiar a manual" : "Valores manuales · conectar con las pestañas 1 y 2"}
            </button>
            {linked ? (
              <div className="space-y-1 text-sm text-slate-300">
                <div>Ahorro de tiempo: <b className="text-white">{money(auto.savings)}</b>/mes <span className="text-slate-500">(pestaña 1)</span></div>
                <div>Ventas incrementales: <b className="text-white">{num(deltaSales, 1)}</b>/mes a {money(f.ticket)} <span className="text-slate-500">(pestaña 2)</span></div>
              </div>
            ) : (<>
              <NumField label="Ahorro mensual de tiempo" value={r.savings} step={10} suffix="USD" onChange={(v) => setR({ ...r, savings: v })} />
              <NumField label="Ventas incrementales / mes" value={r.sales} onChange={(v) => setR({ ...r, sales: v })} />
            </>)}
          </Card>
          <Card>
            <Out k="Beneficio mensual neto" sub="ahorro + ventas × ticket × margen − costo mensual" big><AnimatedNumber value={res.benefit} /></Out>
            <Out k="Margen de ventas nuevas"><AnimatedNumber value={res.salesMargin} /></Out>
            <Out k="Meses para recuperar" sub="inversión ÷ beneficio mensual">{isFinite(res.payback) ? <AnimatedNumber value={res.payback} format={{ maximumFractionDigits: 1 }} /> : "No se recupera"}</Out>
            <Out k="ROI primer año" sub="(12 × beneficio − inversión) ÷ (inversión + 12 × costo mensual)"><AnimatedNumber value={res.roi12} format={PCT} /></Out>
            <Out k="Ganancia neta a 12 meses"><AnimatedNumber value={res.net12} /></Out>
            <div className="mt-4">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Acumulado mes a mes</div>
              <div className="flex h-28 items-center gap-1">
                {res.curve.map((c) => (
                  <div key={c.m} className="flex h-full flex-1 flex-col justify-center" title={`Mes ${c.m}: ${money(c.acc)}`}>
                    <div className="flex h-1/2 items-end"><motion.div className="w-full rounded-t bg-bwo-turquoise" animate={{ height: `${c.acc > 0 ? (c.acc / maxAcc) * 100 : 0}%` }} /></div>
                    <div className="flex h-1/2 items-start"><motion.div className="w-full rounded-b bg-bwo-cerise" animate={{ height: `${c.acc < 0 ? (-c.acc / maxAcc) * 100 : 0}%` }} /></div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-slate-500"><span>Mes 0</span><span>Mes 12</span></div>
            </div>
          </Card>
        </div>
      )}
      <p className="mt-6 text-xs text-slate-500">Cifras ilustrativas; cada cliente debe recalcular con sus propios datos.</p>
    </div>
  );
}
