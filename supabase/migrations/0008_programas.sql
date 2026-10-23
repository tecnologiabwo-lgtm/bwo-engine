-- ============================================================
--  BWO ENGINE · 0008 · Programas BWO (brochures 2026)
--  Cada programa: Fase I = pago único el primer mes (setup_price);
--  Fase II = mensualidad desde el segundo mes (price, meta.starts_month = 2).
--  Los planes anteriores (Turquoise/Cerise/Crayola, CRM+ADS) se desactivan:
--  no se borran, para conservar el historial.
-- ============================================================
alter table price_catalog add column if not exists setup_price numeric(12,2);

alter table price_catalog drop constraint if exists price_catalog_unit_check;
alter table price_catalog add constraint price_catalog_unit_check check (unit in ('unico','mes','hora','dia','sesion','pack','linea','usuario'));

update price_catalog set active = false
 where id in ('plan_turquoise','plan_cerise','plan_crayola','setup_social','crm_ads_monthly','crm_ads_setup');

insert into price_catalog(id, category, name, description, price, setup_price, unit, badge, color, features, meta, sort, active) values
 ('prog_01','program','Programa 01 · Presencia Digital B2B','Contenido e imagen para Instagram y Facebook.',0,0,'mes',null,'#22D3C5',
  '["Precio pendiente de cargar"]','{"starts_month":2,"excludes":["prog_02","prog_03"],"num":1}',10,false),
 ('prog_02','program','Programa 02 · La Máquina de Facturación B2B','Capte nuevos compradores y organice el seguimiento de sus ventas. Contenido, Meta Ads y CRM Clientify.',650,450,'mes','EL MÁS COMPLETO EN META','#6C3BF5',
  '["16 piezas al mes: 8 imágenes/carruseles y 8 Reels con guion y edición","Historias semanales","Campañas de Meta Ads con formularios de precalificación","1 usuario máster de Clientify con automatizaciones","Hasta 8 horas de acompañamiento al mes","Reporte mensual de publicidad y CRM · Project Manager"]',
  '{"starts_month":2,"excludes":["prog_01","prog_03","prog_04"],"num":2}',20,true),
 ('prog_03','program','Programa 03 · Expansión Corporativa Multicanal','Contenido, anuncios en Meta y Google, y Clientify para hasta 4 usuarios.',950,600,'mes','MULTICANAL','#E6197E',
  '["24 piezas al mes: 12 imágenes/carruseles y 12 Reels","2 historias diarias","Meta Ads y Google Ads (búsqueda)","Clientify hasta 4 usuarios con embudo por vendedor","Instagram automatizado y correo de seguimiento","Hasta 8 horas de acompañamiento · reporte por vendedor"]',
  '{"starts_month":2,"excludes":["prog_01","prog_02","prog_04"],"num":3}',30,true),
 ('prog_04','program','Programa 04 · Integración Comercial CRM','Clientify para ordenar clientes y ventas, con capacitación y 1 usuario máster.',150,250,'mes',null,'#F5A623',
  '["1 usuario máster de Clientify (renovación mensual)","Etapas de venta, contactos y oportunidades","WhatsApp Business, Instagram y Facebook conectados","Capacitación práctica en su empresa","Soporte en días hábiles, respuesta inicial ≤ 24 h","Hasta 8 horas de acompañamiento · reporte de gestión comercial"]',
  '{"starts_month":2,"excludes":["prog_02","prog_03"],"num":4}',40,true),
 ('prog_05','program','Programa 05 · Centralización y WhatsApp API','Bandeja de WhatsApp, chatbot y 1 usuario máster. Montaje previsto en 1 semana.',55,150,'mes',null,'#22D3C5',
  '["1 línea de WhatsApp conectada a la API oficial de Meta","Clientify Inbox con 1 usuario máster","Chatbot con menú, bienvenida y ausencia","1 capacitación online","Supervisión de la conexión y soporte técnico","Los consumos de WhatsApp API se pagan aparte a Meta"]',
  '{"starts_month":2,"num":5}',50,true),
 ('prog_06','program','Programa 06 · Comercio Electrónico y Tienda Virtual','Sellibrí y carga inicial de hasta 50 productos. Primer mes de gestión incluido.',150,500,'mes','DESDE','#A78BFA',
  '["Tienda Sellibrí con la imagen de su marca","Hasta 50 referencias (SKU) con categorías y variantes","Pago Móvil, transferencias o Zelle · envíos y delivery","Plan START de Sellibrí incluido","1 banner mensual y reporte con 2–3 recomendaciones","Manual PDF y capacitación en vivo de 60 min"]',
  '{"starts_month":2,"num":6,"from_price":true}',60,true),
 ('wa_line','addon','Línea adicional de WhatsApp','Por línea, sobre el Programa 05',15,null,'linea',null,null,'[]','{"requires":"prog_05"}',70,true)
on conflict (id) do nothing;
