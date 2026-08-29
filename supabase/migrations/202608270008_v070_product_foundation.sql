-- Limoxis Observer v0.7.0 — product foundation
-- Shared attachments, custom role bundles, governed indicators, patient-days and external reference versions.

create table if not exists public.custom_roles (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, description text, is_active boolean not null default true, created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,name)
);
create table if not exists public.custom_role_capabilities (
  id uuid primary key default gen_random_uuid(), custom_role_id uuid not null references public.custom_roles(id) on delete cascade,
  capability text not null, created_at timestamptz not null default now(), unique(custom_role_id,capability)
);
alter table public.organization_members add column if not exists custom_role_id uuid references public.custom_roles(id) on delete set null;

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text not null, entity_id text not null, file_name text not null, storage_path text not null, mime_type text, size_bytes bigint,
  uploaded_by uuid references auth.users(id), created_at timestamptz not null default now(), deleted_at timestamptz
);
create index if not exists attachments_entity_idx on public.attachments(organization_id,entity_type,entity_id) where deleted_at is null;

create table if not exists public.patient_days (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade, census_date date not null, patient_days integer not null check(patient_days>=0),
  source text not null check(source in ('calculated','imported','manual')), review_status text not null default 'locked' check(review_status in ('locked','reviewable','approved')),
  source_reference text, calculated_at timestamptz, created_by uuid references auth.users(id), updated_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(organization_id,department_id,census_date)
);
create index if not exists patient_days_period_idx on public.patient_days(organization_id,census_date,department_id);

create table if not exists public.indicator_definitions (
  id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id) on delete cascade,
  indicator_key text not null, version text not null, title_el text not null, title_en text not null, category text not null,
  numerator_definition jsonb not null default '{}'::jsonb, denominator_definition jsonb not null default '{}'::jsonb, multiplier numeric not null default 1,
  unit text, source_authority text, effective_from date, effective_to date, status text not null default 'draft' check(status in ('draft','review','active','retired')),
  created_by uuid references auth.users(id), approved_by uuid references auth.users(id), created_at timestamptz not null default now(), unique(organization_id,indicator_key,version)
);

create table if not exists public.external_reference_versions (
  id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id) on delete cascade,
  source_key text not null, authority text not null, title text not null, source_url text, version_label text, published_at date, checked_at timestamptz,
  status text not null default 'pending_review' check(status in ('pending_review','approved','superseded','rejected')),
  metadata jsonb not null default '{}'::jsonb, reviewed_by uuid references auth.users(id), created_at timestamptz not null default now(), unique(organization_id,source_key,version_label)
);

alter table public.custom_roles enable row level security; alter table public.custom_role_capabilities enable row level security; alter table public.attachments enable row level security; alter table public.patient_days enable row level security; alter table public.indicator_definitions enable row level security; alter table public.external_reference_versions enable row level security;

create policy custom_roles_read on public.custom_roles for select using(public.is_org_member(organization_id));
create policy custom_roles_admin on public.custom_roles for all using(public.is_org_admin(organization_id)) with check(public.is_org_admin(organization_id));
create policy custom_role_caps_read on public.custom_role_capabilities for select using(exists(select 1 from public.custom_roles r where r.id=custom_role_id and public.is_org_member(r.organization_id)));
create policy custom_role_caps_admin on public.custom_role_capabilities for all using(exists(select 1 from public.custom_roles r where r.id=custom_role_id and public.is_org_admin(r.organization_id))) with check(exists(select 1 from public.custom_roles r where r.id=custom_role_id and public.is_org_admin(r.organization_id)));
create policy attachments_read on public.attachments for select using(public.is_org_member(organization_id));
create policy attachments_write on public.attachments for insert with check(public.is_org_member(organization_id) and uploaded_by=auth.uid());
create policy patient_days_read on public.patient_days for select using(public.is_org_member(organization_id));
create policy patient_days_manage on public.patient_days for all using(public.is_org_admin(organization_id) or public.current_user_has_org_role(organization_id,array['infection_control_lead']::public.app_role[])) with check(public.is_org_admin(organization_id) or public.current_user_has_org_role(organization_id,array['infection_control_lead']::public.app_role[]));
create policy indicators_read on public.indicator_definitions for select using(organization_id is null or public.is_org_member(organization_id));
create policy indicators_manage on public.indicator_definitions for all using(organization_id is not null and public.is_org_admin(organization_id)) with check(organization_id is not null and public.is_org_admin(organization_id));
create policy external_refs_read on public.external_reference_versions for select using(organization_id is null or public.is_org_member(organization_id));
create policy external_refs_manage on public.external_reference_versions for all using(organization_id is not null and public.is_org_admin(organization_id)) with check(organization_id is not null and public.is_org_admin(organization_id));

-- Automatic daily patient-day generation from the patient registry.
-- Manual/imported rows are never silently overwritten.
create or replace function public.generate_patient_days(target_org uuid, target_date date default current_date)
returns integer language plpgsql security definer set search_path=public as $$
declare affected integer;
begin
  if not (public.is_org_admin(target_org) or public.current_user_has_org_role(target_org,array['infection_control_lead']::public.app_role[])) then
    raise exception 'permission denied';
  end if;
  insert into public.patient_days(organization_id,department_id,census_date,patient_days,source,review_status,source_reference,calculated_at,created_by,updated_by)
  select target_org,p.department_id,target_date,count(*)::integer,'calculated','locked','patients registry',now(),auth.uid(),auth.uid()
  from public.patients p
  where p.organization_id=target_org and p.department_id is not null and p.admission_date<=target_date and (p.discharge_date is null or p.discharge_date>=target_date)
  group by p.department_id
  on conflict(organization_id,department_id,census_date) do update set patient_days=excluded.patient_days,calculated_at=now(),updated_at=now(),updated_by=auth.uid()
  where public.patient_days.source='calculated';
  get diagnostics affected=row_count;
  return affected;
end;$$;

-- Always-current calculated patient-days. Stored rows in public.patient_days act as governed overrides/imports.
create or replace view public.calculated_patient_days with (security_invoker=true) as
select p.organization_id,p.department_id,d.day::date as census_date,count(*)::integer as patient_days,'calculated'::text as source,'locked'::text as review_status
from public.patients p
cross join lateral generate_series(p.admission_date,coalesce(p.discharge_date,current_date),'1 day'::interval) d(day)
where p.department_id is not null and p.admission_date is not null
group by p.organization_id,p.department_id,d.day::date;

create or replace view public.effective_patient_days with (security_invoker=true) as
select c.organization_id,c.department_id,c.census_date,coalesce(o.patient_days,c.patient_days) as patient_days,coalesce(o.source,c.source) as source,coalesce(o.review_status,c.review_status) as review_status
from public.calculated_patient_days c
left join public.patient_days o on o.organization_id=c.organization_id and o.department_id=c.department_id and o.census_date=c.census_date
union all
select o.organization_id,o.department_id,o.census_date,o.patient_days,o.source,o.review_status
from public.patient_days o
where not exists(select 1 from public.calculated_patient_days c where c.organization_id=o.organization_id and c.department_id=o.department_id and c.census_date=o.census_date);
