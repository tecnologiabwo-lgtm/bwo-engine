import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { LayoutGrid, Clapperboard, Receipt, FileBarChart, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useClient } from "@/lib/clientContext";
import { supabase } from "@/lib/supabase";
import { AnimatedNumber } from "@/components/ui/number";
import TextAnimation from "@/components/ui/scroll-text";
import { Card } from "@/components/ui/primitives";

const COUNT = { style: "decimal", maximumFractionDigits: 0 };

/** Conteo tolerante: si la tabla aún no existe (migración pendiente), devuelve null. */
async function count(q) {
  const { count: n, error } = await q;
  return error ? null : n ?? 0;
}

export default function Home() {
  const { profile, isAdmin } = useAuth();
  const { client, clientId } = useClient();
  const [k, setK] = useState({});

  useEffect(() => {
    let off = false;
    (async () => {
      const head = { count: "exact", head: true };
      const byClient = (q) => (isAdmin || !clientId ? q : q.eq("client_id", clientId));
      const [posts, changes, pieces, quotes, reports] = await Promise.all([
        count(byClient(supabase.from("posts").select("id", head).eq("status", "pending").eq("archived", false))),
        count(byClient(supabase.from("posts").select("id", head).eq("status", "changes").eq("archived", false))),
        count(byClient(supabase.from("sala_pieces").select("id", head).eq("status", "aprobacion"))),
        count(supabase.from("quotes").select("id", head).eq("status", "solicitada")),
        count(byClient(supabase.from("reports").select("id", head))),
      ]);
      if (!off) setK({ posts, changes, pieces, quotes, reports });
    })();
    return () => { off = true; };
  }, [isAdmin, clientId]);

  const name = profile?.full_name || (profile?.email || "").split("@")[0];
  const cards = isAdmin
    ? [
        { to: "/feed", icon: LayoutGrid, label: "Posts esperando al cliente", n: k.posts, tone: "#A78BFA" },
        { to: "/feed", icon: LayoutGrid, label: "Posts con cambios pedidos", n: k.changes, tone: "#E6197E" },
        { to: "/sala", icon: Clapperboard, label: "Guiones en aprobación", n: k.pieces, tone: "#F5A623" },
        { to: "/cotizador", icon: Receipt, label: "Cotizaciones solicitadas por clientes", n: k.quotes, tone: "#22D3C5" },
      ]
    : [
        { to: "/feed", icon: LayoutGrid, label: "Publicaciones por aprobar", n: k.posts, tone: "#A78BFA" },
        { to: "/sala", icon: Clapperboard, label: "Guiones por aprobar", n: k.pieces, tone: "#F5A623" },
        { to: "/reportes", icon: FileBarChart, label: "Reportes disponibles", n: k.reports, tone: "#22D3C5" },
        { to: "/cotizador", icon: Receipt, label: "Cotizaciones enviadas", n: k.quotes, tone: "#E6197E" },
      ];

  return (
    <div>
      <div className="mb-8 pt-2">
        <div className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-bwo-amber">{isAdmin ? "Agencia" : client?.name}</div>
        <TextAnimation as="h1" text={`Hola, ${name}.`} classname="text-4xl font-black tracking-tight text-white sm:text-5xl" />
        <p className="mt-2 text-slate-400">{isAdmin ? "Esto es lo que necesita atención hoy en todos los clientes." : "Esto es lo que necesitamos de ti."}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Link to={c.to} className="group block">
              <Card className="h-full transition hover:-translate-y-0.5 hover:border-white/20">
                <c.icon className="mb-4 size-5" style={{ color: c.tone }} />
                <div className="text-4xl font-black text-white">{c.n == null ? "—" : <AnimatedNumber value={c.n} format={COUNT} />}</div>
                <div className="mt-1 flex items-center justify-between text-sm text-slate-400">{c.label}<ArrowRight className="size-4 opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100" /></div>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
