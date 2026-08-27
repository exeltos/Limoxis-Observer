-- Limoxis Observer v0.2.0 — identity, organizations, memberships, audit foundation
create extension if not exists pgcrypto;

create type public.organization_type as enum ('group', 'hospital', 'clinic', 'other');
create type public.organization_status as enum ('active', 'suspended', 'archived');
create type public.member_status as enum ('invited', 'active', 'disabled');
create type public.app_role as enum ('platform_owner','hospital_admin','infection_control_lead','link_nurse','doctor_reviewer','department_user','laboratory','staff_user');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  is_platform_owner boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.organizations(id) on delete restrict,
  name text not null,
  code text not null unique,
  type public.organization_type not null default 'hospital',
  status public.organization_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  status public.member_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.system_audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role public.app_role,
  event_type text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index organization_members_user_idx on public.organization_members(user_id, status);
create index organization_members_org_idx on public.organization_members(organization_id, status);
create index audit_org_created_idx on public.system_audit_log(organization_id, created_at desc);

create or replace function public.current_user_is_platform_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_platform_owner from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_org_member(target_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.organization_members where organization_id = target_org and user_id = auth.uid() and status = 'active');
$$;

create or replace function public.has_org_role(target_org uuid, allowed_roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_user_is_platform_owner() or exists(
    select 1 from public.organization_members
    where organization_id = target_org and user_id = auth.uid() and status = 'active' and role = any(allowed_roles)
  );
$$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.system_audit_log enable row level security;

create policy profiles_self_read on public.profiles for select using (id = auth.uid() or public.current_user_is_platform_owner());
create policy organizations_member_read on public.organizations for select using (public.current_user_is_platform_owner() or public.is_org_member(id));
create policy organizations_platform_write on public.organizations for all using (public.current_user_is_platform_owner()) with check (public.current_user_is_platform_owner());
create policy memberships_member_read on public.organization_members for select using (user_id = auth.uid() or public.has_org_role(organization_id, array['hospital_admin']::public.app_role[]));
create policy memberships_admin_write on public.organization_members for all using (public.has_org_role(organization_id, array['hospital_admin']::public.app_role[])) with check (public.has_org_role(organization_id, array['hospital_admin']::public.app_role[]));
create policy audit_admin_read on public.system_audit_log for select using (organization_id is not null and public.has_org_role(organization_id, array['hospital_admin']::public.app_role[]));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
