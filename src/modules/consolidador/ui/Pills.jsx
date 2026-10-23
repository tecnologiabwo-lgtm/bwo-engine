import React, { useId, useState } from "react";
import { motion, LayoutGroup, AnimatePresence } from "motion/react";

/* ============================================================
   Pills — grupo de pestañas con indicador «magnético»
   Reimplementación propia del PreviewTab que se compartió
   (motion.button + layoutId), sin dependencias de Next ni de
   @/components/ui/tab:
   - el fondo activo se desliza de una pestaña a otra (layoutId)
   - efecto «hover»: un resalte suave sigue al cursor
   - efecto «wobbly»: resorte con un leve rebote al llegar
   Con «reducir movimiento» del sistema (MotionConfig
   reducedMotion="user" en main.jsx) los cambios son instantáneos.
   ============================================================ */

const SPRING = { type: "spring", stiffness: 420, damping: 30, mass: 0.8 };      // wobbly sutil
const HOVER = { type: "spring", stiffness: 520, damping: 38 };

export function Pills({ value, onChange, options, label, style, size }) {
  const gid = useId();
  const [hover, setHover] = useState(null);
  return (
    <LayoutGroup id={gid}>
      <div className={"pills mg" + (size === "sm" ? " sm" : "")} role="tablist" aria-label={label} style={style}
        onMouseLeave={() => setHover(null)}>
        {options.map((o) => {
          const on = o.key === value;
          return (
            <button key={o.key} type="button" role="tab" aria-selected={on}
              className={"pill mg-pill" + (on ? " on" : "")} disabled={o.disabled} title={o.title}
              onMouseEnter={() => !o.disabled && setHover(o.key)}
              onFocus={() => !o.disabled && setHover(o.key)} onBlur={() => setHover(null)}
              onClick={() => !o.disabled && onChange(o.key)}>
              {hover === o.key && !on && <motion.span layoutId="hover" className="mg-hover" transition={HOVER} />}
              {on && <motion.span layoutId="active" className="mg-ind" transition={SPRING} />}
              <span className="mg-lab">{o.label}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

/** Transición de contenido entre pestañas (equivalente a TabsContent). */
export function TabPanel({ k, children, y = 8 }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={k} role="tabpanel"
        initial={{ opacity: 0, y }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -y / 2 }}
        transition={{ duration: 0.18, ease: "easeOut" }}>
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export const PILLS_CSS = `
.pills.mg{gap:4px}
.pill.mg-pill{position:relative;isolation:isolate;background:#fff;transition:color .15s ease,border-color .15s ease}
.pill.mg-pill.on,.pill.mg-pill.on:hover,.pill.mg-pill.on:focus{background:transparent;color:#fff;border-color:transparent}
.pill.mg-pill:hover:not(:disabled){color:var(--ink)}
.pill.mg-pill.on:hover:not(:disabled){color:#fff}
.mg-lab{position:relative;z-index:2}
.mg-ind{position:absolute;inset:-1px;z-index:1;background:conic-gradient(from 90deg at 50% 50%,#2E4A63 0%,#0F1E2B 50%,#24405A 100%);box-shadow:0 3px 12px rgba(15,30,43,.28)}
.mg-hover{position:absolute;inset:0;z-index:0;background:var(--paper)}
.pill.mg-pill:focus-visible{outline:2px solid var(--amber);outline-offset:2px}
.pills.mg.sm .pill{padding:5px 12px;font-size:11.5px}
`;
