import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs) => twMerge(clsx(inputs));

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
export const money = (n) => (n == null || !isFinite(n) ? "—" : usd.format(n));
export const num = (n, d = 0) =>
  n == null || !isFinite(n) ? "—" : new Intl.NumberFormat("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);

/** Redondeo a centavos sin errores de coma flotante acumulados. */
export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const pad = (n) => String(n).padStart(2, "0");
export const isoDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return isoDate(d); };
export const diffDays = (a, b) => Math.round((parseDate(a) - parseDate(b)) / 864e5);
export const shortDate = (s) => (s ? parseDate(s).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }) : "");
