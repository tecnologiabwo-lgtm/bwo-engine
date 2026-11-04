-- ============================================================
--  BWO ENGINE · 0005 · Núcleo de la plataforma
--  Aditiva sobre el esquema del Feed Planner (clients, pillars, posts,
--  stories, highlights, corrections, post_events). No borra datos.
--
--  Roles:  admin  = agencia (todo)
--          viewer = cliente (solo lo de los clientes a los que pertenece)
-- ============================================================

-- ---------- Perfiles ----------
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  role       text not null default 'viewer' check (role in ('admin','viewer')),
  created_at timestamptz not null default now()
);

-- Los usuarios que ya existen son del equipo de la agencia (login del Feed Planner)
insert into profiles(id, email, role)
select id, email, 'admin' from auth.users
on conflict (id) do nothing;

-- Toda cuenta nueva nace como espectador; un admin la promueve si hace falta
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles(id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;
create or replace trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------- Pertenencia usuario ↔ cliente ----------
create table if not exists client_members (
  client_id  uuid not null references clients(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (client_id, user_id)
);
create index if not exists idx_members_user on client_members(user_id);

create or replace function is_member(p_client uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select is_admin() or exists(select 1 from client_members where client_id = p_client and user_id = auth.uid());
$$;

-- ---------- Permisos del Feed Planner ----------
-- Antes: cualquier usuario autenticado veía y editaba todo. Ahora: admin todo,
-- espectador solo lectura de sus clientes (aprueba por las funciones con token).
-- Sin DROP: la política abierta «agency_all» se renombra y se restringe a administradores.
do $$
declare t text;
begin
  foreach t in array array['clients','pillars','posts','stories','highlights','corrections','post_events'] loop
    if to_regclass('public.'||t) is null then continue; end if;
    execute format('alter table %I enable row level security', t);
    if exists(select 1 from pg_policies where schemaname='public' and tablename=t and policyname='agency_all') then
      execute format('alter policy agency_all on %I rename to admin_all', t);
      execute format('alter policy admin_all on %I to authenticated using (is_admin()) with check (is_admin())', t);
    elsif not exists(select 1 from pg_policies where schemaname='public' and tablename=t and policyname='admin_all') then
      execute format('create policy admin_all on %I for all to authenticated using (is_admin()) with check (is_admin())', t);
    end if;
  end loop;
end $$;

create policy viewer_read on clients    for select to authenticated using (is_member(id));
create policy viewer_read on pillars    for select to authenticated using (is_member(client_id));
create policy viewer_read on stories    for select to authenticated using (is_member(client_id));
create policy viewer_read on highlights for select to authenticated using (is_member(client_id));
create policy viewer_read on posts      for select to authenticated
  using (is_member(client_id) and status <> 'draft' and coalesce(archived,false) = false);
create policy viewer_read on corrections for select to authenticated
  using (exists(select 1 from posts p where p.id = post_id and is_member(p.client_id)));
create policy viewer_read on post_events for select to authenticated
  using (exists(select 1 from posts p where p.id = post_id and is_member(p.client_id)));

-- Clientes visibles para el usuario actual (selector del portal)
create or replace function my_clients()
returns table(id uuid, name text, handle text, photo text, share_token uuid)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.handle, c.photo, c.share_token from clients c
  where is_member(c.id) order by c.name;
$$;

-- Administración de accesos (solo admin)
create or replace function admin_set_member(p_client uuid, p_email text, p_add boolean)
returns text language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  if not is_admin() then raise exception 'solo administradores'; end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then return 'no_user'; end if;
  if p_add then
    insert into client_members(client_id, user_id) values (p_client, v_user) on conflict do nothing;
  else
    delete from client_members where client_id = p_client and user_id = v_user;
  end if;
  return 'ok';
end $$;

create or replace function admin_set_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'solo administradores'; end if;
  if p_user = auth.uid() and p_role <> 'admin' then raise exception 'no puedes quitarte el rol de admin'; end if;
  update profiles set role = p_role where id = p_user;
end $$;

alter table profiles enable row level security;
alter table client_members enable row level security;
create policy self_read on profiles for select to authenticated using (id = auth.uid() or is_admin());
create policy self_update_name on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()));
create policy admin_all on client_members for all to authenticated using (is_admin()) with check (is_admin());
create policy self_read on client_members for select to authenticated using (user_id = auth.uid());
