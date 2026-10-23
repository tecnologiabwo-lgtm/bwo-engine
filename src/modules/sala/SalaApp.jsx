import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Plus, FileJson, CalendarPlus, Clapperboard } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useClient } from "@/lib/clientContext";
import { supabase, run } from "@/lib/supabase";
import { FMT, issues, timing, RANK, STATUS_COLOR, statusLabel, parseImport } from "@/lib/sala";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/ui/number";
import { Button, Card, Empty, ErrorBox, Field, Input, PageHeader, Select, Spinner, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { TodayView, CalendarView, BoardView, ShootView, QualityView } from "./views.jsx";
import PieceDrawer from "./PieceDrawer.jsx";
import PieceForm from "./PieceForm.jsx";
import Teleprompter from "./Teleprompter.jsx";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const monthName = (iso) => { const [y, m] = iso.split("-").map(Number); return `${MONTHS[m - 1]} ${y}`; };
const TABS = [["hoy", "Hoy"], ["calendario", "Calendario"], ["tablero", "Tablero"], ["grabacion", "Grabación"], ["calidad", "Control de calidad"]];
const COUNT = { maximumFractionDigits: 0 };

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <motion.div initial={{ scale: .97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-bwo-inkDeep p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-extrabold text-white">{title}</h2>{children}
      </motion.div>
    </div>
  );
}

function CalendarForm({ clientId, cal, onClose, onSaved }) {
  const toast = useToast();
  const nx = new Date(); nx.setDate(1); nx.setMonth(nx.getMonth() + 1);   // por defecto: el mes siguiente
  const [d, setD] = useState(cal || { month: `${nx.getFullYear()}-${String(nx.getMonth() + 1).padStart(2, "0")}-01`, title: "", objective: "", summary: "", channels: "Instagram · Facebook", arc: [] });
  const save = async () => {
    try {
      const row = { client_id: clientId, month: d.month.slice(0, 7) + "-01", title: d.title, objective: d.objective || null, summary: d.summary || null, channels: d.channels || null, arc: (d.arc || []).filter(Boolean) };
      const r = cal ? await run(supabase.from("sala_calendars").update(row).eq("id", cal.id).select().single())
                    : await run(supabase.from("sala_calendars").insert(row).select().single());
      toast("Calendario guardado"); onSaved(r.id);
    } catch (e) { toast(e.message.includes("duplicate") ? "Ya existe un calendario para ese mes" : e.message, "error"); }
  };
  return (
    <Modal title={cal ? "Editar calendario" : "Nuevo calendario del mes"} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Mes"><Input type="month" value={d.month.slice(0, 7)} onChange={(e) => setD({ ...d, month: e.target.value + "-01" })} /></Field>
        <Field label="Canales"><Input value={d.channels || ""} onChange={(e) => setD({ ...d, channels: e.target.value })} /></Field>
        <Field label="Objetivo del mes" className="sm:col-span-2"><Input value={d.objective || ""} onChange={(e) => setD({ ...d, objective: e.target.value })} placeholder="Ej.: Posicionar el servicio de importación" /></Field>
        <Field label="Enfoque de la estrategia" className="sm:col-span-2"><Textarea value={d.summary || ""} onChange={(e) => setD({ ...d, summary: e.target.value })} /></Field>
        <Field label="Arco narrativo (un paso por línea)" className="sm:col-span-2"><Textarea value={(d.arc || []).join("\n")} onChange={(e) => setD({ ...d, arc: e.target.value.split("\n") })} /></Field>
      </div>
      <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={save}>Guardar</Button></div>
    </Modal>
  );
}

function ImportForm({ clientId, onClose, onDone }) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setMsg(""); let parsed;
    try { parsed = parseImport(text); } catch (e) { setMsg(e.message); return; }
    setBusy(true);
    try {
      const { calendar, pieces } = parsed;
      const cal = await run(supabase.from("sala_calendars").upsert({ client_id: clientId, ...calendar }, { onConflict: "client_id,month" }).select().single());
      const existing = await run(supabase.from("sala_pieces").select("id, ext_id").eq("calendar_id", cal.id));
      const byExt = new Map(existing.map((x) => [x.ext_id, x.id]));
      let created = 0, updated = 0;
      for (const p of pieces) {
        const row = { ...p, calendar_id: cal.id, client_id: clientId, updated_at: new Date().toISOString() };
        if (byExt.has(p.ext_id)) { await run(supabase.from("sala_pieces").update(row).eq("id", byExt.get(p.ext_id))); updated++; }
        else {
          const ins = await run(supabase.from("sala_pieces").insert(row).select("id").single());
          await run(supabase.rpc("sala_set_status", { p_piece: ins.id, p_status: "aprobacion", p_note: "Importado" }));
          created++;
        }
      }
      toast(`${created} piezas nuevas · ${updated} actualizadas (conservan su estado)`); onDone(cal.id);
    } catch (e) { setMsg(`No se pudo importar: ${e.message}`); } finally { setBusy(false); }
  };
  return (
    <Modal title="Importar calendario (JSON)" onClose={onClose}>
      <p className="mb-3 text-sm text-slate-400">Pega el JSON que exporta la Fábrica. Las piezas nuevas entran «En aprobación»; si una pieza ya existe en ese mes, se actualiza su contenido y conserva su estado. Para crear guiones a mano usa «Nueva pieza».</p>
      <Textarea rows={12} className="font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder='{"calendar": {...}, "pieces": [...]}' />
      {msg && <p className="mt-2 text-sm text-bwo-ceriseLt">{msg}</p>}
      <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={go} loading={busy}>Importar</Button></div>
    </Modal>
  );
}

export default function SalaApp() {
  const { isAdmin } = useAuth();
  const { clientId, client } = useClient();
  const [cals, setCals] = useState(null);
  const [calId, setCalId] = useState(null);
  const [pieces, setPieces] = useState([]);
  const [comments, setComments] = useState([]);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState(() => { try { return localStorage.getItem("sala.tab") || "hoy"; } catch { return "hoy"; } });
  const [open, setOpen] = useState(null);
  const [edit, setEdit] = useState(null);       // null | "new" | piece
  const [modal, setModal] = useState(null);     // "cal" | "editcal" | "import"
  const [tp, setTp] = useState(null);

  const loadCals = useCallback(async (focus) => {
    try {
      const rows = await run(supabase.from("sala_calendars").select("*").eq("client_id", clientId).order("month", { ascending: false }));
      setCals(rows); setErr("");
      setCalId((cur) => focus || (rows.some((r) => r.id === cur) ? cur : rows[0]?.id || null));
    } catch (e) { setErr(e.message); setCals([]); }
  }, [clientId]);
  useEffect(() => { setCals(null); setCalId(null); loadCals(); }, [loadCals]);

  const loadPieces = useCallback(async () => {
    if (!calId) { setPieces([]); setComments([]); return; }
    try {
      const ps = await run(supabase.from("sala_pieces").select("*").eq("calendar_id", calId).order("date"));
      setPieces(ps);
      const ids = ps.map((p) => p.id);
      setComments(ids.length ? await run(supabase.from("sala_comments").select("*").in("piece_id", ids).order("created_at")) : []);
    } catch (e) { setErr(e.message); }
  }, [calId]);
  useEffect(() => { loadPieces(); }, [loadPieces]);

  // Tiempo real: cualquier cambio de la agencia o del cliente se ve al instante
  useEffect(() => {
    if (!calId) return;
    const ch = supabase.channel(`sala-${calId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sala_pieces", filter: `calendar_id=eq.${calId}` }, loadPieces)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "sala_comments" }, loadPieces)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [calId, loadPieces]);

  const cal = cals?.find((c) => c.id === calId);
  const list = useMemo(() => [...pieces].sort((a, b) => a.date.localeCompare(b.date) || (a.num || 0) - (b.num || 0)), [pieces]);
  const iss = useMemo(() => issues(list), [list]);
  const piece = pieces.find((p) => p.id === open);
  const chooseTab = (k) => { setTab(k); try { localStorage.setItem("sala.tab", k); } catch {} };

  if (err && !cals?.length) return <ErrorBox error={`No se pudo abrir la Sala: ${err}. ¿Se aplicó la migración 0005?`} onRetry={() => loadCals()} />;
  if (!cals) return <Spinner />;

  const approved = list.filter((p) => RANK[p.status] >= 2).length;
  const late = list.filter((p) => timing(p).late).length;
  const decisions = list.filter((p) => p.decision?.q && p.choice == null).length;
  const segs = ["publicado", "listo", "edicion", "produccion", "aprobado", "aprobacion", "cambios"];

  return (
    <div>
      <PageHeader eyebrow={client?.name} title="Sala de producción"
        subtitle={isAdmin ? "Guiones, intención, tono, tomas y aprobaciones del mes, en vivo con el cliente." : "Revisa cada guion del mes y apruébalo o pide cambios."}
        actions={<>
          {cals.length > 0 && <Select value={calId || ""} onChange={(e) => setCalId(e.target.value)} className="h-10 w-48">{cals.map((c) => <option key={c.id} value={c.id}>{monthName(c.month)}</option>)}</Select>}
          {isAdmin && <>
            <Button variant="ghost" onClick={() => setModal("cal")}><CalendarPlus className="size-4" />Mes</Button>
            <Button variant="ghost" onClick={() => setModal("import")}><FileJson className="size-4" />Importar JSON</Button>
            {cal && <Button onClick={() => setEdit("new")}><Plus className="size-4" />Nueva pieza</Button>}
          </>}
        </>} />

      {!cal ? (
        <Empty icon={Clapperboard} title="Aún no hay calendarios">{isAdmin ? "Crea el calendario del mes o importa el JSON de la Fábrica." : "Cuando BWO cargue el calendario del mes, aparecerá aquí con cada guion listo para revisar."}</Empty>
      ) : (<>
        <Card className="mb-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="mb-2 flex flex-wrap gap-2 text-xs">{[monthName(cal.month), cal.channels].filter(Boolean).map((x) => <span key={x} className="rounded-full bg-white/10 px-2.5 py-0.5 text-slate-300">{x}</span>)}
              {isAdmin && <button onClick={() => setModal("editcal")} className="text-bwo-violetLt">Editar</button>}</div>
            <h2 className="text-2xl font-extrabold text-white">{cal.objective || cal.title || "Calendario de contenidos"}</h2>
            {cal.summary && <p className="mt-2 text-sm text-slate-400">{cal.summary}</p>}
            {!!cal.arc?.length && <div className="mt-3 flex flex-wrap gap-1.5">{cal.arc.map((a, i) => <span key={i} className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-200"><b className="mr-1 text-bwo-cerise">{i + 1}</b>{a}</span>)}</div>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[[`${approved}/${list.length}`, "piezas aprobadas", "text-emerald-400", null], [late, late === 1 ? "pieza atrasada" : "piezas atrasadas", late ? "text-red-400" : "text-emerald-400", late],
              [decisions, "decisiones pendientes", decisions ? "text-bwo-amber" : "text-emerald-400", decisions], [iss.length, "alertas de calidad", iss.length ? "text-bwo-amber" : "text-emerald-400", iss.length]].map(([v, l, c, n]) => (
              <div key={l} className="rounded-xl bg-white/5 p-3"><div className={cn("text-2xl font-black", c)}>{n == null ? v : <AnimatedNumber value={n} format={COUNT} />}</div><div className="text-xs text-slate-400">{l}</div></div>
            ))}
            <div className="col-span-2 flex h-2 overflow-hidden rounded-full bg-white/10">{segs.map((s) => { const n = list.filter((p) => p.status === s).length; return n ? <i key={s} style={{ width: `${(n / list.length) * 100}%`, background: STATUS_COLOR[s] }} title={`${statusLabel(s, { fmt: "reel" })}: ${n}`} /> : null; })}</div>
            <div className="col-span-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">{Object.entries(FMT).map(([k, f]) => { const n = list.filter((p) => p.fmt === k).length; return n ? <span key={k}><span className="mr-1 inline-block size-2 rounded-full" style={{ background: f.c }} />{f.n} · <b className="text-slate-200">{n}</b></span> : null; })}</div>
          </div>
        </Card>

        <div className="sticky top-0 z-10 -mx-1 mb-5 flex gap-1 overflow-x-auto bg-bwo-inkDeep/70 px-1 py-2 backdrop-blur" role="tablist">
          {TABS.map(([k, n]) => {
            const lateN = k === "calidad" ? iss.filter((i) => i.sev === "late").length : 0;
            return (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => chooseTab(k)} className={cn("relative whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold", tab === k ? "text-white" : "text-slate-400")}>
                {tab === k && <motion.span layoutId="sala-tab" className="absolute inset-0 rounded-lg bg-white/10" />}
                <span className="relative">{n}{lateN > 0 && <span className="ml-1.5 rounded-full bg-red-500 px-1.5 text-[11px] text-white">{lateN}</span>}</span>
              </button>
            );
          })}
        </div>

        {!list.length ? <Empty icon={Clapperboard} title="Este calendario no tiene piezas">{isAdmin ? "Crea la primera con «Nueva pieza»." : "Pronto verás aquí los guiones del mes."}</Empty>
          : tab === "hoy" ? <TodayView list={list} isAdmin={isAdmin} onOpen={setOpen} />
          : tab === "calendario" ? <CalendarView list={list} calendar={cal} onOpen={setOpen} />
          : tab === "tablero" ? <BoardView list={list} onOpen={setOpen} />
          : tab === "grabacion" ? <ShootView list={list} onOpen={setOpen} onShoot={setTp} />
          : <QualityView list={list} calendar={cal} onOpen={setOpen} />}
      </>)}

      {piece && <PieceDrawer p={piece} comments={comments.filter((c) => c.piece_id === piece.id)} isAdmin={isAdmin}
        onClose={() => setOpen(null)} onEdit={() => { setEdit(piece); setOpen(null); }} onShoot={() => { setTp([piece.id]); setOpen(null); }} onDeleted={() => { setOpen(null); loadPieces(); }} />}
      {edit && cal && <PieceForm calendar={cal} piece={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={(id) => { setEdit(null); loadPieces(); setOpen(id); }} />}
      {tp && <Teleprompter ids={tp} pieces={pieces} isAdmin={isAdmin} onClose={() => { setTp(null); loadPieces(); }} onDone={() => { setTp(null); loadPieces(); }} />}
      {modal === "cal" && <CalendarForm clientId={clientId} onClose={() => setModal(null)} onSaved={(id) => { setModal(null); loadCals(id); }} />}
      {modal === "editcal" && cal && <CalendarForm clientId={clientId} cal={cal} onClose={() => setModal(null)} onSaved={(id) => { setModal(null); loadCals(id); }} />}
      {modal === "import" && <ImportForm clientId={clientId} onClose={() => setModal(null)} onDone={(id) => { setModal(null); loadCals(id); }} />}
    </div>
  );
}
