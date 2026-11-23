-- Μετρήσεις του πραγματικού Demo («Demo Νοσοκομείο») για το τεστ ευθυγράμμισης με την προεπισκόπηση βοήθειας.
-- Μόνο ανάγνωση. Το αποτέλεσμα αντιγράφεται στο tests/fixtures/demoSnapshot.json (πεδίο "counts").
select 'departments' as key, count(*)::int as n from departments where organization_id = '9fdc7fb5-c514-41c0-8fac-0b39ba0c8735'
union all select 'employees', count(*)::int from employees where organization_id = '9fdc7fb5-c514-41c0-8fac-0b39ba0c8735'
union all select 'patients', count(*)::int from patients where organization_id = '9fdc7fb5-c514-41c0-8fac-0b39ba0c8735';
