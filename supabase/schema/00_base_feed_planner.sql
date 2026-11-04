-- ============================================================
--  Esquema base del Feed Planner (anterior a las migraciones).
--  Reconstruido desde la base real el 2026-10-23. Es DOCUMENTACIÓN:
--  no está en supabase/migrations porque esas tablas ya existían.
--  Sirve para crear un entorno de pruebas desde cero:
--    1) este archivo  2) todas las migraciones en orden.
-- ============================================================
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null, handle text not null,
  category text, bio text, link text, photo text,
  frequency_days text, frequency_note text,
  followers text default '0', following text default '0',
  frequency_per_week int default 3,
  share_token uuid not null default gen_random_uuid(),
  created_at timestamptz default now()
);
create table if not exists pillars (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id),
  name text not null, color text not null, target_pct int, sort int default 0
);
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id),
  pillar_id uuid references pillars(id),
  caption text, scheduled_date date,
  format text not null default 'post_v',
  images jsonb default '[]', status text default 'draft',
  pinned boolean default false, sort int default 0,
  created_at timestamptz default now()
);
create table if not exists corrections (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id),
  author text, text text, resolved boolean default false,
  created_at timestamptz default now()
);
create table if not exists highlights (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id), name text, cover text, sort int default 0
);
create table if not exists stories (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id), name text, img text, sort int default 0
);
alter table clients enable row level security;
alter table pillars enable row level security;
alter table posts enable row level security;
alter table corrections enable row level security;
alter table highlights enable row level security;
alter table stories enable row level security;
-- Políticas originales (luego restringidas por la migración engine_core_a)
create policy agency_all on clients     for all to authenticated using (true) with check (true);
create policy agency_all on pillars     for all to authenticated using (true) with check (true);
create policy agency_all on posts       for all to authenticated using (true) with check (true);
create policy agency_all on corrections for all to authenticated using (true) with check (true);
create policy agency_all on highlights  for all to authenticated using (true) with check (true);
create policy agency_all on stories     for all to authenticated using (true) with check (true);
