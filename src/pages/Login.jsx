import { useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { MailCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Backdrop } from "@/app/AppShell";
import { LiquidGlassCard } from "@/components/ui/liquid-glass";
import TextAnimation from "@/components/ui/scroll-text";
import { Button, Field, Input, Textarea } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const REASONS = {
  inactividad: "Cerramos tu sesión por inactividad. Vuelve a ingresar.",
  limite: "Tu sesión llegó al tiempo máximo permitido. Vuelve a ingresar.",
  bloqueada: "Tu cuenta fue suspendida. Escribe a Big Way Offices.",
};

/** Reglas mínimas de contraseña: 10+ caracteres con letras y números. */
const weak = (p) => p.length < 10 || !/[a-zA-Z]/.test(p) || !/\d/.test(p);

export default function Login() {
  const { session, loading, signIn, signUp, sendReset } = useAuth();
  const [params] = useSearchParams();
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ email: "", password: "", password2: "", full_name: "", company: "", phone: "", note: "", accept: false });
  const [msg, setMsg] = useState(REASONS[params.get("motivo")] || (params.get("confirmado") ? "Correo confirmado. Ya puedes ingresar." : ""));
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  if (!loading && session) return <Navigate to="/inicio" replace />;
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault(); setMsg("");
    if (mode === "registro") {
      if (!f.full_name.trim() || !f.company.trim()) return setMsg("Escribe tu nombre y el de tu empresa.");
      if (weak(f.password)) return setMsg("La contraseña debe tener al menos 10 caracteres, con letras y números.");
      if (f.password !== f.password2) return setMsg("Las contraseñas no coinciden.");
      if (!f.accept) return setMsg("Debes aceptar el uso de tus datos para la verificación.");
    }
    setBusy(true);
    try {
      if (mode === "login") await signIn(f.email.trim(), f.password);
      else { await signUp({ email: f.email.trim(), password: f.password, full_name: f.full_name.trim(), company: f.company.trim(), phone: f.phone.trim(), note: f.note.trim() }); setSent(true); }
    } catch (err) { setMsg(err.message); } finally { setBusy(false); }
  };
  const reset = async () => {
    if (!f.email.trim()) { setMsg("Escribe tu correo para enviarte el enlace."); return; }
    try { await sendReset(f.email.trim()); setMsg("Si el correo existe, te enviamos un enlace para crear una nueva contraseña."); } catch (err) { setMsg(err.message); }
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
            <div className="relative z-10">
              <div className="mb-5 flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-xl text-sm font-black text-white" style={{ background: "linear-gradient(135deg,#6C3BF5,#E6197E)" }}>WO</div>
                <div><div className="text-lg font-extrabold text-white">BWO Engine</div><div className="text-xs text-slate-400">{mode === "login" ? "Ingresa con tu cuenta" : "Solicita acceso a tu portal"}</div></div>
              </div>
              {!sent && (
                <div className="mb-5 grid grid-cols-2 rounded-xl bg-white/5 p-1 text-sm font-semibold" role="tablist">
                  {[["login", "Ingresar"], ["registro", "Crear cuenta"]].map(([k, l]) => (
                    <button key={k} role="tab" aria-selected={mode === k} onClick={() => { setMode(k); setMsg(""); }} className={cn("relative rounded-lg py-2", mode === k ? "text-bwo-inkDeep" : "text-slate-300")}>
                      {mode === k && <motion.span layoutId="auth-tab" className="absolute inset-0 rounded-lg bg-white" />}<span className="relative">{l}</span>
                    </button>
                  ))}
                </div>
              )}
              <AnimatePresence mode="wait">
                {sent ? (
                  <motion.div key="sent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 text-center">
                    <MailCheck className="mx-auto size-10 text-bwo-turquoise" />
                    <h2 className="text-lg font-bold text-white">Revisa tu correo</h2>
                    <p className="text-sm text-slate-300">Te enviamos un enlace para confirmar <b>{f.email}</b>. Después, el equipo de Big Way Offices verificará tu registro y te dará acceso al portal de tu empresa.</p>
                    <Button variant="ghost" onClick={() => { setSent(false); setMode("login"); }}>Volver a ingresar</Button>
                  </motion.div>
                ) : (
                  <motion.form key={mode} onSubmit={submit} initial={{ opacity: 0, x: mode === "login" ? -10 : 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-3.5">
                    {mode === "registro" && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Nombre y apellido"><Input autoComplete="name" required value={f.full_name} onChange={set("full_name")} maxLength={120} /></Field>
                        <Field label="Empresa"><Input autoComplete="organization" required value={f.company} onChange={set("company")} maxLength={120} /></Field>
                        <Field label="Teléfono / WhatsApp" className="sm:col-span-2"><Input type="tel" autoComplete="tel" value={f.phone} onChange={set("phone")} maxLength={40} /></Field>
                      </div>
                    )}
                    <Field label="Correo"><Input type="email" autoComplete="email" required value={f.email} onChange={set("email")} /></Field>
                    <Field label="Contraseña" hint={mode === "registro" ? "Mínimo 10 caracteres, con letras y números" : undefined}>
                      <Input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required value={f.password} onChange={set("password")} />
                    </Field>
                    {mode === "registro" && (<>
                      <Field label="Repite la contraseña"><Input type="password" autoComplete="new-password" required value={f.password2} onChange={set("password2")} /></Field>
                      <Field label="¿Algo que debamos saber? (opcional)"><Textarea rows={2} maxLength={500} value={f.note} onChange={set("note")} placeholder="Ej.: soy el gerente comercial de…" /></Field>
                      <label className="flex items-start gap-2 text-xs text-slate-300"><input type="checkbox" checked={f.accept} onChange={set("accept")} className="mt-0.5 accent-bwo-violet" />Acepto que Big Way Offices use estos datos para verificar mi identidad y darme acceso.</label>
                    </>)}
                    {msg && <p className="text-sm text-bwo-ceriseLt" role="alert">{msg}</p>}
                    <Button type="submit" size="lg" className="w-full" loading={busy}>{mode === "login" ? "Entrar" : "Solicitar acceso"}</Button>
                    {mode === "login" && <button type="button" onClick={reset} className="w-full text-center text-xs text-slate-400 hover:text-white">¿Olvidaste tu contraseña?</button>}
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </LiquidGlassCard>
        </motion.div>
      </div>
    </div>
  );
}
