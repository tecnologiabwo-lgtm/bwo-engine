-- ============================================================
--  auditoria_y_errores
--  1) audit_log: quién cambió qué y cuándo, en todas las tablas de negocio.
--     Lo escribe un trigger en la base, así que registra igual los cambios
--     hechos desde BWO Engine, el Feed aislado o un enlace público.
--     Guarda solo los campos que cambiaron (de → a); imágenes y contenidos
--     largos se anotan sin copiar su contenido. Solo admins lo leen.
--  2) client_errors + log_client_error(): errores del navegador en producción,
--     con límite anti-abuso (50 por usuario cada 10 min).
--  Reversión: deshabilitar los triggers audit_* (alter table ... disable trigger).
-- ============================================================
create table if not exists audit_log (
  id         bigserial primary key,
  at         timestamptz not null default now(),
  actor_id   uuid,
  actor_name text,
  actor_role text,
  via        text not null default 'app',
  client_id  uuid,
  entity     text not null,
  entity_id  text,
  action     text not null,
  changes    jsonb,
  note       text
);
create index if not exists idx_audit_at on audit_log(at desc);
create index if not exists idx_audit_client on audit_log(client_id, at desc);
create index if not exists idx_audit_entity on audit_log(entity, entity_id, at desc);
alter table audit_log enable row level security;
create policy admin_read on audit_log for select to authenticated using (is_admin());

create or replace function audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  r jsonb := coalesce(n, o);
  heavy text[] := array['images','cover','photo','img','data','blocks','lines','features'];
  ignore text[] := array['updated_at','created_at','sort','last_seen','last_used_at','uses','history','checks','cta_ready'];
  ch jsonb := '{}'::jsonb; k text; v_uid uuid := auth.uid(); v_name text; v_role text; v_via text := 'app'; v_client uuid;
begin
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(n) loop
      if k = any(ignore) or (o->k) is not distinct from (n->k) then continue; end if;
      ch := ch || jsonb_build_object(k, case when k = any(heavy)
              then jsonb_build_object('de','(contenido anterior)','a','(contenido nuevo)')
              else jsonb_build_object('de', o->k, 'a', n->k) end);
    end loop;
    if ch = '{}'::jsonb then return new; end if;
  else
    for k in select jsonb_object_keys(r) loop
      if k = any(ignore) or r->k is null or r->k = 'null'::jsonb then continue; end if;
      ch := ch || jsonb_build_object(k, case when k = any(heavy) then to_jsonb('(contenido)'::text) else r->k end);
    end loop;
  end if;

  if v_uid is not null then
    select coalesce(nullif(full_name,''), email), role into v_name, v_role from profiles where id = v_uid;
  else
    v_name := coalesce(nullif(current_setting('bwo.actor', true), ''), 'sistema');
    v_via := case when v_name like 'Cliente%' then 'enlace' else 'sistema' end;
  end if;
  v_client := case when tg_table_name = 'clients' then (r->>'id')::uuid
                   when r ? 'client_id' then (r->>'client_id')::uuid end;
  begin
    insert into audit_log(actor_id, actor_name, actor_role, via, client_id, entity, entity_id, action, changes)
    values (v_uid, v_name, v_role, v_via, v_client, tg_table_name,
            coalesce(r->>'id', r->>'key', r->>'user_id'),
            case tg_op when 'INSERT' then 'crear' when 'DELETE' then 'eliminar'
                       else case when ch ? 'status' then 'estado' else 'editar' end end,
            ch);
  exception when others then null;  -- la auditoría nunca bloquea la operación
  end;
  return coalesce(new, old);
end $$;
revoke execute on function audit_row() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['clients','pillars','posts','stories','highlights','sala_calendars','sala_pieces','quotes',
                           'price_catalog','app_settings','client_members','profiles','reports','share_links'] loop
    if to_regclass('public.'||t) is null then continue; end if;
    execute format('create or replace trigger audit_%1$s after insert or update or delete on %1$I for each row execute function audit_row()', t);
  end loop;
end $$;

create table if not exists client_errors (
  id         bigserial primary key,
  at         timestamptz not null default now(),
  user_id    uuid default auth.uid(),
  message    text not null,
  stack      text,
  url        text,
  release    text,
  user_agent text,
  context    jsonb
);
create index if not exists idx_client_errors_at on client_errors(at desc);
alter table client_errors enable row level security;
create policy admin_read on client_errors for select to authenticated using (is_admin());

create or replace function log_client_error(p_message text, p_stack text default null, p_url text default null,
  p_release text default null, p_user_agent text default null, p_context jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from client_errors
       where at > now() - interval '10 minutes'
         and (user_id = auth.uid() or (auth.uid() is null and user_id is null))) >= 50 then
    return;  -- límite anti-abuso
  end if;
  insert into client_errors(message, stack, url, release, user_agent, context)
  values (left(coalesce(p_message,'(sin mensaje)'), 1000), left(p_stack, 6000), left(p_url, 500),
          left(p_release, 60), left(p_user_agent, 300),
          case when pg_column_size(p_context) < 8000 then p_context end);
end $$;
grant execute on function log_client_error(text,text,text,text,text,jsonb) to anon, authenticated;
