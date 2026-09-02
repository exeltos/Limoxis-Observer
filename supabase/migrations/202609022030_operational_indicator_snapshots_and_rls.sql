create table if not exists public.indicator_snapshots (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  indicator_key text not null, definition_id uuid null references public.indicator_definitions(id) on delete set null,
  department_id uuid null references public.departments(id) on delete set null, period_start date not null, period_end date not null,
  numerator numeric null, denominator numeric null, value numeric null, unit text null, target_value numeric null,
  direction text not null default 'context' check (direction in ('higher','lower','context')),
  calculation_type text not null default 'auto' check (calculation_type in ('auto','manual')),
  source_snapshot jsonb not null default '{}'::jsonb, status text not null default 'calculated' check (status in ('draft','calculated','reviewed','approved','retired')),
  calculated_at timestamptz not null default now(), calculated_by uuid null references auth.users(id), reviewed_at timestamptz null,
  reviewed_by uuid null references auth.users(id), notes text null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint indicator_snapshots_period_check check (period_end >= period_start)
);
create unique index if not exists indicator_snapshots_scope_period_uidx on public.indicator_snapshots (organization_id,indicator_key,coalesce(department_id,'00000000-0000-0000-0000-000000000000'::uuid),period_start,period_end);
create index if not exists indicator_snapshots_org_period_idx on public.indicator_snapshots(organization_id,period_start desc,period_end desc);
create index if not exists indicator_snapshots_department_period_idx on public.indicator_snapshots(organization_id,department_id,period_start desc) where department_id is not null;
create index if not exists indicator_snapshots_definition_idx on public.indicator_snapshots(definition_id) where definition_id is not null;
create index if not exists indicator_snapshots_calculated_by_idx on public.indicator_snapshots(calculated_by) where calculated_by is not null;
create index if not exists indicator_snapshots_reviewed_by_idx on public.indicator_snapshots(reviewed_by) where reviewed_by is not null;
alter table public.indicator_snapshots enable row level security;
revoke all on public.indicator_snapshots from anon,authenticated; grant select,insert,update on public.indicator_snapshots to authenticated;
create policy indicator_snapshots_read on public.indicator_snapshots for select to authenticated using (public.current_user_is_platform_owner() or public.current_user_has_capability(organization_id,'view_indicators') or public.current_user_has_org_role(organization_id,array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer','quality_manager']::public.app_role[]));
create policy indicator_snapshots_write on public.indicator_snapshots for insert to authenticated with check (public.current_user_is_platform_owner() or public.current_user_has_capability(organization_id,'manage_indicators') or public.current_user_has_org_role(organization_id,array['hospital_admin','infection_control_lead']::public.app_role[]));
create policy indicator_snapshots_update on public.indicator_snapshots for update to authenticated using (public.current_user_is_platform_owner() or public.current_user_has_capability(organization_id,'manage_indicators') or public.current_user_has_org_role(organization_id,array['hospital_admin','infection_control_lead']::public.app_role[])) with check (public.current_user_is_platform_owner() or public.current_user_has_capability(organization_id,'manage_indicators') or public.current_user_has_org_role(organization_id,array['hospital_admin','infection_control_lead']::public.app_role[]));

drop policy if exists patient_days_manage on public.patient_days; drop policy if exists patient_days_read on public.patient_days;
create policy patient_days_read on public.patient_days for select to authenticated using (public.current_user_is_platform_owner() or public.current_user_has_capability(organization_id,'view_indicators') or public.current_user_has_capability(organization_id,'manage_bed_days') or public.current_user_has_org_role(organization_id,array['hospital_admin','infection_control_lead','infection_control_member','quality_manager']::public.app_role[]));
create policy patient_days_manage on public.patient_days for all to authenticated using (public.current_user_is_platform_owner() or public.current_user_has_capability(organization_id,'manage_bed_days') or public.current_user_has_org_role(organization_id,array['hospital_admin','infection_control_lead']::public.app_role[])) with check (public.current_user_is_platform_owner() or public.current_user_has_capability(organization_id,'manage_bed_days') or public.current_user_has_org_role(organization_id,array['hospital_admin','infection_control_lead']::public.app_role[]));
revoke all on public.patient_days from anon;

drop policy if exists patient_day_periods_manage on public.patient_day_periods; drop policy if exists patient_day_periods_read on public.patient_day_periods;
create policy patient_day_periods_read on public.patient_day_periods for select to authenticated using (public.current_user_is_platform_owner() or public.current_user_has_capability(organization_id,'view_indicators') or public.current_user_has_capability(organization_id,'manage_bed_days') or public.current_user_has_org_role(organization_id,array['hospital_admin','infection_control_lead','infection_control_member','quality_manager']::public.app_role[]));
create policy patient_day_periods_manage on public.patient_day_periods for all to authenticated using (public.current_user_is_platform_owner() or public.current_user_has_capability(organization_id,'manage_bed_days') or public.current_user_has_org_role(organization_id,array['hospital_admin','infection_control_lead']::public.app_role[])) with check (public.current_user_is_platform_owner() or public.current_user_has_capability(organization_id,'manage_bed_days') or public.current_user_has_org_role(organization_id,array['hospital_admin','infection_control_lead']::public.app_role[]));
revoke all on public.patient_day_periods from anon; grant delete on public.patient_day_periods to authenticated;
