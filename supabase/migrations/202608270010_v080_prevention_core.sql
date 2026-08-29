-- Limoxis Observer v0.8.0 — Prevention Core
-- WHO hand-hygiene observations, waste, antiseptic consumption and prevention bundles.


create or replace function public.current_user_has_capability(target_org uuid, capability_key text)
returns boolean language sql stable security definer set search_path=public as $$
  select public.current_user_is_platform_owner() or exists(
    select 1
    from public.organization_members om
    left join public.organization_member_capabilities mc on mc.membership_id=om.id
    left join public.custom_role_capabilities crc on crc.custom_role_id=om.custom_role_id
    where om.user_id=auth.uid() and om.organization_id=target_org and om.status='active'
      and (mc.capability=capability_key or crc.capability=capability_key)
  );
$$;

create table if not exists public.hand_hygiene_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  observation_date date not null,
  professional_category text,
  observations integer not null default 0 check(observations >= 0),
  compliant_observations integer not null default 0 check(compliant_observations >= 0),
  observer_id uuid references auth.users(id),
  source_standard text not null default 'WHO',
  source_version text,
  status text not null default 'completed' check(status in ('draft','completed','cancelled')),
  notes text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(compliant_observations <= observations)
);
create index if not exists hand_hygiene_sessions_idx on public.hand_hygiene_sessions(organization_id,observation_date,department_id);

create table if not exists public.waste_measurements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  record_date date not null,
  waste_type_id uuid references public.master_library_items(id) on delete set null,
  weight_kg numeric(12,3) not null check(weight_kg >= 0),
  containers integer check(containers is null or containers >= 0),
  document_number text,
  collection_company text,
  status text not null default 'completed' check(status in ('draft','completed','cancelled')),
  notes text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists waste_measurements_idx on public.waste_measurements(organization_id,record_date,department_id);

create table if not exists public.antiseptic_consumption_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  period_start date not null,
  period_end date not null,
  antiseptic_item_id uuid references public.master_library_items(id) on delete set null,
  litres numeric(12,3) not null check(litres >= 0),
  source text not null default 'manual' check(source in ('manual','imported')),
  source_reference text,
  notes text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(period_end >= period_start)
);
create index if not exists antiseptic_consumption_idx on public.antiseptic_consumption_periods(organization_id,period_start,period_end,department_id);

create table if not exists public.prevention_bundle_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  bundle_key text not null,
  assessment_date date not null,
  period_label text,
  score numeric(5,2) check(score is null or (score >= 0 and score <= 100)),
  criteria jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check(status in ('draft','completed','cancelled')),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists prevention_bundle_idx on public.prevention_bundle_assessments(organization_id,assessment_date,department_id,bundle_key);

alter table public.hand_hygiene_sessions enable row level security;
alter table public.waste_measurements enable row level security;
alter table public.antiseptic_consumption_periods enable row level security;
alter table public.prevention_bundle_assessments enable row level security;

create policy hand_hygiene_read on public.hand_hygiene_sessions for select using(public.is_org_member(organization_id));
create policy hand_hygiene_write on public.hand_hygiene_sessions for all using(public.is_org_admin(organization_id) or public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member']::public.app_role[]) or public.current_user_has_capability(organization_id,'hand_hygiene_observer') or public.current_user_has_capability(organization_id,'record_hand_hygiene')) with check(public.is_org_admin(organization_id) or public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member']::public.app_role[]) or public.current_user_has_capability(organization_id,'hand_hygiene_observer') or public.current_user_has_capability(organization_id,'record_hand_hygiene'));
create policy waste_read on public.waste_measurements for select using(public.is_org_member(organization_id));
create policy waste_write on public.waste_measurements for all using(public.is_org_admin(organization_id) or public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member']::public.app_role[]) or public.current_user_has_capability(organization_id,'waste_management') or public.current_user_has_capability(organization_id,'record_waste')) with check(public.is_org_admin(organization_id) or public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member']::public.app_role[]) or public.current_user_has_capability(organization_id,'waste_management') or public.current_user_has_capability(organization_id,'record_waste'));
create policy antiseptic_read on public.antiseptic_consumption_periods for select using(public.is_org_member(organization_id));
create policy antiseptic_write on public.antiseptic_consumption_periods for all using(public.is_org_admin(organization_id) or public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member']::public.app_role[]) or public.current_user_has_capability(organization_id,'record_antiseptic')) with check(public.is_org_admin(organization_id) or public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member']::public.app_role[]) or public.current_user_has_capability(organization_id,'record_antiseptic'));
create policy bundles_read on public.prevention_bundle_assessments for select using(public.is_org_member(organization_id));
create policy bundles_write on public.prevention_bundle_assessments for all using(public.is_org_admin(organization_id) or public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member']::public.app_role[]) or public.current_user_has_capability(organization_id,'record_prevention_bundle')) with check(public.is_org_admin(organization_id) or public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member']::public.app_role[]) or public.current_user_has_capability(organization_id,'record_prevention_bundle'));
