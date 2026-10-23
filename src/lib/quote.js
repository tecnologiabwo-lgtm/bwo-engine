/* Motor de cotización — función pura (sin React) para poder probarla.
 *
 * selection: { [itemId]: { qty, billing: "mes" | "anio", price?, setup? } }
 *            price / setup: precio acordado en esta cotización (precio abierto);
 *            si no vienen, se usa el del catálogo.
 * discounts: { setup, services, clientify } en % (0–100)
 * taxRate:   fracción (0.21 = 21 %). Se aplica a todo lo cotizado.
 *
 * Cada ítem puede tener:
 *   - setup_price            → pago único (Fase I de los programas)
 *   - price + unit recurrente → mensualidad (Fase II)
 *   - meta.starts_month = 2  → la mensualidad empieza el segundo mes (no entra en la primera cuota)
 *
 * Clasificación de cada línea:
 *   - unit "mes" | "linea" | "usuario", u "hora" con meta.recurring → mensual
 *   - Clientify con billing "anio" → anual, se paga por adelantado en la primera cuota
 *   - resto (unico, pack, dia, sesion) → pago único
 */
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const clampPct = (p) => Math.max(0, Math.min(100, Number(p) || 0)) / 100;
const RECURRING = new Set(["mes", "linea", "usuario"]);
const annualAllowed = (item, sel) => item.category === "clientify" && sel?.billing === "anio" && item.price_year != null;

export function computeQuote(catalog, selection, discounts = {}, taxRate = 0) {
  const byId = new Map(catalog.map((i) => [i.id, i]));
  const lines = [];
  for (const [id, sel] of Object.entries(selection || {})) {
    const item = byId.get(id);
    const qty = Math.max(0, Math.floor(Number(sel?.qty) || 0));
    if (!item || !qty) continue;
    const bucket = item.category === "setup" ? "setup" : item.category === "clientify" ? "clientify" : "services";
    const num = (v) => (v === "" || v == null || !Number.isFinite(+v) ? null : Math.max(0, +v));
    const setupPrice = num(sel.setup) ?? num(item.setup_price) ?? 0;
    const basePrice = num(sel.price) ?? num(item.price) ?? 0;
    // Fase I del programa: pago único, se descuenta con «configuraciones iniciales»
    if (setupPrice > 0) {
      lines.push({ id: `${id}:fase1`, itemId: id, name: `${item.name} · Fase I`, category: item.category, qty, unitPrice: setupPrice,
        unit: "unico", kind: "unico", bucket: "setup", startsMonth: 1, custom: num(sel.setup) != null, gross: r2(setupPrice * qty) });
    }
    if (!(basePrice > 0) && !(annualAllowed(item, sel))) continue;
    const annual = item.category === "clientify" && sel.billing === "anio" && item.price_year != null;
    const recurring = !annual && (RECURRING.has(item.unit) || (item.unit === "hora" && item.meta?.recurring));
    const unitPrice = annual ? (num(sel.price) ?? item.price_year) : basePrice;
    const kind = annual ? "anual" : recurring ? "mensual" : "unico";
    const startsMonth = recurring ? Math.max(1, Math.floor(item.meta?.starts_month || 1)) : 1;
    lines.push({ id, itemId: id, name: setupPrice > 0 ? `${item.name} · Fase II` : item.name, category: item.category, qty, unitPrice,
      unit: annual ? "anio" : item.unit, kind, bucket, startsMonth, custom: num(sel.price) != null, gross: r2(unitPrice * qty) });
  }
  const pct = { setup: clampPct(discounts.setup), services: clampPct(discounts.services), clientify: clampPct(discounts.clientify) };
  for (const l of lines) { l.discount = r2(l.gross * pct[l.bucket]); l.net = r2(l.gross - l.discount); }

  const sum = (fn) => r2(lines.filter(fn).reduce((a, l) => a + l.net, 0));
  const oneTime = sum((l) => l.kind === "unico");
  const annual = sum((l) => l.kind === "anual");
  const monthly = sum((l) => l.kind === "mensual");
  const monthlyInFirst = sum((l) => l.kind === "mensual" && l.startsMonth <= 1);
  const gross = r2(lines.reduce((a, l) => a + l.gross, 0));
  const discount = r2(lines.reduce((a, l) => a + l.discount, 0));
  const rate = Math.max(0, Number(taxRate) || 0);
  const firstSub = r2(oneTime + annual + monthlyInFirst);
  const firstTax = r2(firstSub * rate);
  const monthlyTax = r2(monthly * rate);
  // Primer año: cada mensualidad se cobra desde su mes de inicio hasta el mes 12
  const recurring12 = lines.filter((l) => l.kind === "mensual").reduce((a, l) => a + l.net * (13 - Math.min(12, l.startsMonth)), 0);
  const year1Sub = oneTime + annual + recurring12;
  const deferred = lines.some((l) => l.kind === "mensual" && l.startsMonth > 1);
  return {
    lines,
    oneTime, annual, monthly, gross, discount,
    firstSubtotal: firstSub, firstTax, firstTotal: r2(firstSub + firstTax),
    monthlyTax, monthlyTotal: r2(monthly + monthlyTax),
    monthlyStarts: deferred ? 2 : 1,
    yearOne: r2(year1Sub * (1 + rate)),
  };
}

/** Aplica las reglas del catálogo al elegir un ítem:
 *  - meta.excludes: ids incompatibles (p. ej. Programa 02 y 03)
 *  - categoría con group: excluyentes entre sí
 *  - setup ligado (meta.for = categoría) se sugiere al elegir
 *  - meta.requires: si se quita el requisito, se quitan sus complementos */
export function toggleItem(catalog, selection, id, categories) {
  const item = catalog.find((i) => i.id === id);
  if (!item) return selection;
  const next = { ...selection };
  const find = (k) => catalog.find((i) => i.id === k);
  const dropDependents = () => { for (const k of Object.keys(next)) if (find(k)?.meta?.requires && !next[find(k).meta.requires]) delete next[k]; };
  if (next[id]?.qty) { delete next[id]; dropDependents(); return next; }

  for (const ex of item.meta?.excludes || []) delete next[ex];
  for (const k of Object.keys(next)) if ((find(k)?.meta?.excludes || []).includes(id)) delete next[k];
  const group = categories.find((c) => c.key === item.category)?.group;
  if (group) {
    const sameGroup = new Set(categories.filter((c) => c.group === group).map((c) => c.key));
    for (const k of Object.keys(next)) { const it = find(k); if (it && sameGroup.has(it.category)) delete next[k]; }
    for (const k of Object.keys(next)) { const it = find(k); if (it?.meta?.for && sameGroup.has(it.meta.for) && it.meta.for !== item.category) delete next[k]; }
  }
  next[id] = { qty: 1, billing: "mes" };
  if (item.meta?.requires && !next[item.meta.requires]) next[item.meta.requires] = { qty: 1, billing: "mes" };
  const setup = catalog.find((i) => i.category === "setup" && i.meta?.for === item.category && i.active !== false);
  if (setup && !next[setup.id]) next[setup.id] = { qty: 1, billing: "mes" };
  dropDependents();
  return next;
}
