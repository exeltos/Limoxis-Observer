alter table public.indicator_definitions add column if not exists calculation_type text not null default 'auto', add column if not exists numerator_metric text, add column if not exists denominator_metric text, add column if not exists target_value numeric, add column if not exists direction text not null default 'context', add column if not exists unit_en text, add column if not exists approved_at timestamptz;
alter table public.indicator_definitions drop constraint if exists indicator_definitions_calculation_type_check;
alter table public.indicator_definitions add constraint indicator_definitions_calculation_type_check check (calculation_type in ('auto','manual'));
alter table public.indicator_definitions drop constraint if exists indicator_definitions_direction_check;
alter table public.indicator_definitions add constraint indicator_definitions_direction_check check (direction in ('higher','lower','context'));
create unique index if not exists indicator_definitions_scope_key_version_uidx on public.indicator_definitions (coalesce(organization_id,'00000000-0000-0000-0000-000000000000'::uuid),indicator_key,version);
drop policy if exists indicators_manage_hospital on public.indicator_definitions;
create policy indicators_manage_hospital on public.indicator_definitions for all to authenticated using (organization_id is not null and current_user_has_capability(organization_id,'manage_indicators')) with check (organization_id is not null and current_user_has_capability(organization_id,'manage_indicators'));
