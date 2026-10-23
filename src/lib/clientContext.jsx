import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./auth.jsx";

/** Cliente activo en toda la plataforma: lo eliges una vez y cada módulo lo usa. */
const Ctx = createContext(null);
const KEY = "bwo.client";

export function ClientProvider({ children }) {
  const { clients } = useAuth();
  const [clientId, setClientId] = useState(() => { try { return localStorage.getItem(KEY); } catch { return null; } });
  useEffect(() => {
    if (!clients.length) return;
    if (!clients.some((c) => c.id === clientId)) setClientId(clients[0].id);
  }, [clients, clientId]);
  const choose = (id) => { setClientId(id); try { localStorage.setItem(KEY, id); } catch {} };
  const client = clients.find((c) => c.id === clientId) || null;
  return <Ctx.Provider value={{ client, clientId: client?.id || null, clients, choose }}>{children}</Ctx.Provider>;
}
export const useClient = () => useContext(Ctx);
