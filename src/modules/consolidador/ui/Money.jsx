/* Montos animados con NumberFlow (adaptado del componente PriceWithDiff).
   - Formato es-ES con centavos, igual que el resto de la app ("299,43 US$").
   - Si no hay dato, muestra "—": NumberFlow nunca recibe un número inventado.
   - Respeta "reducir movimiento" del sistema (comportamiento por defecto). */
import React from "react";
import NumberFlow, { useCanAnimate } from "@number-flow/react";
import { motion } from "motion/react";

const MotionNumberFlow = motion.create(NumberFlow);

/* NumberFlow dibuja los dígitos en un contenedor encapsulado sin texto
   accesible. Por eso la animación va oculta para lectores de pantalla y al
   lado se pone el valor como texto real (invisible a la vista): así lo leen
   los lectores de pantalla, se puede copiar y las pruebas lo encuentran. */
const fmtMoney = (v, cur) => new Intl.NumberFormat("es-ES", { style: "currency", currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

export function Money({ value, cur = "USD", className }) {
  if (value === null || value === undefined || !isFinite(value)) return <span className={className}>—</span>;
  return (
    <span className={className}>
      <span aria-hidden="true">
        <NumberFlow
          value={value}
          locales="es-ES"
          format={{ style: "currency", currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2 }}
        />
      </span>
      <span className="sr-only">{fmtMoney(value, cur)}</span>
    </span>
  );
}

/* Variación porcentual con flecha que rota.
   goodWhen: "lower" para costos (bajar es bueno) o "higher" para volúmenes.
   diff es una fracción: -0.12 = 12 % menos. */
export function Diff({ diff, goodWhen = "lower", label }) {
  const canAnimate = useCanAnimate();
  if (diff === null || diff === undefined || !isFinite(diff)) return null;
  const good = goodWhen === "lower" ? diff < 0 : diff > 0;
  const flat = Math.abs(diff) < 0.0005;
  const bg = flat ? "#8A99A5" : good ? "#1F7A6B" : "#C2492C";
  return (
    <span className="mdiff-wrap" title={label}>
      <span className="sr-only">{flat ? "Igual" : `${new Intl.NumberFormat("es-ES", { style: "percent", maximumFractionDigits: 1 }).format(Math.abs(diff))} ${diff < 0 ? "menos" : "más"}`}</span>
      <motion.span
        aria-hidden="true"
        className="mdiff"
        style={{ background: bg, borderRadius: 999 }}
        layout={canAnimate}
        transition={{ layout: { duration: 0.9, bounce: 0, type: "spring" } }}
      >
        <motion.svg
          viewBox="0 0 24 24" width="0.8em" height="0.8em" fill="none" stroke="currentColor" strokeWidth="3"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          initial={false}
          animate={{ rotate: diff >= 0 ? 0 : -180 }}
          transition={{ rotate: { type: "spring", duration: 0.5, bounce: 0 } }}
        >
          <path d="M12 19V5M5 12l7-7 7 7" />
        </motion.svg>
        <MotionNumberFlow
          value={Math.abs(diff)}
          locales="es-ES"
          format={{ style: "percent", maximumFractionDigits: 1 }}
          layout={canAnimate}
          layoutRoot={canAnimate}
        />
      </motion.span>
      {label && <span className="mdiff-label">{label}</span>}
    </span>
  );
}
