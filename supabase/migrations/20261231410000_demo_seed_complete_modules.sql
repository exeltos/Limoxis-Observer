-- Το πακέτο δεδομένων Demo γεμίζει πλέον και τις ενότητες που ήταν άδειες:
-- βάρδιες, κανονισμοί, πρωτόκολλα, μητρώα τμημάτων, συνεντεύξεις, προμηθευτές
-- και εξοπλισμός, συναντήσεις τμημάτων, ανασκόπηση, στόχοι, αυτοαξιολόγηση,
-- ερωτηματολόγια ικανοποίησης και ανάκληση κουζίνας. Κατά τα άλλα ίδιο με το
-- 20261123110200.
create or replace function private.demo_seed_data(p_organization_id uuid, p_actor uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
begin
  if p_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations o where o.id = v_org and o.is_demo) then
    raise exception 'Only Demo organizations can be filled with Demo data' using errcode = '42501';
  end if;
  perform set_config('limoxis.test_reset', 'on', true);
  perform private.demo_seed_departments_patients(v_org, p_actor);
  perform private.demo_seed_surveillance(v_org, p_actor);
  perform private.demo_seed_laboratory(v_org, p_actor);
  perform private.demo_seed_microbiology(v_org, p_actor);
  perform private.demo_seed_susceptibility(v_org, p_actor);
  perform private.demo_seed_hand_hygiene_employees(v_org, p_actor);
  perform private.demo_seed_patient_days(v_org, p_actor);
  perform private.demo_seed_incidents(v_org, p_actor);
  perform private.demo_seed_capa(v_org, p_actor);
  perform private.demo_seed_documents(v_org, p_actor);
  perform private.demo_seed_committees(v_org, p_actor);
  perform private.demo_seed_controls(v_org, p_actor);
  perform private.demo_seed_training(v_org, p_actor);
  perform private.demo_seed_pharmacy(v_org, p_actor);
  perform private.demo_seed_occupational_health(v_org, p_actor);
  perform private.demo_seed_prevention(v_org, p_actor);
  -- Full, coherent data in every screen (20261018120000).
  perform private.demo_seed_clinical(v_org, p_actor);
  perform private.demo_seed_current_month(v_org, p_actor);
  perform private.demo_seed_quality(v_org, p_actor);
  perform private.demo_seed_people_clinical_scales(v_org, p_actor);
  perform private.demo_seed_people_training(v_org, p_actor);
  perform private.demo_seed_people_employees(v_org, p_actor);
  perform private.demo_seed_people_occupational_health(v_org, p_actor);
  perform private.demo_seed_governance(v_org, p_actor);
  -- The kitchen (HACCP), 20261123110200.
  perform private.demo_seed_kitchen(v_org, p_actor);
  -- Οι ενότητες που ήταν άδειες στα Demo (20261231350000–20261231390000).
  perform private.demo_seed_rosters_regulations(v_org, p_actor);
  perform private.demo_seed_registers(v_org, p_actor);
  perform private.demo_seed_interviews(v_org, p_actor);
  perform private.demo_seed_quality_resources(v_org, p_actor);
  perform private.demo_seed_quality_governance(v_org, p_actor);
  return jsonb_build_object(
    'ok', true,
    'departments', (select count(*) from public.departments x where x.organization_id = v_org),
    'patients', (select count(*) from public.patients x where x.organization_id = v_org),
    'surveillanceCases', (select count(*) from public.surveillance_cases x where x.organization_id = v_org),
    'laboratorySamples', (select count(*) from public.laboratory_samples x where x.organization_id = v_org),
    'microbiologyResults', (select count(*) from public.microbiology_results x where x.organization_id = v_org),
    'handHygieneSessions', (select count(*) from public.hand_hygiene_sessions x where x.organization_id = v_org),
    'employees', (select count(*) from public.employees x where x.organization_id = v_org),
    'incidents', (select count(*) from public.quality_incidents x where x.organization_id = v_org),
    'capa', (select count(*) from public.quality_capa_actions x where x.organization_id = v_org),
    'documents', (select count(*) from public.controlled_documents x where x.organization_id = v_org),
    'committees', (select count(*) from public.committees x where x.organization_id = v_org),
    'controls', (select count(*) from public.control_definitions x where x.organization_id = v_org),
    'controlExecutions', (select count(*) from public.control_executions x where x.organization_id = v_org),
    'trainingPrograms', (select count(*) from public.training_programs x where x.organization_id = v_org),
    'trainingAssignments', (select count(*) from public.training_assignments x where x.organization_id = v_org),
    'antibioticDispensing', (select count(*) from public.antibiotic_dispensing_periods x where x.organization_id = v_org),
    'vaccinations', (select count(*) from public.employee_vaccinations x where x.organization_id = v_org),
    'occupationalVisits', (select count(*) from public.occupational_health_visits x where x.organization_id = v_org),
    'exposures', (select count(*) from public.occupational_exposure_incidents x where x.organization_id = v_org),
    'wasteRecords', (select count(*) from public.waste_measurements x where x.organization_id = v_org),
    'antisepticRecords', (select count(*) from public.antiseptic_consumption_periods x where x.organization_id = v_org),
    'bundleAudits', (select count(*) from public.prevention_bundle_assessments x where x.organization_id = v_org),
    'kitchenReceipts', (select count(*) from public.kitchen_receipts x where x.organization_id = v_org),
    'rosters', (select count(*) from public.department_rosters x where x.organization_id = v_org),
    'regulations', (select count(*) from public.regulations x where x.organization_id = v_org),
    'registers', (select count(*) from public.department_registers x where x.organization_id = v_org),
    'candidates', (select count(*) from public.hr_candidates x where x.organization_id = v_org),
    'suppliers', (select count(*) from public.quality_suppliers x where x.organization_id = v_org),
    'equipment', (select count(*) from public.quality_equipment x where x.organization_id = v_org),
    'departmentMeetings', (select count(*) from public.quality_department_meetings x where x.organization_id = v_org),
    'objectives', (select count(*) from public.quality_objectives x where x.organization_id = v_org)
  );
end;
$function$;
