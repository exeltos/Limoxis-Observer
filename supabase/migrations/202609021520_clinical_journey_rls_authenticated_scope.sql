alter policy surveillance_devices_read on public.surveillance_devices to authenticated;
alter policy surveillance_devices_write on public.surveillance_devices to authenticated;
alter policy reassessments_read on public.surveillance_reassessments to authenticated;
alter policy reassessments_write on public.surveillance_reassessments to authenticated;
alter policy outcomes_read on public.surveillance_outcomes to authenticated;
alter policy outcomes_write on public.surveillance_outcomes to authenticated;

revoke all on table public.surveillance_devices from anon;
revoke all on table public.surveillance_reassessments from anon;
revoke all on table public.surveillance_outcomes from anon;
