create table if not exists public.prevention_bundle_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  bundle_key text not null,
  name text not null,
  title_el text not null default '',
  title_en text not null default '',
  version text not null default '1.0',
  status text not null default 'draft' check (status in ('draft','published','retired')),
  scope text not null default '',
  source text not null default '',
  source_version text not null default '',
  departments jsonb not null default '[]'::jsonb,
  elements jsonb not null default '[]'::jsonb,
  based_on uuid references public.prevention_bundle_templates(id) on delete set null,
  is_system boolean not null default false,
  hidden boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  published_by uuid references auth.users(id) on delete set null,
  retired_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prevention_bundle_templates_system_scope check ((is_system and organization_id is null) or (not is_system and organization_id is not null)),
  constraint prevention_bundle_templates_unique_version unique nulls not distinct (organization_id,bundle_key,version)
);

alter table public.prevention_bundle_templates enable row level security;
revoke all on table public.prevention_bundle_templates from anon;
grant select,insert,update,delete on table public.prevention_bundle_templates to authenticated;

drop policy if exists prevention_bundle_templates_read on public.prevention_bundle_templates;
drop policy if exists prevention_bundle_templates_manage_hospital on public.prevention_bundle_templates;
drop policy if exists prevention_bundle_templates_manage_system_owner on public.prevention_bundle_templates;

create policy prevention_bundle_templates_read on public.prevention_bundle_templates
for select to authenticated
using (is_system or (organization_id is not null and public.is_org_member(organization_id)));

create policy prevention_bundle_templates_manage_hospital on public.prevention_bundle_templates
for all to authenticated
using (
  not is_system and organization_id is not null and
  (public.is_org_admin(organization_id) or public.current_user_has_org_role(organization_id, array['infection_control_lead'::public.app_role]))
)
with check (
  not is_system and organization_id is not null and
  (public.is_org_admin(organization_id) or public.current_user_has_org_role(organization_id, array['infection_control_lead'::public.app_role]))
);

create policy prevention_bundle_templates_manage_system_owner on public.prevention_bundle_templates
for all to authenticated
using (is_system and organization_id is null and public.current_user_is_platform_owner())
with check (is_system and organization_id is null and public.current_user_is_platform_owner());

drop trigger if exists trg_audit_prevention_bundle_templates on public.prevention_bundle_templates;
create trigger trg_audit_prevention_bundle_templates
after insert or update or delete on public.prevention_bundle_templates
for each row execute function private.audit_management_change();
