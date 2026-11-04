-- ============================================================
--  BWO ENGINE · 0006 · Catálogo inicial de precios (USD)
--  Copiado de pricingData.js. Los planes BWO estaban en EUR: se cargan con
--  la misma cifra en USD y se ajustan desde «Precios» en la plataforma.
--  on conflict do nothing: volver a correrlo no pisa precios ya editados.
-- ============================================================
insert into app_settings(key, value) values
  ('currency', '"USD"'),
  ('tax', '{"label":"IVA","rate":0}'),
  ('quote_validity_days', '15'),
  ('quote_footer', '"Big Way Offices • info@bigwayoffices.com • bigwayoffices.com"')
on conflict (key) do nothing;

insert into price_catalog(id, category, name, description, price, unit, badge, color, features, meta, sort) values
 ('plan_turquoise','plan','Plan Turquoise','Ideal para iniciar presencia estratégica y captación B2B',350,'mes',null,'#22D3C5',
  '["4 post · 4 carruseles · 8 reels · 16 historias","1 pauta/mes","4 pub/sem · 7 historias/sem","Optimización semanal CPL","WhatsApp API + redes","Pipeline","Plantillas + seguimiento","SLA + alertas"]','{}',10),
 ('plan_cerise','plan','Plan Cerise','Plan integral balanceado con retargeting activo',450,'mes','EL MÁS VENDIDO','#E6197E',
  '["6 post · 6 carruseles · 8 reels · 20 historias","1-2 pautas/mes","4-6 pub/sem · 7 historias/sem","Captación + Retargeting","Pipeline + protocolos","Automatizaciones + reactivación","Integraciones + dashboards"]','{}',20),
 ('plan_crayola','plan','Plan Crayola','Dominio de marca con dirección creativa B2B',750,'mes','MÁXIMA ESCALA','#F5A623',
  '["4 post · 8 carruseles · 12 reels · 24 historias","2 pautas/mes","6 pub/sem · 14 historias/sem","Captación + Retargeting + Dirección creativa","WhatsApp API multicanal","Pipeline avanzado + automatizaciones","Dashboards en tiempo real"]','{}',30),
 ('setup_social','setup','Configuración inicial & Onboarding (Fase 1)','Pago único al contratar un plan',350,'unico',null,null,'[]','{"for":"plan"}',40),
 ('crm_ads_monthly','crm','Plan mensual CRM + ADS','Sin gestión de redes: embudo + Business Manager + monitoreo',150,'mes',null,'#6C3BF5','[]','{}',50),
 ('crm_ads_setup','setup','Configuración inicial CRM + ADS','Pago único',250,'unico',null,null,'[]','{"for":"crm"}',60),
 ('cf_plat','clientify','Acceso a la plataforma Clientify','1 usuario + 1.000 contactos mkt',65,'mes','Incluido en planes',null,'[]','{"group":"Plataforma base"}',100),
 ('cf_user','clientify','Usuario adicional','Licencia por usuario extra',25,'mes',null,null,'[]','{"group":"Usuarios y gestión"}',110),
 ('cf_adv','clientify','Gestión avanzada de usuarios','Permisos granulares y auditoría',12,'mes',null,null,'[]','{"group":"Usuarios y gestión"}',120),
 ('cf_contacts','clientify','+1.000 contactos de marketing','Amplía tu base de contactos activos',5,'mes',null,null,'[]','{"group":"Contactos"}',130),
 ('cf_inbox','clientify','Canal adicional en Inbox','WhatsApp, Instagram, Messenger, etc.',12,'mes',null,null,'[]','{"group":"Canales e Inbox"}',140),
 ('cf_api','clientify','ADD API','Webhooks y automatizaciones externas',20,'mes',null,null,'[]','{"group":"Integraciones"}',150),
 ('cf_ecomm','clientify','Integración e-commerce + API','Sincronización de pedidos y clientes',40,'mes',null,null,'[]','{"group":"Integraciones"}',160),
 ('cf_looker','clientify','ADD Looker Studio','Dashboards analíticos avanzados',37,'mes',null,null,'[]','{"group":"Analítica"}',170),
 ('cf_setup','setup','Configuración & Onboarding Clientify','Pago único',220,'unico',null,null,'[]','{"for":"clientify"}',180),
 ('web_01','web','Web 01 — Corporativa Esencial','Fase I diseño + configuraciones · Fase II páginas esenciales',650,'unico',null,null,'["Fase I · Diseño + configuraciones · 300","Fase II · Páginas esenciales · 350"]','{}',200),
 ('web_02','web','Web 02 — Con sistema de citas','Incluye sistema de citas',900,'unico','CITAS',null,'["Fase I · Diseño + configuraciones · 300","Fase II · Páginas esenciales · 350","Fase III · Sistema de citas · 250"]','{}',210),
 ('web_03','web','Web 03 — E-commerce completo','WooCommerce + pasarela + tienda Meta',2000,'unico','ECOMMERCE',null,'["Fase I · Diseño + configuraciones · 300","Fase II · Páginas esenciales · 350","Fase III · WooCommerce + pasarela + tienda Meta · 1350"]','{}',220),
 ('adv_1','advisory','Asesoría & Consultoría · 1 sesión','Sesión de 60 min',50,'pack','Sesión individual',null,'[]','{"sessions":1}',300),
 ('adv_4','advisory','Asesoría & Consultoría · 4 sesiones','Sesiones de 60 min',160,'pack','Ahorro 20%',null,'[]','{"sessions":4}',310),
 ('adv_8','advisory','Asesoría & Consultoría · 8 sesiones','Sesiones de 60 min',250,'pack','Ahorro 37.5%',null,'[]','{"sessions":8}',320),
 ('event_day','event','Cobertura de eventos','Por día de cobertura',70,'dia',null,null,'[]','{}',400),
 ('support_hour','support','Soporte mensual','Horas de soporte recurrentes cada mes',35,'hora',null,null,'[]','{"recurring":true}',500),
 ('sup_1','support_pack','Pack soporte puntual · 1 h',null,35,'pack',null,null,'[]','{"hours":1}',510),
 ('sup_5','support_pack','Pack soporte puntual · 5 h',null,150,'pack',null,null,'[]','{"hours":5}',520),
 ('sup_10','support_pack','Pack soporte puntual · 10 h',null,280,'pack',null,null,'[]','{"hours":10}',530),
 ('sup_20','support_pack','Pack soporte puntual · 20 h',null,500,'pack',null,null,'[]','{"hours":20}',540)
on conflict (id) do nothing;

-- Clientify: precio anual (se cobra por adelantado)
update price_catalog set price_year = v.y from (values
 ('cf_plat',468),('cf_user',180),('cf_adv',86),('cf_contacts',36),('cf_inbox',86),('cf_api',144),('cf_ecomm',288),('cf_looker',266)
) as v(id,y) where price_catalog.id = v.id and price_catalog.price_year is null;
