-- Limoxis Observer v0.27.14 — Platform Owner Center foundation
alter table public.organizations
  add column if not exists region text,
  add column if not exists health_region text,
  add column if not exists city text,
  add column if not exists country text not null default 'Greece',
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists bed_capacity integer,
  add column if not exists paused_at timestamptz;

create table if not exists public.platform_demo_entitlements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  label text not null,
  contact_name text,
  contact_email text,
  valid_from date not null,
  valid_until date not null,
  status text not null default 'active' check (status in ('active','paused','expired','revoked')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until >= valid_from)
);

alter table public.platform_demo_entitlements enable row level security;
drop policy if exists platform_demo_owner_all on public.platform_demo_entitlements;
create policy platform_demo_owner_all on public.platform_demo_entitlements for all
  using (public.current_user_is_platform_owner())
  with check (public.current_user_is_platform_owner());

-- Platform owner needs to inspect organization members for platform user counts/interventions.
drop policy if exists memberships_platform_owner_read on public.organization_members;
create policy memberships_platform_owner_read on public.organization_members for select
  using (public.current_user_is_platform_owner() or user_id = auth.uid() or public.has_org_role(organization_id, array['hospital_admin']::public.app_role[]));

create table if not exists public.account_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  delivery_email text not null,
  role public.app_role not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.account_invitations enable row level security;
drop policy if exists account_invitations_owner_read on public.account_invitations;
create policy account_invitations_owner_read on public.account_invitations for select
  using (public.current_user_is_platform_owner() or public.has_org_role(organization_id, array['hospital_admin']::public.app_role[]));
