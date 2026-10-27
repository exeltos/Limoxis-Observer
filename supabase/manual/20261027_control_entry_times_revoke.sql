-- Run in the SQL Editor: the «Adherence» missed-times function is for signed-in users only.
revoke all on function public.control_entry_times(uuid, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.control_entry_times(uuid, timestamptz, timestamptz, text) to authenticated;
-- control_entry_days (counts only) is replaced by control_entry_times.
drop function if exists public.control_entry_days(uuid, timestamptz, timestamptz, text);
