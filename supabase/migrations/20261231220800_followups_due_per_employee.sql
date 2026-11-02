-- «Εκπρόθεσμοι επανέλεγχοι» (analysis_people_metrics → workforce.followUpsDue): μετρούσε κάθε επίσκεψη με περασμένη
-- ημερομηνία επανελέγχου, ακόμα κι αν ο εργαζόμενος ξαναήρθε μετά (ΙΑΣΩ 2/11/2026: 231, από τις οποίες 104 είχαν ήδη
-- νεότερη επίσκεψη). Τώρα μετρά εργαζόμενους: όσους η τελευταία τους (μη ακυρωμένη) επίσκεψη έχει περασμένο επανέλεγχο (127).
do $patch$
declare
  v_def text := pg_get_functiondef('public.analysis_people_metrics(uuid,date,date,uuid)'::regprocedure);
  v_old text := $q$(select count(*) from public.occupational_health_visits o join emp on emp.id=o.employee_id where o.follow_up_date<current_date and coalesce(o.status,'') not in ('cancelled'))$q$;
  v_new text := $q$(select count(distinct o.employee_id) from public.occupational_health_visits o join emp on emp.id=o.employee_id where o.follow_up_date<current_date and coalesce(o.status,'') not in ('cancelled') and not exists (select 1 from public.occupational_health_visits l where l.employee_id=o.employee_id and coalesce(l.status,'') not in ('cancelled') and coalesce(l.visit_date,l.created_at::date)>coalesce(o.visit_date,o.created_at::date)))$q$;
begin
  if position(v_new in v_def) > 0 then raise notice 'already patched'; return; end if;
  if position(v_old in v_def) = 0 then raise exception 'analysis_people_metrics: followUpsDue expression not found'; end if;
  execute replace(v_def, v_old, v_new);
end
$patch$;
