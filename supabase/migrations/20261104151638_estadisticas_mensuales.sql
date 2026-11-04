-- ============================================================
--  estadisticas_mensuales
--  Histórico del Consolidador por cliente y mes, para revisar por mes,
--  trimestre y año. Cada «Guardar mes» reemplaza ese mes del cliente.
--   - stats_months: una fila por cliente y mes (moneda, nivel, período, archivos)
--   - ad_stats_monthly: pauta por entidad (campaña/conjunto/anuncio) y mes
--   - organic_stats_monthly: métricas orgánicas IG/FB por mes
--  El cliente las lee (solo las suyas); la agencia las escribe.
-- ============================================================
create table if not exists stats_months (
  id          uuid not null default gen_random_uuid() unique,
  client_id   uuid not null references clients(id) on delete cascade,
  month       date not null check (extract(day from month) = 1),
  currency    text not null default 'USD',
  level       text not null default 'campaign',
  period_from date,
  period_to   date,
  sources     jsonb not null default '[]',
  note        text,
  saved_by    uuid references auth.users(id) on delete set null default auth.uid(),
  saved_at    timestamptz not null default now(),
  primary key (client_id, month)
);

create table if not exists ad_stats_monthly (
  id          uuid not null default gen_random_uuid() unique,
  client_id   uuid not null references clients(id) on delete cascade,
  month       date not null check (extract(day from month) = 1),
  level       text not null default 'campaign',
  entity      text not null,
  objective   text not null default '',
  result_type text,
  spend       numeric(14,2) not null default 0,
  results     numeric(14,2) not null default 0,
  impressions bigint not null default 0,
  reach       bigint not null default 0,
  ig_follows  numeric(14,2) not null default 0,
  days        int,
  prorated    boolean not null default false,
  primary key (client_id, month, level, entity, objective)
);
create index if not exists idx_ad_stats_client_month on ad_stats_monthly(client_id, month);

create table if not exists organic_stats_monthly (
  id        uuid not null default gen_random_uuid() unique,
  client_id uuid not null references clients(id) on delete cascade,
  month     date not null check (extract(day from month) = 1),
  platform  text not null check (platform in ('instagram','facebook')),
  metric    text not null,
  value     numeric(16,2) not null default 0,
  days      int,
  primary key (client_id, month, platform, metric)
);
create index if not exists idx_org_stats_client_month on organic_stats_monthly(client_id, month);

alter table stats_months enable row level security;
alter table ad_stats_monthly enable row level security;
alter table organic_stats_monthly enable row level security;
create policy admin_all on stats_months          for all to authenticated using (is_admin()) with check (is_admin());
create policy admin_all on ad_stats_monthly      for all to authenticated using (is_admin()) with check (is_admin());
create policy admin_all on organic_stats_monthly for all to authenticated using (is_admin()) with check (is_admin());
create policy viewer_read on stats_months          for select to authenticated using (is_member(client_id));
create policy viewer_read on ad_stats_monthly      for select to authenticated using (is_member(client_id));
create policy viewer_read on organic_stats_monthly for select to authenticated using (is_member(client_id));

create or replace trigger audit_stats_months after insert or update or delete on stats_months for each row execute function audit_row();
