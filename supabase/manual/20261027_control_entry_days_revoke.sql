-- Run in the SQL Editor: the «Adherence» missed-days function is for signed-in users only.
revoke all on function public.control_entry_days(uuid, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.control_entry_days(uuid, timestamptz, timestamptz, text) to authenticated;
