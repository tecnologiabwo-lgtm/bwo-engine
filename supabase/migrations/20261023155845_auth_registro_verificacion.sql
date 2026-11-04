-- ============================================================
--  BWO ENGINE · 0007 · Registro de clientes con verificación,
--  control de acceso por atributos (anti-IDOR) y sesiones.
--
--  Flujo: el cliente se registra (queda «pendiente») → la agencia
--  verifica el registro y lo vincula a su empresa → recién entonces
--  ve datos. Toda lectura pasa por RLS: cambiar un id en la URL no
--  da acceso a datos de otro cliente (IDOR).
-- ============================================================

alter table profiles add column if not exists status      text not null default 'pending';
alter table profiles add column if not exists company     text;
alter table profiles add column if not exists phone       text;
alter table profiles add column if not exists note        text;          -- mensaje del registro
alter table profiles add column if not exists reviewed_at timestamptz;
alter table profiles add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table profiles add column if not exists last_seen   timestamptz;

do $$ begin
  alter table profiles add constraint profiles_status_chk check (status in ('pending','active','blocked'));
exception when duplicate_object then null; end $$;

-- Las cuentas que ya existían (equipo de la agencia) quedan activas
update profiles set status = 'active' where role = 'admin' and status = 'pending';

-- Registro: el rol y el estado NUNCA salen de los datos que envía el usuario
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles(id, email, full_name, company, phone, note, role, status)
  values (new.id, new.email,
          left(coalesce(new.raw_user_meta_data->>'full_name', ''), 120),
          left(coalesce(new.raw_user_meta_data->>'company', ''), 120),
          left(coalesce(new.raw_user_meta_data->>'phone', ''), 40),
          left(coalesce(new.raw_user_meta_data->>'note', ''), 500),
          'viewer', 'pending')
  on conflict (id) do nothing;
  return new;
end $$;

-- Solo un admin activo es admin; solo un usuario activo es miembro
create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and role = 'admin' and status = 'active');
$$;

create or replace function is_member(p_client uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select is_admin() or exists(
    select 1 from client_members m join profiles p on p.id = m.user_id
    where m.client_id = p_client and m.user_id = auth.uid() and p.status = 'active');
$$;

-- El usuario puede editar su nombre/teléfono, pero no su rol, estado ni revisión
create or replace function protect_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    new.role := old.role; new.status := old.status; new.email := old.email;
    new.reviewed_at := old.reviewed_at; new.reviewed_by := old.reviewed_by;
  end if;
  return new;
end $$;
create or replace trigger profiles_protect before update on profiles for each row execute function protect_profile();

-- (sin DROP) la protección de columnas la hace el trigger; la política queda simple
alter policy self_update_name on profiles rename to self_update;
alter policy self_update on profiles using (id = auth.uid()) with check (id = auth.uid());
create policy admin_update on profiles for update to authenticated using (is_admin()) with check (is_admin());

-- Verificación del registro por la agencia
create or replace function admin_review_signup(p_user uuid, p_approve boolean, p_client uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'solo administradores'; end if;
  if p_user = auth.uid() then raise exception 'no puedes revisar tu propia cuenta'; end if;
  update profiles set status = case when p_approve then 'active' else 'blocked' end,
         reviewed_at = now(), reviewed_by = auth.uid()
   where id = p_user;
  if p_approve and p_client is not null then
    insert into client_members(client_id, user_id) values (p_client, p_user) on conflict do nothing;
  end if;
  if not p_approve then
    delete from client_members where user_id = p_user;
  end if;
end $$;

-- Bloquear / reactivar una cuenta ya existente
create or replace function admin_set_status(p_user uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'solo administradores'; end if;
  if p_user = auth.uid() then raise exception 'no puedes cambiar tu propio estado'; end if;
  if p_status not in ('active','blocked','pending') then raise exception 'estado inválido'; end if;
  update profiles set status = p_status, reviewed_at = now(), reviewed_by = auth.uid() where id = p_user;
end $$;

-- Dar acceso exige que la cuenta esté verificada
create or replace function admin_set_member(p_client uuid, p_email text, p_add boolean)
returns text language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_status text;
begin
  if not is_admin() then raise exception 'solo administradores'; end if;
  select u.id, p.status into v_user, v_status from auth.users u left join profiles p on p.id = u.id
   where lower(u.email) = lower(trim(p_email));
  if v_user is null then return 'no_user'; end if;
  if p_add then
    if v_status <> 'active' then return 'not_active'; end if;
    insert into client_members(client_id, user_id) values (p_client, v_user) on conflict do nothing;
  else
    delete from client_members where client_id = p_client and user_id = v_user;
  end if;
  return 'ok';
end $$;

-- Latido de actividad (expiración de sesión del lado del servidor, auditable)
create or replace function touch_session()
returns text language sql security definer set search_path = public as $$
  update profiles set last_seen = now() where id = auth.uid() returning status;
$$;

-- Política de sesión configurable por la agencia
insert into app_settings(key, value) values ('session', '{"idle_minutes":30,"max_hours":12,"warn_seconds":60}')
on conflict (key) do nothing;

grant execute on function admin_review_signup(uuid,boolean,uuid), admin_set_status(uuid,text),
  admin_set_member(uuid,text,boolean), touch_session() to authenticated;

-- Una cuenta sin verificar no lee nada más que su propio perfil
create or replace function is_active()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and status = 'active');
$$;
grant execute on function is_active() to authenticated;

alter policy read_public on price_catalog using (active and public and is_active());
alter policy read_all on app_settings using (is_active() or key = 'session');
alter policy viewer_request on quotes
  with check (is_active() and created_by = auth.uid() and source = 'cliente' and status = 'solicitada' and (client_id is null or is_member(client_id)));
alter policy viewer_own on quotes
  using (is_active() and (created_by = auth.uid() or (client_id is not null and is_member(client_id))));
