-- Στόχοι στους κοινούς δείκτες της πλατφόρμας που δεν είχαν (εγκρίθηκαν από τον ιδιοκτήτη).
-- Ο έλεγχος ιστορικού (private.audit_management_change) ζητά συνδεδεμένο χρήστη: η αλλαγή γράφεται
-- στο ιστορικό ως ο γενικός λογαριασμός «Platform Owner», όχι με προσωπικό όνομα.
-- Ενημερώνει μόνο όπου ο στόχος είναι κενός. Οι νέες απομονώσεις MDR, τα φαρμακευτικά συμβάντα και οι
-- αντοχές του εργαστηρίου μένουν χωρίς στόχο (εξαρτώνται από το μέγεθος του νοσοκομείου ή θέλουμε να αναφέρονται).
do $$
begin
  perform set_config('request.jwt.claims', '{"sub":"84066ee0-57b7-4cae-9186-09e491d3ea6d","role":"authenticated"}', true);
  update public.indicator_definitions d
  set target_value = v.target,
      direction = coalesce(v.direction, d.direction)
  from (values
    ('clabsi-per-1000-cvc-days', 2::numeric, null::text),
    ('vap-per-1000-ventilator-days', 5, null),
    ('hai-prevalence-pps', 7, null),
    ('antibiotic-use-prevalence-pps', 35, null),
    ('antibiotic-ddd-per-100-patient-days', 80, null),
    ('patient-falls-per-1000-patient-days', 3, null),
    ('quality-risks-high', 0, null),
    ('abhr-use', 20, 'higher'),
    ('vaccination-coverage', 70, 'higher')
  ) as v(indicator_key, target, direction)
  where d.organization_id is null and d.status = 'active' and d.indicator_key = v.indicator_key and d.target_value is null;
end $$;
