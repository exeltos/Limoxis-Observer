-- Αίθουσα Τοκετών ΙΑΣΩ (REG-004), έλεγχος δεικτών 2/11/2026 (εγκρίθηκε από τον ιδιοκτήτη):
-- 1) «% πολύδυμων που γεννήθηκαν με καισαρική»: παρονομαστής οι πολύδυμοι τοκετοί (καισαρική + φυσιολογικός), όχι όλοι (2026: 2,2% → 95,8%).
-- 2) «% φυσιολογικών μετά από καισαρική»: δεν καταγράφονται οι γυναίκες με προηγούμενη καισαρική, άρα γίνεται πλήθος χωρίς στόχο.
-- 3) «% καισαρικών τομών»: στόχος ≤ 55, όριο 65, όπως στο Μητρώο λεχωίδων Μαιευτικής (REG-003).
-- 4) Δύο εγγραφές του FileMaker που είναι αθροίσματα πολλών μηνών μετριούνται ως «σύνολο περιόδου» (νέα στήλη period_end):
--    1/12/2023 (1.451 τοκετοί) → όλο το 2023 · 1/2/2024 (338 τοκετοί) → Ιανουάριος–Φεβρουάριος 2024.
--    Μετρούν στο σύνολο του έτους, όχι σε έναν μήνα. Τίποτα δεν σβήνεται.
-- 5) Νέοι δείκτες πλήθους χωρίς στόχο: περιδέσεις τραχήλου, παρακολουθήσεις κύησης.
do $$
declare
  org uuid := '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd';
  rid uuid;
begin
  select id into rid from public.department_registers where organization_id = org and code = 'REG-004' and table_name = 'register_deliveryroom_c1b3757d';
  if rid is null then return; end if;

  update public.department_register_indicators set denominator_rows = array['multiple_cs','multiple_vaginal']
   where register_id = rid and key = 'multiple_cs_rate';

  update public.department_register_indicators
     set title_el = 'Φυσιολογικοί τοκετοί μετά από καισαρική', title_en = 'Vaginal births after caesarean',
         aggregation = 'sum', denominator_rows = '{}', unit_el = null, unit_en = null, target = null, threshold = null, direction = 'context'
   where register_id = rid and key = 'vbac_rate';

  update public.department_register_indicators set target = '55', threshold = '65', direction = 'lower'
   where register_id = rid and key = 'cs_rate';

  insert into public.department_register_indicators (organization_id, register_id, key, position, title_el, title_en, aggregation, sheet_rows, denominator_rows, multiplier, direction, archived, daily_only)
  select org, rid, v.key, v.pos, v.el, v.en, 'sum', array[v.row], '{}', 1, 'context', false, false
  from (values ('cerclages', 8, 'Περιδέσεις τραχήλου', 'Cervical cerclages', 'cerclage'),
               ('pregnancy_monitoring', 9, 'Παρακολουθήσεις κύησης', 'Pregnancy monitoring', 'pregnancy_monitoring')) as v(key, pos, el, en, row)
  where not exists (select 1 from public.department_register_indicators i where i.register_id = rid and i.key = v.key);
end
$$;

alter table public.register_deliveryroom_c1b3757d add column if not exists period_end date;

update public.register_deliveryroom_c1b3757d set period_start = date '2023-01-01', entry_date = date '2023-01-01', period_end = date '2023-12-31'
 where id = 'ba511fbf-b983-4341-8754-3801d020dbf8' and period_end is null;
update public.register_deliveryroom_c1b3757d set period_start = date '2024-01-01', entry_date = date '2024-01-01', period_end = date '2024-02-29'
 where id = '88526ddb-eed6-42cc-a1e8-e523876006df' and period_end is null;
