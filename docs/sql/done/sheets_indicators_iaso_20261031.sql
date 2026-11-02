-- ΙΑΣΩ 31/10/2026 (εγκρίθηκε από τον ιδιοκτήτη): δείκτες Οφθαλμολογικού (REG-008), ΤΕΠ (REG-007), Αίθουσας Τοκετών (REG-004), σημείωση Μαιευτικής (REG-003).
-- Δεν περιέχει delete/drop: ο δείκτης «Μέσος όρος πράξεων ανά μήνα» αρχειοθετείται. Οι εγγραφές δεν αλλάζουν.
do $$
declare
  org uuid; rid uuid; iid uuid;
begin
  select id into org from public.organizations where name = 'ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ';
  if org is null then return; end if;
  perform set_config('request.jwt.claims', '{"sub":"84066ee0-57b7-4cae-9186-09e491d3ea6d","role":"authenticated"}', true);

  -- Οφθαλμολογικό
  select id into rid from public.department_registers where organization_id = org and code = 'REG-008';
  if rid is not null and not exists (select 1 from public.department_register_indicators where register_id = rid and key = 'daily_mean') then
    update public.department_register_indicators set archived = true where register_id = rid and key = 'monthly_mean';
    insert into public.department_register_indicators (organization_id, register_id, key, position, title_el, title_en, aggregation, sheet_rows, unit_el, unit_en, direction) values
      (org, rid, 'other_local_share', 4, '% λοιπών τοπικών πράξεων', '% other local procedures', 'percent', array['other_local'], '%', '%', 'context');
    insert into public.department_register_indicators (organization_id, register_id, key, position, title_el, title_en, aggregation, sheet_rows, direction, daily_only, note_el, note_en) values
      (org, rid, 'daily_mean', 5, 'Μέσος αριθμός πράξεων ανά ημέρα λειτουργίας', 'Mean procedures per working day', 'mean', array[]::text[], 'context', true, 'Από τα ημερήσια φύλλα· οι μήνες που καταχωρίστηκαν με ένα σύνολο δεν μετράνε.', 'From the daily sheets; months recorded as one total do not count.'),
      (org, rid, 'days_recorded', 6, 'Ημέρες με καταχώριση', 'Days recorded', 'count', array[]::text[], 'context', true, null, null);
    update public.department_registers set version = coalesce(version, 1) + 1, history = coalesce(history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'actor', 'Ενημέρωση δεικτών Οφθαλμολογικού', 'action', 'updated')) where id = rid;
    perform public.department_register_fast_reads(rid);
  end if;

  -- ΤΕΠ
  select id into rid from public.department_registers where organization_id = org and code = 'REG-007';
  if rid is not null and not exists (select 1 from public.department_register_indicators where register_id = rid and key = 'daily_cases') then
    insert into public.department_register_indicators (organization_id, register_id, key, position, title_el, title_en, aggregation, sheet_rows, denominator_rows, unit_el, unit_en, direction, note_el, note_en) values
      (org, rid, 'admission_rate', 2, '% εισαγωγών από τα ΤΕΠ', '% admitted from the emergency department', 'percent', array['admissions'], array['surgical','urgent','checkup','preop','assessments','septic'], '%', '%', 'context', 'Εισαγωγές ÷ περιστατικά του ΤΕΠ.', 'Admissions ÷ the department''s cases.');
    insert into public.department_register_indicators (organization_id, register_id, key, position, title_el, title_en, aggregation, sheet_rows, direction, daily_only, note_el, note_en) values
      (org, rid, 'daily_cases', 3, 'Μέσος αριθμός περιστατικών ανά ημέρα', 'Mean cases per day', 'mean', array['surgical','urgent','checkup','preop','assessments','septic'], 'context', true, 'Από τα ημερήσια φύλλα· οι μήνες που καταχωρίστηκαν με ένα σύνολο δεν μετράνε.', 'From the daily sheets; months recorded as one total do not count.');
    update public.department_register_indicators set position = case key when 'total' then 0 when 'admissions' then 1 when 'admission_rate' then 2 when 'daily_cases' then 3 when 'night_share' then 4 when 'septic' then 5 when 'left_without_seen_rate' then 6 when 'revisit_72h_rate' then 7 when 'transfer_rate' then 8 else position end where register_id = rid;
    update public.department_registers set version = coalesce(version, 1) + 1, history = coalesce(history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'actor', 'Ενημέρωση δεικτών ΤΕΠ', 'action', 'updated')) where id = rid;
    perform public.department_register_fast_reads(rid);
  end if;

  -- Αίθουσα Τοκετών
  select id into rid from public.department_registers where organization_id = org and code = 'REG-004';
  if rid is not null and not exists (select 1 from public.department_register_indicators where register_id = rid and key = 'daily_deliveries') then
    update public.department_register_indicators set title_el = '% φυσιολογικών τοκετών μετά από προηγούμενη καισαρική', title_en = '% vaginal births after a previous caesarean' where register_id = rid and key = 'vbac_rate';
    update public.department_register_indicators set title_el = '% πολύδυμων που γεννήθηκαν με καισαρική', title_en = '% multiple pregnancies born by caesarean' where register_id = rid and key = 'multiple_cs_rate';
    update public.department_register_sheet_axes set label_el = 'Φυσιολογικοί μετά από καισαρική (μέρος των φυσιολογικών)', label_en = 'Vaginal after caesarean (within vaginal)' where register_id = rid and axis = 'row' and key = 'vbac';
    update public.department_register_sheet_axes set label_el = 'Πολύδυμες με φυσιολογικό τοκετό' where register_id = rid and axis = 'row' and key = 'multiple_vaginal';
    update public.department_register_sheet_axes set label_el = 'Πολύδυμες με καισαρική τομή' where register_id = rid and axis = 'row' and key = 'multiple_cs';
    update public.department_register_sheet_axes set label_el = 'Τοκετοί πριν την άφιξη στο νοσοκομείο' where register_id = rid and axis = 'row' and key = 'born_before_arrival';
    insert into public.department_register_indicators (organization_id, register_id, key, position, title_el, title_en, aggregation, sheet_rows, direction, note_el, note_en) values
      (org, rid, 'born_before_arrival', 6, 'Τοκετοί πριν την άφιξη στο νοσοκομείο', 'Births before arrival at the hospital', 'sum', array['born_before_arrival'], 'context', 'Δεν περιλαμβάνονται στο σύνολο των τοκετών.', 'Not included in the total deliveries.');
    insert into public.department_register_indicators (organization_id, register_id, key, position, title_el, title_en, aggregation, sheet_rows, direction, daily_only, note_el, note_en) values
      (org, rid, 'daily_deliveries', 7, 'Μέσος αριθμός τοκετών ανά ημέρα', 'Mean deliveries per day', 'mean', array['vaginal','cs'], 'context', true, 'Από τα ημερήσια φύλλα· οι μήνες που καταχωρίστηκαν με ένα σύνολο δεν μετράνε.', 'From the daily sheets; months recorded as one total do not count.');
    update public.department_registers set version = coalesce(version, 1) + 1, history = coalesce(history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'actor', 'Ενημέρωση δεικτών Αίθουσας Τοκετών', 'action', 'updated')) where id = rid;
    perform public.department_register_fast_reads(rid);
  end if;

  -- Μαιευτική: σημείωση στον δείκτη καισαρικών
  select id into rid from public.department_registers where organization_id = org and code = 'REG-003';
  if rid is not null then
    update public.department_register_indicators set note_el = 'Ανά λεχωίδα του τμήματος. Η Αίθουσα Τοκετών μετράει όλους τους τοκετούς.', note_en = 'Per mother on the ward. The delivery room counts every delivery.' where register_id = rid and key = 'cs_rate' and note_el is null;
  end if;
end $$;
