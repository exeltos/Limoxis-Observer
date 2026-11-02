-- Οι δείκτες του κανονισμού λοιμώξεων (Υ1.Γ.Π.114971, ΦΕΚ Β΄ 388/2014) που έλειπαν από τους κοινούς δείκτες:
--   · Μηνιαία επίπτωση βακτηριαιμιών από πολυανθεκτικά παθογόνα που επιτηρούνται ανά 1.000 ημέρες νοσηλείας
--   · CAUTI ανά 1.000 ημέρες ουροκαθετήρα
--   · Λοιμώξεις χειρουργικού πεδίου (χειροκίνητη τιμή: δεν υπάρχει ακόμη πηγή δεδομένων για τις επεμβάσεις)
-- Γράφεται στο ιστορικό ως ο γενικός λογαριασμός «Platform Owner». Προσθέτει μόνο γραμμές.
do $$
begin
  perform set_config('request.jwt.claims', '{"sub":"84066ee0-57b7-4cae-9186-09e491d3ea6d","role":"authenticated"}', true);
  insert into public.indicator_definitions
    (organization_id, indicator_key, version, title_el, title_en, category, numerator_definition, denominator_definition, multiplier, unit, unit_en, source_authority, effective_from, status, calculation_type, numerator_metric, denominator_metric, target_value, direction, approved_at)
  select null, v.indicator_key, '2026.1', v.title_el, v.title_en, 'surveillance', jsonb_build_object('description', v.num), jsonb_build_object('description', v.den), v.multiplier, v.unit, v.unit_en,
         'Υ1.Γ.Π.114971 (ΦΕΚ Β΄ 388/2014) · Πρόγραμμα «Προκρούστης»', date '2026-01-01', 'active', v.calc, v.num_metric, v.den_metric, v.target, 'lower', now()
  from (values
    ('mdro-bsi-per-1000-patient-days', 'Μηνιαία επίπτωση βακτηριαιμιών από πολυανθεκτικά παθογόνα', 'Monthly incidence of bacteraemia from multidrug-resistant pathogens',
     'Νέα επεισόδια βακτηριαιμίας από πολυανθεκτικά παθογόνα που επιτηρούνται', 'Σύνολο ημερών νοσηλείας', 1000::numeric, 'ανά 1.000 ημέρες νοσηλείας', 'per 1,000 patient-days', 'auto', 'mdro_bsi', 'patient_days', 1::numeric),
    ('cauti-per-1000-catheter-days', 'CAUTI ανά 1.000 ημέρες ουροκαθετήρα', 'CAUTI per 1,000 urinary-catheter days',
     'Επεισόδια CAUTI που ταξινομήθηκαν στην περίοδο', 'Ημέρες ασθενών με ουροκαθετήρα στην περίοδο', 1000, 'ανά 1.000 ημέρες ουροκαθετήρα', 'per 1,000 catheter days', 'auto', 'cauti_events', 'urinary_catheter_days', 2),
    ('ssi-rate', 'Λοιμώξεις χειρουργικού πεδίου στις επεμβάσεις που επιτηρούνται', 'Surgical site infections in the surveilled procedures',
     'Επεμβάσεις με λοίμωξη χειρουργικού πεδίου', 'Επεμβάσεις που επιτηρούνται', 100, '%', '%', 'manual', null, null, 2)
  ) as v(indicator_key, title_el, title_en, num, den, multiplier, unit, unit_en, calc, num_metric, den_metric, target)
  where not exists (select 1 from public.indicator_definitions d where d.organization_id is null and d.indicator_key = v.indicator_key);
end $$;
