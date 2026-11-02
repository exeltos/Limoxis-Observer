-- Στόχοι ποιότητας 2026 για το ΙΑΣΩ Θεσσαλίας: 10 συνδεδεμένοι με δείκτες των μητρώων τμημάτων (υπολογίζονται μόνοι τους)
-- και 8 που τους καταχωρεί ο υπεύθυνος (τιμή από τον υπεύθυνο). Οι στόχοι 2023–2025 δεν αλλάζουν.
-- Προσθέτει μόνο γραμμές· ξανατρέχει χωρίς διπλότυπα (on conflict do nothing).
do $$
declare
  org uuid;
  due date := date '2026-12-31';
begin
  select id into org from public.organizations where name = 'ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ';
  if org is null then
    return;
  end if;

  insert into public.quality_objectives
    (organization_id, code, year, title, title_en, department_id, register_id, indicator_key, target, direction, unit, owner_label, due_date, status)
  select org, v.code, 2026, v.title, v.title_en, r.department_id, r.id, v.indicator_key, v.target, v.direction, v.unit, v.owner_label, due, 'active'
  from (values
    ('QO-2026-001', 'REG-002', 'readmissions_48h', 'ΜΕΘ: επανεισαγωγές εντός 48 ωρών έως 5%', 'ICU: readmissions within 48 hours up to 5%', 5::numeric, 'lower', '%', 'Διευθυντής ΜΕΘ'),
    ('QO-2026-002', 'REG-002', 'pressure_ulcers', 'ΜΕΘ: ασθενείς με κατάκλιση έως 5%', 'ICU: patients with a pressure ulcer up to 5%', 5, 'lower', '%', 'Διευθυντής ΜΕΘ'),
    ('QO-2026-003', 'REG-001', 'readmissions', 'ΜΕΝΝ: επανεισαγωγές νεογνών έως 5%', 'NICU: neonatal readmissions up to 5%', 5, 'lower', '%', 'Διευθυντής ΜΕΝΝ'),
    ('QO-2026-004', 'REG-001', 'late_infection_rate', 'ΜΕΝΝ: όψιμες λοιμώξεις έως 5 ανά 1.000 ημέρες καθετήρα', 'NICU: late infections up to 5 per 1,000 catheter days', 5, 'lower', '/1.000 ημέρες καθετήρα', 'Διευθυντής ΜΕΝΝ'),
    ('QO-2026-005', 'REG-001', 'breast_milk', 'ΜΕΝΝ: αποκλειστικά μητρικό γάλα τουλάχιστον 50%', 'NICU: exclusively breast milk at least 50%', 50, 'higher', '%', 'Διευθυντής ΜΕΝΝ'),
    ('QO-2026-006', 'REG-003', 'exclusive_bf', 'Μαιευτική: αποκλειστικός μητρικός θηλασμός τουλάχιστον 60%', 'Obstetrics: exclusive breastfeeding at least 60%', 60, 'higher', '%', 'Προϊσταμένη Μαιευτικής'),
    ('QO-2026-007', 'REG-005', 'complications', 'Αιμοδυναμικό: επιπλοκές έως 2%', 'Cath lab: complications up to 2%', 2, 'lower', '%', 'Υπεύθυνος Αιμοδυναμικού'),
    ('QO-2026-008', 'REG-010', 'readmissions', 'Παιδιατρική: επανεισαγωγές εντός 30 ημερών έως 5%', 'Paediatrics: readmissions within 30 days up to 5%', 5, 'lower', '%', 'Διευθυντής Παιδιατρικής'),
    ('QO-2026-009', 'REG-010', 'hai', 'Παιδιατρική: λοιμώξεις σχετιζόμενες με τη νοσηλεία έως 2%', 'Paediatrics: healthcare-associated infections up to 2%', 2, 'lower', '%', 'Διευθυντής Παιδιατρικής'),
    ('QO-2026-010', 'REG-010', 'falls', 'Παιδιατρική: πτώσεις ασθενών — μηδέν', 'Paediatrics: patient falls — zero', 0, 'lower', null, 'Προϊσταμένη Παιδιατρικής')
  ) as v(code, register_code, indicator_key, title, title_en, target, direction, unit, owner_label)
  join public.department_registers r on r.organization_id = org and r.code = v.register_code
  on conflict (organization_id, code) do nothing;

  insert into public.quality_objectives
    (organization_id, code, year, title, title_en, target, direction, unit, owner_label, due_date, status)
  select org, v.code, 2026, v.title, v.title_en, v.target, v.direction, v.unit, v.owner_label, due, 'active'
  from (values
    ('QO-2026-011', 'Ικανοποίηση ασθενών τουλάχιστον 90%', 'Patient satisfaction at least 90%', 90::numeric, 'higher', '%', 'Υπεύθυνος Ποιότητας'),
    ('QO-2026-012', 'Υγιεινή χεριών νοσηλευτικού προσωπικού τουλάχιστον 70%', 'Hand hygiene compliance, nursing staff, at least 70%', 70, 'higher', '%', 'Επιτροπή Λοιμώξεων'),
    ('QO-2026-013', 'Υγιεινή χεριών ιατρών τουλάχιστον 70%', 'Hand hygiene compliance, physicians, at least 70%', 70, 'higher', '%', 'Επιτροπή Λοιμώξεων'),
    ('QO-2026-014', 'Συμμόρφωση στους εσωτερικούς ελέγχους τουλάχιστον 95%', 'Compliance in internal audits at least 95%', 95, 'higher', '%', 'Υπεύθυνος Ποιότητας'),
    ('QO-2026-015', 'Major μη συμμορφώσεις — μηδέν', 'Major nonconformities — zero', 0, 'lower', null, 'Υπεύθυνος Ποιότητας'),
    ('QO-2026-016', 'Εκπαίδευση προσωπικού τουλάχιστον 70%', 'Staff training at least 70%', 70, 'higher', '%', 'Υπεύθυνος Εκπαίδευσης'),
    ('QO-2026-017', 'Εργατικά ατυχήματα — μηδέν', 'Work accidents — zero', 0, 'lower', null, 'Τεχνικός Ασφαλείας'),
    ('QO-2026-018', 'Αντιγριπικός εμβολιασμός προσωπικού τουλάχιστον 70%', 'Staff influenza vaccination at least 70%', 70, 'higher', '%', 'Ιατρός Εργασίας')
  ) as v(code, title, title_en, target, direction, unit, owner_label)
  on conflict (organization_id, code) do nothing;
end $$;
