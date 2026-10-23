/* Motor de cotización — función pura (sin React) para poder probarla.
 *
 * selection: { [itemId]: { qty, billing: "mes" | "anio" } }
 * discounts: { setup, services, clientify } en % (0–100)
 * taxRate:   fracción (0.21 = 21 %). Se aplica a todo lo cotizado.
 *
 * Clasificación de cada línea:
 *   - unit "mes"                      → mensual recurrente
 *   - unit "hora" con meta.recurring  → mensual recurrente (horas × tarifa)
 *   - Clientify con billing "anio"    → anual, se paga por adelantado en la primera cuota
 *   - resto (unico, pack, dia, sesion)→ pago único
 * La primera cuota = pagos únicos + anuales + el primer mes de lo recurrente.
 */
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const clampPct = (p) => Math.max(0, Math.min(100, Number(p) || 0)) / 100;

export function computeQuote(catalog, selection, discounts = {}, taxRate = 0) {
  const byId = new Map(catalog.map((i) => [i.id, i]));
  const lines = [];
  for (const [id, sel] of Object.entries(selection || {})) {
    const item = byId.get(id);
    const qty = Math.max(0, Math.floor(Number(sel?.qty) || 0));
    if (!item || !qty) continue;
    const annual = item.category === "clientify" && sel.billing === "anio" && item.price_year != null;
    const recurring = !annual && (item.unit === "mes" || (item.unit === "hora" && item.meta?.recurring));
    const unitPrice = annual ? item.price_year : item.price;
    const kind = annual ? "anual" : recurring ? "mensual" : "unico";
    const bucket = item.category === "setup" ? "setup" : item.category === "clientify" ? "clientify" : "services";
    lines.push({ id, name: item.name, category: item.category, qty, unitPrice, unit: annual ? "anio" : item.unit, kind, bucket, gross: r2(unitPrice * qty) });
  }
  const pct = { setup: clampPct(discounts.setup), services: clampPct(discounts.services), clientify: clampPct(discounts.clientify) };
  for (const l of lines) { l.discount = r2(l.gross * pct[l.bucket]); l.net = r2(l.gross - l.discount); }

  const sum = (fn) => r2(lines.filter(fn).reduce((a, l) => a + l.net, 0));
  const oneTime = sum((l) => l.kind === "unico");
  const annual = sum((l) => l.kind === "anual");
  const monthly = sum((l) => l.kind === "mensual");
  const gross = r2(lines.reduce((a, l) => a + l.gross, 0));
  const discount = r2(lines.reduce((a, l) => a + l.discount, 0));
  const rate = Math.max(0, Number(taxRate) || 0);
  const firstSub = r2(oneTime + annual + monthly);
  const firstTax = r2(firstSub * rate);
  const monthlyTax = r2(monthly * rate);
  return {
    lines,
    oneTime, annual, monthly, gross, discount,
    firstSubtotal: firstSub, firstTax, firstTotal: r2(firstSub + firstTax),
    monthlyTax, monthlyTotal: r2(monthly + monthlyTax),
    yearOne: r2(firstSub + firstTax + (monthly + monthlyTax) * 11),
  };
}

/** Aplica las reglas de exclusión del catálogo al elegir un ítem. */
export function toggleItem(catalog, selection, id, categories) {
  const item = catalog.find((i) => i.id === id);
  if (!item) return selection;
  const next = { ...selection };
  if (next[id]?.qty) { delete next[id]; return next; }
  const group = categories.find((c) => c.key === item.category)?.group;
  if (group) {
    const sameGroup = new Set(categories.filter((c) => c.group === group).map((c) => c.key));
    for (const k of Object.keys(next)) { const it = catalog.find((i) => i.id === k); if (it && sameGroup.has(it.category)) delete next[k]; }
    // un setup ligado a la categoría que se apaga también sale
    for (const k of Object.keys(next)) { const it = catalog.find((i) => i.id === k); if (it?.meta?.for && sameGroup.has(it.meta.for) && it.meta.for !== item.category) delete next[k]; }
  }
  next[id] = { qty: 1, billing: "mes" };
  // Al elegir un plan o CRM se sugiere su configuración inicial
  const setup = catalog.find((i) => i.category === "setup" && i.meta?.for === item.category && i.active !== false);
  if (setup && !next[setup.id]) next[setup.id] = { qty: 1, billing: "mes" };
  return next;
}
