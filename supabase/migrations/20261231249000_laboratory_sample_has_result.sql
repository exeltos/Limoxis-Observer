-- «Έναρξη επεξεργασίας» δείγματος (8/11/2026): κάθε αλλαγή σε laboratory_samples σταματούσε με
-- «infinite recursion detected in policy for relation laboratory_samples». Οι πολιτικές update/delete
-- κοιτούν αν υπάρχει αποτέλεσμα στο microbiology_results, και η πολιτική ανάγνωσης του microbiology_results
-- κοιτά πάλι το laboratory_samples. Ο έλεγχος «έχει αποτέλεσμα» γίνεται εδώ χωρίς RLS, ώστε ο κύκλος να σπάσει.
-- Η αλλαγή των πολιτικών είναι στο 20261231249001_laboratory_samples_policies_no_recursion.sql (τρέχει ο ιδιοκτήτης).
create or replace function private.laboratory_sample_has_result(p_sample_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.microbiology_results mr where mr.sample_id = p_sample_id)
$$;

grant execute on function private.laboratory_sample_has_result(uuid) to authenticated;
