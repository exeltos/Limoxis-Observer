-- Recycle bin: an employee screening (with what hangs from it) can be deleted to the bin too.
-- Only the list of tables grows; the rules of who may delete stay in bin_delete.
create or replace function private.bin_module(p_table text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select case when p_table = any(array[
    'patients', 'patient_admissions', 'surveillance_cases', 'clinical_assessments',
    'surveillance_reassessments', 'hai_classifications', 'isolation_episodes',
    'antimicrobial_therapies', 'antimicrobial_therapy_administrations', 'laboratory_samples',
    'surveillance_devices', 'surveillance_outcomes', 'surveillance_events',
    'patient_clinical_scale_assessments', 'prevention_bundle_assessments',
    'surveillance_case_questionnaires', 'surveillance_surgical_procedures',
    'clinical_protocol_runs', 'notifiable_disease_reports',
    'employee_surveillance_records'
  ]) then 'clinical' end;
$function$;
