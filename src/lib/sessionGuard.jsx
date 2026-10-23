import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Clock } from "lucide-react";
import { supabase } from "./supabase.js";
import { useAuth } from "./auth.jsx";

/* Gestión del ciclo de vida de la sesión:
 *  - Expiración por inactividad (idle_minutes) con aviso previo (warn_seconds).
 *  - Expiración absoluta (max_hours) contada desde el inicio de sesión.
 *  - Latido al servidor (touch_session) cada 4 min: si la agencia bloquea la cuenta,
 *    la sesión se cierra en el siguiente latido aunque el token siga vigente.
 *  - La actividad se comparte entre pestañas (localStorage), así una pestaña
 *    olvidada no cierra la sesión de otra en uso.
 *  Los valores se editan en app_settings.session. */
const DEFAULTS = { idle_minutes: 30, max_hours: 12, warn_seconds: 60 };
const KEY = "bwo.lastActivity";
const HEARTBEAT_MS = 4 * 60 * 1000;
const now = () => Date.now();
const readLast = () => { try { return +localStorage.getItem(KEY) || now(); } catch { return now(); } };
const writeLast = (t) => { try { localStorage.setItem(KEY, String(t)); } catch {} };

export function SessionGuard() {
  const { session, signOut } = useAuth();
  const [cfg, setCfg] = useState(DEFAULTS);
  const [warn, setWarn] = useState(null);   // segundos restantes o null
  const lastWrite = useRef(0);

  useEffect(() => {
    supabase.from("app_settings").select("value").eq("key", "session").maybeSingle()
      .then(({ data }) => data?.value && setCfg({ ...DEFAULTS, ...data.value }));
  }, []);

  const expire = useCallback(async (reason) => {
    try { localStorage.removeItem(KEY); } catch {}
    await signOut();
    location.replace(`/login?motivo=${reason}`);
  }, [signOut]);

  // Registrar actividad (con freno: como mucho una escritura cada 5 s)
  useEffect(() => {
    if (!session) return;
    writeLast(now());
    const mark = () => { const t = now(); if (t - lastWrite.current > 5000) { lastWrite.current = t; writeLast(t); setWarn(null); } };
    const evs = ["pointerdown", "keydown", "scroll", "touchstart", "wheel"];
    evs.forEach((e) => addEventListener(e, mark, { passive: true }));
    return () => evs.forEach((e) => removeEventListener(e, mark));
  }, [session]);

  // Reloj: inactividad y límite absoluto
  useEffect(() => {
    if (!session) return;
    const started = Date.parse(session.user?.last_sign_in_at || "") || now();
    const tick = () => {
      if (now() - started > cfg.max_hours * 3600e3) return expire("limite");
      const left = cfg.idle_minutes * 60e3 - (now() - readLast());
      if (left <= 0) return expire("inactividad");
      setWarn(left <= cfg.warn_seconds * 1000 ? Math.ceil(left / 1000) : null);
    };
    tick();
    const h = setInterval(tick, 1000);
    return () => clearInterval(h);
  }, [session, cfg, expire]);

  // Latido: el servidor confirma que la cuenta sigue activa
  useEffect(() => {
    if (!session) return;
    const beat = async () => {
      if (document.hidden) return;
      const { data, error } = await supabase.rpc("touch_session");
      if (!error && data && data !== "active") expire("bloqueada");
    };
    beat();
    const h = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(h);
  }, [session, expire]);

  return (
    <AnimatePresence>
      {warn != null && (
        <motion.div className="bwo fixed inset-0 z-[90] grid place-items-center bg-black/60 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="alertdialog" aria-modal="true" aria-labelledby="sg-t">
          <motion.div initial={{ scale: .96 }} animate={{ scale: 1 }} className="w-full max-w-sm rounded-3xl border border-white/10 bg-bwo-inkDeep p-6 text-center shadow-2xl">
            <Clock className="mx-auto mb-3 size-8 text-bwo-amber" />
            <h2 id="sg-t" className="text-lg font-extrabold text-white">¿Sigues ahí?</h2>
            <p className="mt-1 text-sm text-slate-400">Por seguridad cerraremos tu sesión por inactividad en <b className="tabular-nums text-white">{warn} s</b>.</p>
            <div className="mt-5 flex justify-center gap-2">
              <button onClick={() => expire("manual")} className="h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-slate-200">Cerrar sesión</button>
              <button autoFocus onClick={() => { writeLast(now()); setWarn(null); }} className="h-10 rounded-xl bg-bwo-violet px-4 text-sm font-semibold text-white">Seguir conectado</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
