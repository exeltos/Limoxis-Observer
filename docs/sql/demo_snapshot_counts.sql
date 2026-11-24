-- Μετρήσεις του πραγματικού Demo («Demo Νοσοκομείο») για το τεστ ευθυγράμμισης με την προεπισκόπηση βοήθειας.
-- Μόνο ανάγνωση. Το αποτέλεσμα αντιγράφεται στο tests/fixtures/demoSnapshot.json (πεδίο "counts").
select 'departments' as key, count(*)::int as n from departments where organization_id = '9fdc7fb5-c514-41c0-8fac-0b39ba0c8735'
union all select 'employees', count(*)::int from employees where organization_id = '9fdc7fb5-c514-41c0-8fac-0b39ba0c8735'
union all select 'patients', count(*)::int from patients where organization_id = '9fdc7fb5-c514-41c0-8fac-0b39ba0c8735'
union all select 'employee_vaccinations', count(*)::int from employee_vaccinations where organization_id = '9fdc7fb5-c514-41c0-8fac-0b39ba0c8735'
union all select 'employee_certificates', count(*)::int from employee_certificates where organization_id = '9fdc7fb5-c514-41c0-8fac-0b39ba0c8735'
union all select 'employee_evaluations', count(*)::int from employee_evaluations where organization_id = '9fdc7fb5-c514-41c0-8fac-0b39ba0c8735'
union all select 'patient_admissions', count(*)::int from patient_admissions where organization_id = '9fdc7fb5-c514-41c0-8fac-0b39ba0c8735'
union all select 'laboratory_samples', count(*)::int from laboratory_samples where organization_id = '9fdc7fb5-c514-41c0-8fac-0b39ba0c8735'
union all select 'control_definitions', count(*)::int from control_definitions where organization_id = '9fdc7fb5-c514-41c0-8fac-0b39ba0c8735'
union all select 'control_assignments', count(*)::int from control_assignments where organization_id = '9fdc7fb5-c514-41c0-8fac-0b39ba0c8735'
union all select 'control_executions', count(*)::int from control_executions where organization_id = '9fdc7fb5-c514-41c0-8fac-0b39ba0c8735'
union all select 'indicator_snapshots', count(*)::int from indicator_snapshots where organization_id = '9fdc7fb5-c514-41c0-8fac-0b39ba0c8735'
union all select 'antibiotic_dispensing_periods', count(*)::int from antibiotic_dispensing_periods where organization_id = '9fdc7fb5-c514-41c0-8fac-0b39ba0c8735';
