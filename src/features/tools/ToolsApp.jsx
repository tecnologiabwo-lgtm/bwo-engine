import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Copy, QrCode, Wrench, ShoppingBag } from "lucide-react";
import { Button, Card, PageHeader, Badge } from "@/shared/ui/primitives";
import { Biwi, SOCIAL } from "@/shared/ui/brand";
import { useToast } from "@/shared/ui/toast";
import { cn } from "@/shared/lib/utils";
import { TOOLS, TAGS, toolById } from "./catalog.js";

function ToolIcon({ icon, className }) {
  if (icon === "whatsapp") return <img src={SOCIAL.whatsapp} alt="" className={cn("size-9", className)} />;
  if (icon === "store") return <span className={cn("grid size-9 place-items-center rounded-xl bg-bwo-cerise/20 text-bwo-ceriseLt", className)}><ShoppingBag className="size-5" /></span>;
  return <span className={cn("grid size-9 place-items-center rounded-xl bg-bwo-violet/20 text-bwo-violetLt", className)}><QrCode className="size-5" /></span>;
}

function ToolView({ tool }) {
  const toast = useToast(); const nav = useNavigate(); const [h, setH] = useState(900);
  const publicUrl = `${location.origin}${tool.src}`;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => nav("/herramientas")}><ArrowLeft className="size-4" />Herramientas</Button>
        <div className="mr-auto flex items-center gap-2"><ToolIcon icon={tool.icon} className="size-7" /><h1 className="text-lg font-extrabold text-white">{tool.title}</h1></div>
        <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(publicUrl).then(() => toast("Enlace público copiado"))}><Copy className="size-4" />Copiar enlace público</Button>
        <Button variant="ghost" size="sm" onClick={() => open(tool.src, "_blank", "noopener")}><ExternalLink className="size-4" />Abrir aparte</Button>
      </div>
      <iframe title={tool.title} src={`${tool.src}?embed=1`} className="w-full rounded-2xl border border-white/10 bg-[#f6f4ff]" style={{ height: h }}
        onLoad={(e) => { try { const d = e.target.contentDocument; const fit = () => setH(Math.max(700, d.documentElement.scrollHeight + 24)); fit(); new ResizeObserver(fit).observe(d.body); } catch {} }} />
    </div>
  );
}

export default function ToolsApp() {
  const id = useParams()["*"];
  const tool = id && toolById(id);
  const [tag, setTag] = useState("Todas");
  if (tool) return <ToolView tool={tool} />;
  const list = tag === "Todas" ? TOOLS : TOOLS.filter((t) => t.tag === tag);
  return (
    <div>
      <PageHeader eyebrow="Kit Big Way" title="Herramientas" subtitle="Calculadoras y generadores listos para usar con clientes. También son recursos públicos: comparte el enlace para atraer tráfico a Big Way." />
      <Biwi className="mb-6" size={72} say="Tip: usa el generador de enlaces con una variante por canal y sabrás si el cliente llegó por la bio, un anuncio o el QR." />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {TAGS.map((t) => <button key={t} onClick={() => setTag(t)} className={cn("rounded-full border px-3 py-1 text-xs font-semibold", tag === t ? "border-bwo-violet bg-bwo-violet/25 text-white" : "border-white/10 text-slate-400 hover:text-white")}>{t}</button>)}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {list.map((t) => (
          <Link key={t.id} to={`/herramientas/${t.id}`} className="group block">
            <Card className="h-full transition hover:-translate-y-0.5 hover:border-white/20">
              <div className="mb-3 flex items-center gap-3"><ToolIcon icon={t.icon} /><Badge color={t.tag === "Captación" ? "turquoise" : t.tag === "Presupuesto" ? "amber" : t.tag === "E-commerce" ? "cerise" : "violet"}>{t.tag}</Badge></div>
              <div className="text-base font-bold text-white">{t.title}</div>
              <p className="mt-1 text-sm text-slate-400">{t.desc}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">{t.uses.map((u) => <span key={u} className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-300">{u}</span>)}</div>
            </Card>
          </Link>
        ))}
      </div>
      <p className="mt-6 flex items-center gap-2 text-xs text-slate-500"><Wrench className="size-3.5" />Las tarifas de WhatsApp se actualizan cada trimestre en <code>public/recursos/assets/rates.js</code> (lo explica el Centro de ayuda).</p>
    </div>
  );
}
