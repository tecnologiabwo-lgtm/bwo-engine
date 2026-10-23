/**
 * Verifica la sesión de Supabase del usuario que llama a una función serverless.
 * Reemplaza la contraseña compartida (APP_PASSWORD): ahora cada llamada lleva
 * el token de la sesión y se comprueba el rol en la tabla profiles (con RLS).
 */
export async function requireUser(req, { admin = false } = {}) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw Object.assign(new Error("Faltan SUPABASE_URL / SUPABASE_ANON_KEY en el servidor."), { status: 500 });
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) throw Object.assign(new Error("Inicia sesión para usar esta función."), { status: 401 });

  const u = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, authorization: `Bearer ${token}` } });
  if (!u.ok) throw Object.assign(new Error("Sesión inválida o vencida."), { status: 401 });
  const user = await u.json();

  if (admin) {
    const r = await fetch(`${url}/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(user.id)}`, { headers: { apikey: key, authorization: `Bearer ${token}` } });
    const rows = r.ok ? await r.json() : [];
    if (rows[0]?.role !== "admin") throw Object.assign(new Error("Solo la agencia puede usar esta función."), { status: 403 });
  }
  return user;
}
