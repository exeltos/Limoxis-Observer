-- Run in the SQL Editor: the trigger function of the entry window is not callable by clients.
revoke all on function private.control_executions_window_guard() from public, anon, authenticated;
