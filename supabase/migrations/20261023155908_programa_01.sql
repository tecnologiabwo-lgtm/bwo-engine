-- ============================================================
--  BWO ENGINE · 0009 · Programa 01 (Presencia Digital B2B)
--  Fase I 300 USD (primer mes) · Fase II 450 USD/mes desde el mes 2.
--  Los precios son valores iniciales: se fijan y ajustan en
--  «Precios y planes», y cada cotización puede acordar otro precio.
-- ============================================================
update price_catalog set
  name = 'Programa 01 · Presencia Digital B2B',
  description = 'Contenido e imagen para Instagram y Facebook. Sin publicidad pagada ni CRM.',
  setup_price = coalesce(nullif(setup_price, 0), 300),
  price = case when price = 0 then 450 else price end,
  features = '["16 publicaciones al mes: 8 imágenes/carruseles y 8 Reels","Guiones, diseño, edición, textos y publicación","Historias semanales","Respuestas automáticas y envío de catálogo por palabra clave en Instagram","Revisión de perfiles y control de comentarios","Project Manager con control de calidad semanal"]',
  active = true, updated_at = now()
where id = 'prog_01';
