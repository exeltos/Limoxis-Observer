-- ΜΕΝΝ (ιδιοκτήτης 17/11/2026): νέοι δείκτες από ό,τι ήδη καταγράφει το μητρώο νεογνών, σε κάθε μητρώο ΜΕΝΝ
-- (ΙΑΣΩ και demo): διατήρηση μητρικού γάλακτος (όποιου είδους), πρόωρα, χαμηλό βάρος, αερισμός, CPAP, ομφαλικός,
-- διαδερμικός καθετήρας και PICC line χωριστά (ποσοστό και μέσες ημέρες), παρεντερική διατροφή, μεταφορές.
-- Νέο πεδίο «Ημέρες ομφαλικού καθετήρα» (umbilical_days) στη φόρμα, και οι όψιμες λοιμώξεις μετρούν πλέον όλες τις ημέρες
-- κεντρικού καθετήρα: διαδερμικός + PICC + ομφαλικός (NHSN/ECDC για νεογνά).
-- Μόνο insert/update· ό,τι υπάρχει ήδη δεν αγγίζεται (on conflict / not exists).
with regs as (select id, organization_id from public.department_registers where template_key = 'nicu'),
defs(key, position, title_el, title_en, aggregation, field_key, date_field_key, unit_el, unit_en, direction) as (values
  ('breast_milk_kept',14,'% που διατήρησαν μητρικό γάλα','% keeping breast milk','percent',null,'discharge_date','%','%','higher'),
  ('preterm_rate',15,'% πρόωρα (< 37 εβδομάδες)','% preterm (< 37 weeks)','percent',null,'discharge_date','%','%','context'),
  ('very_preterm_rate',16,'% πολύ πρόωρα (< 32 εβδομάδες)','% very preterm (< 32 weeks)','percent',null,'discharge_date','%','%','context'),
  ('lbw_rate',17,'% χαμηλό βάρος γέννησης (< 2.500 g)','% low birth weight (< 2,500 g)','percent',null,'discharge_date','%','%','context'),
  ('vlbw_rate',18,'% πολύ χαμηλό βάρος γέννησης (< 1.500 g)','% very low birth weight (< 1,500 g)','percent',null,'discharge_date','%','%','context'),
  ('ventilator_rate',19,'% σε μηχανικό αερισμό','% on mechanical ventilation','percent',null,'discharge_date','%','%','context'),
  ('cpap_rate',20,'% σε CPAP','% on CPAP','percent',null,'discharge_date','%','%','context'),
  ('umbilical_rate',21,'% με ομφαλικό καθετήρα','% with an umbilical catheter','percent',null,'discharge_date','%','%','context'),
  ('central_line_rate',22,'% με διαδερμικό καθετήρα','% with a percutaneous central line','percent',null,'discharge_date','%','%','context'),
  ('mean_central_line',23,'Μέσες ημέρες διαδερμικού καθετήρα','Mean percutaneous central line days','mean','central_line_days','discharge_date','ημέρες','days','lower'),
  ('picc_rate',24,'% με PICC line','% with a PICC line','percent',null,'discharge_date','%','%','context'),
  ('mean_picc',25,'Μέσες ημέρες PICC line','Mean PICC line days','mean','picc_days','discharge_date','ημέρες','days','lower'),
  ('tpn_rate',26,'% σε παρεντερική διατροφή','% on parenteral nutrition','percent',null,'discharge_date','%','%','context'),
  ('transfer_rate',27,'% μεταφορές σε άλλο νοσοκομείο','% transferred to another hospital','percent',null,'discharge_date','%','%','context')
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
  ('preterm_rate','numerator',0,'gestation','lt','259'),
  ('preterm_rate','denominator',0,'gestation','filled',null),
  ('very_preterm_rate','numerator',0,'gestation','lt','224'),
  ('very_preterm_rate','denominator',0,'gestation','filled',null),
  ('lbw_rate','numerator',0,'birth_weight','lt','2500'),
  ('lbw_rate','denominator',0,'birth_weight','filled',null),
  ('vlbw_rate','numerator',0,'birth_weight','lt','1500'),
  ('vlbw_rate','denominator',0,'birth_weight','filled',null),
  ('ventilator_rate','numerator',0,'ventilator_days','gt','0'),
  ('cpap_rate','numerator',0,'cpap_days','gt','0'),
  ('umbilical_rate','numerator',0,'umbilical_catheter','eq','yes|venous|arterial|both|unspecified'),
  ('umbilical_rate','denominator',0,'umbilical_catheter','filled',null),
  ('central_line_rate','numerator',0,'central_line_days','gt','0'),
  ('mean_central_line','numerator',0,'central_line_days','gt','0'),
  ('picc_rate','numerator',0,'picc_days','gt','0'),
  ('mean_picc','numerator',0,'picc_days','gt','0'),
  ('tpn_rate','numerator',0,'tpn_days','gt','0'),
  ('transfer_rate','numerator',0,'outcome','eq','transfer_hospital'),
  ('transfer_rate','denominator',0,'outcome','filled',null)
)
insert into public.department_register_indicator_filters (organization_id, register_id, indicator_id, part, position, field_key, op, value)
select ins.organization_id, ins.register_id, ins.id, f.part, f.position, f.field_key, f.op, f.value from ins join f on f.key = ins.key;

update public.department_register_indicators i set denominator_field_key = 'central_line_days+picc_days+umbilical_days'
where i.key = 'late_infection_rate' and i.denominator_field_key = 'central_line_days'
  and i.register_id in (select id from public.department_registers where template_key = 'nicu');

-- Το πεδίο «Ημέρες ομφαλικού καθετήρα», αμέσως μετά τον «Ομφαλικό καθετήρα», και η στήλη του στον πίνακα του μητρώου.
do $field$
declare
  reg record;
  at integer;
begin
  for reg in select r.id, r.organization_id, r.table_name from public.department_registers r where r.template_key = 'nicu' and r.table_name is not null loop
    if exists (select 1 from public.department_register_fields f where f.register_id = reg.id and f.key = 'umbilical_days') then continue; end if;
    select f.position + 1 into at from public.department_register_fields f where f.register_id = reg.id and f.key = 'umbilical_catheter';
    if at is null then continue; end if;
    update public.department_register_fields set position = position + 1 where register_id = reg.id and position >= at;
    insert into public.department_register_fields (organization_id, register_id, key, position, section_key, field_type, label_el, label_en, unit_el, unit_en, min_value, max_value, show_when_key)
    values (reg.organization_id, reg.id, 'umbilical_days', at, 'stay', 'number', 'Ημέρες ομφαλικού καθετήρα', 'Umbilical catheter days', 'ημέρες', 'days', 0, 60, 'umbilical_catheter');
    execute format('alter table public.%I add column if not exists umbilical_days numeric', reg.table_name);
  end loop;
end
$field$;
