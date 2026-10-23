/**
 * Registro de módulos de BWO Engine.
 * Agregar un módulo = una entrada aquí. El menú, las rutas y los permisos
 * del frontend salen de esta lista; la seguridad real vive en RLS (Supabase).
 *
 * roles: quién lo ve en el menú. "admin" = agencia, "viewer" = cliente.
 * viewerLabel: nombre que ve el cliente, si cambia.
 * needsClient: el módulo trabaja sobre el cliente activo.
 * canvas: "dark" (por defecto) o "light" (módulo con su propio diseño claro).
 */
import { lazy } from "react";
import { Home, Users2, LayoutGrid, Clapperboard, BarChart3, FileBarChart, Calculator, Receipt, Tags } from "lucide-react";

export const MODULES = [
  { id: "inicio", path: "inicio", label: "Inicio", icon: Home, roles: ["admin", "viewer"],
    Component: lazy(() => import("../pages/Home.jsx")) },
  { id: "clientes", path: "clientes", label: "Clientes y accesos", icon: Users2, roles: ["admin"],
    Component: lazy(() => import("../modules/clientes/ClientesApp.jsx")) },
  { id: "feed", path: "feed", label: "Feed Planner", viewerLabel: "Mi feed", icon: LayoutGrid, roles: ["admin", "viewer"], needsClient: true, fullBleed: true,
    Component: lazy(() => import("../modules/feed/FeedApp.jsx")) },
  { id: "sala", path: "sala", label: "Sala de producción", viewerLabel: "Guiones", icon: Clapperboard, roles: ["admin", "viewer"], needsClient: true,
    Component: lazy(() => import("../modules/sala/SalaApp.jsx")) },
  { id: "consolidador", path: "consolidador", label: "Consolidador Meta Ads", icon: BarChart3, roles: ["admin"], canvas: "light",
    Component: lazy(() => import("../modules/consolidador/ConsolidadorApp.jsx")) },
  { id: "reportes", path: "reportes", label: "Reportes publicados", viewerLabel: "Mis reportes", icon: FileBarChart, roles: ["admin", "viewer"], needsClient: true,
    Component: lazy(() => import("../modules/reportes/ReportesApp.jsx")) },
  { id: "cotizador", path: "cotizador", label: "Cotizador", viewerLabel: "Cotizar servicios", icon: Receipt, roles: ["admin", "viewer"],
    Component: lazy(() => import("../modules/cotizador/CotizadorApp.jsx")) },
  { id: "calculadora", path: "calculadora", label: "Calculadora ROI", icon: Calculator, roles: ["admin", "viewer"],
    Component: lazy(() => import("../modules/calculadora/CalculadoraApp.jsx")) },
  { id: "precios", path: "precios", label: "Precios y planes", icon: Tags, roles: ["admin"],
    Component: lazy(() => import("../modules/precios/PreciosApp.jsx")) },
];

export const modulesFor = (role) => MODULES.filter((m) => m.roles.includes(role));
export const labelFor = (m, role) => (role === "viewer" && m.viewerLabel) || m.label;
