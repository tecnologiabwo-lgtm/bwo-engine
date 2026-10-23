/* Catálogo por defecto — datos puros (sin React ni Supabase) para poder probarlos.
   Idéntico a supabase/migrations/0006_price_seed.sql. */
export const CATEGORIES = [
  { key: "program", label: "Programas BWO", hint: "Fase I: pago único el primer mes · Fase II: mensualidad desde el segundo mes" },
  { key: "addon", label: "Complementos de programa", hint: "Se suman a la mensualidad" },
  { key: "plan", label: "Planes anteriores", group: "base" },
  { key: "crm", label: "Solo CRM + ADS (anterior)", group: "base" },
  { key: "clientify", label: "Plataforma Clientify", hint: "Mensual o anual (el anual se paga por adelantado)" },
  { key: "web", label: "Desarrollo web", group: "web", hint: "Proyecto de pago único" },
  { key: "advisory", label: "Asesoría & consultoría", group: "advisory" },
  { key: "event", label: "Cobertura de eventos", hint: "Por día" },
  { key: "support", label: "Soporte mensual", hint: "Horas al mes" },
  { key: "support_pack", label: "Soporte puntual", group: "support_pack" },
  { key: "setup", label: "Configuraciones iniciales", hint: "Pagos únicos" },
];
export const UNITS = { unico: "pago único", mes: "/ mes", hora: "/ hora", dia: "/ día", sesion: "/ sesión", pack: "pack", linea: "/ línea al mes", usuario: "/ usuario al mes" };

const f = (id, category, name, description, price, unit, extra = {}) =>
  ({ id, category, name, description, price, unit, price_year: null, setup_price: null, badge: null, color: null, features: [], meta: {}, active: true, public: true, sort: 0, ...extra });

const P = (id, name, description, setup, price, color, features, meta, sort, extra = {}) =>
  f(id, "program", name, description, price, "mes", { setup_price: setup, color, features, meta: { starts_month: 2, ...meta }, sort, ...extra });

export const DEFAULT_CATALOG = [
  P("prog_01", "Programa 01 · Presencia Digital B2B", "Contenido e imagen para Instagram y Facebook. Sin publicidad pagada ni CRM.", 300, 450, "#22D3C5",
    ["16 publicaciones al mes: 8 imágenes/carruseles y 8 Reels", "Guiones, diseño, edición, textos y publicación", "Historias semanales", "Respuestas automáticas y envío de catálogo por palabra clave en Instagram", "Revisión de perfiles y control de comentarios", "Project Manager con control de calidad semanal"],
    { excludes: ["prog_02", "prog_03"], num: 1 }, 1),
  P("prog_02", "Programa 02 · La Máquina de Facturación B2B", "Capte nuevos compradores y organice el seguimiento de sus ventas. Contenido, Meta Ads y CRM Clientify.", 450, 650, "#6C3BF5",
    ["16 piezas al mes: 8 imágenes/carruseles y 8 Reels con guion y edición", "Historias semanales", "Campañas de Meta Ads con formularios de precalificación", "1 usuario máster de Clientify con automatizaciones", "Hasta 8 horas de acompañamiento al mes", "Reporte mensual de publicidad y CRM · Project Manager"],
    { excludes: ["prog_01", "prog_03", "prog_04"], num: 2 }, 2, { badge: "EL MÁS COMPLETO EN META" }),
  P("prog_03", "Programa 03 · Expansión Corporativa Multicanal", "Contenido, anuncios en Meta y Google, y Clientify para hasta 4 usuarios.", 600, 950, "#E6197E",
    ["24 piezas al mes: 12 imágenes/carruseles y 12 Reels", "2 historias diarias", "Meta Ads y Google Ads (búsqueda)", "Clientify hasta 4 usuarios con embudo por vendedor", "Instagram automatizado y correo de seguimiento", "Hasta 8 horas de acompañamiento · reporte por vendedor"],
    { excludes: ["prog_01", "prog_02", "prog_04"], num: 3 }, 3, { badge: "MULTICANAL" }),
  P("prog_04", "Programa 04 · Integración Comercial CRM", "Clientify para ordenar clientes y ventas, con capacitación y 1 usuario máster.", 250, 150, "#F5A623",
    ["1 usuario máster de Clientify (renovación mensual)", "Etapas de venta, contactos y oportunidades", "WhatsApp Business, Instagram y Facebook conectados", "Capacitación práctica en su empresa", "Soporte en días hábiles, respuesta inicial ≤ 24 h", "Hasta 8 horas de acompañamiento · reporte de gestión comercial"],
    { excludes: ["prog_02", "prog_03"], num: 4 }, 4),
  P("prog_05", "Programa 05 · Centralización y WhatsApp API", "Bandeja de WhatsApp, chatbot y 1 usuario máster. Montaje previsto en 1 semana.", 150, 55, "#22D3C5",
    ["1 línea de WhatsApp conectada a la API oficial de Meta", "Clientify Inbox con 1 usuario máster", "Chatbot con menú, bienvenida y ausencia", "1 capacitación online", "Supervisión de la conexión y soporte técnico", "Los consumos de WhatsApp API se pagan aparte a Meta"],
    { num: 5 }, 5),
  P("prog_06", "Programa 06 · Comercio Electrónico y Tienda Virtual", "Sellibrí y carga inicial de hasta 50 productos. Primer mes de gestión incluido.", 500, 150, "#A78BFA",
    ["Tienda Sellibrí con la imagen de su marca", "Hasta 50 referencias (SKU) con categorías y variantes", "Pago Móvil, transferencias o Zelle · envíos y delivery", "Plan START de Sellibrí incluido", "1 banner mensual y reporte con 2–3 recomendaciones", "Manual PDF y capacitación en vivo de 60 min"],
    { num: 6, from_price: true }, 6, { badge: "DESDE" }),
  f("wa_line", "addon", "Línea adicional de WhatsApp", "Por línea, sobre el Programa 05", 15, "linea", { meta: { requires: "prog_05" }, sort: 7 }),

  f("plan_turquoise", "plan", "Plan Turquoise", "Ideal para iniciar presencia estratégica y captación B2B", 350, "mes", { active: false, color: "#22D3C5", sort: 10,
    features: ["4 post · 4 carruseles · 8 reels · 16 historias", "1 pauta/mes", "4 pub/sem · 7 historias/sem", "Optimización semanal CPL", "WhatsApp API + redes", "Pipeline", "Plantillas + seguimiento", "SLA + alertas"] }),
  f("plan_cerise", "plan", "Plan Cerise", "Plan integral balanceado con retargeting activo", 450, "mes", { active: false, color: "#E6197E", badge: "EL MÁS VENDIDO", sort: 20,
    features: ["6 post · 6 carruseles · 8 reels · 20 historias", "1-2 pautas/mes", "4-6 pub/sem · 7 historias/sem", "Captación + Retargeting", "Pipeline + protocolos", "Automatizaciones + reactivación", "Integraciones + dashboards"] }),
  f("plan_crayola", "plan", "Plan Crayola", "Dominio de marca con dirección creativa B2B", 750, "mes", { active: false, color: "#F5A623", badge: "MÁXIMA ESCALA", sort: 30,
    features: ["4 post · 8 carruseles · 12 reels · 24 historias", "2 pautas/mes", "6 pub/sem · 14 historias/sem", "Captación + Retargeting + Dirección creativa", "WhatsApp API multicanal", "Pipeline avanzado + automatizaciones", "Dashboards en tiempo real"] }),
  f("setup_social", "setup", "Configuración inicial & Onboarding (Fase 1)", "Pago único al contratar un plan", 350, "unico", { active: false, meta: { for: "plan" }, sort: 40 }),
  f("crm_ads_monthly", "crm", "Plan mensual CRM + ADS", "Sin gestión de redes: embudo + Business Manager + monitoreo", 150, "mes", { active: false, color: "#6C3BF5", sort: 50 }),
  f("crm_ads_setup", "setup", "Configuración inicial CRM + ADS", "Pago único", 250, "unico", { active: false, meta: { for: "crm" }, sort: 60 }),
  f("cf_plat", "clientify", "Acceso a la plataforma Clientify", "1 usuario + 1.000 contactos mkt", 65, "mes", { price_year: 468, badge: "Incluido en planes", meta: { group: "Plataforma base" }, sort: 100 }),
  f("cf_user", "clientify", "Usuario adicional", "Licencia por usuario extra", 25, "mes", { price_year: 180, meta: { group: "Usuarios y gestión" }, sort: 110 }),
  f("cf_adv", "clientify", "Gestión avanzada de usuarios", "Permisos granulares y auditoría", 12, "mes", { price_year: 86, meta: { group: "Usuarios y gestión" }, sort: 120 }),
  f("cf_contacts", "clientify", "+1.000 contactos de marketing", "Amplía tu base de contactos activos", 5, "mes", { price_year: 36, meta: { group: "Contactos" }, sort: 130 }),
  f("cf_inbox", "clientify", "Canal adicional en Inbox", "WhatsApp, Instagram, Messenger, etc.", 12, "mes", { price_year: 86, meta: { group: "Canales e Inbox" }, sort: 140 }),
  f("cf_api", "clientify", "ADD API", "Webhooks y automatizaciones externas", 20, "mes", { price_year: 144, meta: { group: "Integraciones" }, sort: 150 }),
  f("cf_ecomm", "clientify", "Integración e-commerce + API", "Sincronización de pedidos y clientes", 40, "mes", { price_year: 288, meta: { group: "Integraciones" }, sort: 160 }),
  f("cf_looker", "clientify", "ADD Looker Studio", "Dashboards analíticos avanzados", 37, "mes", { price_year: 266, meta: { group: "Analítica" }, sort: 170 }),
  f("cf_setup", "setup", "Configuración & Onboarding Clientify", "Pago único", 220, "unico", { meta: { for: "clientify" }, sort: 180 }),
  f("web_01", "web", "Web 01 — Corporativa Esencial", "Fase I diseño + configuraciones · Fase II páginas esenciales", 650, "unico", { sort: 200,
    features: ["Fase I · Diseño + configuraciones · 300", "Fase II · Páginas esenciales · 350"] }),
  f("web_02", "web", "Web 02 — Con sistema de citas", "Incluye sistema de citas", 900, "unico", { badge: "CITAS", sort: 210,
    features: ["Fase I · Diseño + configuraciones · 300", "Fase II · Páginas esenciales · 350", "Fase III · Sistema de citas · 250"] }),
  f("web_03", "web", "Web 03 — E-commerce completo", "WooCommerce + pasarela + tienda Meta", 2000, "unico", { badge: "ECOMMERCE", sort: 220,
    features: ["Fase I · Diseño + configuraciones · 300", "Fase II · Páginas esenciales · 350", "Fase III · WooCommerce + pasarela + tienda Meta · 1350"] }),
  f("adv_1", "advisory", "Asesoría & Consultoría · 1 sesión", "Sesión de 60 min", 50, "pack", { badge: "Sesión individual", meta: { sessions: 1 }, sort: 300 }),
  f("adv_4", "advisory", "Asesoría & Consultoría · 4 sesiones", "Sesiones de 60 min", 160, "pack", { badge: "Ahorro 20%", meta: { sessions: 4 }, sort: 310 }),
  f("adv_8", "advisory", "Asesoría & Consultoría · 8 sesiones", "Sesiones de 60 min", 250, "pack", { badge: "Ahorro 37.5%", meta: { sessions: 8 }, sort: 320 }),
  f("event_day", "event", "Cobertura de eventos", "Por día de cobertura", 70, "dia", { sort: 400 }),
  f("support_hour", "support", "Soporte mensual", "Horas de soporte recurrentes cada mes", 35, "hora", { meta: { recurring: true }, sort: 500 }),
  f("sup_1", "support_pack", "Pack soporte puntual · 1 h", null, 35, "pack", { meta: { hours: 1 }, sort: 510 }),
  f("sup_5", "support_pack", "Pack soporte puntual · 5 h", null, 150, "pack", { meta: { hours: 5 }, sort: 520 }),
  f("sup_10", "support_pack", "Pack soporte puntual · 10 h", null, 280, "pack", { meta: { hours: 10 }, sort: 530 }),
  f("sup_20", "support_pack", "Pack soporte puntual · 20 h", null, 500, "pack", { meta: { hours: 20 }, sort: 540 }),
];

export const DEFAULT_SETTINGS = {
  currency: "USD",
  tax: { label: "IVA", rate: 0 },
  quote_validity_days: 15,
  quote_footer: "Big Way Offices • info@bigwayoffices.com • bigwayoffices.com",
};

