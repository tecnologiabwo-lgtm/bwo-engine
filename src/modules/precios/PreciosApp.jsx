import { useEffect, useState } from "react";
import { Plus, Save, Trash2, Eye, EyeOff, Power } from "lucide-react";
import { supabase, run } from "@/lib/supabase";
import { useCatalog, CATEGORIES, UNITS } from "@/lib/catalog";
import { money, cn } from "@/lib/utils";
import { Badge, Button, Card, Field, Input, PageHeader, Select, Textarea, Spinner, ErrorBox } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);

function Row({ item, onSaved, onDeleted }) {
  const toast = useToast();
  const [d, setD] = useState(item);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(d) !== JSON.stringify(item);
  useEffect(() => setD(item), [item]);
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));

  const save = async () => {
    if (!d.name.trim()) { toast("El nombre es obligatorio", "error"); return; }
    if (!(d.price >= 0)) { toast("Precio inválido", "error"); return; }
    setBusy(true);
    try {
      const row = { ...d, price: +d.price, price_year: d.price_year === "" || d.price_year == null ? null : +d.price_year,
        setup_price: d.setup_price === "" || d.setup_price == null ? null : +d.setup_price, updated_at: new Date().toISOString() };
      delete row.isNew;
      await run(supabase.from("price_catalog").upsert(row));
      toast(`«${d.name}» guardado`); onSaved();
    } catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  };
  const del = async () => {
    if (!confirm(`¿Eliminar «${d.name}» del catálogo? Las cotizaciones ya guardadas no cambian.`)) return;
    if (item.isNew) { onDeleted(item.id); return; }
    try { await run(supabase.from("price_catalog").delete().eq("id", d.id)); onSaved(); } catch (e) { toast(e.message, "error"); }
  };

  return (
    <div className={cn("rounded-xl border bg-white/[0.03] p-4", dirty ? "border-bwo-amber/50" : "border-white/10", !d.active && "opacity-60")}>
      <div className="grid gap-3 md:grid-cols-12">
        <Field label="Nombre" className="md:col-span-4"><Input value={d.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Precio USD" className="md:col-span-2"><Input type="number" min="0" step="0.01" value={d.price} onChange={(e) => set("price", e.target.value)} /></Field>
        <Field label="Unidad" className="md:col-span-2">
          <Select value={d.unit} onChange={(e) => set("unit", e.target.value)}>{Object.entries(UNITS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
        </Field>
        {d.category === "clientify"
          ? <Field label="Precio anual" className="md:col-span-2"><Input type="number" min="0" step="0.01" value={d.price_year ?? ""} onChange={(e) => set("price_year", e.target.value)} /></Field>
          : <Field label="Etiqueta" className="md:col-span-2"><Input value={d.badge || ""} onChange={(e) => set("badge", e.target.value || null)} /></Field>}
        {(d.category === "program" || d.setup_price != null) && <>
          <Field label="Fase I · pago único" className="md:col-span-2"><Input type="number" min="0" step="0.01" value={d.setup_price ?? ""} onChange={(e) => set("setup_price", e.target.value === "" ? null : e.target.value)} /></Field>
          <Field label="Mensualidad empieza" className="md:col-span-2">
            <Select value={d.meta?.starts_month || 1} onChange={(e) => set("meta", { ...(d.meta || {}), starts_month: +e.target.value })}>
              <option value={1}>Mes 1 (con la primera cuota)</option><option value={2}>Mes 2 (después de la Fase I)</option>
            </Select>
          </Field>
          <Field label="Excluye (ids, separados por coma)" className="md:col-span-4" hint="No se pueden contratar a la vez">
            <Input value={(d.meta?.excludes || []).join(", ")} onChange={(e) => set("meta", { ...(d.meta || {}), excludes: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
          </Field>
        </>}
        <Field label="Color" className="md:col-span-2">
          <div className="flex gap-2"><input type="color" value={d.color || "#6C3BF5"} onChange={(e) => set("color", e.target.value)} className="h-9 w-10 cursor-pointer rounded-lg border border-white/10 bg-transparent" />
            <Input value={d.color || ""} placeholder="sin color" onChange={(e) => set("color", e.target.value || null)} /></div>
        </Field>
        <Field label="Descripción" className="md:col-span-6"><Input value={d.description || ""} onChange={(e) => set("description", e.target.value)} /></Field>
        <Field label="Incluye (una línea por punto)" className="md:col-span-6">
          <Textarea className="min-h-[38px]" rows={2} value={(d.features || []).join("\n")} onChange={(e) => set("features", e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))} />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge color="slate">{d.id}</Badge>
        <button onClick={() => set("active", !d.active)} className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-300"><Power className="size-3" />{d.active ? "Activo" : "Inactivo"}</button>
        <button onClick={() => set("public", !d.public)} className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-300">{d.public ? <Eye className="size-3" /> : <EyeOff className="size-3" />}{d.public ? "Visible para clientes" : "Solo agencia"}</button>
        <span className="ml-auto text-xs text-slate-400">{d.setup_price > 0 && `Fase I ${money(+d.setup_price)} · `}{money(+d.price)} {UNITS[d.unit]}</span>
        <Button size="sm" variant="ghost" onClick={del}><Trash2 className="size-3.5" /></Button>
        <Button size="sm" onClick={save} loading={busy} disabled={!dirty}><Save className="size-3.5" />Guardar</Button>
      </div>
    </div>
  );
}

function Settings({ settings, onSaved }) {
  const toast = useToast();
  const [tax, setTax] = useState(settings.tax);
  const [validity, setValidity] = useState(settings.quote_validity_days);
  const [footer, setFooter] = useState(settings.quote_footer);
  useEffect(() => { setTax(settings.tax); setValidity(settings.quote_validity_days); setFooter(settings.quote_footer); }, [settings]);
  const save = async () => {
    try {
      await run(supabase.from("app_settings").upsert([
        { key: "tax", value: { label: tax.label || "Impuestos", rate: Math.max(0, Math.min(1, +tax.rate || 0)) } },
        { key: "quote_validity_days", value: Math.max(1, +validity || 15) },
        { key: "quote_footer", value: footer || "" },
      ]));
      toast("Condiciones guardadas"); onSaved();
    } catch (e) { toast(e.message, "error"); }
  };
  return (
    <Card className="mb-6">
      <div className="mb-3 text-sm font-bold text-white">Condiciones de las cotizaciones</div>
      <div className="grid gap-3 md:grid-cols-4">
        <Field label="Nombre del impuesto"><Input value={tax.label} onChange={(e) => setTax({ ...tax, label: e.target.value })} /></Field>
        <Field label="Tasa (%)" hint="0 = precios netos"><Input type="number" min="0" max="100" value={Math.round((+tax.rate || 0) * 1000) / 10} onChange={(e) => setTax({ ...tax, rate: (+e.target.value || 0) / 100 })} /></Field>
        <Field label="Vigencia (días)"><Input type="number" min="1" value={validity} onChange={(e) => setValidity(e.target.value)} /></Field>
        <Field label="Pie de la propuesta"><Input value={footer} onChange={(e) => setFooter(e.target.value)} /></Field>
      </div>
      <Button size="sm" className="mt-3" onClick={save}><Save className="size-3.5" />Guardar condiciones</Button>
    </Card>
  );
}

export default function PreciosApp() {
  const { items, settings, source, error, reload } = useCatalog();
  const [extra, setExtra] = useState([]);
  const [cat, setCat] = useState("program");
  if (source === "loading") return <Spinner />;
  const list = [...items, ...extra].filter((i) => i.category === cat).sort((a, b) => a.sort - b.sort);
  const add = () => {
    const name = prompt("Nombre del nuevo servicio o plan:");
    if (!name) return;
    const id = `${cat}_${slug(name)}`;
    if ([...items, ...extra].some((i) => i.id === id)) { alert("Ya existe un ítem con ese nombre en esta categoría."); return; }
    setExtra((x) => [...x, { id, category: cat, name, description: "", price: 0, price_year: null, unit: ["plan", "crm", "program"].includes(cat) ? "mes" : "unico", setup_price: cat === "program" ? 0 : null, badge: null, color: null, features: [], meta: cat === "program" ? { starts_month: 2 } : {}, sort: (list.at(-1)?.sort || 0) + 10, active: true, public: true, isNew: true }]);
  };
  return (
    <div>
      <PageHeader eyebrow="Agencia" title="Precios y planes" subtitle="Lo que cambies aquí se aplica al instante en el cotizador de la agencia y en la autocotización de los clientes. Las cotizaciones guardadas conservan el precio con que se hicieron." />
      {source === "local" && <ErrorBox error={`La tabla price_catalog no está disponible (${error || "sin datos"}). Aplica las migraciones 0005 y 0006 para poder editar precios.`} />}
      {source === "db" && <Settings settings={settings} onSaved={reload} />}
      <div className="mb-4 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button key={c.key} onClick={() => setCat(c.key)} className={cn("rounded-xl px-3 py-1.5 text-xs font-bold", cat === c.key ? "bg-bwo-violet text-white" : "bg-white/5 text-slate-300 hover:bg-white/10")}>{c.label}</button>
        ))}
      </div>
      <div className="space-y-3">
        {list.map((i) => <Row key={i.id} item={i} onSaved={() => { setExtra([]); reload(); }} onDeleted={(id) => setExtra((x) => x.filter((e) => e.id !== id))} />)}
      </div>
      {source === "db" && <Button variant="ghost" className="mt-4" onClick={add}><Plus className="size-4" />Agregar a esta categoría</Button>}
    </div>
  );
}
