import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

/** Modo grabación a pantalla completa: una toma a la vez, letra grande,
 *  cronómetro y pantalla siempre encendida (Wake Lock). Solo la agencia marca tomas. */
export default function Teleprompter({ ids, pieces, isAdmin, onClose, onDone }) {
  const list = ids.map((id) => pieces.find((p) => p.id === id)).filter(Boolean);
  const [pi, setPi] = useState(0);
  const first = list[0];
  const [bi, setBi] = useState(() => { const i = (first?.blocks || []).findIndex((_, k) => !(first.checks || {})[k]); return i < 0 ? 0 : i; });
  const [size, setSize] = useState(1);
  const [clock, setClock] = useState({ run: false, t0: 0, acc: 0, now: 0 });
  const wake = useRef(null);

  useEffect(() => {
    navigator.wakeLock?.request("screen").then((w) => (wake.current = w)).catch(() => {});
    return () => { try { wake.current?.release(); } catch {} };
  }, []);
  useEffect(() => {
    if (!clock.run) return;
    const h = setInterval(() => setClock((c) => ({ ...c, now: Date.now() })), 250);
    return () => clearInterval(h);
  }, [clock.run]);

  const p = list[pi];
  const blocks = p?.blocks || [];
  const b = blocks[bi];
  const done = !!(p?.checks || {})[bi];
  const secs = clock.run ? Math.floor((clock.now - clock.t0) / 1000) + clock.acc : clock.acc;

  const next = async () => {
    if (!p) return;
    if (isAdmin && !done) await supabase.rpc("sala_toggle", { p_piece: p.id, p_field: "checks", p_key: String(bi), p_value: true });
    if (bi < blocks.length - 1) setBi(bi + 1);
    else if (pi < list.length - 1) { setPi(pi + 1); setBi(0); setClock({ run: false, t0: 0, acc: 0, now: 0 }); }
    else { onDone(); }
  };
  const prev = () => { if (bi > 0) setBi(bi - 1); else if (pi > 0) { setPi(pi - 1); setBi((list[pi - 1].blocks || []).length - 1); } };
  const timer = () => setClock((c) => (c.run ? { run: false, t0: 0, acc: c.acc + Math.floor((Date.now() - c.t0) / 1000), now: 0 } : { ...c, run: true, t0: Date.now(), now: Date.now() }));

  useEffect(() => {
    const k = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if ((e.key === "ArrowRight" || e.key === " ") && e.target.tagName !== "BUTTON") { e.preventDefault(); next(); }
    };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  });

  if (!p || !b) return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-[#0B0B18] text-white"><div className="text-center"><p>Esta pieza no tiene tomas.</p><button className="mt-3 underline" onClick={onClose}>Salir</button></div></div>
  );
  const px = [26, 32, 40, 50][size];
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0B0B18] px-4 text-[#F4F4FA]" role="dialog" aria-modal="true" aria-label="Modo grabación">
      <div className="flex flex-wrap items-center gap-3 py-3">
        <div className="min-w-0 flex-1 text-sm font-semibold opacity-85">{list.length > 1 && `Pieza ${pi + 1} de ${list.length} · `}{p.title}{p.num ? ` #${p.num}` : ""}</div>
        <button onClick={() => setSize((size + 1) % 4)} className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold">A{["", "+", "++", "+++"][size]}</button>
        <button onClick={onClose} className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold">Salir</button>
      </div>
      <div className="flex gap-1">{blocks.map((_, i) => <i key={i} className={"h-1 flex-1 rounded-full " + (i === bi ? "bg-bwo-cerise" : (p.checks || {})[i] ? "bg-emerald-400" : "bg-white/15")} />)}</div>
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center overflow-y-auto py-6">
        <div className="text-sm font-semibold uppercase tracking-widest text-bwo-cerise">{b.k}{b.t ? ` · ${b.t}` : ""}{done ? " · grabada" : ""}</div>
        <div className="mt-3 whitespace-pre-wrap font-medium leading-snug" style={{ fontSize: px }}>{b.x}</div>
        {b.v && <div className="mt-4 text-base opacity-60">Visual: {b.v}</div>}
        {bi === 0 && p.visual && <div className="mt-2 text-base opacity-60">Puesta en escena: {p.visual}</div>}
      </div>
      <div className="flex flex-wrap items-center gap-3 py-4">
        <div className="mr-auto font-mono text-xl font-semibold tabular-nums">{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}{p.dur_max ? <small className="ml-2 text-xs opacity-60">objetivo {p.dur_min || 0}–{p.dur_max} s</small> : null}</div>
        <button onClick={timer} className="rounded-xl bg-white/10 px-4 py-3 font-semibold">{clock.run ? "Pausar" : "Cronómetro"}</button>
        <button onClick={prev} disabled={pi === 0 && bi === 0} className="rounded-xl bg-white/10 px-4 py-3 font-semibold disabled:opacity-40">Anterior</button>
        <button onClick={next} className="rounded-xl bg-bwo-cerise px-5 py-3 font-bold">{isAdmin && !done ? "Toma lista ✓" : "Siguiente"}</button>
      </div>
    </div>
  );
}
