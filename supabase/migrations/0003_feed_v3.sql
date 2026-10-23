-- ============================================================
--  FEED PLANNER · MIGRACIÓN v3
--  Ejecutar UNA vez en Supabase → SQL Editor → Run.
--  No borra nada: solo agrega columnas y actualiza funciones.
-- ============================================================

alter table posts   add column if not exists cover        text;          -- portada del reel
alter table posts   add column if not exists approved_at  timestamptz;   -- fecha de aprobación
alter table posts   add column if not exists approved_by  text;          -- 'Cliente' o 'BigWay'
alter table posts   add column if not exists archived     boolean default false;
alter table stories add column if not exists scheduled_date date;
alter table clients add column if not exists archive_after_days int;     -- archivado automático (null = apagado)

update posts set archived = false where archived is null;
create index if not exists idx_posts_archived on posts(client_id, archived);

-- Feed del cliente: sin borradores ni archivados
create or replace function get_client_feed(p_token uuid)
returns json language sql security definer set search_path = public as $$
  select json_build_object(
    'client', (select row_to_json(c) from (
        select id,name,handle,category,bio,link,photo,followers,following,
               frequency_per_week,frequency_days,frequency_note
        from clients where share_token = p_token) c),
    'pillars', (select coalesce(json_agg(row_to_json(p) order by p.sort),'[]'::json)
        from pillars p join clients c on c.id=p.client_id where c.share_token=p_token),
    'posts', (select coalesce(json_agg(pp),'[]'::json) from (
        select po.id, po.format, po.pillar_id, po.caption, po.images, po.cover,
               po.scheduled_date, po.status, po.pinned, po.sort,
               po.approved_at, po.approved_by,
               (select coalesce(json_agg(row_to_json(cor) order by cor.created_at),'[]'::json)
                  from corrections cor where cor.post_id=po.id) as corrections
        from posts po join clients c on c.id=po.client_id
        where c.share_token=p_token and po.status <> 'draft' and coalesce(po.archived,false)=false
        order by po.pinned desc, po.sort) pp),
    'highlights', (select coalesce(json_agg(row_to_json(h) order by h.sort),'[]'::json)
        from highlights h join clients c on c.id=h.client_id where c.share_token=p_token),
    'stories', (select coalesce(json_agg(row_to_json(s) order by s.sort),'[]'::json)
        from stories s join clients c on c.id=s.client_id where c.share_token=p_token)
  );
$$;

-- Aprobar una o varias publicaciones
create or replace function client_bulk_approve(p_token uuid, p_posts uuid[])
returns int language plpgsql security definer set search_path=public as $$
declare v_client uuid; n int;
begin
  select id into v_client from clients where share_token = p_token;
  if v_client is null then raise exception 'token inválido'; end if;
  insert into corrections(post_id,author,text,resolved)
    select id,'Cliente','✓ Publicación aprobada',true from posts
    where id = any(p_posts) and client_id=v_client and status in ('pending','changes');
  update posts set status='approved', approved_at=now(), approved_by='Cliente'
    where id = any(p_posts) and client_id=v_client and status in ('pending','changes');
  get diagnostics n = row_count; return n;
end $$;

-- Pedir cambios en una o varias publicaciones
create or replace function client_bulk_changes(p_token uuid, p_posts uuid[], p_text text)
returns int language plpgsql security definer set search_path=public as $$
declare v_client uuid; n int;
begin
  select id into v_client from clients where share_token = p_token;
  if v_client is null then raise exception 'token inválido'; end if;
  insert into corrections(post_id,author,text,resolved)
    select id,'Cliente',p_text,false from posts
    where id = any(p_posts) and client_id=v_client and status in ('pending','changes','approved');
  update posts set status='changes', approved_at=null, approved_by=null
    where id = any(p_posts) and client_id=v_client and status in ('pending','changes','approved');
  get diagnostics n = row_count; return n;
end $$;

-- Las funciones individuales ahora delegan en las masivas
create or replace function client_approve(p_token uuid, p_post uuid)
returns void language plpgsql security definer set search_path=public as $$
begin perform client_bulk_approve(p_token, array[p_post]); end $$;
create or replace function client_request_changes(p_token uuid, p_post uuid, p_text text)
returns void language plpgsql security definer set search_path=public as $$
begin perform client_bulk_changes(p_token, array[p_post], p_text); end $$;

grant execute on function client_bulk_approve(uuid,uuid[])       to anon, authenticated;
grant execute on function client_bulk_changes(uuid,uuid[],text)  to anon, authenticated;
grant execute on function client_approve(uuid,uuid)              to anon, authenticated;
grant execute on function client_request_changes(uuid,uuid,text) to anon, authenticated;
