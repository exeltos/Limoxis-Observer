-- Οι 8 στόχοι ποιότητας 2026 του ΙΑΣΩ που έλειπαν: συνδέονται με δείκτες μητρώων που έχουν στόχο
-- και δεν έχουν δική τους τιμή (target null), οπότε παίρνουν τον στόχο από τον ορισμό του δείκτη.
-- Προσθέτει μόνο γραμμές· ξανατρέχει χωρίς διπλότυπα.
do $$
declare
  org uuid;
begin
  select id into org from public.organizations where name = 'ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ';
  if org is null then
    return;
  end if;

  insert into public.quality_objectives
    (organization_id, code, year, title, title_en, department_id, register_id, indicator_key, target, direction, unit, owner_label, due_date, status)
  select org, v.code, 2026, v.title, v.title_en, r.department_id, r.id, v.indicator_key, null, i.direction, i.unit_el, v.owner_label, date '2026-12-31', 'active'
  from (values
    ('QO-2026-019', 'REG-001', 'mortality', 'ΜΕΝΝ: θνησιμότητα', 'NICU: mortality', 'Διευθυντής ΜΕΝΝ'),
    ('QO-2026-020', 'REG-001', 'mean_los', 'ΜΕΝΝ: μέση διάρκεια νοσηλείας', 'NICU: mean length of stay', 'Διευθυντής ΜΕΝΝ'),
    ('QO-2026-021', 'REG-001', 'no_breast_milk', 'ΜΕΝΝ: νεογνά χωρίς μητρικό γάλα', 'NICU: neonates without breast milk', 'Διευθυντής ΜΕΝΝ'),
    ('QO-2026-022', 'REG-002', 'mortality', 'ΜΕΘ: θνησιμότητα', 'ICU: mortality', 'Διευθυντής ΜΕΘ'),
    ('QO-2026-023', 'REG-002', 'mean_icu_days', 'ΜΕΘ: μέσες ημέρες νοσηλείας', 'ICU: mean days in the unit', 'Διευθυντής ΜΕΘ'),
    ('QO-2026-024', 'REG-003', 'antenatal', 'Μαιευτική: λεχωίδες με προγεννητικά μαθήματα', 'Obstetrics: mothers with antenatal classes', 'Προϊσταμένη Μαιευτικής'),
    ('QO-2026-025', 'REG-004', 'cs_rate', 'Αίθουσα Τοκετών: ποσοστό καισαρικών τομών', 'Delivery room: caesarean section rate', 'Διευθυντής Μαιευτικής'),
    ('QO-2026-026', 'REG-010', 'picu', 'Παιδιατρική: μεταφορές σε ΜΕΘ Παίδων', 'Paediatrics: transfers to the paediatric ICU', 'Διευθυντής Παιδιατρικής')
  ) as v(code, register_code, indicator_key, title, title_en, owner_label)
  join public.department_registers r on r.organization_id = org and r.code = v.register_code
  join public.department_register_indicators i on i.register_id = r.id and i.key = v.indicator_key
  on conflict (organization_id, code) do nothing;
end $$;
