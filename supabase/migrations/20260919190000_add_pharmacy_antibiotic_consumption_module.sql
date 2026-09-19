-- ΥΑ Υ1.Γ.Π.114971/ΦΕΚ Β 388/2014 §2.4 requires semi-annual reporting of
-- antibiotic consumption in DDD (WHO ATC/DDD methodology) per 100
-- patient-days, recorded continuously by the hospital pharmacy. No data
-- model existed for this at all: the closest table, antimicrobial_therapies,
-- is a clinical treatment-order record (free-text dose like "1g q8h", no
-- quantity, no ATC/DDD reference) and cannot support a DDD calculation.
--
-- This adds a dedicated pharmacy consumption-capture module, mirroring the
-- existing antiseptic_consumption_periods pattern (a governed, periodic,
-- department-scoped quantity record) plus a WHO ATC/DDD reference table,
-- exactly matching this product's own surveillance-module spec, which
-- calls for the pharmacy's antibiotic consumption record to be a distinct
-- module from the clinical antimicrobial-therapy workflow.

create table public.antibiotic_dispensing_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  period_start date not null,
  period_end date not null,
  antibiotic_item_id uuid not null references public.master_library_items(id),
  quantity_grams numeric not null check (quantity_grams >= 0),
  source text,
  source_reference text,
  responsible_name text,
  notes text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_antibiotic_dispensing_periods_org_period on public.antibiotic_dispensing_periods (organization_id, period_start, period_end);
create index idx_antibiotic_dispensing_periods_department on public.antibiotic_dispensing_periods (department_id);
create index idx_antibiotic_dispensing_periods_item on public.antibiotic_dispensing_periods (antibiotic_item_id);

alter table public.antibiotic_dispensing_periods enable row level security;

create or replace function public.current_user_can_read_pharmacy_consumption(target_org uuid, target_department uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    public.current_user_is_platform_owner()
    or public.is_org_admin(target_org)
    or public.current_user_has_org_role(target_org,array['infection_control_lead','infection_control_member']::public.app_role[])
    or (
      target_department is not null
      and public.current_user_has_department_scope(target_org,target_department)
      and public.current_user_has_capability(target_org,'record_pharmacy')
    );
$$;

create or replace function public.current_user_can_write_pharmacy_consumption(target_org uuid, target_department uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    public.current_user_is_platform_owner()
    or public.current_user_has_org_role(target_org,array['infection_control_lead','infection_control_member']::public.app_role[])
    or (
      target_department is not null
      and public.current_user_has_department_scope(target_org,target_department)
      and public.current_user_has_capability(target_org,'record_pharmacy')
    );
$$;

revoke all on function public.current_user_can_read_pharmacy_consumption(uuid,uuid) from public,anon;
revoke all on function public.current_user_can_write_pharmacy_consumption(uuid,uuid) from public,anon;
grant execute on function public.current_user_can_read_pharmacy_consumption(uuid,uuid) to authenticated;
grant execute on function public.current_user_can_write_pharmacy_consumption(uuid,uuid) to authenticated;

create policy antibiotic_dispensing_read on public.antibiotic_dispensing_periods for select
  using (public.current_user_can_read_pharmacy_consumption(organization_id, department_id));
create policy antibiotic_dispensing_insert on public.antibiotic_dispensing_periods for insert
  with check (public.current_user_can_write_pharmacy_consumption(organization_id, department_id));
create policy antibiotic_dispensing_update on public.antibiotic_dispensing_periods for update
  using (public.current_user_can_write_pharmacy_consumption(organization_id, department_id))
  with check (public.current_user_can_write_pharmacy_consumption(organization_id, department_id));
create policy antibiotic_dispensing_delete on public.antibiotic_dispensing_periods for delete
  using (public.current_user_can_write_pharmacy_consumption(organization_id, department_id));

revoke all on public.antibiotic_dispensing_periods from public, anon;
grant select, insert, update, delete on public.antibiotic_dispensing_periods to authenticated;

-- WHO ATC/DDD Index reference values, per antibiotic. System-managed
-- (organization_id null = shared baseline), analogous to indicator_definitions'
-- system rows. Keyed by the antibiotic's library CODE (e.g. 'ABX-CRO'),
-- not a master_library_items row id — every organization has its own copy
-- of each baseline library item with a distinct id, so a shared/system
-- reference row cannot point at one organization's row.
-- Left EMPTY by this migration: DDD grams are official WHO reference
-- numbers that must be verified against the current published ATC/DDD
-- Index by hospital pharmacy staff before being relied on for a ΕΟΔΥ
-- submission — this migration ships the structure and the calculation,
-- not guessed figures.
create table public.who_ddd_reference (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  antibiotic_code text not null,
  ddd_grams numeric not null check (ddd_grams > 0),
  route text,
  source_authority text not null default 'WHO Collaborating Centre for Drug Statistics Methodology, ATC/DDD Index',
  source_version text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index who_ddd_reference_scope_code_uidx on public.who_ddd_reference (coalesce(organization_id,'00000000-0000-0000-0000-000000000000'::uuid), antibiotic_code);

alter table public.who_ddd_reference enable row level security;

create policy who_ddd_reference_read on public.who_ddd_reference for select
  using (organization_id is null or public.is_org_member(organization_id));
create policy who_ddd_reference_write on public.who_ddd_reference for all
  using (organization_id is not null and public.is_org_admin(organization_id))
  with check (organization_id is not null and public.is_org_admin(organization_id));
create policy who_ddd_reference_platform_write on public.who_ddd_reference for all
  using (public.current_user_is_platform_owner())
  with check (public.current_user_is_platform_owner());

revoke all on public.who_ddd_reference from public, anon;
grant select on public.who_ddd_reference to authenticated;
grant insert, update, delete on public.who_ddd_reference to authenticated;

create or replace function public.current_user_has_capability(target_org uuid, capability_key text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_user_is_platform_owner()
  or exists (
    select 1
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.organization_id = target_org
      and om.status = 'active'
      and om.role = 'hospital_admin'
      and capability_key not in ('view_platform','manage_platform','view_occupational_health','manage_occupational_health')
  )
  or exists (
    select 1
    from public.organization_members om
    where om.user_id=auth.uid()
      and om.organization_id=target_org
      and om.status='active'
      and (
        exists (
          select 1
          from public.custom_role_capabilities crc
          where crc.custom_role_id=om.custom_role_id
            and crc.capability=capability_key
        )
        or exists (
          select 1
          from public.organization_member_capabilities omc
          where omc.membership_id=om.id
            and (
              (omc.capability='lab_access' and capability_key='view_lab')
              or (omc.capability='quality_access' and capability_key in ('view_quality','view_controls'))
            )
        )
        or case capability_key
          when 'view_training' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','department_manager','department_user','hr_office')
          when 'manage_training' then om.role in ('hospital_admin','infection_control_lead')
          when 'view_prevention' then om.role in ('hospital_admin','infection_control_lead','infection_control_member')
          when 'view_lab' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','laboratory','doctor_reviewer')
          when 'manage_libraries' then om.role in ('hospital_admin','infection_control_lead')
          when 'view_controls' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','department_manager','department_user','laboratory','quality_manager')
          when 'manage_controls' then om.role in ('hospital_admin','infection_control_lead','quality_manager')
          when 'view_indicators' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','link_nurse','department_manager','pharmacy','doctor_reviewer','quality_manager')
          when 'manage_indicators' then om.role in ('hospital_admin','infection_control_lead','quality_manager')
          when 'record_pharmacy' then om.role in ('hospital_admin','infection_control_lead','pharmacy')
          else false
        end
      )
  );
$$;

revoke all on function public.current_user_has_capability(uuid,text) from public;
grant execute on function public.current_user_has_capability(uuid,text) to authenticated;
