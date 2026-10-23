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
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
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
do $$
declare t text; p record;
begin
  foreach t in array array['clients','pillars','posts','stories','highlights','corrections','post_events'] loop
    if to_regclass('public.'||t) is null then continue; end if;
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on %I', p.policyname, t);
    end loop;
    execute format('alter table %I enable row level security', t);
    execute format('create policy admin_all on %I for all to authenticated using (is_admin()) with check (is_admin())', t);
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

-- ---------- Catálogo de precios (editable desde la plataforma) ----------
create table if not exists price_catalog (
  id          text primary key,
  category    text not null,          -- plan | crm | clientify | web | advisory | event | support | support_pack | setup
  name        text not null,
  description text,
  price       numeric(12,2) not null default 0,
  price_year  numeric(12,2),          -- precio anual (Clientify)
  unit        text not null default 'unico' check (unit in ('unico','mes','hora','dia','sesion','pack')),
  badge       text,
  color       text,
  features    jsonb not null default '[]',
  meta        jsonb not null default '{}',
  sort        int not null default 0,
  active      boolean not null default true,
  public      boolean not null default true,   -- visible para el cliente en la autocotización
  updated_at  timestamptz not null default now()
);
alter table price_catalog enable row level security;
create policy admin_all on price_catalog for all to authenticated using (is_admin()) with check (is_admin());
create policy read_public on price_catalog for select to authenticated using (active and public);

create table if not exists app_settings (
  key   text primary key,
  value jsonb not null
);
alter table app_settings enable row level security;
create policy admin_all on app_settings for all to authenticated using (is_admin()) with check (is_admin());
create policy read_all on app_settings for select to authenticated using (true);

-- ---------- Cotizaciones ----------
create table if not exists quotes (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references clients(id) on delete set null,
  created_by  uuid references auth.users(id) on delete set null default auth.uid(),
  source      text not null default 'agencia' check (source in ('agencia','cliente')),
  contact     jsonb not null default '{}',
  lines       jsonb not null default '[]',
  totals      jsonb not null default '{}',
  discounts   jsonb not null default '{}',
  status      text not null default 'borrador' check (status in ('borrador','enviada','solicitada','aceptada','rechazada','vencida')),
  valid_until date,
  created_at  timestamptz not null default now()
);
alter table quotes enable row level security;
create policy admin_all on quotes for all to authenticated using (is_admin()) with check (is_admin());
create policy viewer_own on quotes for select to authenticated using (created_by = auth.uid() or (client_id is not null and is_member(client_id)));
create policy viewer_request on quotes for insert to authenticated
  with check (created_by = auth.uid() and source = 'cliente' and status = 'solicitada' and (client_id is null or is_member(client_id)));

-- ---------- Sala de Producción ----------
create table if not exists sala_calendars (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references clients(id) on delete cascade,
  month      date not null,              -- primer día del mes
  title      text not null default '',
  objective  text,
  summary    text,
  channels   text,
  arc        jsonb not null default '[]',
  milestones jsonb not null default '[]',
  created_at timestamptz not null default now(),
  unique (client_id, month)
);
create table if not exists sala_pieces (
  id         uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references sala_calendars(id) on delete cascade,
  client_id  uuid not null references clients(id) on delete cascade,
  ext_id     text,                       -- id del JSON importado (para reimportar sin duplicar)
  date       date not null,
  fmt        text not null default 'reel' check (fmt in ('reel','carrusel','historias','post','institucional')),
  title      text not null default '',
  sub        text, series text, num int,
  audience   text, pain text, intent text, tone text,
  visual     text, setup text, props text,
  dur_min    int, dur_max int,
  blocks     jsonb not null default '[]',   -- [{k,t,x,v,s}]
  cta        jsonb not null default '{}',   -- {type,value,resource}
  decision   jsonb,                         -- {q, options[]}
  choice     int,
  gaps       jsonb not null default '[]',
  facts      jsonb not null default '[]',   -- [{label,a,op,b,unit,claim}]
  status     text not null default 'borrador'
             check (status in ('borrador','aprobacion','cambios','aprobado','produccion','edicion','listo','publicado')),
  checks     jsonb not null default '{}',
  cta_ready  jsonb not null default '{}',
  history    jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (calendar_id, ext_id)
);
create index if not exists idx_pieces_cal on sala_pieces(calendar_id, date);
create table if not exists sala_comments (
  id         uuid primary key default gen_random_uuid(),
  piece_id   uuid not null references sala_pieces(id) on delete cascade,
  author     uuid references auth.users(id) on delete set null default auth.uid(),
  author_name text,
  kind       text not null default 'nota' check (kind in ('nota','cambio')),
  text       text not null check (length(trim(text)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists idx_comments_piece on sala_comments(piece_id, created_at);

alter table sala_calendars enable row level security;
alter table sala_pieces enable row level security;
alter table sala_comments enable row level security;
create policy admin_all on sala_calendars for all to authenticated using (is_admin()) with check (is_admin());
create policy admin_all on sala_pieces    for all to authenticated using (is_admin()) with check (is_admin());
create policy admin_all on sala_comments  for all to authenticated using (is_admin()) with check (is_admin());
create policy viewer_read on sala_calendars for select to authenticated using (is_member(client_id));
create policy viewer_read on sala_pieces    for select to authenticated using (is_member(client_id) and status <> 'borrador');
create policy viewer_read on sala_comments  for select to authenticated
  using (exists(select 1 from sala_pieces p where p.id = piece_id and is_member(p.client_id)));

-- El historial se escribe en el servidor: dos personas a la vez no se pisan
create or replace function sala_set_status(p_piece uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v sala_pieces; v_name text;
begin
  select * into v from sala_pieces where id = p_piece for update;
  if v.id is null then raise exception 'pieza no encontrada'; end if;
  if not is_member(v.client_id) then raise exception 'sin acceso'; end if;
  -- El cliente solo aprueba o pide cambios de lo que está en aprobación
  if not is_admin() then
    if p_status not in ('aprobado','cambios') or v.status not in ('aprobacion','cambios','aprobado') then
      raise exception 'acción no permitida';
    end if;
    if p_status = 'cambios' and coalesce(length(trim(p_note)),0) = 0 then raise exception 'describe el cambio'; end if;
  end if;
  select coalesce(nullif(full_name,''), email) into v_name from profiles where id = auth.uid();
  update sala_pieces set status = p_status, updated_at = now(),
    history = history || jsonb_build_array(jsonb_build_object(
      's', p_status, 'at', now(), 'by', coalesce(v_name,'—'), 'role', case when is_admin() then 'agencia' else 'cliente' end, 'note', p_note))
  where id = p_piece;
  if p_status = 'cambios' and p_note is not null then
    insert into sala_comments(piece_id, author_name, kind, text) values (p_piece, v_name, 'cambio', p_note);
  end if;
end $$;

-- El cliente elige una opción de la decisión pendiente
create or replace function sala_choose(p_piece uuid, p_choice int)
returns void language plpgsql security definer set search_path = public as $$
declare v sala_pieces;
begin
  select * into v from sala_pieces where id = p_piece;
  if v.id is null or not is_member(v.client_id) then raise exception 'sin acceso'; end if;
  update sala_pieces set choice = p_choice, updated_at = now() where id = p_piece;
end $$;

-- Comentario del cliente (la tabla solo deja insertar al admin)
create or replace function sala_comment(p_piece uuid, p_text text)
returns void language plpgsql security definer set search_path = public as $$
declare v sala_pieces; v_name text;
begin
  select * into v from sala_pieces where id = p_piece;
  if v.id is null or not is_member(v.client_id) then raise exception 'sin acceso'; end if;
  select coalesce(nullif(full_name,''), email) into v_name from profiles where id = auth.uid();
  insert into sala_comments(piece_id, author_name, kind, text) values (p_piece, v_name, 'nota', p_text);
end $$;

-- Marca de toma / check del CTA: fusiona la clave en el servidor en vez de reemplazar el objeto
create or replace function sala_toggle(p_piece uuid, p_field text, p_key text, p_value boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'solo administradores'; end if;
  if p_field = 'checks' then
    update sala_pieces set checks = checks || jsonb_build_object(p_key, p_value), updated_at = now() where id = p_piece;
  elsif p_field = 'cta_ready' then
    update sala_pieces set cta_ready = cta_ready || jsonb_build_object(p_key, p_value), updated_at = now() where id = p_piece;
  else raise exception 'campo inválido'; end if;
end $$;

-- ---------- Reportes del Consolidador ----------
create table if not exists reports (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients(id) on delete cascade,
  period_from  date not null,
  period_to    date not null,
  title        text,
  data         jsonb not null,
  analysis     text,
  published_by uuid references auth.users(id) on delete set null default auth.uid(),
  published_at timestamptz not null default now(),
  unique (client_id, period_from, period_to)
);
alter table reports enable row level security;
create policy admin_all on reports for all to authenticated using (is_admin()) with check (is_admin());
create policy viewer_read on reports for select to authenticated using (is_member(client_id));

grant execute on function is_admin(), is_member(uuid), my_clients(),
  admin_set_member(uuid,text,boolean), admin_set_role(uuid,text),
  sala_set_status(uuid,text,text), sala_choose(uuid,int), sala_comment(uuid,text),
  sala_toggle(uuid,text,text,boolean) to authenticated;

-- Tiempo real para la Sala (si la publicación existe, como en todo proyecto de Supabase)
do $$ begin
  alter publication supabase_realtime add table sala_pieces, sala_comments;
exception when others then null; end $$;
