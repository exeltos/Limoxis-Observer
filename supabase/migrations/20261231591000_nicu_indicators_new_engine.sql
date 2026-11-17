-- ΜΕΝΝ, δεύτερο μέρος (εφαρμόζεται μαζί με τον κώδικα που διαβάζει «a|b» και «a+b»): % που διατήρησαν μητρικό γάλα
-- (όποιου είδους), % με ομφαλικό καθετήρα, και οι όψιμες λοιμώξεις ανά όλες τις ημέρες κεντρικού καθετήρα
-- (PICC/διαδερμικός + ομφαλικός, NHSN/ECDC για νεογνά· το PICC ενώθηκε στο 20261231592000).
with regs as (select id, organization_id from public.department_registers where template_key = 'nicu'),
defs(key, position, title_el, title_en, aggregation, field_key, date_field_key, unit_el, unit_en, direction) as (values
  ('breast_milk_kept',14,'% που διατήρησαν μητρικό γάλα','% keeping breast milk','percent',null,'discharge_date','%','%','higher'),
  ('umbilical_rate',21,'% με ομφαλικό καθετήρα','% with an umbilical catheter','percent',null,'discharge_date','%','%','context')
),
ins as (
  insert into public.department_register_indicators (organization_id, register_id, key, position, title_el, title_en, aggregation, field_key, date_field_key, unit_el, unit_en, direction)
  select r.organization_id, r.id, d.key, d.position, d.title_el, d.title_en, d.aggregation, d.field_key, d.date_field_key, d.unit_el, d.unit_en, d.direction
  from regs r cross join defs d
  where not exists (select 1 from public.department_register_indicators i where i.register_id = r.id and i.key = d.key)
  returning id, organization_id, register_id, key
),
f(key, part, position, field_key, op, value) as (values
  ('breast_milk_kept','numerator',0,'breast_milk','eq','kept|exclusive|mixed|unspecified'),
  ('breast_milk_kept','denominator',0,'breast_milk','filled',null),
  ('umbilical_rate','numerator',0,'umbilical_catheter','eq','yes|venous|arterial|both|unspecified'),
  ('umbilical_rate','denominator',0,'umbilical_catheter','filled',null)
)
insert into public.department_register_indicator_filters (organization_id, register_id, indicator_id, part, position, field_key, op, value)
select ins.organization_id, ins.register_id, ins.id, f.part, f.position, f.field_key, f.op, f.value from ins join f on f.key = ins.key;

update public.department_register_indicators i set denominator_field_key = 'central_line_days+umbilical_days'
where i.key = 'late_infection_rate' and i.denominator_field_key = 'central_line_days'
  and i.register_id in (select id from public.department_registers where template_key = 'nicu');
