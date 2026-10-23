import { useId } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const BLUR = { none: 0, xs: 2, sm: 6, md: 12, lg: 20, xl: 32 };
const SHADOW = {
  none: "none",
  xs: "0 2px 8px rgba(0,0,0,.18)",
  sm: "0 8px 24px rgba(0,0,0,.28)",
  md: "0 16px 40px rgba(0,0,0,.36)",
  lg: "0 28px 70px rgba(0,0,0,.45)",
};
const GLOW = {
  none: "none",
  xs: "inset 0 0 6px rgba(255,255,255,.08)",
  sm: "inset 0 1px 0 rgba(255,255,255,.22), inset 0 0 14px rgba(255,255,255,.10)",
  md: "inset 0 1px 0 rgba(255,255,255,.30), inset 0 0 24px rgba(255,255,255,.14)",
  lg: "inset 0 1px 0 rgba(255,255,255,.38), inset 0 0 40px rgba(255,255,255,.18)",
};

/** Tarjeta de "vidrio líquido": desenfoque + refracción del fondo (filtro SVG de
 *  desplazamiento, solo navegadores Chromium; en el resto queda el desenfoque),
 *  brillo interior y borde de luz. draggable la vuelve arrastrable con Motion. */
export function LiquidGlassCard({
  children, className, style,
  blurIntensity = "sm", shadowIntensity = "sm", glowIntensity = "sm",
  borderRadius = "16px", draggable = false, as = "div", ...rest
}) {
  const id = useId().replace(/:/g, "");
  const Comp = draggable ? motion.div : as;
  const blur = BLUR[blurIntensity] ?? 6;
  const dragProps = draggable ? { drag: true, dragMomentum: false, dragElastic: 0.12, whileDrag: { scale: 1.02 } } : {};
  return (
    <Comp
      className={cn("relative isolate overflow-hidden", draggable && "cursor-grab active:cursor-grabbing", className)}
      style={{ borderRadius, boxShadow: SHADOW[shadowIntensity], ...style }}
      {...dragProps}
      {...rest}
    >
      <svg className="absolute size-0" aria-hidden="true">
        <filter id={`lg-${id}`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.012" numOctaves="2" seed="7" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="2" result="soft" />
          <feDisplacementMap in="SourceGraphic" in2="soft" scale="38" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      {/* capa de refracción + desenfoque */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          borderRadius,
          backdropFilter: `blur(${blur}px) saturate(160%) url(#lg-${id})`,
          WebkitBackdropFilter: `blur(${blur}px) saturate(160%)`,
        }}
      />
      {/* tinte y brillo */}
      <div className="absolute inset-0 -z-10" style={{ borderRadius, background: "linear-gradient(135deg,rgba(255,255,255,.12),rgba(255,255,255,.03) 55%,rgba(108,59,245,.06))", boxShadow: GLOW[glowIntensity] }} />
      <div className="pointer-events-none absolute inset-0 -z-10" style={{ borderRadius, border: "1px solid rgba(255,255,255,.16)" }} />
      {children}
    </Comp>
  );
}
