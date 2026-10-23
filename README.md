# BWO Engine — Big Way Offices

Plataforma única de la agencia: Feed Planner, Sala de producción, Consolidador Meta Ads,
reportes, Cotizador, Calculadora ROI y catálogo de precios, con login y dos roles.

| Rol | Quién | Qué puede hacer |
|---|---|---|
| `admin` | Agencia | Todo: cargar datos, editar precios, publicar reportes, dar accesos |
| `viewer` | Cliente (se registra y la agencia lo verifica) | Solo lo de sus clientes: aprobar/pedir cambios en posts y guiones, ver reportes, autocotizarse, usar la calculadora |

La seguridad real está en Supabase (políticas RLS y funciones `security definer`); el menú solo oculta lo que el rol no usa.

## Stack (todo en planes gratuitos)

- **Vite + React 18 + React Router + Tailwind** (preflight desactivado: el Consolidador trae su CSS)
- **Motion** (animaciones) y **NumberFlow** (cifras animadas)
- **Supabase**: Auth, Postgres con RLS, Realtime (Sala)
- **Vercel**: hosting estático + funciones en `api/`

## Estructura

```
src/
  app/            App.jsx (rutas + permisos), AppShell.jsx (barra lateral de vidrio), modules.js (registro)
  lib/            supabase, auth (sesión + rol), clientContext (cliente activo),
                  quote.js (motor del cotizador), roi.js (calculadora), sala.js (lógica de la sala),
                  catalog.js / catalogData.js (catálogo de precios)
  components/ui/  liquid-glass, number (NumberFlow), scroll-text, primitives, toast
  pages/          Login, Home, Account
  modules/
    calculadora/  Calculadora ROI (3 pestañas conectadas)
    clientes/     Accesos: qué usuario ve qué cliente, roles
    consolidador/ Consolidador Meta Ads (lógica original intacta, publica en `reports`)
    cotizador/    Cotizador de agencia + autocotización del cliente, guarda en `quotes`
    feed/         Integra el Feed Planner (public/feed) en la plataforma
    precios/      Editor del catálogo (`price_catalog`) y condiciones (`app_settings`)
    reportes/     Reportes publicados (el cliente los ve en solo lectura)
    sala/         Sala de producción: calendarios, formulario de guiones, aprobaciones, modo grabación
public/feed/      Feed Planner original (vanilla JS) — comparte sesión con la plataforma
api/              Funciones serverless (Vercel). `api/_lib/auth.js` verifica la sesión de Supabase
supabase/migrations/  SQL en orden (0003, 0004 del Feed Planner; 0005 núcleo; 0006 precios)
test/             Pruebas automáticas (`npm test`)
legacy/           HTML originales de referencia (calculadora, sala)
```

## Agregar un módulo

1. Crear `src/modules/<nombre>/<Nombre>App.jsx` con `export default`.
2. Agregar una entrada en `src/app/modules.js` (ícono, roles, si necesita cliente activo).
3. Si guarda datos: una migración en `supabase/migrations/` con RLS (`is_admin()` / `is_member(client_id)`).

## Base de datos

Aplicar en Supabase → SQL Editor, en orden: `0005_engine_core.sql`, `0006_price_seed.sql`, `0007_auth_registro.sql`, `0008_programas.sql`
(0003 y 0004 ya estaban aplicadas por el Feed Planner). Son aditivas: no borran datos.
Los usuarios que ya existían quedan como `admin`; toda cuenta nueva nace como `viewer`.

## Desarrollo

```
npm install
npm run dev        # frontend (las funciones /api requieren `vercel dev`)
npm test           # 5 baterías de pruebas
npm run build
```

## Variables de entorno (Vercel → Settings → Environment Variables)

Ver `.env.example`. El frontend trae por defecto la URL y la clave publicable del proyecto.
Para la IA del Consolidador: `ANTHROPIC_API_KEY` (u `OPENAI_API_KEY` / `GOOGLE_API_KEY`) y,
opcional, `<PROVEEDOR>_MODEL`. El modelo también se puede elegir en pantalla.

Seguridad, registro y sesiones: ver `docs/SEGURIDAD.md`.
