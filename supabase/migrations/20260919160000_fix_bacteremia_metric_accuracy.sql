-- Fixes 3 correctness issues in the bacteremia metrics added by
-- 20260919150000, found by review before merge:
--  1. The count included draft (unvalidated) results, and double-counted
--     amended results (both the original row and its amended_from
--     successor were counted), inflating a legally-reported figure.
--  2. bacteremia_total counted every positive blood culture regardless of
--     organism, including fungi (e.g. Candida auris = candidemia, not
--     bacteremia), silently inflating the indicator.
-- Fix: restrict to validation_status in ('validated','amended'), exclude
-- superseded rows (any row that is itself someone else's amended_from),
-- and define bacteremia_total as the union of the 8 reference-pathogen
-- matches rather than "any organism".

create or replace function private.indicator_metric_snapshot(p_organization_id uuid, p_from date, p_to date, p_department_id uuid default null::uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare v_scoped boolean;v_daily_count integer:=0;v_patient_days numeric:=0;v_active bigint:=0;v_resistant bigint:=0;v_hh_ok numeric:=0;v_hh_total numeric:=0;v_bundle_ok bigint:=0;v_bundle_total bigint:=0;v_abhr numeric:=0;v_staff bigint:=0;v_vaccinated bigint:=0;v_training_ok bigint:=0;v_training_total bigint:=0;v_incidents bigint:=0;v_mdro bigint:=0;
v_bact_total bigint:=0;v_bact_ecoli bigint:=0;v_bact_proteus bigint:=0;v_bact_acineto bigint:=0;v_bact_kleb bigint:=0;v_bact_entb bigint:=0;v_bact_pseudo bigint:=0;v_bact_saureus bigint:=0;v_bact_entc bigint:=0;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_from is null or p_to is null or p_to<p_from then raise exception 'Invalid indicator period'; end if;
  if not (public.current_user_is_platform_owner() or public.current_user_has_capability(p_organization_id,'view_indicators')) then raise exception 'Indicator access denied'; end if;
  select private.indicator_requires_department_scope(p_organization_id) into v_scoped;
  if v_scoped and p_department_id is null then raise exception 'Department scope required'; end if;
  if v_scoped and p_department_id is not null and not public.current_user_has_department_scope(p_organization_id,p_department_id) then raise exception 'Department scope denied'; end if;
  select count(*),coalesce(sum(pd.patient_days),0) into v_daily_count,v_patient_days from public.patient_days pd where pd.organization_id=p_organization_id and pd.census_date between p_from and p_to and (p_department_id is null or pd.department_id=p_department_id);
  if v_daily_count=0 then select coalesce(sum(pp.patient_days),0) into v_patient_days from public.patient_day_periods pp where pp.organization_id=p_organization_id and pp.period_start>=p_from and pp.period_end<=p_to and (p_department_id is null or pp.department_id=p_department_id); end if;
  select count(*) into v_active from public.surveillance_cases s where s.organization_id=p_organization_id and s.voided_at is null and s.started_at::date<=p_to and (s.closed_at is null or s.closed_at::date>=p_from) and (p_department_id is null or s.department_id=p_department_id);
  select count(distinct s.id) into v_resistant from public.surveillance_cases s join public.laboratory_samples l on l.surveillance_case_id=s.id and l.organization_id=s.organization_id join public.microbiology_results m on m.sample_id=l.id and m.organization_id=s.organization_id where s.organization_id=p_organization_id and s.voided_at is null and s.started_at::date<=p_to and (s.closed_at is null or s.closed_at::date>=p_from) and (p_department_id is null or s.department_id=p_department_id) and m.result_status='positive' and (upper(coalesce(m.resistance_class,'')) in ('MDR','XDR','PDR') or exists(select 1 from public.amr_classifications a where a.organization_id=p_organization_id and a.microbiology_result_id=m.id and a.status<>'rejected' and upper(coalesce(a.classification,'')) in ('MDR','XDR','PDR')));
  select coalesce(sum(h.compliant_observations),0),coalesce(sum(h.observations),0) into v_hh_ok,v_hh_total from public.hand_hygiene_sessions h where h.organization_id=p_organization_id and h.status='completed' and h.observation_date between p_from and p_to and (p_department_id is null or h.department_id=p_department_id);
  select count(*) filter(where b.score>=100),count(*) into v_bundle_ok,v_bundle_total from public.prevention_bundle_assessments b where b.organization_id=p_organization_id and b.status='completed' and b.assessment_date between p_from and p_to and (p_department_id is null or b.department_id=p_department_id);
  select coalesce(sum(a.litres),0) into v_abhr from public.antiseptic_consumption_periods a where a.organization_id=p_organization_id and a.period_start>=p_from and a.period_end<=p_to and (p_department_id is null or a.department_id=p_department_id);
  select count(*) into v_staff from public.employees e where e.organization_id=p_organization_id and e.employment_status='active' and (p_department_id is null or e.department_id=p_department_id);
  select count(distinct v.employee_id) into v_vaccinated from public.employee_vaccinations v join public.employees e on e.id=v.employee_id where v.organization_id=p_organization_id and e.employment_status='active' and v.vaccination_date<=p_to and (v.valid_until is null or v.valid_until>=p_to) and lower(coalesce(v.status,'active')) not in ('cancelled','canceled','rejected','expired','inactive','voided') and (p_department_id is null or e.department_id=p_department_id);
  select count(*) filter(where coalesce(t.payload->>'status','')='completed'),count(*) into v_training_ok,v_training_total from public.training_records t where t.organization_id=p_organization_id and t.record_type='assignment' and coalesce(nullif(t.payload->>'assignedDate','')::date,t.created_at::date) between p_from and p_to and (p_department_id is null or t.department_id=p_department_id);
  select count(*) into v_incidents from public.quality_incidents q where q.organization_id=p_organization_id and q.occurred_at::date between p_from and p_to and q.severity='high' and q.status<>'closed' and (p_department_id is null or q.department_id=p_department_id);
  select count(distinct m.id) into v_mdro from public.microbiology_results m join public.laboratory_samples l on l.id=m.sample_id where m.organization_id=p_organization_id and m.result_status='positive' and l.collected_at::date between p_from and p_to and (p_department_id is null or l.department_id=p_department_id) and lower(coalesce(l.sample_type,'')) like '%blood%' and (upper(coalesce(m.resistance_class,'')) in ('MDR','XDR','PDR') or exists(select 1 from public.amr_classifications a where a.organization_id=p_organization_id and a.microbiology_result_id=m.id and a.status<>'rejected' and upper(coalesce(a.classification,'')) in ('MDR','XDR','PDR')));
  select
    count(distinct m.id) filter(where lower(coalesce(m.organism,'')) like '%escherichia coli%' or lower(coalesce(m.organism,'')) like '%proteus%' or lower(coalesce(m.organism,'')) like '%acinetobacter%' or lower(coalesce(m.organism,'')) like '%klebsiella%' or lower(coalesce(m.organism,'')) like '%enterobacter%' or lower(coalesce(m.organism,'')) like '%pseudomonas%' or lower(coalesce(m.organism,'')) like '%staphylococcus aureus%' or lower(coalesce(m.organism,'')) like '%enterococcus%'),
    count(distinct m.id) filter(where lower(coalesce(m.organism,'')) like '%escherichia coli%'),
    count(distinct m.id) filter(where lower(coalesce(m.organism,'')) like '%proteus%'),
    count(distinct m.id) filter(where lower(coalesce(m.organism,'')) like '%acinetobacter%'),
    count(distinct m.id) filter(where lower(coalesce(m.organism,'')) like '%klebsiella%'),
    count(distinct m.id) filter(where lower(coalesce(m.organism,'')) like '%enterobacter%'),
    count(distinct m.id) filter(where lower(coalesce(m.organism,'')) like '%pseudomonas%'),
    count(distinct m.id) filter(where lower(coalesce(m.organism,'')) like '%staphylococcus aureus%'),
    count(distinct m.id) filter(where lower(coalesce(m.organism,'')) like '%enterococcus%')
  into v_bact_total,v_bact_ecoli,v_bact_proteus,v_bact_acineto,v_bact_kleb,v_bact_entb,v_bact_pseudo,v_bact_saureus,v_bact_entc
  from public.microbiology_results m join public.laboratory_samples l on l.id=m.sample_id
  where m.organization_id=p_organization_id and m.result_status='positive' and m.validation_status in ('validated','amended') and m.organism is not null and l.collected_at::date between p_from and p_to and (p_department_id is null or l.department_id=p_department_id) and lower(coalesce(l.sample_type,'')) like '%blood%'
    and not exists(select 1 from public.microbiology_results m2 where m2.organization_id=m.organization_id and m2.amended_from=m.id);
  return jsonb_build_object('patient_days',v_patient_days,'active_surveillance',v_active,'resistant_active_surveillance',v_resistant,'hh_compliant_actions',v_hh_ok,'hh_opportunities',v_hh_total,'bundle_all_or_none_pass',v_bundle_ok,'bundle_executions',v_bundle_total,'abhr_litres',v_abhr,'active_staff',v_staff,'active_staff_with_vaccination',v_vaccinated,'training_completed',v_training_ok,'training_assignments',v_training_total,'open_high_incidents',v_incidents,'mdro_bsi',v_mdro,'bacteremia_total',v_bact_total,'bacteremia_ecoli',v_bact_ecoli,'bacteremia_proteus',v_bact_proteus,'bacteremia_acinetobacter',v_bact_acineto,'bacteremia_klebsiella',v_bact_kleb,'bacteremia_enterobacter',v_bact_entb,'bacteremia_pseudomonas',v_bact_pseudo,'bacteremia_saureus',v_bact_saureus,'bacteremia_enterococcus',v_bact_entc);
end;$function$;
