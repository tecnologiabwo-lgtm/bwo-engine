-- Feed Planner v4 (parte 1): tabla de bitácora
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

create policy agency_all on post_events
  for all to authenticated using (true) with check (true);
-- El público (anon) no toca esta tabla: escribe solo por las funciones de abajo,
-- y lee solo lo que get_client_feed le devuelve.
