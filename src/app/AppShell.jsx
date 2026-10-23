import { Suspense, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { LogOut, Menu, X, ChevronsUpDown, UserCircle2 } from "lucide-react";
import { LiquidGlassCard } from "@/components/ui/liquid-glass";
import { Spinner } from "@/components/ui/primitives";
import { useAuth } from "@/lib/auth";
import { useClient } from "@/lib/clientContext";
import { cn } from "@/lib/utils";
import { modulesFor, labelFor } from "./modules.js";

export function Backdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bwo-inkDeep">
      <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 18% 22%,#191A3E 0%,transparent 55%),radial-gradient(circle at 85% 72%,#4C1D95 0%,transparent 50%),radial-gradient(circle at 50% 100%,#0D0B2E 0%,#020617 100%)" }} />
      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-bwo-violet/20 blur-[120px]" />
      <div className="absolute -right-32 top-1/4 h-[30rem] w-[30rem] rounded-full bg-bwo-cerise/10 blur-[140px]" />
      <div className="absolute -bottom-32 left-1/3 h-[28rem] w-[28rem] rounded-full bg-bwo-turquoise/10 blur-[130px]" />
    </div>
  );
}

function ClientPicker() {
  const { clients, clientId, choose } = useClient();
  if (!clients.length) return <p className="px-1 text-xs text-slate-400">Sin clientes asignados</p>;
  return (
    <label className="relative block">
      <span className="mb-1 block px-1 text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">Cliente</span>
      <select value={clientId || ""} onChange={(e) => choose(e.target.value)}
        className="w-full appearance-none rounded-xl border border-white/15 bg-white/10 py-2 pl-3 pr-8 text-sm font-semibold text-white outline-none focus:border-bwo-violet [&>option]:text-bwo-ink">
        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <ChevronsUpDown className="pointer-events-none absolute bottom-2.5 right-2.5 size-4 text-slate-400" />
    </label>
  );
}

function Sidebar({ onNavigate }) {
  const { profile, signOut } = useAuth();
  const role = profile?.role || "viewer";
  return (
    <LiquidGlassCard glowIntensity="sm" shadowIntensity="sm" borderRadius="20px" blurIntensity="md" className="flex h-full w-[264px] flex-col p-4">
      <div className="mb-5 flex items-center gap-3 px-1">
        <div className="grid size-10 place-items-center rounded-xl text-sm font-black text-white shadow-lg" style={{ background: "linear-gradient(135deg,#6C3BF5,#E6197E)" }}>WO</div>
        <div>
          <div className="text-sm font-extrabold leading-tight text-white">BWO Engine</div>
          <div className="text-[10px] text-slate-400">{role === "admin" ? "Agencia · Big Way Offices" : "Portal de clientes"}</div>
        </div>
      </div>
      <ClientPicker />
      <nav className="relative z-30 mt-4 flex-1 space-y-1 overflow-y-auto" aria-label="Módulos">
        {modulesFor(role).map((m) => {
          const Icon = m.icon;
          return (
            <NavLink key={m.id} to={`/${m.path}`} onClick={onNavigate}
              className={({ isActive }) => cn("relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive ? "text-bwo-inkDeep" : "text-white hover:bg-white/15")}>
              {({ isActive }) => (<>
                {isActive && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-xl bg-white shadow-lg" transition={{ type: "spring", bounce: 0.15, duration: 0.45 }} />}
                <Icon className="relative z-10 size-[18px]" />
                <span className="relative z-10">{labelFor(m, role)}</span>
              </>)}
            </NavLink>
          );
        })}
      </nav>
      <div className="mt-3 border-t border-white/10 pt-3">
        <NavLink to="/cuenta" onClick={onNavigate} className="flex items-center gap-2 rounded-xl px-2 py-2 text-xs text-slate-300 hover:bg-white/10">
          <UserCircle2 className="size-4" /><span className="truncate">{profile?.full_name || profile?.email}</span>
        </NavLink>
        <button onClick={signOut} className="mt-1 flex w-full items-center gap-2 rounded-xl px-2 py-2 text-xs text-slate-300 hover:bg-white/10">
          <LogOut className="size-4" />Cerrar sesión
        </button>
      </div>
    </LiquidGlassCard>
  );
}

export default function AppShell() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  return (
    <div className="min-h-screen text-slate-100">
      <Backdrop />
      <div className="mx-auto flex max-w-[1600px] gap-5 p-3 sm:p-5">
        <aside className="bwo sticky top-5 hidden h-[calc(100vh-2.5rem)] lg:block"><Sidebar /></aside>
        <div className="bwo fixed inset-x-3 top-3 z-40 flex items-center justify-between lg:hidden">
          <button onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-xl border border-white/15 bg-bwo-ink/80 backdrop-blur" aria-label="Abrir menú"><Menu className="size-5" /></button>
        </div>
        <AnimatePresence>
          {open && (
            <motion.div className="bwo fixed inset-0 z-50 bg-black/50 p-3 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
              <motion.div className="h-full w-fit" initial={{ x: -30 }} animate={{ x: 0 }} exit={{ x: -30 }} onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setOpen(false)} className="absolute right-4 top-4 grid size-10 place-items-center rounded-xl bg-white/10" aria-label="Cerrar menú"><X className="size-5" /></button>
                <Sidebar onNavigate={() => setOpen(false)} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        <main className="min-w-0 flex-1 pt-14 lg:pt-0">
          <Suspense fallback={<Spinner label="Cargando módulo…" />}>
            <motion.div key={loc.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <Outlet />
            </motion.div>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
