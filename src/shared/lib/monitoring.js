/* Tracking de errores en producción.
 * Envía a Supabase (tabla client_errors, vía log_client_error) los errores que
 * ocurren en el navegador: excepciones no capturadas, promesas rechazadas y
 * errores de renderizado de React (ErrorBoundary).
 * - Sin dependencias ni servicios externos (gratis).
 * - Agrupa repetidos (mismo mensaje en 60 s) y limita a 20 envíos por pestaña.
 * - Nunca rompe la app: si el envío falla, se ignora.
 * Si más adelante se quiere Sentry, basta con llamar también a Sentry desde report(). */
import { supabase } from "./supabase.js";

/* global __APP_RELEASE__ */
export const RELEASE = typeof __APP_RELEASE__ !== "undefined" ? __APP_RELEASE__ : "dev";
const MAX_PER_TAB = 20, DEDUPE_MS = 60_000;
let sent = 0;
const recent = new Map();
const IGNORE = [/ResizeObserver loop/i, /Loading chunk \d+ failed/i, /^Script error\.?$/i, /AbortError/i];

export function report(error, context = {}) {
  try {
    const message = String(error?.message || error || "Error desconocido").slice(0, 1000);
    if (IGNORE.some((r) => r.test(message))) return;
    const key = message + (context.source || "");
    const now = Date.now();
    if (recent.has(key) && now - recent.get(key) < DEDUPE_MS) return;
    recent.set(key, now);
    if (++sent > MAX_PER_TAB) return;
    if (import.meta.env.DEV) console.error("[monitoreo]", error, context);
    supabase?.rpc("log_client_error", {
      p_message: message,
      p_stack: error?.stack ? String(error.stack).slice(0, 6000) : null,
      p_url: location.pathname + location.search.replace(/token=[^&]+/, "token=***"),
      p_release: RELEASE,
      p_user_agent: navigator.userAgent.slice(0, 300),
      p_context: { ...context, viewport: `${innerWidth}x${innerHeight}` },
    }).then(() => {}, () => {});
  } catch { /* el monitoreo nunca debe fallar */ }
}

export function initMonitoring() {
  addEventListener("error", (e) => report(e.error || e.message, { source: "window.error", file: e.filename, line: e.lineno }));
  addEventListener("unhandledrejection", (e) => report(e.reason, { source: "unhandledrejection" }));
}
