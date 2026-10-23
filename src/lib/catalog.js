/* Catálogo de servicios. La fuente de verdad es la tabla price_catalog en
   Supabase (editable en «Precios y planes»). DEFAULT_CATALOG es el respaldo
   local, idéntico a supabase/migrations/0006_price_seed.sql, para que el
   cotizador funcione aunque la tabla aún no exista. */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabase.js";

import { CATEGORIES, UNITS, DEFAULT_CATALOG, DEFAULT_SETTINGS } from "./catalogData.js";
export { CATEGORIES, UNITS, DEFAULT_CATALOG, DEFAULT_SETTINGS };

/** Carga catálogo + ajustes. source: "db" o "local" (respaldo). */
export function useCatalog() {
  const [state, setState] = useState({ items: DEFAULT_CATALOG, settings: DEFAULT_SETTINGS, source: "loading", error: "" });
  const load = useCallback(async () => {
    const [{ data: items, error }, { data: settings }] = await Promise.all([
      supabase.from("price_catalog").select("*").order("sort"),
      supabase.from("app_settings").select("*"),
    ]);
    if (error || !items?.length) {
      setState({ items: DEFAULT_CATALOG, settings: DEFAULT_SETTINGS, source: "local", error: error?.message || "" });
      return;
    }
    const s = { ...DEFAULT_SETTINGS };
    (settings || []).forEach((r) => { s[r.key] = r.value; });
    setState({ items: items.map((i) => ({ ...i, price: +i.price, price_year: i.price_year == null ? null : +i.price_year })), settings: s, source: "db", error: "" });
  }, []);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}
