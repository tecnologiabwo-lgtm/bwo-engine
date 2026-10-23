-- ============================================================
--  BWO ENGINE · 0010 · Endurecimiento (asesor de seguridad de Supabase)
--  - Funciones internas: sin acceso para usuarios sin sesión (anon).
--  - Funciones de trigger: no se pueden llamar por la API.
--  - Solo quedan públicas las del enlace del feed por token.
-- ============================================================
revoke execute on function is_admin(), is_member(uuid), is_active(), my_clients(),
  admin_set_member(uuid,text,boolean), admin_set_role(uuid,text), admin_review_signup(uuid,boolean,uuid),
  admin_set_status(uuid,text), touch_session(),
  sala_set_status(uuid,text,text), sala_choose(uuid,int), sala_comment(uuid,text), sala_toggle(uuid,text,text,boolean)
  from public, anon;

revoke execute on function handle_new_user(), protect_profile() from public, anon, authenticated;

-- Enlace público del feed (sin login, protegido por token UUID): se mantienen para anon
grant execute on function get_client_feed(uuid), client_bulk_approve(uuid,uuid[]), client_bulk_changes(uuid,uuid[],text),
  client_approve(uuid,uuid), client_request_changes(uuid,uuid,text) to anon, authenticated;

-- Tabla de diagnóstico creada durante la instalación: cerrada hasta que se elimine
do $$ begin
  if to_regclass('public._bwo_probe') is not null then
    execute 'alter table public._bwo_probe enable row level security';
    execute 'revoke all on public._bwo_probe from anon, authenticated';
  end if;
end $$;
