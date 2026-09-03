grant usage on schema private to authenticated;

revoke all on function private.indicator_metric_snapshot(uuid,date,date,uuid) from public, anon;
grant execute on function private.indicator_metric_snapshot(uuid,date,date,uuid) to authenticated;
