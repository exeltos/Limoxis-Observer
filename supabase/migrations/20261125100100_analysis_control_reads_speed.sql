-- Analysis reads control executions from a covering index: the domain and
-- cross-tab metrics keep only the columns they use, and the period filter is
-- on performed_at itself (never null), so a year of a large hospital (about
-- 70,000 executions) is an index-only scan instead of 70,000 heap reads.
-- Only the control_executions CTE of each function changes; the rest of the
-- live body is kept as it is (re-created from pg_get_functiondef).

create index if not exists control_executions_analysis_idx
  on public.control_executions (organization_id, performed_at)
  include (department_id, control_id, status, has_finding, created_at)
  where cancelled_at is null;

do $do$
declare
  d text;
begin
  d := pg_get_functiondef('public.analysis_domain_metrics(uuid,date,date,uuid)'::regprocedure);
  if position('select c.* from public.control_executions c' in d) = 0
    or position('(p_from is null or coalesce(c.performed_at,c.created_at)::date>=p_from)' in d) = 0
    or position('(p_to is null or coalesce(c.performed_at,c.created_at)::date<=p_to)' in d) = 0 then
    raise exception 'analysis_domain_metrics: control_executions CTE not found';
  end if;
  d := replace(d, 'select c.* from public.control_executions c', 'select c.department_id, c.control_id, c.status, c.has_finding, c.performed_at, c.created_at from public.control_executions c');
  d := replace(d, '(p_from is null or coalesce(c.performed_at,c.created_at)::date>=p_from)', '(p_from is null or c.performed_at>=p_from)');
  d := replace(d, '(p_to is null or coalesce(c.performed_at,c.created_at)::date<=p_to)', '(p_to is null or c.performed_at<p_to+1)');
  execute d;

  d := pg_get_functiondef('public.analysis_crosstab_metrics(uuid,date,date,uuid)'::regprocedure);
  if position('select c.* from public.control_executions c' in d) = 0
    or position('(p_from is null or coalesce(c.performed_at, c.created_at)::date >= p_from)' in d) = 0
    or position('(p_to is null or coalesce(c.performed_at, c.created_at)::date <= p_to)' in d) = 0 then
    raise exception 'analysis_crosstab_metrics: control_executions CTE not found';
  end if;
  d := replace(d, 'select c.* from public.control_executions c', 'select c.department_id, c.control_id, c.status, c.has_finding, c.performed_at, c.created_at from public.control_executions c');
  d := replace(d, '(p_from is null or coalesce(c.performed_at, c.created_at)::date >= p_from)', '(p_from is null or c.performed_at >= p_from)');
  d := replace(d, '(p_to is null or coalesce(c.performed_at, c.created_at)::date <= p_to)', '(p_to is null or c.performed_at < p_to + 1)');
  execute d;
end
$do$;
