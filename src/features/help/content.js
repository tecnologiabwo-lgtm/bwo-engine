/* Contenido base del Centro de ayuda (viaja con el código y se versiona en git).
   Los artículos que la agencia escribe desde la plataforma se guardan en
   help_articles y se muestran junto a estos. audience: "todos" | "agencia". */
export const SECTIONS = [
  { id: "primeros-pasos", label: "Primeros pasos", desc: "Cómo entrar y moverte por BWO Engine" },
  { id: "comercial", label: "Lógica comercial", desc: "Programas, fases, precios y cotizaciones" },
  { id: "tutoriales", label: "Tutoriales", desc: "Paso a paso de cada módulo" },
  { id: "tecnica", label: "Documentación técnica", desc: "Arquitectura, datos, seguridad y operación" },
  { id: "faq", label: "Preguntas frecuentes", desc: "Respuestas rápidas" },
  { id: "articulos", label: "Artículos de interés", desc: "Ideas para vender más en digital" },
];

const A = (slug, section, title, summary, body, audience = "todos") => ({ slug, section, title, summary, body, audience, builtin: true });

export const ARTICLES = [
  // ── Primeros pasos
  A("que-es-bwo-engine", "primeros-pasos", "Qué es BWO Engine", "La plataforma de Big Way para trabajar con cada cliente en un solo lugar.", `
BWO Engine reúne en un solo lugar todo lo que hacemos con cada cliente: **feed de Instagram, guiones, reportes, cotizaciones, proyecciones y herramientas**.

## Dos tipos de usuario
- **Agencia (administrador):** el equipo de Big Way. Crea y edita todo.
- **Cliente (espectador):** ve solo su empresa. Aprueba publicaciones y guiones, revisa reportes y su evolución, y puede cotizar servicios.

## El cliente activo
Arriba del menú eliges el cliente. Cada módulo (Feed, Sala, Reportes, Histórico) trabaja con ese cliente.
`),
  A("entrar-por-primera-vez", "primeros-pasos", "Entrar por primera vez", "Invitación por correo o registro con verificación.", `
Hay dos formas de entrar:

1. **Invitación por correo (recomendada).** Big Way te envía un correo. Pulsa _Crear mi contraseña_ y entras directo a tu espacio, ya verificado.
2. **Registro.** En la página de acceso eliges _Crear cuenta_ y llenas tus datos. La agencia verifica que perteneces a la empresa y te da acceso.

> Tu sesión se cierra sola tras un tiempo sin actividad, por seguridad. Vuelve a entrar con tu correo y contraseña.

¿Olvidaste la contraseña? En la página de acceso usa _Recuperar contraseña_.
`),
  A("estados-y-colores", "primeros-pasos", "Qué significa cada estado", "Borrador, pendiente, cambios, aprobado y publicado.", `
## Feed
- **Borrador:** la agencia lo está preparando (el cliente no lo ve).
- **Pendiente de tu aprobación:** listo para que lo revises.
- **Cambios solicitados:** pediste ajustes; la agencia los está haciendo.
- **Aprobado:** listo para publicarse en su fecha.
- **Publicado:** ya está en Instagram.

## Sala de producción (guiones)
Borrador → En aprobación → Aprobado → Producción (grabación o diseño) → Edición (solo video) → Listo → Publicado.
`),

  // ── Comercial
  A("programas-bwo", "comercial", "Los 6 programas de Big Way", "Qué incluye cada programa y para quién es.", `
## Programa 01 · Presencia Digital B2B
Contenido e imagen para Instagram y Facebook. Sin publicidad pagada ni CRM. Para empresas que necesitan verse profesionales y constantes.

## Programa 02 · La Máquina de Facturación B2B
Contenido, **Meta Ads** y **CRM Clientify**. Para captar compradores nuevos y ordenar el seguimiento de ventas.

## Programa 03 · Expansión Corporativa Multicanal
Contenido, anuncios en **Meta y Google**, y Clientify para hasta 4 usuarios. Para empresas que quieren crecer en varios canales a la vez.

## Programa 04 · Integración Comercial CRM
Clientify para ordenar clientes y ventas, con capacitación y 1 usuario máster.

## Programa 05 · Centralización y WhatsApp API
Bandeja de WhatsApp compartida, chatbot y 1 usuario máster. Montaje previsto en 1 semana. Las líneas adicionales se cobran aparte.

## Programa 06 · Comercio Electrónico y Tienda Virtual
Tienda en Sellibrí con carga inicial de hasta 50 productos. Incluye el primer mes de gestión.
`),
  A("fases-y-cobro", "comercial", "Fase I y Fase II: cómo se cobra", "Pago único de arranque y mensualidad desde el segundo mes.", `
Todos los programas se cobran en dos fases:

- **Fase I:** pago único el primer mes. Cubre diagnóstico, configuración, montaje y arranque.
- **Fase II:** mensualidad desde el segundo mes. Cubre la operación continua (contenido, campañas, soporte).

Los montos están en **dólares (USD)**. Son de referencia y se fijan en cada cotización: la agencia puede ajustar cada precio según el alcance real del cliente.

> Los precios vigentes se editan en **Precios y planes**. Si cambian, las cotizaciones ya enviadas conservan su precio.
`),
  A("cotizaciones", "comercial", "Cómo funciona una cotización", "Del armado al envío y la aceptación.", `
1. En **Cotizador** eliges el programa y los complementos (líneas de WhatsApp, webs, configuración inicial…).
2. Cada línea muestra su precio de referencia y lo puedes ajustar para ese cliente.
3. El total separa **Fase I (pago único)** y **Fase II (mensual)**.
4. El cliente también puede armar una cotización desde su portal; le llega a la agencia como _solicitada_.
5. Cada cambio queda registrado en **Auditoría** (quién cambió qué y cuándo).
`),
  A("argumento-roi", "comercial", "Cómo presentar el retorno (ROI)", "Usa la Calculadora ROI para justificar la inversión.", `
La **Calculadora ROI** responde tres preguntas del cliente:

- **¿Cuánto tiempo me ahorro?** Tareas repetitivas × minutos × costo por hora del equipo.
- **¿Cuánto puedo vender?** Embudo: leads → respuesta → calificados → ganados.
- **¿Cuándo recupero la inversión?** Recuperación = inversión inicial ÷ beneficio mensual.

Fórmula del ROI a 12 meses: _(beneficio de 12 meses − inversión inicial) ÷ (inversión inicial + 12 × mensualidad)_.

> Usa supuestos conservadores. Es mejor superar la proyección que quedarse corto.
`),

  // ── Tutoriales
  A("tutorial-feed-cliente", "tutoriales", "Aprobar tu feed (clientes)", "Revisa, aprueba o pide cambios en pocos clics.", `
1. Entra a **Mi feed**. Verás tu perfil tal como se verá en Instagram (6 filas × 3 columnas por página).
2. Toca una publicación para verla en grande, con su texto, fecha e historial.
3. Pulsa **Aprobar**, o escribe un comentario y pulsa **Pedir cambios**.
4. ¿Varias a la vez? Marca el círculo de cada publicación y usa la barra de acciones.

En **Calendario** ves cuánto se publica los próximos días y qué espera tu aprobación.
`),
  A("tutorial-feed-agencia", "tutoriales", "Planificar el feed (agencia)", "Crear, ordenar, enviar a aprobación y archivar.", `
- **Nueva:** sube la imagen (se comprime sola a WebP), elige formato, pilar, fecha y copy.
- **Ordenar:** arrastra las publicaciones en el filtro _Todas_. Solo se guardan las posiciones que cambian.
- **Enviar al cliente:** selecciona varias y pulsa _Enviar al cliente_ (pasan a Pendiente).
- **Calendario:** barras de carga de los próximos 14 días y el mes completo. Desde un día vacío pulsa _Programar_.
- **Enlaces públicos:** comparte el feed sin login, con caducidad. Si un enlace se filtra, revócalo o rota el principal.
- **Versión clásica:** el botón de arriba abre el Feed anterior, que sigue funcionando igual.
`, "agencia"),
  A("tutorial-teleprompter", "tutoriales", "Grabar con el teleprompter", "Lee el guion mientras grabas desde la Sala.", `
1. En **Sala de producción** abre una pieza de video y pulsa **Teleprompter + cámara**.
2. Ajusta la **velocidad**, el **tamaño de letra** y el **ancho** del texto.
3. Si usas un cristal de teleprompter, activa el **espejo**.
4. Pulsa **Activar cámara** y elige el formato (vertical para Reels).
5. **Grabar** inicia una cuenta regresiva de 3 segundos y el texto empieza a subir.
6. Al detener, descarga cada toma. El video queda en tu dispositivo; no se sube a internet.

Atajos: _Espacio_ iniciar/pausar · _↑ ↓_ velocidad · _+ −_ tamaño · _M_ espejo · _R_ grabar · _Esc_ salir.
`),
  A("tutorial-consolidador", "tutoriales", "Consolidador e histórico mensual", "De los exportes de Meta a la revisión mensual, trimestral y anual.", `
1. En **Consolidador Meta Ads** carga los exportes de Meta (anuncios y orgánico).
2. Revisa el análisis y publícalo como reporte para el cliente.
3. En la pestaña _Publicar_ pulsa **Guardar en el histórico mensual**. Si el informe abarca varios meses, se reparte por día cuando hay detalle diario, o en proporción a los días de cada mes cuando no lo hay.
4. En **Histórico** cambia entre mes, trimestre y año. Compara con el periodo anterior y con el mismo periodo del año pasado.
`, "agencia"),
  A("tutorial-nuevo-cliente", "tutoriales", "Crear un cliente nuevo", "Dónde y cómo dar de alta una empresa.", `
1. Ve a **Clientes y accesos** y pulsa **Nuevo cliente** (o elige _＋ Nuevo cliente…_ en el selector de cliente del menú).
2. Escribe el nombre de la empresa y su usuario de Instagram. Lo demás es opcional.
3. Deja marcada la opción de **pilares base** para empezar a planificar enseguida.
4. Al crearlo queda seleccionado en todo BWO Engine: Feed, Sala, Reportes e Histórico.
5. Sube la foto de perfil y ajusta los pilares en **Feed → Perfil y pilares**.
6. Para que la persona del cliente entre a su portal, usa **Invitar por correo**.
`, "agencia"),
  A("tutorial-invitar", "tutoriales", "Invitar a un cliente por correo", "El cliente entra ya verificado y vinculado a su empresa.", `
1. Ve a **Clientes y accesos → Invitar por correo**.
2. Escribe el correo y el nombre, y elige el cliente.
3. Pulsa **Invitar**. Le llega un correo de Big Way (enviado con Resend) con el enlace para crear su contraseña.
4. Si ya tenía cuenta, solo recibe el acceso a ese cliente y un aviso por correo.

Si el envío falla, verás el motivo junto a la invitación y podrás reenviarla.
`, "agencia"),

  A("tutorial-sellibri", "tutoriales", "Cargar productos para Sellibri", "Del catálogo del cliente al CSV de importación.", `
1. Abre **Herramientas → Carga de productos para Sellibri** (o comparte el enlace público con el cliente).
2. Agrega cada producto: título, descripción, precio, inventario y fotos (enlaces https).
3. Si viene en colores o tallas, crea las **opciones**: se generan todas las combinaciones con su SKU, precio y cantidad.
4. Pulsa **Revisar y descargar**. Corrige lo marcado en rojo; los avisos en amarillo no impiden descargar.
5. Descarga el CSV e impórtalo en el panel de Sellibri.

> El avance se guarda en el navegador. Puedes cerrar y seguir después, o volver a cargar un CSV que ya descargaste.
`),

  // ── Técnica
  A("arquitectura", "tecnica", "Arquitectura", "React + Supabase + Vercel, organizado por funcionalidad.", `
- **Frontend:** Vite + React 18 + Tailwind, desplegado en **Vercel** desde la rama main de GitHub.
- **Datos y acceso:** **Supabase** (Postgres, Auth, Storage, Edge Functions).
- **Código por funcionalidad:** \`src/features/<módulo>\` (feed, sala, consolidador, cotizador…) y \`src/shared\` para lo común. Agregar un módulo = una entrada en \`src/app/modules.js\`.
- **Feed clásico** (\`public/feed\`) y **recursos públicos** (\`public/recursos\`): páginas estáticas que conviven con la app y usan la misma base.
- **Correo:** la Edge Function \`invite-client\` envía las invitaciones con **Resend**.
`, "agencia"),
  A("seguridad", "tecnica", "Seguridad y permisos", "RBAC + ABAC en la base de datos, sesiones y enlaces.", `
- **Roles (RBAC):** admin = agencia, viewer = cliente. El menú se adapta al rol, pero la seguridad real está en la base de datos.
- **Por cliente (ABAC, anti-IDOR):** cada tabla tiene políticas RLS. Un cliente solo lee filas de las empresas a las que está vinculado, aunque cambie un ID en la URL.
- **Cuentas:** quedan _pendientes_ hasta que la agencia las verifica, salvo las invitadas por correo. Una cuenta suspendida pierde el acceso en minutos.
- **Enlaces públicos:** token aleatorio con caducidad, revocación y conteo de usos.
- **Auditoría:** cada cambio queda en \`audit_log\` con quién, cuándo y el antes y el después.
`, "agencia"),
  A("migraciones", "tecnica", "Migraciones de base de datos", "Reglas para que el esquema no se desordene.", `
1. Crea cada cambio con \`npm run migration:new nombre\`. Genera \`AAAAMMDDHHMMSS_nombre.sql\`.
2. **Nunca edites una migración aplicada:** corrígela con una nueva. \`migrations.lock\` guarda una huella de cada una.
3. \`npm test\` falla si un nombre es inválido, si hay DROP o TRUNCATE sin \`-- permitido:\` o si una tabla nueva no tiene RLS.
4. Con los secretos de GitHub configurados, el workflow \`migraciones.yml\` las aplica solo.

La guía completa está en \`docs/MIGRACIONES.md\`.
`, "agencia"),
  A("operacion", "tecnica", "Operación y mantenimiento", "Errores, hibernación, tarifas y respaldos.", `
- **Errores en producción:** se guardan en \`client_errors\` y se ven en **Auditoría y errores → Errores**, agrupados.
- **Anti-hibernación:** GitHub Actions consulta la base 3 veces por semana (\`mantener-activa.yml\`).
- **Tarifas de WhatsApp:** Meta las cambia el 1 de enero, abril, julio y octubre. Actualiza \`public/recursos/assets/rates.js\` y la fecha en \`config.js\`.
- **Imágenes:** van al bucket \`feed-media\` de Supabase Storage, comprimidas a WebP (máx. 10 MB).
- **Secretos de correo:** \`RESEND_API_KEY\`, \`INVITE_FROM\` y \`SITE_URL\` en Supabase → Edge Functions → Secrets.
`, "agencia"),

  // ── FAQ
  A("faq-no-veo-mi-feed", "faq", "No veo mi feed o mis reportes", "Tu cuenta debe estar verificada y vinculada a tu empresa.", `
Si al entrar no ves datos, es probable que tu cuenta todavía no esté vinculada a tu empresa. Escríbele a tu contacto en Big Way; en cuanto te vinculen, lo verás sin volver a registrarte.
`),
  A("faq-enlace-caducado", "faq", "Mi enlace dice que caducó", "Los enlaces públicos tienen fecha de vencimiento.", `
Por seguridad, los enlaces para ver el feed sin cuenta vencen. Pide uno nuevo a Big Way, o mejor aún, una invitación para entrar con tu propia cuenta.
`),
  A("faq-cambios-aprobado", "faq", "¿Puedo pedir cambios a algo ya aprobado?", "Sí, mientras no esté publicado.", `
Sí. Abre la publicación o el guion y deja tu comentario. La agencia lo verá en el historial y lo volverá a enviar a aprobación.
`),
  A("faq-precios", "faq", "¿Los precios son fijos?", "Son de referencia y se fijan en cada cotización.", `
Los programas tienen un precio de referencia en dólares. Cada cotización se ajusta al alcance real de tu empresa. Lo que ves en tu cotización es lo que se factura.
`),
  A("faq-video-teleprompter", "faq", "¿Dónde queda el video del teleprompter?", "En tu dispositivo.", `
Cada toma se descarga a tu equipo cuando pulsas el botón de la toma. No se sube a internet, así que guárdalas antes de cerrar la ventana.
`),

  // ── Artículos
  A("articulo-pilares", "articulos", "Pilares de contenido: el orden detrás de un feed que vende", "Educar, inspirar, entretener, vender y comunidad.", `
Un feed sin pilares termina siendo puras promociones. Los pilares reparten la intención de cada publicación:

- **Educar:** resuelve dudas de tu comprador. Genera autoridad.
- **Inspirar:** casos, resultados, antes y después.
- **Entretener:** cercanía y alcance.
- **Vender:** ofertas y llamados a la acción claros.
- **Comunidad:** clientes, equipo, detrás de cámaras.

> Regla práctica B2B: no más de 1 publicación de venta directa por cada 3 de valor.
`),
  A("articulo-whatsapp-b2b", "articulos", "WhatsApp en B2B: de chat a canal de ventas", "Por qué medir cada entrada y responder rápido.", `
En B2B el comprador pregunta antes de comprar, y lo hace por WhatsApp. Tres prácticas que cambian los resultados:

1. **Un enlace por canal.** Usa el _Generador de enlaces_ de Herramientas con un mensaje distinto para la bio, los anuncios y el QR. Así sabes de dónde llega cada cliente.
2. **Responde en menos de 5 minutos.** La probabilidad de cerrar cae rápido después de eso. Un chatbot puede saludar y calificar al cliente mientras el equipo responde.
3. **Lleva cada conversación al CRM.** Sin registro no hay seguimiento, y sin seguimiento no hay venta.
`),
  A("articulo-reels-guion", "articulos", "Guion de un Reel que retiene", "Hook, desarrollo y CTA en menos de 35 segundos.", `
- **Hook (0–3 s):** una frase que nombre el problema del cliente. Nada de logos ni saludos.
- **Desarrollo:** una sola idea, mostrada antes que explicada.
- **CTA:** una acción concreta, como _Comenta GUÍA_ o _Escríbenos por WhatsApp_.

Graba con el teleprompter de la Sala para mantener el ritmo sin memorizar.
`),
];
