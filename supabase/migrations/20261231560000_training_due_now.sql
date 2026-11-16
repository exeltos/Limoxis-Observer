-- Εικόνα νοσοκομείου › «Κατάσταση σήμερα»: η εκπαίδευση έμοιαζε τρέχουσα, αλλά το training μετρά μόνο αναθέσεις της
-- περιόδου (tra, κατά assigned_date). Νέα κλειδιά, ανεξάρτητα από την περίοδο, με τα ίδια όρια οργανισμού, τμήματος, module:
--   dueNow: αναθέσεις με προθεσμία έως σήμερα (όχι ακυρωμένες) · completedDueNow: όσες από αυτές ολοκληρώθηκαν
--   overdueNow: ανοιχτές με προθεσμία πριν από σήμερα, όποτε κι αν ανατέθηκαν.
do $patch$
declare
  v_def text := pg_get_functiondef('public.analysis_people_metrics(uuid,date,date,uuid)'::regprocedure);
  v_old text := $q$'overdue',(select count(*) from tra where status not in ('completed','cancelled') and due_date<current_date),$q$;
  v_new text := $q$'overdue',(select count(*) from tra where status not in ('completed','cancelled') and due_date<current_date),
      'dueNow',(select count(*) from public.training_assignments x where not l_all and (p_organization_id is null or x.organization_id=p_organization_id) and (p_department_id is null or x.department_id=p_department_id) and coalesce(x.status,'')<>'cancelled' and x.due_date<=current_date),
      'completedDueNow',(select count(*) from public.training_assignments x where not l_all and (p_organization_id is null or x.organization_id=p_organization_id) and (p_department_id is null or x.department_id=p_department_id) and x.status='completed' and x.due_date<=current_date),
      'overdueNow',(select count(*) from public.training_assignments x where not l_all and (p_organization_id is null or x.organization_id=p_organization_id) and (p_department_id is null or x.department_id=p_department_id) and coalesce(x.status,'') not in ('completed','cancelled') and x.due_date<current_date),$q$;
begin
  if position('overdueNow' in v_def) > 0 then raise notice 'already patched'; return; end if;
  if position(v_old in v_def) = 0 then raise exception 'analysis_people_metrics: anchor not found'; end if;
  v_def := replace(v_def, v_old, v_new);
  execute v_def;
end
$patch$;
