# Seguridad y acceso — BWO Engine

## Registro de clientes con verificación

1. El cliente entra a `/login` → **Crear cuenta** (nombre, empresa, teléfono, correo, contraseña de 10+ caracteres con letras y números).
2. Supabase le envía un correo para **confirmar su dirección** (activar en Supabase → Authentication → Providers → Email → *Confirm email*).
3. La cuenta queda **pendiente**: puede iniciar sesión, pero solo ve «Estamos verificando tu registro». No lee ningún dato: ni catálogo, ni cotizaciones, ni clientes.
4. La agencia la revisa en **Clientes y accesos → Solicitudes de registro**, elige el cliente que podrá ver y la **aprueba** (o la rechaza: queda bloqueada).
5. El rol (`admin` / `viewer`) y el estado (`pending` / `active` / `blocked`) **nunca** salen de lo que envía el usuario: el trigger `handle_new_user` siempre crea `viewer` + `pending`, y `protect_profile` impide que alguien cambie su propio rol o estado.

## Control de acceso (RBAC + ABAC) contra IDOR

- **RBAC:** dos roles, `admin` (agencia) y `viewer` (cliente). `is_admin()` exige rol admin **y** cuenta activa.
- **ABAC:** cada fila de datos lleva `client_id`; el atributo que decide el acceso es la pertenencia `client_members(client_id, user_id)` de una cuenta activa (`is_member(client_id)`).
- **Anti-IDOR:** toda lectura y escritura pasa por políticas RLS en Postgres. Cambiar un id en la URL, en el selector o en una petición manual no devuelve datos de otro cliente: la base responde vacío o error. El frontend nunca es la barrera de seguridad.
- Las acciones del cliente (aprobar guion, pedir cambios, comentar, elegir opción) son funciones `security definer` que **vuelven a comprobar** la pertenencia y el estado de la pieza antes de escribir.
- El portal del Feed por enlace usa un token UUID aleatorio por cliente; solo lo reciben sus miembros.

## Ciclo de vida de la sesión (expiración)

| Control | Valor por defecto | Dónde se cambia |
|---|---|---|
| Cierre por inactividad | 30 min, con aviso 60 s antes | `app_settings.session.idle_minutes` / `warn_seconds` |
| Duración máxima de la sesión | 12 h desde el inicio de sesión | `app_settings.session.max_hours` |
| Revocación inmediata | Al suspender una cuenta, se cierra en el siguiente latido (≤ 4 min) | Clientes y accesos → Suspender |

- La actividad se comparte entre pestañas y con el Feed Planner embebido.
- El latido `touch_session()` registra `last_seen` (auditoría) y devuelve el estado de la cuenta.
- Recomendado en Supabase → Authentication → Sessions: *JWT expiry* en 3600 s. (El cierre por inactividad del lado del servidor de Supabase es una función de pago; aquí se cubre con el latido + RLS por estado.)

## Migraciones

Aplicar en orden: `0005_engine_core.sql`, `0006_price_seed.sql`, `0007_auth_registro.sql`, `0008_programas.sql`, `0009_programa_01.sql`.
