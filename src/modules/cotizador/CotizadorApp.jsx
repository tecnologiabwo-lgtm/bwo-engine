import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, Copy, Printer, Save, Send, History, Sparkles, Minus, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useClient } from "@/lib/clientContext";
import { supabase, run } from "@/lib/supabase";
import { useCatalog, CATEGORIES, UNITS } from "@/lib/catalog";
import { computeQuote, toggleItem } from "@/lib/quote";
import { money, cn, isoDate, addDays } from "@/lib/utils";
import { AnimatedNumber } from "@/components/ui/number";
import { Badge, Button, Card, Field, Input, PageHeader, Select, Textarea, ErrorBox } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

const STATUS = { borrador: "slate", enviada: "violet", solicitada: "amber", aceptada: "turquoise", rechazada: "red", vencida: "slate" };

function Stepper({ value, onChange, max = 99 }) {
  return (
    <div className="inline-flex items-center gap-1">
      <button onClick={() => onChange(Math.max(0, value - 1))} className="grid size-7 place-items-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10" aria-label="Menos"><Minus className="size-3" /></button>
      <span className="w-7 text-center text-sm font-bold tabular-nums">{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} className="grid size-7 place-items-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10" aria-label="Más"><Plus className="size-3" /></button>
    </div>
  );
}

function ItemCard({ item, sel, onToggle, onQty, onBilling, qtyMode }) {
  const on = !!sel?.qty;
  return (
    <div className={cn("rounded-xl border p-4 transition", on ? "border-2 bg-white/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]")}
      style={on ? { borderColor: item.color || "#6C3BF5" } : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button className="min-w-0 flex-1 text-left" onClick={qtyMode ? undefined : onToggle} disabled={qtyMode}>
          <div className="flex flex-wrap items-center gap-2">
            {item.color && <span className="size-3 rounded-full" style={{ background: item.color }} />}
            <span className="text-sm font-bold text-white">{item.name}</span>
            {item.badge && <Badge color="amber">{item.badge}</Badge>}
            {on && !qtyMode && <Check className="size-4 text-bwo-turquoise" />}
          </div>
          {item.description && <p className="mt-1 text-xs text-slate-400">{item.description}</p>}
          {!!item.features?.length && <ul className="mt-2 grid gap-x-4 gap-y-0.5 text-[11px] text-slate-300 sm:grid-cols-2">{item.features.map((f) => <li key={f}>· {f}</li>)}</ul>}
        </button>
        <div className="text-right">
          <div className="text-xl font-black" style={{ color: item.color || "#fff" }}>{money(sel?.billing === "anio" ? item.price_year : item.price)}</div>
          <div className="text-[11px] text-slate-400">{sel?.billing === "anio" ? "/ año (por adelantado)" : UNITS[item.unit]}</div>
          {qtyMode && <div className="mt-2"><Stepper value={sel?.qty || 0} onChange={onQty} /></div>}
        </div>
      </div>
      {item.category === "clientify" && item.price_year != null && on && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          {["mes", "anio"].map((b) => (
            <button key={b} onClick={() => onBilling(b)} className={cn("rounded-lg px-2.5 py-1 font-bold", (sel.billing || "mes") === b ? "bg-bwo-turquoise text-bwo-inkDeep" : "bg-white/5 text-slate-300")}>
              {b === "mes" ? `${money(item.price)}/mes` : `${money(item.price_year)}/año`}
            </button>
          ))}
          {item.price * 12 > item.price_year && <span className="font-semibold text-bwo-turquoise">Anual ahorra {money(item.price * 12 - item.price_year)}</span>}
        </div>
      )}
    </div>
  );
}

function Summary({ q, taxLabel, taxRate, onCopy, copied }) {
  const groups = [["unico", "Pagos únicos"], ["anual", "Anual (por adelantado)"], ["mensual", "Mensual recurrente"]];
  return (
    <Card className="lg:sticky lg:top-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-bold text-white"><Sparkles className="size-4 text-bwo-amber" />Resumen de inversión</div>
      {!q.lines.length && <p className="text-sm text-slate-400">Selecciona servicios para armar la propuesta.</p>}
      <AnimatePresence initial={false}>
        {groups.map(([k, label]) => {
          const ls = q.lines.filter((l) => l.kind === k);
          if (!ls.length) return null;
          return (
            <motion.div key={k} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-3 overflow-hidden">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</div>
              {ls.map((l) => (
                <div key={l.id} className="flex justify-between gap-3 py-1 text-xs">
                  <span className="text-slate-300">{l.name}{l.qty > 1 && ` ×${l.qty}`}</span>
                  <span className="whitespace-nowrap font-semibold tabular-nums text-white">{l.discount > 0 && <s className="mr-1 text-slate-500">{money(l.gross)}</s>}{money(l.net)}</span>
                </div>
              ))}
            </motion.div>
          );
        })}
      </AnimatePresence>
      {q.discount > 0 && <div className="flex justify-between border-t border-white/10 pt-2 text-xs text-bwo-turquoise"><span>Ahorro por descuentos</span><span>−{money(q.discount)}</span></div>}
      {taxRate > 0 && <div className="flex justify-between pt-1 text-xs text-slate-400"><span>{taxLabel} ({Math.round(taxRate * 100)}%)</span><span>+{money(q.firstTax)}</span></div>}
      <div className="mt-4 rounded-xl p-4" style={{ background: "linear-gradient(135deg,rgba(108,59,245,.35),rgba(230,25,126,.25))" }}>
        <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-200">Primera cuota</div>
        <AnimatedNumber value={q.firstTotal} className="text-4xl font-black text-white" />
        <div className="mt-3 flex justify-between text-sm"><span className="text-slate-200">Luego, cada mes</span><AnimatedNumber value={q.monthlyTotal} className="font-bold text-white" /></div>
        <div className="mt-1 flex justify-between text-xs text-slate-300"><span>Inversión primer año</span><AnimatedNumber value={q.yearOne} /></div>
      </div>
      {onCopy && <Button variant="ghost" className="mt-3 w-full" onClick={onCopy} disabled={!q.lines.length}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />}{copied ? "Copiado" : "Copiar para WhatsApp"}</Button>}
    </Card>
  );
}

function QuoteHistory({ isAdmin, refreshKey, onLoad }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const toast = useToast();
  const load = async () => {
    try { setRows(await run(supabase.from("quotes").select("*, clients(name)").order("created_at", { ascending: false }).limit(50))); setErr(""); }
    catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(); }, [refreshKey]);
  const setStatus = async (id, status) => {
    try { await run(supabase.from("quotes").update({ status }).eq("id", id)); load(); } catch (e) { toast(e.message, "error"); }
  };
  if (err) return <ErrorBox error={`No se pudieron cargar las cotizaciones: ${err}`} />;
  if (!rows) return null;
  if (!rows.length) return <p className="text-sm text-slate-400">Aún no hay cotizaciones guardadas.</p>;
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-white">{r.contact?.company || r.contact?.name || r.clients?.name || "Sin nombre"}</div>
            <div className="text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString("es-ES")} · {r.source === "cliente" ? "pedida por el cliente" : "agencia"} · primera cuota {money(r.totals?.firstTotal)} · {money(r.totals?.monthlyTotal)}/mes</div>
          </div>
          <Badge color={STATUS[r.status]}>{r.status}</Badge>
          {isAdmin && (
            <Select value={r.status} onChange={(e) => setStatus(r.id, e.target.value)} className="h-8 w-36 py-1 text-xs">
              {Object.keys(STATUS).map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          )}
          <Button size="sm" variant="ghost" onClick={() => onLoad(r)}>Abrir</Button>
        </div>
      ))}
    </div>
  );
}

export default function CotizadorApp() {
  const { isAdmin, profile } = useAuth();
  const { client } = useClient();
  const toast = useToast();
  const { items, settings, source } = useCatalog();
  const catalog = useMemo(() => items.filter((i) => i.active !== false && (isAdmin || i.public !== false)), [items, isAdmin]);
  const [selection, setSelection] = useState({});
  const [disc, setDisc] = useState({ setup: 0, services: 0, clientify: 0 });
  const [contact, setContact] = useState({ name: "", company: "", email: "", phone: "", notes: "" });
  const [linkClient, setLinkClient] = useState(true);
  const [tab, setTab] = useState("armar");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(0);

  const taxRate = Number(settings.tax?.rate) || 0;
  const q = useMemo(() => computeQuote(catalog, selection, isAdmin ? disc : {}, taxRate), [catalog, selection, disc, taxRate, isAdmin]);
  const validity = Number(settings.quote_validity_days) || 15;

  const sel = (id) => selection[id];
  const toggle = (id) => setSelection((s) => toggleItem(catalog, s, id, CATEGORIES));
  const setQty = (id, qty) => setSelection((s) => { const n = { ...s }; if (qty <= 0) delete n[id]; else n[id] = { billing: "mes", ...n[id], qty }; return n; });
  const setBilling = (id, billing) => setSelection((s) => ({ ...s, [id]: { ...s[id], billing } }));

  const text = () => {
    let t = `*PROPUESTA COMERCIAL | BIG WAY OFFICES*\n\nHola *${contact.name || "Estimado(a)"}*${contact.company ? ` (${contact.company})` : ""}, este es el resumen de inversión:\n\n`;
    q.lines.forEach((l) => { t += `• ${l.name}${l.qty > 1 ? ` ×${l.qty}` : ""}: ${money(l.net)}${l.kind === "mensual" ? "/mes" : l.kind === "anual" ? "/año" : ""}\n`; });
    t += `\n*Primera cuota:* ${money(q.firstTotal)}\n*Mensualidad:* ${money(q.monthlyTotal)}/mes\n`;
    if (taxRate > 0) t += `_Incluye ${settings.tax?.label || "impuestos"} (${Math.round(taxRate * 100)}%)_\n`;
    t += `\nVigencia: ${validity} días\n${settings.quote_footer || ""}`;
    return t;
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(text()); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { toast("No se pudo copiar: tu navegador bloqueó el portapapeles", "error"); }
  };

  const save = async (status) => {
    if (!q.lines.length) return;
    setBusy(true);
    try {
      await run(supabase.from("quotes").insert({
        client_id: (isAdmin ? linkClient : true) ? client?.id || null : null,
        source: isAdmin ? "agencia" : "cliente",
        status: isAdmin ? status : "solicitada",
        contact: isAdmin ? contact : { name: profile?.full_name || "", email: profile?.email, company: client?.name || "", notes: contact.notes },
        lines: q.lines, totals: { firstTotal: q.firstTotal, monthlyTotal: q.monthlyTotal, yearOne: q.yearOne, oneTime: q.oneTime, annual: q.annual, monthly: q.monthly, discount: q.discount, tax: q.firstTax },
        discounts: isAdmin ? disc : {}, valid_until: addDays(isoDate(), validity),
      }));
      setSaved((n) => n + 1);
      toast(isAdmin ? "Cotización guardada" : "¡Listo! Enviamos tu solicitud a Big Way Offices");
    } catch (e) { toast(`No se pudo guardar: ${e.message}`, "error"); }
    finally { setBusy(false); }
  };

  const loadQuote = (r) => {
    const s = {}; (r.lines || []).forEach((l) => { s[l.id] = { qty: l.qty, billing: l.kind === "anual" ? "anio" : "mes" }; });
    setSelection(s); setContact({ name: "", company: "", email: "", phone: "", notes: "", ...(r.contact || {}) });
    setDisc({ setup: 0, services: 0, clientify: 0, ...(r.discounts || {}) }); setTab("armar");
  };

  const cats = CATEGORIES.map((c) => ({ ...c, items: catalog.filter((i) => i.category === c.key) })).filter((c) => c.items.length);
  const qtyMode = (c) => ["clientify", "event", "support"].includes(c.key);

  return (
    <div>
      <PageHeader eyebrow={isAdmin ? "Agencia" : client?.name} title={isAdmin ? "Cotizador" : "Cotiza tus servicios"}
        subtitle={isAdmin ? "Arma propuestas con el catálogo vigente. Los precios se editan en «Precios y planes»." : "Elige lo que necesitas y te mostramos la inversión al instante. Al enviarla, el equipo de BWO te contacta."}
        actions={<>
          <Button variant={tab === "armar" ? "primary" : "ghost"} size="sm" onClick={() => setTab("armar")}>Armar</Button>
          <Button variant={tab === "historial" ? "primary" : "ghost"} size="sm" onClick={() => setTab("historial")}><History className="size-4" />{isAdmin ? "Cotizaciones" : "Mis solicitudes"}</Button>
        </>} />
      {source === "local" && isAdmin && <div className="mb-4 rounded-xl border border-bwo-amber/30 bg-bwo-amber/10 px-4 py-2 text-xs text-amber-200">Usando el catálogo local: la tabla de precios aún no existe en Supabase (falta aplicar la migración 0005/0006).</div>}

      {tab === "historial" ? <Card><QuoteHistory isAdmin={isAdmin} refreshKey={saved} onLoad={loadQuote} /></Card> : (
        <div className="grid items-start gap-6 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-8">
            {isAdmin && (
              <Card>
                <div className="mb-3 text-sm font-bold text-white">Prospecto / cliente</div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[["name", "Nombre"], ["company", "Empresa"], ["email", "Email"], ["phone", "Teléfono / WhatsApp"]].map(([k, l]) => (
                    <Field key={k} label={l}><Input value={contact[k]} onChange={(e) => setContact((c) => ({ ...c, [k]: e.target.value }))} /></Field>
                  ))}
                  <Field label="Objetivo comercial" className="sm:col-span-2"><Input value={contact.notes} onChange={(e) => setContact((c) => ({ ...c, notes: e.target.value }))} /></Field>
                </div>
                {client && <label className="mt-3 flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={linkClient} onChange={(e) => setLinkClient(e.target.checked)} className="accent-bwo-violet" />Vincular a {client.name} (cliente activo)</label>}
              </Card>
            )}
            {cats.map((c) => (
              <section key={c.key}>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h2 className="text-sm font-bold text-white">{c.label}</h2>
                  {c.hint && <span className="text-[11px] text-slate-500">{c.hint}</span>}
                </div>
                <div className="grid gap-3">
                  {c.items.map((it) => (
                    <ItemCard key={it.id} item={it} sel={sel(it.id)} qtyMode={qtyMode(c)}
                      onToggle={() => toggle(it.id)} onQty={(v) => setQty(it.id, v)} onBilling={(b) => setBilling(it.id, b)} />
                  ))}
                </div>
              </section>
            ))}
            {isAdmin ? (
              <Card>
                <div className="mb-3 text-sm font-bold text-white">Descuentos</div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[["setup", "Configuraciones iniciales"], ["services", "Servicios BWO"], ["clientify", "Clientify"]].map(([k, l]) => (
                    <Field key={k} label={`${l} (%)`}><Input type="number" min="0" max="100" value={disc[k] || ""} placeholder="0"
                      onChange={(e) => setDisc((d) => ({ ...d, [k]: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) }))} /></Field>
                  ))}
                </div>
              </Card>
            ) : (
              <Card><Field label="¿Algo que debamos saber?"><Textarea value={contact.notes} onChange={(e) => setContact((c) => ({ ...c, notes: e.target.value }))} placeholder="Objetivo, fechas, dudas…" /></Field></Card>
            )}
          </div>
          <div className="space-y-3 lg:col-span-4">
            <Summary q={q} taxRate={taxRate} taxLabel={settings.tax?.label || "Impuestos"} onCopy={isAdmin ? copy : null} copied={copied} />
            {isAdmin ? (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="ghost" onClick={() => save("borrador")} loading={busy} disabled={!q.lines.length}><Save className="size-4" />Guardar</Button>
                <Button onClick={() => save("enviada")} loading={busy} disabled={!q.lines.length}><Send className="size-4" />Marcar enviada</Button>
                <Button variant="ghost" className="col-span-2" onClick={() => window.print()} disabled={!q.lines.length}><Printer className="size-4" />Imprimir / PDF</Button>
              </div>
            ) : (
              <Button size="lg" className="w-full" onClick={() => save()} loading={busy} disabled={!q.lines.length}><Send className="size-4" />Enviar solicitud a BWO</Button>
            )}
            <p className="text-center text-[11px] text-slate-500">Precios en USD · vigencia {validity} días</p>
          </div>
        </div>
      )}
    </div>
  );
}
