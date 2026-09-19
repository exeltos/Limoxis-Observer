-- ΥΑ Υ1.Γ.Π.114971/ΦΕΚ Β 388/2014 §2.3 requires semi-annual reporting of
-- antimicrobial resistance per reference pathogen and reference antibiotic:
-- (resistant isolates of pathogen X ÷ all tested isolates of pathogen X) × 100.
-- No such metric existed at all. Adds a tested/resistant count pair per
-- ΕΟΔΥ reference pathogen, using one EARS-Net-style reference antibiotic
-- per pathogen (3rd-gen cephalosporin/carbapenem for Enterobacterales and
-- non-fermenters, oxacillin for S. aureus/MRSA, vancomycin for
-- Enterococcus/VRE), sourced from antimicrobial_susceptibility_results —
-- the same table the laboratory AST workflow already writes to.
--
-- Applies the same correctness rules already fixed for the bacteremia
-- metrics (20260919160000): only validated/amended, non-superseded
-- microbiology results are counted.

create or replace function private.indicator_metric_snapshot(p_organization_id uuid, p_from date, p_to date, p_department_id uuid default null::uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare v_scoped boolean;v_daily_count integer:=0;v_patient_days numeric:=0;v_active bigint:=0;v_resistant bigint:=0;v_hh_ok numeric:=0;v_hh_total numeric:=0;v_bundle_ok bigint:=0;v_bundle_total bigint:=0;v_abhr numeric:=0;v_staff bigint:=0;v_vaccinated bigint:=0;v_training_ok bigint:=0;v_training_total bigint:=0;v_incidents bigint:=0;v_mdro bigint:=0;
v_bact_total bigint:=0;v_bact_ecoli bigint:=0;v_bact_proteus bigint:=0;v_bact_acineto bigint:=0;v_bact_kleb bigint:=0;v_bact_entb bigint:=0;v_bact_pseudo bigint:=0;v_bact_saureus bigint:=0;v_bact_entc bigint:=0;
v_amr_t_ecoli bigint:=0;v_amr_r_ecoli bigint:=0;v_amr_t_proteus bigint:=0;v_amr_r_proteus bigint:=0;v_amr_t_acineto bigint:=0;v_amr_r_acineto bigint:=0;v_amr_t_kleb bigint:=0;v_amr_r_kleb bigint:=0;v_amr_t_entb bigint:=0;v_amr_r_entb bigint:=0;v_amr_t_pseudo bigint:=0;v_amr_r_pseudo bigint:=0;v_amr_t_saureus bigint:=0;v_amr_r_saureus bigint:=0;v_amr_t_entc bigint:=0;v_amr_r_entc bigint:=0;
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
  return jsonb_build_object('patient_days',v_patient_days,'active_surveillance',v_active,'resistant_active_surveillance',v_resistant,'hh_compliant_actions',v_hh_ok,'hh_opportunities',v_hh_total,'bundle_all_or_none_pass',v_bundle_ok,'bundle_executions',v_bundle_total,'abhr_litres',v_abhr,'active_staff',v_staff,'active_staff_with_vaccination',v_vaccinated,'training_completed',v_training_ok,'training_assignments',v_training_total,'open_high_incidents',v_incidents,'mdro_bsi',v_mdro,'bacteremia_total',v_bact_total,'bacteremia_ecoli',v_bact_ecoli,'bacteremia_proteus',v_bact_proteus,'bacteremia_acinetobacter',v_bact_acineto,'bacteremia_klebsiella',v_bact_kleb,'bacteremia_enterobacter',v_bact_entb,'bacteremia_pseudomonas',v_bact_pseudo,'bacteremia_saureus',v_bact_saureus,'bacteremia_enterococcus',v_bact_entc,'amr_tested_ecoli',v_amr_t_ecoli,'amr_resistant_ecoli',v_amr_r_ecoli,'amr_tested_proteus',v_amr_t_proteus,'amr_resistant_proteus',v_amr_r_proteus,'amr_tested_acinetobacter',v_amr_t_acineto,'amr_resistant_acinetobacter',v_amr_r_acineto,'amr_tested_klebsiella',v_amr_t_kleb,'amr_resistant_klebsiella',v_amr_r_kleb,'amr_tested_enterobacter',v_amr_t_entb,'amr_resistant_enterobacter',v_amr_r_entb,'amr_tested_pseudomonas',v_amr_t_pseudo,'amr_resistant_pseudomonas',v_amr_r_pseudo,'amr_tested_saureus',v_amr_t_saureus,'amr_resistant_saureus',v_amr_r_saureus,'amr_tested_enterococcus',v_amr_t_entc,'amr_resistant_enterococcus',v_amr_r_entc);
end;$function$;

alter table public.indicator_definitions disable trigger trg_audit_indicator_definitions;

insert into public.indicator_definitions (
  organization_id,indicator_key,version,title_el,title_en,category,numerator_metric,denominator_metric,multiplier,unit,unit_en,source_authority,status,calculation_type,direction
) values
  (null,'amr-ecoli-ceftriaxone-rate','1.0','Αντοχή E. coli σε κεφτριαξόνη','E. coli ceftriaxone resistance rate','laboratory','amr_resistant_ecoli','amr_tested_ecoli',100,'%','%','Εργαστήριο · ΕΟΔΥ · ΥΑ Υ1.Γ.Π.114971/ΦΕΚ Β 388/2014','active','auto','lower'),
  (null,'amr-proteus-ceftriaxone-rate','1.0','Αντοχή Proteus spp. σε κεφτριαξόνη','Proteus spp. ceftriaxone resistance rate','laboratory','amr_resistant_proteus','amr_tested_proteus',100,'%','%','Εργαστήριο · ΕΟΔΥ · ΥΑ Υ1.Γ.Π.114971/ΦΕΚ Β 388/2014','active','auto','lower'),
  (null,'amr-acinetobacter-meropenem-rate','1.0','Αντοχή Acinetobacter spp. σε μεροπενέμη','Acinetobacter spp. meropenem resistance rate','laboratory','amr_resistant_acinetobacter','amr_tested_acinetobacter',100,'%','%','Εργαστήριο · ΕΟΔΥ · ΥΑ Υ1.Γ.Π.114971/ΦΕΚ Β 388/2014','active','auto','lower'),
  (null,'amr-klebsiella-meropenem-rate','1.0','Αντοχή Klebsiella spp. σε μεροπενέμη','Klebsiella spp. meropenem resistance rate','laboratory','amr_resistant_klebsiella','amr_tested_klebsiella',100,'%','%','Εργαστήριο · ΕΟΔΥ · ΥΑ Υ1.Γ.Π.114971/ΦΕΚ Β 388/2014','active','auto','lower'),
  (null,'amr-enterobacter-ceftriaxone-rate','1.0','Αντοχή Enterobacter spp. σε κεφτριαξόνη','Enterobacter spp. ceftriaxone resistance rate','laboratory','amr_resistant_enterobacter','amr_tested_enterobacter',100,'%','%','Εργαστήριο · ΕΟΔΥ · ΥΑ Υ1.Γ.Π.114971/ΦΕΚ Β 388/2014','active','auto','lower'),
  (null,'amr-pseudomonas-meropenem-rate','1.0','Αντοχή Pseudomonas spp. σε μεροπενέμη','Pseudomonas spp. meropenem resistance rate','laboratory','amr_resistant_pseudomonas','amr_tested_pseudomonas',100,'%','%','Εργαστήριο · ΕΟΔΥ · ΥΑ Υ1.Γ.Π.114971/ΦΕΚ Β 388/2014','active','auto','lower'),
  (null,'amr-saureus-oxacillin-rate','1.0','Αντοχή S. aureus σε οξακιλλίνη (MRSA)','S. aureus oxacillin resistance rate (MRSA)','laboratory','amr_resistant_saureus','amr_tested_saureus',100,'%','%','Εργαστήριο · ΕΟΔΥ · ΥΑ Υ1.Γ.Π.114971/ΦΕΚ Β 388/2014','active','auto','lower'),
  (null,'amr-enterococcus-vancomycin-rate','1.0','Αντοχή Enterococcus spp. σε βανκομυκίνη (VRE)','Enterococcus spp. vancomycin resistance rate (VRE)','laboratory','amr_resistant_enterococcus','amr_tested_enterococcus',100,'%','%','Εργαστήριο · ΕΟΔΥ · ΥΑ Υ1.Γ.Π.114971/ΦΕΚ Β 388/2014','active','auto','lower')
on conflict do nothing;

alter table public.indicator_definitions enable trigger trg_audit_indicator_definitions;
