-- Run in the SQL Editor: the «Adherence» missed-times function is for signed-in users only.
revoke all on function public.control_entry_day_times(uuid, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.control_entry_day_times(uuid, timestamptz, timestamptz, text) to authenticated;
-- control_entry_times (one row per day) is replaced by control_entry_day_times.
drop function if exists public.control_entry_times(uuid, timestamptz, timestamptz, text);
