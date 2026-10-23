import { useEffect, useRef, useState } from "react";
import { ExternalLink, Maximize2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useClient } from "@/lib/clientContext";
import { Button, Empty } from "@/components/ui/primitives";
import { LayoutGrid } from "lucide-react";

/* Fase 1: el Feed Planner (vanilla, con datos en producción) se integra tal cual
   desde /feed. Comparte sesión con la plataforma porque usa el mismo proyecto
   de Supabase en el mismo dominio. Se migrará a React en una fase posterior. */
export default function FeedApp() {
  const { isAdmin } = useAuth();
  const { client } = useClient();
  const ref = useRef(null);
  const [h, setH] = useState(820);

  useEffect(() => {
    const fit = () => setH(Math.max(640, window.innerHeight - 40));
    fit(); addEventListener("resize", fit); return () => removeEventListener("resize", fit);
  }, []);

  if (!isAdmin && !client?.share_token) return <Empty icon={LayoutGrid} title="Tu feed aún no está disponible">Big Way Offices todavía no ha preparado la vista de tu feed.</Empty>;
  const src = isAdmin ? "/feed/panel.html" : `/feed/cliente.html?token=${encodeURIComponent(client.share_token)}`;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div><h1 className="text-xl font-extrabold text-white">{isAdmin ? "Feed Planner" : "Tu feed"}</h1>
          <p className="text-xs text-slate-400">{isAdmin ? "Planifica, ordena y envía publicaciones a aprobación." : "Revisa cómo se verá tu feed y aprueba o pide cambios."}</p></div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => ref.current?.requestFullscreen?.()}><Maximize2 className="size-4" />Pantalla completa</Button>
          <Button size="sm" variant="ghost" onClick={() => window.open(src, "_blank", "noopener")}><ExternalLink className="size-4" />Abrir aparte</Button>
        </div>
      </div>
      <iframe ref={ref} key={src} src={src} title="Feed Planner" className="w-full rounded-2xl border border-white/10 bg-[#0D0E24] shadow-2xl" style={{ height: h }} />
    </div>
  );
}
