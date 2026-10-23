-- ============================================================
--  FEED PLANNER · MIGRACIÓN v4 — Bitácora de publicaciones
--  Ejecutar UNA vez en Supabase → SQL Editor → Run.
--  Aditiva: no borra datos ni columnas existentes.
-- ============================================================

-- 1) Tabla de eventos (RLS activado en la misma migración)
create table if not exists post_events (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts(id) on delete cascade,
  type       text not null,          -- created|sent|changes|updated|edited|approved|published|archived|restored
  actor      text not null default 'BigWay',
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists idx_events_post on post_events(post_id, created_at);

alter table post_events enable row level security;

drop policy if exists agency_all on post_events;
create policy agency_all on post_events
  for all to authenticated using (true) with check (true);
-- El público (anon) no toca esta tabla: escribe solo por las funciones de abajo,
-- y lee solo lo que get_client_feed le devuelve.

-- 2) El feed del cliente incluye su bitácora
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
                  from corrections cor where cor.post_id=po.id) as corrections,
               (select coalesce(json_agg(row_to_json(ev) order by ev.created_at),'[]'::json)
                  from post_events ev where ev.post_id=po.id) as events
        from posts po join clients c on c.id=po.client_id
        where c.share_token=p_token and po.status <> 'draft' and coalesce(po.archived,false)=false
        order by po.pinned desc, po.sort) pp),
    'highlights', (select coalesce(json_agg(row_to_json(h) order by h.sort),'[]'::json)
        from highlights h join clients c on c.id=h.client_id where c.share_token=p_token),
    'stories', (select coalesce(json_agg(row_to_json(s) order by s.sort),'[]'::json)
        from stories s join clients c on c.id=s.client_id where c.share_token=p_token)
  );
$$;

-- 3) Las acciones del cliente quedan registradas en la bitácora
create or replace function client_bulk_approve(p_token uuid, p_posts uuid[])
returns int language plpgsql security definer set search_path=public as $$
declare v_client uuid; n int;
begin
  select id into v_client from clients where share_token = p_token;
  if v_client is null then raise exception 'token inválido'; end if;
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
declare v_client uuid; n int;
begin
  select id into v_client from clients where share_token = p_token;
  if v_client is null then raise exception 'token inválido'; end if;
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

grant execute on function get_client_feed(uuid)                 to anon, authenticated;
grant execute on function client_bulk_approve(uuid,uuid[])      to anon, authenticated;
grant execute on function client_bulk_changes(uuid,uuid[],text) to anon, authenticated;

-- 4) Relleno histórico: para que lo ya existente no aparezca con bitácora vacía
insert into post_events(post_id,type,actor,created_at)
select p.id,'created','BigWay',coalesce(p.created_at,now())
from posts p where not exists (select 1 from post_events e where e.post_id=p.id and e.type='created');

insert into post_events(post_id,type,actor,note,created_at)
select c.post_id,
       case when c.text like '✓%' then 'approved' else 'changes' end,
       c.author,
       case when c.text like '✓%' then null else c.text end,
       c.created_at
from corrections c
where not exists (select 1 from post_events e where e.post_id=c.post_id and e.created_at=c.created_at);

insert into post_events(post_id,type,actor,created_at)
select p.id,'published','BigWay',coalesce(p.approved_at,now())
from posts p where p.status='published'
  and not exists (select 1 from post_events e where e.post_id=p.id and e.type='published');
