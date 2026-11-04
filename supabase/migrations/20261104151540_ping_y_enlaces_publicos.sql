-- ============================================================
--  ping_y_enlaces_publicos
--  1) ping(): consulta mínima para que la tarea programada evite la hibernación.
--  2) Enlaces públicos con caducidad y revocación:
--     - share_links: varios enlaces por cliente, con etiqueta, vencimiento,
--       revocación y conteo de uso.
--     - clients.share_expires_at: caducidad opcional del token de siempre.
--     - El Feed aislado y el clásico siguen funcionando: get_client_feed y
--       client_bulk_* aceptan el token de siempre o un enlace nuevo.
--     - Revocar el token de siempre = rotarlo (admin_rotate_share_token).
--  Reversión: los enlaces nuevos se ignoran si se vuelve a la versión
--  anterior de las funciones; las columnas nuevas son nulas.
-- ============================================================
create or replace function ping()
returns timestamptz language sql stable as $$ select now(); $$;
grant execute on function ping() to anon, authenticated;

alter table clients add column if not exists share_expires_at timestamptz;

create table if not exists share_links (
  id           uuid primary key default gen_random_uuid(),
  token        uuid not null unique default gen_random_uuid(),
  client_id    uuid not null references clients(id) on delete cascade,
  scope        text not null default 'feed' check (scope in ('feed')),
  label        text not null default 'Enlace',
  expires_at   timestamptz,
  revoked_at   timestamptz,
  created_by   uuid references auth.users(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  uses         int not null default 0
);
create index if not exists idx_share_links_client on share_links(client_id);
alter table share_links enable row level security;
create policy admin_all on share_links for all to authenticated using (is_admin()) with check (is_admin());

-- Resuelve un token a su cliente si está vigente. Registra el uso y deja el
-- nombre del actor para la auditoría (bwo.actor) durante la transacción.
create or replace function resolve_share_token(p_token uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_client uuid; v_label text;
begin
  select l.client_id, l.label into v_client, v_label from share_links l
   where l.token = p_token and l.revoked_at is null and (l.expires_at is null or l.expires_at > now());
  if v_client is not null then
    update share_links set last_used_at = now(), uses = uses + 1 where token = p_token;
  else
    select c.id into v_client from clients c
     where c.share_token = p_token and (c.share_expires_at is null or c.share_expires_at > now());
    v_label := 'enlace principal';
  end if;
  if v_client is not null then
    perform set_config('bwo.actor', 'Cliente · ' || coalesce(v_label, 'enlace'), true);
  end if;
  return v_client;
end $$;
revoke execute on function resolve_share_token(uuid) from public, anon, authenticated;

create or replace function get_client_feed(p_token uuid)
returns json language plpgsql security definer set search_path = public as $$
declare v_client uuid := resolve_share_token(p_token);
begin
  if v_client is null then return json_build_object('client', null); end if;
  return json_build_object(
    'client', (select row_to_json(c) from (
        select id,name,handle,category,bio,link,photo,followers,following,
               frequency_per_week,frequency_days,frequency_note
        from clients where id = v_client) c),
    'pillars', (select coalesce(json_agg(row_to_json(p) order by p.sort),'[]'::json) from pillars p where p.client_id = v_client),
    'posts', (select coalesce(json_agg(pp),'[]'::json) from (
        select po.id, po.format, po.pillar_id, po.caption, po.images, po.cover,
               po.scheduled_date, po.status, po.pinned, po.sort,
               po.approved_at, po.approved_by,
               (select coalesce(json_agg(row_to_json(cor) order by cor.created_at),'[]'::json)
                  from corrections cor where cor.post_id=po.id) as corrections,
               (select coalesce(json_agg(row_to_json(ev) order by ev.created_at),'[]'::json)
                  from post_events ev where ev.post_id=po.id) as events
        from posts po
        where po.client_id = v_client and po.status <> 'draft' and coalesce(po.archived,false)=false
        order by po.pinned desc, po.sort) pp),
    'highlights', (select coalesce(json_agg(row_to_json(h) order by h.sort),'[]'::json) from highlights h where h.client_id = v_client),
    'stories', (select coalesce(json_agg(row_to_json(s) order by s.sort),'[]'::json) from stories s where s.client_id = v_client)
  );
end $$;

create or replace function client_bulk_approve(p_token uuid, p_posts uuid[])
returns int language plpgsql security definer set search_path=public as $$
declare v_client uuid := resolve_share_token(p_token); n int;
begin
  if v_client is null then raise exception 'enlace inválido o vencido'; end if;
  insert into corrections(post_id,author,text,resolved)
    select id,'Cliente','✓ Publicación aprobada',true from posts
    where id = any(p_posts) and client_id=v_client and status in ('pending','changes');
  insert into post_events(post_id,type,actor)
    select id,'approved','Cliente' from posts
    where id = any(p_posts) and client_id=v_client and status in ('pending','changes');
  update posts set status='approved', approved_at=now(), approved_by='Cliente'
    where id = any(p_posts) and client_id=v_client and status in ('pending','changes');
  get diagnostics n = row_count; return n;
end $$;

create or replace function client_bulk_changes(p_token uuid, p_posts uuid[], p_text text)
returns int language plpgsql security definer set search_path=public as $$
declare v_client uuid := resolve_share_token(p_token); n int;
begin
  if v_client is null then raise exception 'enlace inválido o vencido'; end if;
  if coalesce(length(trim(p_text)),0) = 0 then raise exception 'comentario vacío'; end if;
  if length(p_text) > 2000 then raise exception 'comentario demasiado largo'; end if;
  insert into corrections(post_id,author,text,resolved)
    select id,'Cliente',p_text,false from posts
    where id = any(p_posts) and client_id=v_client and status in ('pending','changes','approved');
  insert into post_events(post_id,type,actor,note)
    select id,'changes','Cliente',p_text from posts
    where id = any(p_posts) and client_id=v_client and status in ('pending','changes','approved');
  update posts set status='changes', approved_at=null, approved_by=null
    where id = any(p_posts) and client_id=v_client and status in ('pending','changes','approved');
  get diagnostics n = row_count; return n;
end $$;

-- Aprobación desde el portal con sesión (cliente identificado por su cuenta)
create or replace function portal_feed_decide(p_posts uuid[], p_approve boolean, p_text text default null)
returns int language plpgsql security definer set search_path = public as $$
declare v_name text; n int;
begin
  if not is_active() then raise exception 'cuenta no verificada'; end if;
  if exists(select 1 from posts where id = any(p_posts) and not is_member(client_id)) then raise exception 'sin acceso'; end if;
  select coalesce(nullif(full_name,''), email) into v_name from profiles where id = auth.uid();
  v_name := coalesce(v_name, 'Cliente') || case when is_admin() then '' else ' (cliente)' end;
  if p_approve then
    insert into corrections(post_id,author,text,resolved)
      select id, v_name, '✓ Publicación aprobada', true from posts where id = any(p_posts) and status in ('pending','changes');
    insert into post_events(post_id,type,actor)
      select id, 'approved', v_name from posts where id = any(p_posts) and status in ('pending','changes');
    update posts set status='approved', approved_at=now(), approved_by=v_name
      where id = any(p_posts) and status in ('pending','changes');
  else
    if coalesce(length(trim(p_text)),0) = 0 then raise exception 'describe el cambio'; end if;
    if length(p_text) > 2000 then raise exception 'comentario demasiado largo'; end if;
    insert into corrections(post_id,author,text,resolved)
      select id, v_name, p_text, false from posts where id = any(p_posts) and status in ('pending','changes','approved');
    insert into post_events(post_id,type,actor,note)
      select id, 'changes', v_name, p_text from posts where id = any(p_posts) and status in ('pending','changes','approved');
    update posts set status='changes', approved_at=null, approved_by=null
      where id = any(p_posts) and status in ('pending','changes','approved');
  end if;
  get diagnostics n = row_count; return n;
end $$;

create or replace function admin_create_share_link(p_client uuid, p_label text, p_days int default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_token uuid;
begin
  if not is_admin() then raise exception 'solo administradores'; end if;
  insert into share_links(client_id, label, expires_at)
  values (p_client, left(coalesce(nullif(trim(p_label),''),'Enlace'),80),
          case when p_days is null or p_days <= 0 then null else now() + make_interval(days => p_days) end)
  returning token into v_token;
  return v_token;
end $$;

create or replace function admin_revoke_share_link(p_link uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'solo administradores'; end if;
  update share_links set revoked_at = now() where id = p_link and revoked_at is null;
end $$;

-- Revoca el enlace de siempre generando uno nuevo (el anterior deja de funcionar)
create or replace function admin_rotate_share_token(p_client uuid, p_days int default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_token uuid := gen_random_uuid();
begin
  if not is_admin() then raise exception 'solo administradores'; end if;
  update clients set share_token = v_token,
         share_expires_at = case when p_days is null or p_days <= 0 then null else now() + make_interval(days => p_days) end
   where id = p_client;
  return v_token;
end $$;

-- El token de siempre solo lo ven los administradores y los miembros con sesión
create or replace function my_clients()
returns table(id uuid, name text, handle text, photo text, share_token uuid)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.handle, c.photo,
         case when c.share_expires_at is null or c.share_expires_at > now() then c.share_token end
  from clients c where is_member(c.id) order by c.name;
$$;

revoke execute on function portal_feed_decide(uuid[],boolean,text), admin_create_share_link(uuid,text,int),
  admin_revoke_share_link(uuid), admin_rotate_share_token(uuid,int) from public, anon;
grant execute on function portal_feed_decide(uuid[],boolean,text), admin_create_share_link(uuid,text,int),
  admin_revoke_share_link(uuid), admin_rotate_share_token(uuid,int) to authenticated;
grant execute on function get_client_feed(uuid), client_bulk_approve(uuid,uuid[]), client_bulk_changes(uuid,uuid[],text) to anon, authenticated;
