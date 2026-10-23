import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ClientProvider, useClient } from "@/lib/clientContext";
import { supabaseConfigured } from "@/lib/supabase";
import { ToastProvider } from "@/components/ui/toast";
import { Spinner, Empty, ErrorBox } from "@/components/ui/primitives";
import { Users2 } from "lucide-react";
import AppShell from "./AppShell.jsx";
import Login from "../pages/Login.jsx";
import Account from "../pages/Account.jsx";
import { MODULES } from "./modules.js";

function Gate({ children }) {
  const { loading, session, error } = useAuth();
  if (loading) return <div className="bwo grid min-h-screen place-items-center"><Spinner label="Entrando…" /></div>;
  if (!session) return <Navigate to="/login" replace />;
  if (error) return <div className="bwo p-8"><ErrorBox error={`No pudimos cargar tu perfil: ${error}`} /></div>;
  return children;
}

function ModuleRoute({ m }) {
  const { profile } = useAuth();
  const { clientId } = useClient();
  const role = profile?.role || "viewer";
  if (!m.roles.includes(role)) return <Navigate to="/inicio" replace />;
  if (m.needsClient && !clientId) {
    return <Empty icon={Users2} title="No hay un cliente seleccionado">{role === "admin" ? "Crea un cliente en el Feed Planner o elige uno en el menú." : "Tu cuenta aún no tiene un cliente asignado. Escríbele a Big Way Offices."}</Empty>;
  }
  const C = m.Component;
  if (m.canvas === "light") {
    // Consolidador: diseño claro propio, en un lienzo flotante sobre el fondo oscuro
    return <div className="overflow-hidden rounded-2xl shadow-2xl" style={{ boxShadow: "0 20px 60px rgba(0,0,0,.45)" }}><C /></div>;
  }
  return <div className="bwo"><C /></div>;
}

function Unconfigured() {
  return (
    <div className="bwo grid min-h-screen place-items-center p-6 text-center text-slate-300">
      <div><h1 className="text-xl font-bold text-white">Falta configurar Supabase</h1>
      <p className="mt-2 text-sm">Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (ver .env.example).</p></div>
    </div>
  );
}

export default function App() {
  if (!supabaseConfigured) return <Unconfigured />;
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<Gate><ClientProvider><AppShell /></ClientProvider></Gate>}>
              {MODULES.map((m) => <Route key={m.id} path={`/${m.path}/*`} element={<ModuleRoute m={m} />} />)}
              <Route path="/cuenta" element={<div className="bwo"><Account /></div>} />
              <Route path="*" element={<Navigate to="/inicio" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
