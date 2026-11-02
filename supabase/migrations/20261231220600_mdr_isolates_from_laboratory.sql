-- Δείκτες «Νέες απομονώσεις MDR» (σύνολο και ανά μικροοργανισμό): μετρούσαν επεισόδια απομόνωσης ασθενών (προφυλάξεις)
-- που συνδέονται με επιτήρηση, οπότε έβγαιναν 0 όπου η απομόνωση δεν καταγράφεται (ΙΑΣΩ 2026: 0, ενώ τα πολυανθεκτικά
-- στελέχη ήταν 96). Τώρα μετρούν τους ασθενείς με θετικό, επικυρωμένο στέλεχος MDR/XDR/PDR που ελήφθη μέσα στην περίοδο
-- (κάθε ασθενής μία φορά ανά μικροοργανισμό), από το εργαστήριο. Τα δείγματα περιβάλλοντος και χωρίς ασθενή μένουν εκτός.
do $patch$
declare
  v_def text := pg_get_functiondef('private.indicator_metric_snapshot(uuid,date,date,uuid)'::regprocedure);
  v_old text := E'  from public.isolation_episodes ie\n  join public.surveillance_cases s on s.id=ie.surveillance_case_id and s.organization_id=ie.organization_id\n  join public.laboratory_samples l on l.surveillance_case_id=s.id and l.organization_id=s.organization_id\n  join public.microbiology_results m on m.sample_id=l.id and m.organization_id=s.organization_id\n  where ie.organization_id=p_organization_id and s.voided_at is null and ie.started_at::date between p_from and p_to and (p_department_id is null or ie.department_id=p_department_id)';
  v_new text := E'  from public.laboratory_samples l\n  join public.microbiology_results m on m.sample_id=l.id and m.organization_id=l.organization_id\n  where l.organization_id=p_organization_id and l.patient_id is not null and coalesce(l.subject_type,''patient'')<>''environment'' and l.collected_at::date between p_from and p_to and (p_department_id is null or l.department_id=p_department_id)';
begin
  if position(v_old in v_def) = 0 then
    if position('count(distinct ie.id)' in v_def) = 0 then raise notice 'already patched'; return; end if;
    raise exception 'indicator_metric_snapshot: the isolation block was not found';
  end if;
  v_def := replace(v_def, v_old, v_new);
  v_def := replace(v_def, 'count(distinct ie.id)', 'count(distinct l.patient_id)');
  execute v_def;
end
$patch$;
