/* Cálculos de la Calculadora ROI — funciones puras (probadas en test/engine.mjs). */

/** Ahorro por automatización en el período cargado (normalmente un mes). */
export function automation({ actions, minutes, salary, weeklyHours }) {
  const wh = weeklyHours > 0 ? weeklyHours : 40;
  const hours = (Math.max(0, actions) * Math.max(0, minutes)) / 60;
  const rate = Math.max(0, salary) / (wh * 52);         // costo por hora
  return { hours, rate, savings: hours * rate, days: hours / 8, months: hours / ((wh * 52) / 12) };
}

/** Embudo sin redondear entre etapas (el redondeo es solo para mostrar). */
export function funnel(leads, { r, q, w }) {
  const resp = leads * r / 100, qual = resp * q / 100, won = qual * w / 100;
  return { leads, resp, qual, won, conv: leads ? won / leads : 0 };
}

/** ROI y recuperación.
 *  benefit = ahorro + ventas × ticket × margen − costo mensual
 *  roi12   = (beneficio de 12 meses − inversión inicial) ÷ (inversión inicial + 12 × costo mensual)
 *  payback = inversión ÷ beneficio mensual (si el beneficio es positivo) */
export function roi({ setup, monthly, savings, sales, ticket, margin }) {
  const salesMargin = Math.max(0, sales) * Math.max(0, ticket) * Math.max(0, margin) / 100;
  const benefit = savings + salesMargin - monthly;
  const totalCost12 = setup + monthly * 12;
  const net12 = benefit * 12 - setup;
  return {
    salesMargin, benefit,
    payback: benefit > 0 ? setup / benefit : Infinity,
    roi12: totalCost12 > 0 ? net12 / totalCost12 : 0,
    net12,
    curve: Array.from({ length: 13 }, (_, m) => ({ m, acc: benefit * m - setup })),
  };
}
