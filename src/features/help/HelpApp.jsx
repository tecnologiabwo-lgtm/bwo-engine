import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Search, Plus, Pencil, BookOpen, Briefcase, GraduationCap, Cpu, HelpCircle, Newspaper } from "lucide-react";
import { useAuth } from "@/features/auth/auth";
import { Card, Button, Badge, Empty, Field, Input, Select, Textarea, Modal } from "@/shared/ui/primitives";
import { Biwi } from "@/shared/ui/brand";
import { Markdown } from "@/shared/ui/markdown";
import { useToast } from "@/shared/ui/toast";
import { cn } from "@/shared/lib/utils";
import { SECTIONS, ARTICLES } from "./content.js";
import { search, slugify } from "./search.js";
import * as api from "./api.js";

const ICONS = { "primeros-pasos": BookOpen, comercial: Briefcase, tutoriales: GraduationCap, tecnica: Cpu, faq: HelpCircle, articulos: Newspaper };
const sectionOf = (id) => SECTIONS.find((s) => s.id === id);

function Editor({ article, onClose, onSaved }) {
  const [a, setA] = useState(article); const [busy, setBusy] = useState(false); const [tab, setTab] = useState("editar"); const toast = useToast();
  const set = (k) => (e) => setA((x) => ({ ...x, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const save = async () => {
    setBusy(true);
    try { await api.saveArticle({ ...a, slug: a.slug || slugify(a.title) }); toast("Artículo guardado"); onSaved(); }
    catch (e) { toast(/duplicate|unique/i.test(e.message) ? "Ya existe un artículo con esa dirección (slug)" : e.message, "error"); } finally { setBusy(false); }
  };
  const del = async () => { if (!confirm("¿Eliminar este artículo?")) return; await api.deleteArticle(a.id).then(onSaved).catch((e) => toast(e.message, "error")); };
  return (
    <Modal open wide onClose={onClose} title={a.id ? "Editar artículo" : "Nuevo artículo"}
      footer={<>{a.id && <Button variant="danger" onClick={del}>Eliminar</Button>}<Button loading={busy} disabled={!a.title?.trim()} onClick={save}>Guardar</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Título"><Input value={a.title || ""} onChange={set("title")} /></Field>
        <Field label="Sección"><Select value={a.section} onChange={set("section")}>{SECTIONS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select></Field>
        <Field label="Resumen" className="sm:col-span-2"><Input value={a.summary || ""} onChange={set("summary")} /></Field>
        <Field label="Visible para"><Select value={a.audience} onChange={set("audience")}><option value="todos">Clientes y agencia</option><option value="agencia">Solo agencia</option></Select></Field>
        <Field label="Dirección (slug)" hint="Se genera del título si lo dejas vacío"><Input value={a.slug || ""} onChange={set("slug")} placeholder={slugify(a.title || "")} /></Field>
      </div>
      <div className="mt-4 flex gap-1 text-xs">{["editar", "vista previa"].map((t) => <button key={t} onClick={() => setTab(t)} className={cn("rounded-lg px-3 py-1 font-semibold capitalize", tab === t ? "bg-white/10 text-white" : "text-slate-400")}>{t}</button>)}</div>
      {tab === "editar"
        ? <Textarea rows={14} className="mt-2 font-mono text-xs" value={a.body || ""} onChange={set("body")} placeholder={"## Subtítulo\nTexto con **negrita**, _cursiva_, listas con - y enlaces [texto](https://…)"} />
        : <Card className="mt-2"><Markdown source={a.body} /></Card>}
      <label className="mt-3 flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={a.published !== false} onChange={set("published")} />Publicado</label>
    </Modal>
  );
}

function ArticleView({ a, related, isAdmin, onEdit }) {
  const nav = useNavigate(); const s = sectionOf(a.section);
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,760px)_1fr]">
      <article>
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => nav("/ayuda")}><ArrowLeft className="size-4" />Centro de ayuda</Button>
        <div className="mb-2 flex flex-wrap items-center gap-2"><Badge color="violet">{s?.label}</Badge>{a.audience === "agencia" && <Badge color="amber">Solo agencia</Badge>}{!a.builtin && <Badge color="slate">Escrito por el equipo</Badge>}</div>
        <h1 className="text-2xl font-extrabold text-white sm:text-3xl">{a.title}</h1>
        {a.summary && <p className="mt-2 text-slate-400">{a.summary}</p>}
        {isAdmin && !a.builtin && <Button size="sm" variant="ghost" className="mt-3" onClick={() => onEdit(a)}><Pencil className="size-4" />Editar</Button>}
        <Card className="mt-5"><Markdown source={a.body} /></Card>
      </article>
      <aside className="space-y-3">
        <Biwi size={64} say="¿No era esto lo que buscabas? Escríbele a tu contacto de Big Way y lo agregamos aquí." />
        {related.length > 0 && <Card><div className="mb-2 text-sm font-bold text-white">En esta sección</div>
          {related.map((r) => <Link key={r.slug} to={`/ayuda/${r.slug}`} className="block rounded-lg px-2 py-1.5 text-sm text-slate-300 hover:bg-white/5 hover:text-white">{r.title}</Link>)}</Card>}
      </aside>
    </div>
  );
}

export default function HelpApp() {
  const slug = useParams()["*"];
  const { isAdmin } = useAuth();
  const [db, setDb] = useState([]); const [q, setQ] = useState(""); const [sec, setSec] = useState(null); const [edit, setEdit] = useState(null);
  const load = () => api.listArticles().then(setDb).catch(() => setDb([]));
  useEffect(() => { load(); }, []);
  const all = useMemo(() => [...ARTICLES, ...db.filter((d) => isAdmin || d.published)]
    .filter((a) => isAdmin || a.audience === "todos"), [db, isAdmin]);
  const found = q.trim() ? search(all, q) : null;
  const current = slug && all.find((a) => a.slug === slug);

  if (slug && current) return <>
    <ArticleView a={current} isAdmin={isAdmin} onEdit={setEdit} related={all.filter((a) => a.section === current.section && a.slug !== current.slug)} />
    {edit && <Editor article={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
  </>;

  const list = found || (sec ? all.filter((a) => a.section === sec) : null);
  return (
    <div>
      <div className="relative mb-8 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-bwo-violet/25 via-bwo-ink to-bwo-turquoise/10 p-6 sm:p-8">
        <img src="/brand/bwo-mark.webp" alt="" aria-hidden="true" className="pointer-events-none absolute -right-6 -top-10 h-72 opacity-20" />
        <div className="relative flex flex-wrap items-end gap-6">
          <div className="min-w-0 flex-1">
            <div className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-bwo-amber">Centro de ayuda</div>
            <h1 className="text-3xl font-black text-white sm:text-4xl">¿En qué te ayudo?</h1>
            <p className="mt-2 max-w-xl text-slate-300">Guías, tutoriales, cómo trabajamos y documentación de BWO Engine.</p>
            <label className="relative mt-5 block max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pregúntale a Biwi: cómo apruebo, qué incluye el programa 02…" aria-label="Buscar en el Centro de ayuda"
                className="h-12 w-full rounded-2xl border border-white/15 bg-white/10 pl-10 pr-4 text-sm text-white placeholder-slate-400 outline-none focus:border-bwo-violet" />
            </label>
          </div>
          <img src="/brand/biwi.webp" alt="Biwi" className="hidden h-44 w-auto sm:block" />
        </div>
      </div>

      {isAdmin && <div className="mb-4 flex justify-end"><Button onClick={() => setEdit({ section: sec || "articulos", audience: "todos", published: true, title: "", body: "" })}><Plus className="size-4" />Nuevo artículo</Button></div>}

      {list ? (
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm text-slate-400">
            <button className="underline" onClick={() => { setSec(null); setQ(""); }}>Todas las secciones</button>
            <span>· {found ? `${found.length} resultados para «${q}»` : sectionOf(sec)?.label}</span>
          </div>
          {list.length ? <div className="grid gap-3 md:grid-cols-2">{list.map((a) => <ArticleCard key={a.slug} a={a} />)}</div>
            : <Empty biwi title="No encontré nada con esas palabras">Prueba con otras, como «aprobar», «precios» o «teleprompter».</Empty>}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {SECTIONS.map((s) => { const Icon = ICONS[s.id]; const items = all.filter((a) => a.section === s.id); if (!items.length) return null; return (
            <Card key={s.id} className="flex flex-col">
              <button onClick={() => setSec(s.id)} className="mb-3 flex items-center gap-3 text-left">
                <span className="grid size-10 place-items-center rounded-xl bg-bwo-violet/20 text-bwo-violetLt"><Icon className="size-5" /></span>
                <span><span className="block font-bold text-white">{s.label}</span><span className="text-xs text-slate-400">{s.desc}</span></span>
              </button>
              <div className="space-y-0.5">{items.slice(0, 4).map((a) => <Link key={a.slug} to={`/ayuda/${a.slug}`} className="block truncate rounded-lg px-2 py-1.5 text-sm text-slate-300 hover:bg-white/5 hover:text-white">{a.title}</Link>)}</div>
              {items.length > 4 && <button onClick={() => setSec(s.id)} className="mt-auto pt-2 text-left text-xs font-semibold text-bwo-turquoiseLt">Ver los {items.length} →</button>}
            </Card>); })}
        </div>
      )}
      {edit && <Editor article={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </div>
  );
}

function ArticleCard({ a }) {
  return (
    <Link to={`/ayuda/${a.slug}`} className="block">
      <Card className="h-full p-4 transition hover:border-white/20">
        <div className="mb-1 flex gap-2"><Badge color="slate">{sectionOf(a.section)?.label}</Badge>{a.audience === "agencia" && <Badge color="amber">Agencia</Badge>}{a.published === false && <Badge color="red">Borrador</Badge>}</div>
        <div className="font-bold text-white">{a.title}</div>
        <p className="mt-1 text-sm text-slate-400">{a.summary}</p>
      </Card>
    </Link>
  );
}
