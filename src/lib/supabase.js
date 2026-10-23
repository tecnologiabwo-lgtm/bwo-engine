import { createClient } from "@supabase/supabase-js";

/* Valores por defecto: proyecto de BWO. La clave publicable es pública por diseño
   (la seguridad la dan las políticas RLS); se puede sobrescribir con VITE_SUPABASE_*. */
const url = import.meta.env.VITE_SUPABASE_URL || "https://getnxeflqaqzdujbxqeu.supabase.co";
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_JlIL10KIgsi16xgCwK_soA_yF3MZ7HV";

export const supabaseConfigured = Boolean(url && key);

/* Misma clave de sesión que usa el Feed Planner (mismo dominio y proyecto):
   iniciar sesión una vez sirve para las dos partes. */
export const supabase = supabaseConfigured ? createClient(url, key) : null;

/** Ejecuta una consulta y lanza un Error legible si falla. */
export async function run(query) {
  const { data, error } = await query;
  if (error) throw new Error(error.message || "Error de conexión");
  return data;
}
