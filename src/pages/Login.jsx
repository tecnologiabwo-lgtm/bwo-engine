import { useState } from "react";
import { Navigate } from "react-router-dom";
import { motion } from "motion/react";
import { useAuth } from "@/lib/auth";
import { Backdrop } from "@/app/AppShell";
import { LiquidGlassCard } from "@/components/ui/liquid-glass";
import TextAnimation from "@/components/ui/scroll-text";
import { Button, Field, Input } from "@/components/ui/primitives";

export default function Login() {
  const { session, loading, signIn, sendReset } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  if (!loading && session) return <Navigate to="/inicio" replace />;

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setMsg("");
    try { await signIn(email.trim(), password); } catch (err) { setMsg(err.message); } finally { setBusy(false); }
  };
  const reset = async () => {
    if (!email.trim()) { setMsg("Escribe tu correo para enviarte el enlace."); return; }
    try { await sendReset(email.trim()); setMsg("Te enviamos un enlace para crear una nueva contraseña."); } catch (err) { setMsg(err.message); }
  };

  return (
    <div className="bwo grid min-h-screen place-items-center p-4 text-slate-100">
      <Backdrop />
      <div className="grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div className="hidden lg:block">
          <div className="mb-4 text-xs font-bold uppercase tracking-[.2em] text-bwo-amber">Big Way Offices</div>
          <TextAnimation as="h1" text="Convertimos ideas en sistemas que venden." classname="text-6xl font-black leading-[1.02] tracking-tight text-white" />
          <TextAnimation as="p" letterAnime stagger={0.012} text="Feed, guiones, reportes, cotizaciones y proyecciones en un solo lugar."
            classname="mt-6 max-w-md text-lg text-slate-300"
            variants={{ hidden: { filter: "blur(4px)", opacity: 0, y: 12 }, visible: { filter: "blur(0px)", opacity: 1, y: 0, transition: { duration: 0.2 } } }} />
        </div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <LiquidGlassCard borderRadius="24px" blurIntensity="lg" shadowIntensity="md" glowIntensity="md" className="p-8">
            <form onSubmit={submit} className="relative z-10 space-y-4">
              <div className="mb-2 flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-xl text-sm font-black text-white" style={{ background: "linear-gradient(135deg,#6C3BF5,#E6197E)" }}>WO</div>
                <div><div className="text-lg font-extrabold text-white">BWO Engine</div><div className="text-xs text-slate-400">Ingresa con tu cuenta</div></div>
              </div>
              <Field label="Correo"><Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
              <Field label="Contraseña"><Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
              {msg && <p className="text-sm text-bwo-ceriseLt" role="alert">{msg}</p>}
              <Button type="submit" size="lg" className="w-full" loading={busy}>Entrar</Button>
              <button type="button" onClick={reset} className="w-full text-center text-xs text-slate-400 hover:text-white">¿Olvidaste tu contraseña?</button>
            </form>
          </LiquidGlassCard>
        </motion.div>
      </div>
    </div>
  );
}
