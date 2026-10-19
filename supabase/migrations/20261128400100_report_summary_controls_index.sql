-- platform_report_summary counted control executions with created_at::date
-- filters: a cast the planner cannot use, so every call scanned the whole
-- table (about 185,000 rows, 2-4 s of the Analysis page and of the Executive
-- dashboard, which reads two periods). The count now compares created_at
-- itself (the same days in the session time zone) against an index-only
-- (organization_id, created_at) range. The rest of the live body is kept.

create index if not exists control_executions_org_created_idx
  on public.control_executions (organization_id, created_at)
  include (department_id);

do $do$
declare
  d text;
begin
  d := pg_get_functiondef('public.platform_report_summary(uuid,date,date,uuid)'::regprocedure);
  if position('(p_from is null or c.created_at::date>=p_from) and (p_to is null or c.created_at::date<=p_to)' in d) = 0 then
    raise exception 'platform_report_summary: control_executions count not found';
  end if;
  d := replace(d, '(p_from is null or c.created_at::date>=p_from) and (p_to is null or c.created_at::date<=p_to)', '(p_from is null or c.created_at>=p_from::timestamptz) and (p_to is null or c.created_at<(p_to+1)::timestamptz)');
  execute d;
end
$do$;
