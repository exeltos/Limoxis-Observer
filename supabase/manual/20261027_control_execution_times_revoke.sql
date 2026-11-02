-- Run in the SQL Editor: the «Times» report function is for signed-in users only.
revoke all on function public.control_execution_times(uuid, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.control_execution_times(uuid, timestamptz, timestamptz, text) to authenticated;
