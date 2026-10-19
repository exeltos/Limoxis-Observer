-- Quality & food safety indicators (system, auto-calculated): six new metrics in
-- private.indicator_metric_snapshot and their definitions (organization_id null).
--
--   audit-answers-compliance      «Συμμορφώνεται» over applicable answers of the
--                                 audits completed in the period (%, higher)
--   kitchen-receipts-out-of-limits  receipts out of limits over receipts (%, lower)
--   kitchen-days-haccp-verified   past production days signed off over production
--                                 days (%, higher)
--   supplier-evaluation-average   mean score of the period's evaluations of active
--                                 suppliers (%, higher)
--   patient-satisfaction          4–5 answers over the 1–5 answers of patient
--                                 surveys (%, higher)
--   quality-risks-high            residual high / very high risks of the
--                                 assessment in force at the end of the period
--                                 (count, lower; whole organization only)
--
-- The rules are those of public.analysis_quality_food_metrics (20261126100000).
-- Whole body re-created from 20261125100000; the earlier metrics are unchanged
-- and the new ones are one more jsonb_build_object chunk (PostgreSQL caps a call
-- at 100 arguments). A department view gets the audit and survey metrics; the
-- kitchen, suppliers and risks belong to the organization, so their metrics stay
-- 0 there and quality_risks_high is left out (a count would read as «none»).

create or replace function private.indicator_metric_snapshot(p_organization_id uuid, p_from date, p_to date, p_department_id uuid default null::uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare v_scoped boolean;v_daily_count integer:=0;v_patient_days numeric:=0;v_active bigint:=0;v_resistant bigint:=0;v_hh_ok numeric:=0;v_hh_total numeric:=0;v_bundle_ok bigint:=0;v_bundle_total bigint:=0;v_abhr numeric:=0;v_staff bigint:=0;v_vaccinated bigint:=0;v_training_ok bigint:=0;v_training_total bigint:=0;v_incidents bigint:=0;v_mdro bigint:=0;
v_bact_total bigint:=0;v_bact_ecoli bigint:=0;v_bact_proteus bigint:=0;v_bact_acineto bigint:=0;v_bact_kleb bigint:=0;v_bact_entb bigint:=0;v_bact_pseudo bigint:=0;v_bact_saureus bigint:=0;v_bact_entc bigint:=0;
v_amr_t_ecoli bigint:=0;v_amr_r_ecoli bigint:=0;v_amr_t_proteus bigint:=0;v_amr_r_proteus bigint:=0;v_amr_t_acineto bigint:=0;v_amr_r_acineto bigint:=0;v_amr_t_kleb bigint:=0;v_amr_r_kleb bigint:=0;v_amr_t_entb bigint:=0;v_amr_r_entb bigint:=0;v_amr_t_pseudo bigint:=0;v_amr_r_pseudo bigint:=0;v_amr_t_saureus bigint:=0;v_amr_r_saureus bigint:=0;v_amr_t_entc bigint:=0;v_amr_r_entc bigint:=0;
v_ddd_total numeric:=0;
v_iso_total bigint:=0;v_iso_ecoli bigint:=0;v_iso_proteus bigint:=0;v_iso_acineto bigint:=0;v_iso_kleb bigint:=0;v_iso_entb bigint:=0;v_iso_pseudo bigint:=0;v_iso_saureus bigint:=0;v_iso_entc bigint:=0;
v_pps_total bigint:=0;v_pps_hai bigint:=0;v_pps_abx bigint:=0;
v_qa_ok bigint:=0;v_qa_total bigint:=0;v_kr_out bigint:=0;v_kr_total bigint:=0;v_kd_ok bigint:=0;v_kd_total bigint:=0;v_se_sum numeric:=0;v_se_total bigint:=0;v_ps_ok bigint:=0;v_ps_total bigint:=0;v_risk_high bigint;
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
  select count(distinct v.employee_id) into v_vaccinated from public.employee_vaccinations v join public.employees e on e.id=v.employee_id where v.organization_id=p_organization_id and e.employment_status='active' and v.vaccination_date<=p_to and (v.valid_until>=p_to or (v.valid_until is null and v.vaccination_date>p_to-interval '12 months')) and lower(coalesce(v.status,'active')) not in ('cancelled','canceled','rejected','expired','inactive','voided') and (lower(coalesce(v.vaccine_label_snapshot,'')) like '%γρίπ%' or lower(coalesce(v.vaccine_label_snapshot,'')) like '%influenza%' or lower(coalesce(v.vaccine_label_snapshot,'')) like '%flu%') and (p_department_id is null or e.department_id=p_department_id);
  select count(*) filter(where t.status='completed'),count(*) into v_training_ok,v_training_total from public.training_assignments t where t.organization_id=p_organization_id and coalesce(t.assigned_date,t.created_at::date) between p_from and p_to and (p_department_id is null or t.department_id=p_department_id);
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
  select
    count(*) filter(where lower(coalesce(a.organism,'')) like '%escherichia coli%' and (a.antimicrobial_code='ABX-CRO' or lower(coalesce(a.antimicrobial_name,'')) like '%ceftriaxone%')),
    count(*) filter(where lower(coalesce(a.organism,'')) like '%escherichia coli%' and (a.antimicrobial_code='ABX-CRO' or lower(coalesce(a.antimicrobial_name,'')) like '%ceftriaxone%') and a.sir_category='R'),
    count(*) filter(where lower(coalesce(a.organism,'')) like '%proteus%' and (a.antimicrobial_code='ABX-CRO' or lower(coalesce(a.antimicrobial_name,'')) like '%ceftriaxone%')),
    count(*) filter(where lower(coalesce(a.organism,'')) like '%proteus%' and (a.antimicrobial_code='ABX-CRO' or lower(coalesce(a.antimicrobial_name,'')) like '%ceftriaxone%') and a.sir_category='R'),
    count(*) filter(where lower(coalesce(a.organism,'')) like '%acinetobacter%' and (a.antimicrobial_code='ABX-MEM' or lower(coalesce(a.antimicrobial_name,'')) like '%meropenem%')),
    count(*) filter(where lower(coalesce(a.organism,'')) like '%acinetobacter%' and (a.antimicrobial_code='ABX-MEM' or lower(coalesce(a.antimicrobial_name,'')) like '%meropenem%') and a.sir_category='R'),
    count(*) filter(where lower(coalesce(a.organism,'')) like '%klebsiella%' and (a.antimicrobial_code='ABX-MEM' or lower(coalesce(a.antimicrobial_name,'')) like '%meropenem%')),
    count(*) filter(where lower(coalesce(a.organism,'')) like '%klebsiella%' and (a.antimicrobial_code='ABX-MEM' or lower(coalesce(a.antimicrobial_name,'')) like '%meropenem%') and a.sir_category='R'),
    count(*) filter(where lower(coalesce(a.organism,'')) like '%enterobacter%' and (a.antimicrobial_code='ABX-CRO' or lower(coalesce(a.antimicrobial_name,'')) like '%ceftriaxone%')),
    count(*) filter(where lower(coalesce(a.organism,'')) like '%enterobacter%' and (a.antimicrobial_code='ABX-CRO' or lower(coalesce(a.antimicrobial_name,'')) like '%ceftriaxone%') and a.sir_category='R'),
    count(*) filter(where lower(coalesce(a.organism,'')) like '%pseudomonas%' and (a.antimicrobial_code='ABX-MEM' or lower(coalesce(a.antimicrobial_name,'')) like '%meropenem%')),
    count(*) filter(where lower(coalesce(a.organism,'')) like '%pseudomonas%' and (a.antimicrobial_code='ABX-MEM' or lower(coalesce(a.antimicrobial_name,'')) like '%meropenem%') and a.sir_category='R'),
    count(*) filter(where lower(coalesce(a.organism,'')) like '%staphylococcus aureus%' and (a.antimicrobial_code='ABX-OXA' or lower(coalesce(a.antimicrobial_name,'')) like '%oxacillin%')),
    count(*) filter(where lower(coalesce(a.organism,'')) like '%staphylococcus aureus%' and (a.antimicrobial_code='ABX-OXA' or lower(coalesce(a.antimicrobial_name,'')) like '%oxacillin%') and a.sir_category='R'),
    count(*) filter(where lower(coalesce(a.organism,'')) like '%enterococcus%' and (a.antimicrobial_code='ABX-VAN' or lower(coalesce(a.antimicrobial_name,'')) like '%vancomycin%')),
    count(*) filter(where lower(coalesce(a.organism,'')) like '%enterococcus%' and (a.antimicrobial_code='ABX-VAN' or lower(coalesce(a.antimicrobial_name,'')) like '%vancomycin%') and a.sir_category='R')
  into v_amr_t_ecoli,v_amr_r_ecoli,v_amr_t_proteus,v_amr_r_proteus,v_amr_t_acineto,v_amr_r_acineto,v_amr_t_kleb,v_amr_r_kleb,v_amr_t_entb,v_amr_r_entb,v_amr_t_pseudo,v_amr_r_pseudo,v_amr_t_saureus,v_amr_r_saureus,v_amr_t_entc,v_amr_r_entc
  from public.antimicrobial_susceptibility_results a
  join public.microbiology_results m on m.id=a.microbiology_result_id and m.organization_id=a.organization_id
  join public.laboratory_samples l on l.id=m.sample_id
  where a.organization_id=p_organization_id and m.result_status='positive' and m.validation_status in ('validated','amended') and l.collected_at::date between p_from and p_to and (p_department_id is null or l.department_id=p_department_id)
    and not exists(select 1 from public.microbiology_results m2 where m2.organization_id=m.organization_id and m2.amended_from=m.id);
  select coalesce(sum(d.quantity_grams / (
    select r.ddd_grams from public.who_ddd_reference r
    where r.antibiotic_code=lib.code and (r.organization_id=d.organization_id or r.organization_id is null)
    order by r.organization_id nulls last limit 1
  )),0) into v_ddd_total
  from public.antibiotic_dispensing_periods d
  join public.master_library_items lib on lib.id=d.antibiotic_item_id
  where d.organization_id=p_organization_id and d.period_start>=p_from and d.period_end<=p_to and (p_department_id is null or d.department_id=p_department_id);
  select
    count(distinct ie.id) filter(where lower(coalesce(m.organism,'')) like '%escherichia coli%' or lower(coalesce(m.organism,'')) like '%proteus%' or lower(coalesce(m.organism,'')) like '%acinetobacter%' or lower(coalesce(m.organism,'')) like '%klebsiella%' or lower(coalesce(m.organism,'')) like '%enterobacter%' or lower(coalesce(m.organism,'')) like '%pseudomonas%' or lower(coalesce(m.organism,'')) like '%staphylococcus aureus%' or lower(coalesce(m.organism,'')) like '%enterococcus%'),
    count(distinct ie.id) filter(where lower(coalesce(m.organism,'')) like '%escherichia coli%'),
    count(distinct ie.id) filter(where lower(coalesce(m.organism,'')) like '%proteus%'),
    count(distinct ie.id) filter(where lower(coalesce(m.organism,'')) like '%acinetobacter%'),
    count(distinct ie.id) filter(where lower(coalesce(m.organism,'')) like '%klebsiella%'),
    count(distinct ie.id) filter(where lower(coalesce(m.organism,'')) like '%enterobacter%'),
    count(distinct ie.id) filter(where lower(coalesce(m.organism,'')) like '%pseudomonas%'),
    count(distinct ie.id) filter(where lower(coalesce(m.organism,'')) like '%staphylococcus aureus%'),
    count(distinct ie.id) filter(where lower(coalesce(m.organism,'')) like '%enterococcus%')
  into v_iso_total,v_iso_ecoli,v_iso_proteus,v_iso_acineto,v_iso_kleb,v_iso_entb,v_iso_pseudo,v_iso_saureus,v_iso_entc
  from public.isolation_episodes ie
  join public.surveillance_cases s on s.id=ie.surveillance_case_id and s.organization_id=ie.organization_id
  join public.laboratory_samples l on l.surveillance_case_id=s.id and l.organization_id=s.organization_id
  join public.microbiology_results m on m.sample_id=l.id and m.organization_id=s.organization_id
  where ie.organization_id=p_organization_id and s.voided_at is null and ie.started_at::date between p_from and p_to and (p_department_id is null or ie.department_id=p_department_id)
    and m.result_status='positive' and m.validation_status in ('validated','amended')
    and not exists(select 1 from public.microbiology_results m2 where m2.organization_id=m.organization_id and m2.amended_from=m.id)
    and (upper(coalesce(m.resistance_class,'')) in ('MDR','XDR','PDR') or exists(select 1 from public.amr_classifications am where am.organization_id=m.organization_id and am.microbiology_result_id=m.id and am.status<>'rejected' and upper(coalesce(am.classification,'')) in ('MDR','XDR','PDR')));
  select coalesce(sum(p.patients_total),0),coalesce(sum(p.patients_with_hai),0),coalesce(sum(p.patients_on_antibiotics),0) into v_pps_total,v_pps_hai,v_pps_abx
  from public.point_prevalence_surveys p
  where p.organization_id=p_organization_id and p.survey_date between p_from and p_to and (p_department_id is null or p.department_id=p_department_id);
  -- Quality & food safety (20261126100100): audit answers, kitchen receipts and
  -- production days, supplier evaluations, patient satisfaction, high risks. The
  -- same rules as public.analysis_quality_food_metrics. Audits and survey
  -- responses carry a department; the kitchen, suppliers and risks belong to the
  -- organization and are counted only for the whole organization.
  select count(*) filter(where coalesce(i.result,i.answer)='yes'),count(*) into v_qa_ok,v_qa_total
  from public.quality_audits a join public.quality_audit_checklist_items i on i.audit_id=a.id and i.organization_id=a.organization_id
  where a.organization_id=p_organization_id and a.status='completed' and a.voided_at is null and a.completed_date between p_from and p_to and (p_department_id is null or a.department_id=p_department_id) and coalesce(i.result,i.answer) in ('yes','partial','no');
  select count(*) filter(where q.ok),count(*) into v_ps_ok,v_ps_total
  from (select coalesce((r.answers->(qq->>'id') #>> '{}') ~ '^\s*[45](\.0+)?\s*$',false) as ok
    from public.quality_survey_responses r join public.quality_surveys s on s.id=r.survey_id and s.organization_id=r.organization_id
    cross join lateral jsonb_array_elements(s.questions) qq
    where r.organization_id=p_organization_id and s.audience='patients' and r.submitted_at>=p_from and r.submitted_at<p_to+1 and (p_department_id is null or r.department_id=p_department_id)
      and qq->>'type'='rating' and jsonb_typeof(r.answers->(qq->>'id')) is not null and jsonb_typeof(r.answers->(qq->>'id'))<>'null' and r.answers->(qq->>'id')<>'""'::jsonb) q;
  if p_department_id is null then
    select count(*) filter(where r.limit_status='out'),count(*) into v_kr_out,v_kr_total from public.kitchen_receipts r where r.organization_id=p_organization_id and r.received_on between p_from and p_to;
    select count(*) filter(where p.verified_at is not null),count(*) into v_kd_ok,v_kd_total from public.kitchen_productions p where p.organization_id=p_organization_id and p.production_date between p_from and p_to and p.production_date<current_date;
    select coalesce(sum(x.score),0),count(*) into v_se_sum,v_se_total from (
      select coalesce(e.total_score,(select round(100*sum(sc.score::numeric/sc.score_scale*sc.weight)/nullif(sum(sc.weight),0),1) from public.quality_supplier_evaluation_scores sc where sc.evaluation_id=e.id and sc.organization_id=e.organization_id)) as score
      from public.quality_supplier_evaluations e join public.quality_suppliers s on s.id=e.supplier_id and s.organization_id=e.organization_id
      where e.organization_id=p_organization_id and s.status='active' and e.evaluated_on between p_from and p_to) x where x.score is not null;
    select count(*) into v_risk_high from public.quality_risks r
    where r.organization_id=p_organization_id and r.residual_score>=8 and r.assessment_id=(
      select a.id from public.quality_risk_assessments a where a.organization_id=p_organization_id and a.assessed_on<=p_to
      order by (a.status='draft'),a.assessed_on desc,a.created_at desc limit 1);
  end if;
  return
    jsonb_build_object('patient_days',v_patient_days,'active_surveillance',v_active,'resistant_active_surveillance',v_resistant,'hh_compliant_actions',v_hh_ok,'hh_opportunities',v_hh_total,'bundle_all_or_none_pass',v_bundle_ok,'bundle_executions',v_bundle_total,'abhr_litres',v_abhr,'active_staff',v_staff,'active_staff_with_vaccination',v_vaccinated,'training_completed',v_training_ok,'training_assignments',v_training_total,'open_high_incidents',v_incidents,'mdro_bsi',v_mdro)
    || jsonb_build_object('bacteremia_total',v_bact_total,'bacteremia_ecoli',v_bact_ecoli,'bacteremia_proteus',v_bact_proteus,'bacteremia_acinetobacter',v_bact_acineto,'bacteremia_klebsiella',v_bact_kleb,'bacteremia_enterobacter',v_bact_entb,'bacteremia_pseudomonas',v_bact_pseudo,'bacteremia_saureus',v_bact_saureus,'bacteremia_enterococcus',v_bact_entc)
    || jsonb_build_object('amr_tested_ecoli',v_amr_t_ecoli,'amr_resistant_ecoli',v_amr_r_ecoli,'amr_tested_proteus',v_amr_t_proteus,'amr_resistant_proteus',v_amr_r_proteus,'amr_tested_acinetobacter',v_amr_t_acineto,'amr_resistant_acinetobacter',v_amr_r_acineto,'amr_tested_klebsiella',v_amr_t_kleb,'amr_resistant_klebsiella',v_amr_r_kleb,'amr_tested_enterobacter',v_amr_t_entb,'amr_resistant_enterobacter',v_amr_r_entb,'amr_tested_pseudomonas',v_amr_t_pseudo,'amr_resistant_pseudomonas',v_amr_r_pseudo,'amr_tested_saureus',v_amr_t_saureus,'amr_resistant_saureus',v_amr_r_saureus,'amr_tested_enterococcus',v_amr_t_entc,'amr_resistant_enterococcus',v_amr_r_entc)
    || jsonb_build_object('antibiotic_ddd_total',v_ddd_total,'mdr_isolation_total',v_iso_total,'mdr_isolation_ecoli',v_iso_ecoli,'mdr_isolation_proteus',v_iso_proteus,'mdr_isolation_acinetobacter',v_iso_acineto,'mdr_isolation_klebsiella',v_iso_kleb,'mdr_isolation_enterobacter',v_iso_entb,'mdr_isolation_pseudomonas',v_iso_pseudo,'mdr_isolation_saureus',v_iso_saureus,'mdr_isolation_enterococcus',v_iso_entc,'pps_patients_total',v_pps_total,'pps_patients_with_hai',v_pps_hai,'pps_patients_on_antibiotics',v_pps_abx)
    || jsonb_build_object('audit_answers_compliant',v_qa_ok,'audit_answers_applicable',v_qa_total,'patient_satisfied_answers',v_ps_ok,'patient_rating_answers',v_ps_total,'kitchen_receipts_out_of_limits',v_kr_out,'kitchen_receipts',v_kr_total,'kitchen_production_days_verified',v_kd_ok,'kitchen_production_days',v_kd_total,'supplier_evaluation_score_total',v_se_sum,'supplier_evaluations_scored',v_se_total)
    || case when v_risk_high is null then '{}'::jsonb else jsonb_build_object('quality_risks_high',v_risk_high) end;
end;$function$;

-- System definitions. organization_id is null, so «on conflict» cannot match
-- (nulls are distinct): insert the ones not there yet.
alter table public.indicator_definitions disable trigger trg_audit_indicator_definitions;

insert into public.indicator_definitions (
  organization_id, indicator_key, version, title_el, title_en, category, numerator_definition, denominator_definition,
  numerator_metric, denominator_metric, multiplier, unit, unit_en, source_authority, effective_from, status, calculation_type, target_value, direction
)
select null, x.k, '2026.4', x.el, x.en, 'quality', jsonb_build_object('description', x.numd), jsonb_build_object('description', x.dend),
  x.num, x.den, x.mult, x.unit, x.unit_en, x.src, date '2026-01-01', 'active', 'auto', x.target, x.dir
from (values
  ('audit-answers-compliance', 'Συμμόρφωση απαντήσεων επιθεωρήσεων', 'Audit answer compliance',
    'Απαντήσεις «Συμμορφώνεται» στις επιθεωρήσεις που ολοκληρώθηκαν', 'Απαντήσεις που εφαρμόζονται (συμμορφώνεται, μερική, μη συμμόρφωση)',
    'audit_answers_compliant', 'audit_answers_applicable', 100::numeric, '%', '%', 'Ποιότητα · Πρόγραμμα επιθεωρήσεων (ISO 9001 §9.2)', 90::numeric, 'higher'),
  ('kitchen-receipts-out-of-limits', 'Παραλαβές κουζίνας εκτός ορίων', 'Kitchen receipts out of limits',
    'Παραλαβές με μέτρηση ή έλεγχο εκτός ορίων', 'Παραλαβές της περιόδου',
    'kitchen_receipts_out_of_limits', 'kitchen_receipts', 100::numeric, '%', '%', 'Κουζίνα · HACCP / ISO 22000 (κρίσιμα όρια παραλαβής)', 5::numeric, 'lower'),
  ('kitchen-days-haccp-verified', 'Ημέρες παραγωγής με επαλήθευση HACCP', 'Production days HACCP-verified',
    'Ημέρες παραγωγής με υπογραφή επαλήθευσης', 'Ημέρες παραγωγής που πέρασαν',
    'kitchen_production_days_verified', 'kitchen_production_days', 100::numeric, '%', '%', 'Κουζίνα · HACCP / ISO 22000 (επαλήθευση)', 95::numeric, 'higher'),
  ('supplier-evaluation-average', 'Μέση βαθμολογία αξιολόγησης προμηθευτών', 'Average supplier evaluation score',
    'Άθροισμα βαθμολογιών (%) των αξιολογήσεων της περιόδου', 'Αξιολογήσεις ενεργών προμηθευτών με βαθμολογία',
    'supplier_evaluation_score_total', 'supplier_evaluations_scored', 1::numeric, '%', '%', 'Ποιότητα · Αξιολόγηση προμηθευτών (ISO 9001 §8.4)', 80::numeric, 'higher'),
  ('patient-satisfaction', 'Συνολική ικανοποίηση ασθενών', 'Overall patient satisfaction',
    'Απαντήσεις 4–5 στις ερωτήσεις κλίμακας 1–5 των ερευνών ασθενών', 'Απαντήσεις στις ερωτήσεις κλίμακας 1–5 των ερευνών ασθενών',
    'patient_satisfied_answers', 'patient_rating_answers', 100::numeric, '%', '%', 'Ποιότητα · Έρευνες ικανοποίησης (ISO 9001 §9.1.2)', 80::numeric, 'higher'),
  ('quality-risks-high', 'Κίνδυνοι υψηλού επιπέδου', 'High-level risks',
    'Κίνδυνοι με υπολειπόμενο επίπεδο υψηλό ή πολύ υψηλό (βαθμός ≥ 8) στην ισχύουσα εκτίμηση', '',
    'quality_risks_high', null, 1::numeric, 'κίνδυνοι', 'risks', 'Ποιότητα · Εκτίμηση επικινδυνότητας (μήτρα 5×5)', null::numeric, 'lower')
) x(k, el, en, numd, dend, num, den, mult, unit, unit_en, src, target, dir)
where not exists (
  select 1 from public.indicator_definitions d
  where d.organization_id is null and d.indicator_key = x.k and d.version = '2026.4'
);

alter table public.indicator_definitions enable trigger trg_audit_indicator_definitions;
