# Estado de BWO Engine — iteración 1

## Corregido en esta iteración

| # | Fallo original | Corrección |
|---|---|---|
| 1 | Dos tablas `clients` incompatibles (Feed vs Consolidador) | Una sola: la del Feed Planner. Los reportes van a la tabla nueva `reports` |
| 2 | `portal-read` aceptaba comodines (`%`, `_`) en el código → se podían adivinar códigos | Endpoint eliminado: el cliente entra con su cuenta y RLS filtra sus reportes |
| 3 | Feed: cualquier usuario autenticado veía y editaba todo | Políticas nuevas: admin todo, espectador solo lectura de sus clientes |
| 4 | Contraseña compartida `APP_PASSWORD` enviada desde el navegador | Sesión de Supabase + rol admin verificado en el servidor (`api/_lib/auth.js`) |
| 5 | Sala dependía de `window.claude` (solo funcionaba en claude.ai) | Reescrita sobre Supabase con tiempo real |
| 6 | Sala: marcar una toma podía borrar las demás; historial con carreras | `sala_toggle` fusiona la clave en el servidor; `sala_set_status` escribe el historial con bloqueo de fila |
| 6b | Sala: el rol cliente/agencia era solo visual | El cliente solo puede aprobar / pedir cambios / elegir / comentar (validado en SQL) |
| 8 | Feed: límite de 200 aplicado a toda la bitácora del cliente | Lectura paginada completa, en lotes de ids |
| 9 | Feed: archivado automático escribía en cada lectura | Una vez por cliente y sesión |
| 9b | Feed: guardar el orden hacía una petición por post | Solo guarda los que cambiaron |
| 9c | Feed: supabase-js desde un CDN sin versión fija | Servido desde `public/feed/vendor` (misma versión que la app) |
| 10 | Cifrado de snapshots fallaba con más de ~100 KB | Base64 por bloques |
| 11 | Publicar reporte usaba el período de la campaña seleccionada | Período = unión de todas las entidades; upsert por cliente + período |
| 12 | Consolidador sin persistencia de reportes | Publicación en `reports`; el cliente los ve en «Mis reportes» |
| 13 | Calculadora: pestañas desconectadas, fórmula de ROI distinta a la mostrada, monedas mezcladas, redondeo por etapa | Pestañas conectables, fórmula única y documentada, solo USD, sin redondeo intermedio |
| 14 | Cotizador: anual de Clientify mostrado como mensual, Clientify fuera del total, IVA fijo, precios en el código, no guardaba | Motor nuevo: anual en la primera cuota, todo en USD, impuesto configurable, catálogo editable, guarda cotizaciones |
| 15 | Sala: calendario solo del primer mes, `NaN%` sin bloques, `Function()` para cifras | Rango ampliado a todas las piezas, divisiones protegidas, evaluador aritmético seguro |

## Pendiente (próximas iteraciones)

- **Aplicar las migraciones 0005 y 0006** en Supabase (el proyecto estaba hibernado y no aceptó conexiones SQL).
- **Imágenes del Feed a Supabase Storage** (hoy van en base64 dentro de la base: límite de 500 MB del plan gratuito).
- Portar el Feed Planner a React (hoy se integra tal cual desde `/feed`).
- Invitar usuarios desde la plataforma (requiere una función con la service key).
- PDF de propuesta con membrete y link público de aceptación de cotizaciones.
- Puente Sala → Feed: una pieza aprobada crea el borrador del post.
- Calculadora alimentada por datos reales (CPL del Consolidador, costo del Cotizador) y escenarios guardados.
- Rendimiento: el chunk de gráficos del Consolidador (recharts) pesa ~560 KB; migrar a recharts 3 o cargar por pestaña.
