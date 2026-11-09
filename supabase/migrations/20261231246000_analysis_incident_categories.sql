-- Analysis › Quality (owner, 8/11/2026: «θέλω να βλέπω κατηγορίες συμβάντων»): the incidents by category and the
-- department × category cells, next to severityByDepartment in analysis_crosstab_metrics. The category is the record's
-- key (e.g. odipy-fall); the client names it and groups it by the ΟΔΙΠΥ group. Read-only, same filters and access.
do $$
declare def text;
  old text := E'''severityByDepartment'', coalesce((select jsonb_agg(jsonb_build_array(r, c, n) order by n desc) from (\n        select coalesce(d.name, ''—'') r, coalesce(qi.severity, ''—'') c, count(*) n\n        from qi left join dept d on d.id = qi.department_id group by 1, 2) x), ''[]''::jsonb)';
begin
  select pg_get_functiondef('public.analysis_crosstab_metrics(uuid,date,date,uuid)'::regprocedure) into def;
  if position('categoryByDepartment' in def) > 0 then return; end if;
  if position(old in def) = 0 then raise exception 'analysis_crosstab_metrics: severityByDepartment block not found'; end if;
  def := replace(def, old, old || E',\n      ''byCategory'', coalesce((select jsonb_agg(jsonb_build_array(c, n) order by n desc) from (\n        select coalesce(nullif(btrim(qi.category), ''''), ''—'') c, count(*) n from qi group by 1) x), ''[]''::jsonb),\n      ''categoryByDepartment'', coalesce((select jsonb_agg(jsonb_build_array(r, c, n) order by n desc) from (\n        select coalesce(d.name, ''—'') r, coalesce(nullif(btrim(qi.category), ''''), ''—'') c, count(*) n\n        from qi left join dept d on d.id = qi.department_id group by 1, 2) x), ''[]''::jsonb)');
  execute def;
end $$;
