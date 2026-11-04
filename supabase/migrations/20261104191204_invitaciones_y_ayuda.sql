-- ============================================================
--  invitaciones_y_ayuda
--  Qué cambia y por qué:
--   1. Borra _bwo_probe (tabla de prueba vacía; confirmado por la dueña).
--   2. invitations: la agencia invita por correo (Resend). Al crearse la
--      cuenta invitada queda activa y vinculada a su cliente.
--   3. help_articles: centro de ayuda / documentación / artículos editable.
--  Reversión: drop table help_articles, invitations; restaurar handle_new_user
--  de la migración auth_registro_verificacion.
-- ============================================================
drop table if exists public._bwo_probe; -- permitido: tabla de prueba vacía, confirmado por la usuaria

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  full_name text not null default '',
  client_id uuid references public.clients(id) on delete cascade,
  role text not null default 'viewer' check (role in ('viewer','admin')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  sent_at timestamptz,
  send_error text,
  accepted_at timestamptz,
  user_id uuid references auth.users(id) on delete set null,
  revoked_at timestamptz
);
create index if not exists invitations_email_idx on public.invitations(email);
alter table public.invitations enable row level security;
create policy admin_all on public.invitations for all to authenticated using (is_admin()) with check (is_admin());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare inv invitations;
begin
  select * into inv from invitations
   where email = lower(new.email) and accepted_at is null and revoked_at is null and expires_at > now()
   order by created_at desc limit 1;

  insert into profiles(id, email, full_name, company, phone, note, role, status, reviewed_at, reviewed_by)
  values (new.id, new.email,
          left(coalesce(nullif(inv.full_name, ''), new.raw_user_meta_data->>'full_name', ''), 120),
          left(coalesce(new.raw_user_meta_data->>'company', ''), 120),
          left(coalesce(new.raw_user_meta_data->>'phone', ''), 40),
          left(coalesce(new.raw_user_meta_data->>'note', ''), 500),
          coalesce(inv.role, 'viewer'),
          case when inv.id is null then 'pending' else 'active' end,
          case when inv.id is null then null else now() end,
          inv.invited_by)
  on conflict (id) do nothing;

  if inv.id is not null then
    if inv.client_id is not null then
      insert into client_members(client_id, user_id) values (inv.client_id, new.id) on conflict do nothing;
    end if;
    update invitations set accepted_at = now(), user_id = new.id where id = inv.id;
  end if;
  return new;
end $$;

create table if not exists public.help_articles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]{2,80}$'),
  section text not null check (section in ('primeros-pasos','comercial','tutoriales','tecnica','faq','articulos')),
  title text not null,
  summary text not null default '',
  body text not null default '',
  audience text not null default 'todos' check (audience in ('todos','agencia')),
  sort int not null default 0,
  published boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.help_articles enable row level security;
create policy admin_all on public.help_articles for all to authenticated using (is_admin()) with check (is_admin());
create policy viewer_read on public.help_articles for select to authenticated
  using (is_active() and published and audience = 'todos');

create or replace trigger audit_invitations after insert or update or delete on public.invitations for each row execute function audit_row();
create or replace trigger audit_help_articles after insert or update or delete on public.help_articles for each row execute function audit_row();
