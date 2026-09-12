drop index if exists public.patient_days_indicator_period_idx;
drop index if exists public.patient_day_periods_indicator_period_idx;
create index if not exists indicator_snapshots_definition_idx on public.indicator_snapshots(definition_id) where definition_id is not null;
create index if not exists indicator_snapshots_calculated_by_idx on public.indicator_snapshots(calculated_by) where calculated_by is not null;
create index if not exists indicator_snapshots_reviewed_by_idx on public.indicator_snapshots(reviewed_by) where reviewed_by is not null;
