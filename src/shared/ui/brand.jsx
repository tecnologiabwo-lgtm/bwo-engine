import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/shared/lib/utils";

/** Logo horizontal oficial. tone="light" (texto blanco) para fondos oscuros; "dark" para fondos claros. */
export function BigwayLogo({ tone = "light", className }) {
  return <img src={`/brand/logo-bigway-${tone}.webp`} alt="Big Way Offices" width="900" height="255" className={cn("h-9 w-auto select-none", className)} draggable={false} />;
}

/** Isotipo "B" (las cuatro formas) sin fondo, para espacios pequeños. */
export function Isotipo({ className }) {
  return <img src="/brand/isotipo.webp" alt="Big Way" width="256" height="255" className={cn("size-9 select-none", className)} draggable={false} />;
}

/** Elemento gráfico vertical de la marca (decorativo). */
export function BwoMark({ className }) {
  return <img src="/brand/bwo-mark.webp" alt="Big Way Offices" width="160" height="400" className={cn("h-10 w-auto select-none", className)} draggable={false} />;
}

/** Biwi, el agente de Big Way: humaniza estados vacíos, bienvenidas y ayuda. */
export function Biwi({ size = 96, say, className, wave = true, children }) {
  const reduce = useReducedMotion();
  return (
    <div className={cn("flex items-end gap-3", className)}>
      <motion.img src="/brand/biwi.webp" alt="Biwi, asistente de Big Way" width={size} height={Math.round(size * 1.057)} draggable={false}
        className="shrink-0 select-none drop-shadow-[0_10px_24px_rgba(34,211,197,.25)]" style={{ width: size, height: "auto" }}
        animate={reduce || !wave ? undefined : { y: [0, -5, 0], rotate: [0, -1.5, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }} />
      {(say || children) && (
        <div className="relative mb-4 max-w-md rounded-2xl rounded-bl-sm border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-slate-200 shadow-xl backdrop-blur">
          {say && <p className="m-0">{say}</p>}
          {children}
        </div>
      )}
    </div>
  );
}

/** Formas de marca decorativas para fondos. */
export function BrandShapes({ className }) {
  return <img src="/brand/bwo-mark.webp" alt="" aria-hidden="true" className={cn("pointer-events-none select-none opacity-[.07]", className)} draggable={false} />;
}

export const SOCIAL = {
  instagram: "/brand/instagram.webp",
  meta: "/brand/meta.webp",
  whatsapp: "/brand/whatsapp.webp",
};
