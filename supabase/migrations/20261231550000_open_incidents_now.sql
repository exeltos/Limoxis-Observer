-- Εικόνα νοσοκομείου: τα «Ανοιχτά συμβάντα» δείχνονται ως «σήμερα», αλλά το openIncidents μετρά μόνο συμβάντα που
-- συνέβησαν μέσα στην περίοδο (qi). Νέο κλειδί openIncidentsNow: όλα τα συμβάντα που είναι ανοιχτά σήμερα, όποτε κι αν
-- συνέβησαν, με τα ίδια όρια οργανισμού, τμήματος και module (l_qual). Το openIncidents μένει ως έχει για την Ανάλυση.
do $patch$
declare
  v_def text := pg_get_functiondef('public.analysis_domain_metrics(uuid,date,date,uuid)'::regprocedure);
  v_old text := $q$'openIncidents',(select count(*) from qi where coalesce(status,'') not in ('closed','resolved','completed')),$q$;
  v_new text := $q$'openIncidents',(select count(*) from qi where coalesce(status,'') not in ('closed','resolved','completed')),
      'openIncidentsNow',(select count(*) from public.quality_incidents x where not l_qual and (p_organization_id is null or x.organization_id=p_organization_id) and (p_department_id is null or x.department_id=p_department_id) and x.voided_at is null and coalesce(x.status,'') not in ('closed','resolved','completed')),$q$;
begin
  if position('openIncidentsNow' in v_def) > 0 then raise notice 'already patched'; return; end if;
  if position(v_old in v_def) = 0 then raise exception 'analysis_domain_metrics: anchor not found'; end if;
  v_def := replace(v_def, v_old, v_new);
  execute v_def;
end
$patch$;
