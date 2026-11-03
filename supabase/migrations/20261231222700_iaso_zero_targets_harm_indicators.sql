select set_config('request.jwt.claims', '{"sub":"84066ee0-57b7-4cae-9186-09e491d3ea6d","role":"authenticated"}', true);
-- ΙΑΣΩ: στόχος μηδέν για τους δείκτες βλάβης (CAUTI, CLABSI, VAP, λοιμώξεις χειρουργικού πεδίου, πτώσεις) στους στόχους 2026 του νοσοκομείου
-- και για τους δείκτες «ανά 1.000 ημέρες νοσηλείας» της Παιδιατρικής (λοιμώξεις, πτώσεις, φλεβίτιδα). Εφαρμόστηκε ήδη στη βάση του ΙΑΣΩ.
update quality_objectives set target = 0, direction = 'lower'
where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd' and year = 2026 and code in ('QO-2026-050','QO-2026-051','QO-2026-057','QO-2026-059','QO-2026-061')
  and platform_indicator_key in ('cauti-per-1000-catheter-days','clabsi-per-1000-cvc-days','patient-falls-per-1000-patient-days','ssi-rate','vap-per-1000-ventilator-days');

update department_register_indicators i set target = 0, direction = 'lower'
from department_registers g
where g.id = i.register_id and g.organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd' and g.name_el = 'Μητρώο νοσηλευομένων Παιδιατρικής' and i.target is null and not i.archived
  and i.title_el in ('Λοιμώξεις νοσηλείας ανά 1.000 ημέρες νοσηλείας','Πτώσεις ανά 1.000 ημέρες νοσηλείας','Φλεβίτιδα ανά 1.000 ημέρες περιφερικού καθετήρα');
