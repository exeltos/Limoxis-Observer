-- Συμπίεση πινάκων με κενό χώρο από παλιές μαζικές αλλαγές (μέτρηση 02/11/2026).
-- Να το τρέξει ο ιδιοκτήτης στο SQL Editor: ΜΙΑ γραμμή κάθε φορά (το VACUUM δεν τρέχει μαζί με άλλες εντολές),
-- σε ήσυχη ώρα: κάθε πίνακας κλειδώνει όσο συμπιέζεται (ο πρώτος ~10–30 δευτερόλεπτα, οι άλλοι λιγότερο από 1).
-- Τα δεδομένα δεν αλλάζουν· ξαναγράφονται συμπαγή και ξαναχτίζονται τα ευρετήριά τους.
--
--   control_executions          460 MB (179 MB γραμμές + 282 MB ευρετήρια), 162.000 εγγραφές, ~3,4× ο χώρος που χρειάζονται  → ~130 MB
--   surveillance_cases, patients, training_assignments, clinical_assessment_findings: 2–5× (μικροί πίνακες)

vacuum (full, analyze) public.control_executions;

vacuum (full, analyze) public.surveillance_cases;

vacuum (full, analyze) public.patients;

vacuum (full, analyze) public.training_assignments;

vacuum (full, analyze) public.clinical_assessment_findings;

-- Έλεγχος μετά (μόνο ανάγνωση):
-- select relname, pg_size_pretty(pg_total_relation_size(oid)) from pg_class
--  where relname in ('control_executions','surveillance_cases','patients','training_assignments','clinical_assessment_findings');
-- select pg_size_pretty(pg_database_size(current_database()));
