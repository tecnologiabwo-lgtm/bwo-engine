import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase, run } from "./supabase.js";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, session: null, profile: null, clients: [], error: "" });

  const load = useCallback(async (session) => {
    if (!session) { setState({ loading: false, session: null, profile: null, clients: [], error: "" }); return; }
    try {
      const [profile, clients] = await Promise.all([
        run(supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle()),
        run(supabase.rpc("my_clients")),
      ]);
            // Sin fila de perfil → pendiente. Fila sin columna status (antes de la migración 0007) → activa.
      const p = profile ? { ...profile, status: profile.status ?? "active" } : { id: session.user.id, email: session.user.email, role: "viewer", status: "pending" };
      setState({ loading: false, session, profile: p, clients: clients || [], error: "" });
    } catch (e) {
      setState({ loading: false, session, profile: null, clients: [], error: e.message });
    }
  }, []);

  useEffect(() => {
    if (!supabase) { setState((s) => ({ ...s, loading: false })); return; }
    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((evt, session) => {
      if (evt === "SIGNED_IN" || evt === "SIGNED_OUT" || evt === "USER_UPDATED") load(session);
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const value = {
    ...state,
    isAdmin: state.profile?.role === "admin" && state.profile?.status === "active",
    status: state.profile?.status || "pending",
    signUp: async ({ email, password, full_name, company, phone, note }) => {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        // El rol y el estado no se envían: el servidor siempre crea la cuenta como espectador pendiente
        options: { data: { full_name, company, phone, note }, emailRedirectTo: `${location.origin}/login?confirmado=1` },
      });
      if (error) throw new Error(/already registered/i.test(error.message) ? "Ese correo ya tiene una cuenta. Inicia sesión o recupera tu contraseña." : error.message);
      return { needsConfirmation: !data.session };
    },
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message === "Invalid login credentials" ? "Correo o contraseña incorrectos" : error.message);
    },
    sendReset: async (email) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/cuenta` });
      if (error) throw new Error(error.message);
    },
    signOut: () => supabase.auth.signOut(),
    reload: () => supabase.auth.getSession().then(({ data }) => load(data.session)),
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
