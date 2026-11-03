-- Δείκτες βακτηριαιμιών / απομονώσεων: το «μηδέν» ισχύει μόνο όταν το εργαστήριο έχει καταχωρημένα αποτελέσματα στην περίοδο.
-- Προσθέτει στο private.indicator_metric_snapshot το μέγεθος microbiology_results_in_period (επικυρωμένα αποτελέσματα μικροβιολογίας
-- με δείγμα στην περίοδο)· ο υπολογισμός των δεικτών δεν κρίνει δείκτη χωρίς αυτό. Το σώμα διορθώνεται από τον ορισμό που ισχύει.
do $patch$
declare
  v_old text := pg_get_functiondef('private.indicator_metric_snapshot(uuid,date,date,uuid)'::regprocedure);
  v_new text;
begin
  if position('microbiology_results_in_period' in v_old) > 0 then return; end if;
  v_new := replace(v_old, 'v_risk_high bigint;', 'v_risk_high bigint;v_lab_active bigint:=0;');
  v_new := replace(v_new, E'  return\n    jsonb_build_object(''patient_days'',v_patient_days,',
$lab$  select count(*) into v_lab_active from public.microbiology_results m join public.laboratory_samples l on l.id=m.sample_id and l.organization_id=m.organization_id
  where m.organization_id=p_organization_id and m.validation_status in ('validated','amended') and l.collected_at::date between p_from and p_to and (p_department_id is null or l.department_id=p_department_id);
$lab$ || E'  return\n    jsonb_build_object(''patient_days'',v_patient_days,');
  v_new := replace(v_new, '|| case when v_risk_high is null', '|| jsonb_build_object(''microbiology_results_in_period'',v_lab_active) || case when v_risk_high is null');
  if v_new = v_old or position('v_lab_active' in v_new) = 0 or position('microbiology_results_in_period' in v_new) = 0 or position('select count(*) into v_lab_active' in v_new) = 0 then
    raise exception 'The snapshot function did not match the expected text';
  end if;
  execute v_new;
end
$patch$;
