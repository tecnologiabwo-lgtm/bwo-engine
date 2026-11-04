-- BWO Engine · núcleo (parte C): Sala de producción y reportes
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
