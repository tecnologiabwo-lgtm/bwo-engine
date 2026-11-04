-- BWO Engine · núcleo (parte B): catálogo, ajustes y cotizaciones
-- ---------- Catálogo de precios (editable desde la plataforma) ----------
create table if not exists price_catalog (
  id          text primary key,
  category    text not null,          -- plan | crm | clientify | web | advisory | event | support | support_pack | setup
  name        text not null,
  description text,
  price       numeric(12,2) not null default 0,
  price_year  numeric(12,2),          -- precio anual (Clientify)
  setup_price numeric(12,2),          -- Fase I / pago único de los programas
  unit        text not null default 'unico' check (unit in ('unico','mes','hora','dia','sesion','pack','linea','usuario')),
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
