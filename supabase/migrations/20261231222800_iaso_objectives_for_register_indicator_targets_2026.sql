select set_config('request.jwt.claims', '{"sub":"84066ee0-57b7-4cae-9186-09e491d3ea6d","role":"authenticated"}', true);
-- ΙΑΣΩ: στόχος νοσοκομείου 2026 (επιπέδου τμήματος) για κάθε δείκτη μητρώου που έχει στόχο και δεν είχε ακόμα, ώστε οι Στόχοι να
-- αντιστοιχούν στους Δείκτες. Η τιμή μένει κενή: ο στόχος παίρνει την τιμή του δείκτη του μητρώου. Εφαρμόστηκε ήδη στη βάση του ΙΑΣΩ.
with todo as (
  select i.register_id, i.key, i.title_el, i.direction, i.unit_el, r.name_el,
    case when r.name_el like '%ΤΕΠ%' then 'ΤΕΠ' when r.name_el like '%ΜΕΘ%' then 'ΜΕΘ' when r.name_el like '%λεχωίδων%' then 'Μαιευτική' when r.name_el like '%ΜΕΝΝ%' then 'ΜΕΝΝ' when r.name_el like '%Παιδιατρικής%' then 'Παιδιατρική' else r.name_el end as prefix,
    case when r.name_el like '%ΤΕΠ%' then 'Υπεύθυνος Ποιότητας' when r.name_el like '%ΜΕΘ%' then 'Διευθυντής ΜΕΘ' when r.name_el like '%λεχωίδων%' then 'Προϊσταμένη Μαιευτικής' when r.name_el like '%ΜΕΝΝ%' then 'Διευθυντής ΜΕΝΝ' when r.name_el like '%Παιδιατρικής%' then 'Διευθυντής Παιδιατρικής' else 'Υπεύθυνος Ποιότητας' end as owner,
    row_number() over (order by r.name_el, i.position) rn
  from department_register_indicators i join department_registers r on r.id = i.register_id
  where i.organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd' and not i.archived and i.target is not null
    and not exists (select 1 from quality_objectives o where o.organization_id = i.organization_id and o.year = 2026 and o.register_id = i.register_id and o.indicator_key = i.key))
insert into quality_objectives (organization_id, code, year, level, title, register_id, indicator_key, target, direction, unit, owner_label, due_date, status, created_by)
select '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd',
       'QO-2026-' || lpad(((select coalesce(max(substring(code from 9)::int), 0) from quality_objectives where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd' and year = 2026 and code ~ '^QO-2026-[0-9]+$') + rn)::text, 3, '0'),
       2026, 'department', prefix || ': ' || title_el, register_id, key, null, direction, unit_el, owner, '2026-12-31', 'active', '84066ee0-57b7-4cae-9186-09e491d3ea6d'
from todo
where exists (select 1 from organizations where id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd')
  and exists (select 1 from auth.users where id = '84066ee0-57b7-4cae-9186-09e491d3ea6d');
