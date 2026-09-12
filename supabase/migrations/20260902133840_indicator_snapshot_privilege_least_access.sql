revoke all on public.indicator_snapshots from authenticated;
grant select, insert, update on public.indicator_snapshots to authenticated;
revoke delete, truncate, references, trigger on public.patient_days from anon, authenticated;
revoke delete, truncate, references, trigger on public.patient_day_periods from anon, authenticated;
