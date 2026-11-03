select set_config('request.jwt.claims', '{"sub":"84066ee0-57b7-4cae-9186-09e491d3ea6d","role":"authenticated"}', true);
-- ΙΑΣΩ: στόχος νοσοκομείου 2026 για κάθε δείκτη της πλατφόρμας που έχει προεπιλεγμένο στόχο στον ορισμό του και δεν έχει ακόμα στόχο,
-- ώστε η καρτέλα «Στόχοι» να δείχνει όσους στόχους φαίνονται δίπλα στους δείκτες. Η τιμή μένει κενή: ο στόχος παίρνει την τιμή του
-- δείκτη (και την ακολουθεί) μέχρι να οριστεί δική του τιμή από τη φόρμα του στόχου.
-- Δεν παίρνουν στόχο οι δείκτες που το νοσοκομείο έχει απενεργοποιήσει (organization_indicator_settings).
-- Ο αντιγριπικός εμβολιασμός (QO-2026-018) υπήρχε ήδη χωρίς σύνδεση· συνδέεται με τον δείκτη του.
update quality_objectives set platform_indicator_key = 'vaccination-coverage'
where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd' and code = 'QO-2026-018' and platform_indicator_key is null
  and exists (select 1 from indicator_definitions where organization_id is null and indicator_key = 'vaccination-coverage');

insert into quality_objectives (organization_id, code, year, level, title, platform_indicator_key, target, direction, unit, owner_label, due_date, status, created_by)
select '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd',
       'QO-2026-' || lpad((29 + row_number() over (order by d.indicator_key))::text, 3, '0'),
       2026, 'hospital', d.title_el, d.indicator_key, null, d.direction, d.unit,
       case when d.indicator_key like 'kitchen-%' or d.indicator_key like 'supplier-%' or d.indicator_key like 'quality-%' or d.indicator_key like 'eody-%' then 'Υπεύθυνος Ποιότητας' else 'Επιτροπή Λοιμώξεων' end,
       '2026-12-31', 'active', '84066ee0-57b7-4cae-9186-09e491d3ea6d'
from indicator_definitions d
where d.organization_id is null and coalesce(d.status, 'active') <> 'retired' and d.target_value is not null
  and d.indicator_key <> 'vaccination-coverage'
  and not exists (select 1 from organization_indicator_settings s where s.organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd' and s.indicator_key = d.indicator_key and s.enabled = false)
  and not exists (select 1 from quality_objectives o where o.organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd' and o.year = 2026 and o.platform_indicator_key = d.indicator_key)
  and exists (select 1 from organizations where id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd')
  and exists (select 1 from auth.users where id = '84066ee0-57b7-4cae-9186-09e491d3ea6d');
