-- ΕΦΑΡΜΟΣΤΗΚΕ 31/10/2026 στον ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ (REG-002 «Μητρώο ασθενών ΜΕΘ», με ρητό ΟΚ του ιδιοκτήτη).
-- Ενότητα «Έξοδος» → «Έξοδος από τη ΜΕΘ», πεδίο «Έκβαση» → «Πού πήγε», «Μεταφορά σε κλινική» → «Μεταφορά σε νοσηλευτικό τμήμα»,
-- νέο πεδίο «Τμήμα μεταφοράς» (εμφανίζεται όταν Πού πήγε = Μεταφορά σε νοσηλευτικό τμήμα) με 8 τμήματα προς συμπλήρωση.
-- Οι εσωτερικές τιμές (outcome, transfer_ward…) δεν άλλαξαν· τα 723 περιστατικά και οι δείκτες μένουν ίδια.
-- Επαλήθευση: ετικέτες, πεδίο, 8 επιλογές και στήλη transfer_department (text) στον πίνακα register_icu_60811e65· έκδοση μητρώου 2.
do $$
declare
  rid uuid := '60811e65-5dc1-41f6-8bc0-bf51f2127425';
  org uuid; tbl text; outcome_pos integer; fid uuid;
begin
  select organization_id, table_name into org, tbl from public.department_registers where id = rid;
  if org is null or tbl is null then raise exception 'ICU register not found'; end if;
  update public.department_register_sections set label_el = 'Έξοδος από τη ΜΕΘ', label_en = 'Leaving the ICU' where register_id = rid and key = 'discharge';
  update public.department_register_fields set label_el = 'Πού πήγε', label_en = 'Where to' where register_id = rid and key = 'outcome';
  update public.department_register_options o set label_el = 'Μεταφορά σε νοσηλευτικό τμήμα'
    from public.department_register_fields f where o.field_id = f.id and f.register_id = rid and f.key = 'outcome' and o.value = 'transfer_ward';
  select position into outcome_pos from public.department_register_fields where register_id = rid and key = 'outcome';
  if not exists (select 1 from public.department_register_fields where register_id = rid and key = 'transfer_department') then
    update public.department_register_fields set position = position + 1 where register_id = rid and position > outcome_pos;
    insert into public.department_register_fields (organization_id, register_id, key, section_key, position, field_type, label_el, label_en, provisional, help_el, help_en, show_when_key, show_when_value)
    values (org, rid, 'transfer_department', 'discharge', outcome_pos + 1, 'choice', 'Τμήμα μεταφοράς', 'Receiving ward', true,
      'Το νοσηλευτικό τμήμα όπου πήγε ο ασθενής. Η λίστα συμπληρώνεται με τα τμήματα του νοσοκομείου.', 'The ward the patient went to. The list is completed with the hospital’s wards.', 'outcome', 'transfer_ward')
    returning id into fid;
    insert into public.department_register_options (organization_id, register_id, field_id, value, label_el, label_en, position) values
      (org, rid, fid, 'internal', 'Παθολογική', 'Internal Medicine', 0),
      (org, rid, fid, 'surgical', 'Χειρουργική', 'Surgery', 1),
      (org, rid, fid, 'cardiology', 'Καρδιολογική', 'Cardiology', 2),
      (org, rid, fid, 'cardiac_surgery_ward', 'Καρδιοχειρουργική κλινική', 'Cardiac surgery ward', 3),
      (org, rid, fid, 'neurology', 'Νευρολογική', 'Neurology', 4),
      (org, rid, fid, 'orthopaedic', 'Ορθοπαιδική', 'Orthopaedics', 5),
      (org, rid, fid, 'pulmonary', 'Πνευμονολογική', 'Pulmonology', 6),
      (org, rid, fid, 'other_ward', 'Άλλο τμήμα', 'Other ward', 7);
  end if;
  execute format('alter table public.%I add column if not exists transfer_department text', tbl);
  execute format('comment on column public.%I.transfer_department is %L', tbl, 'Τμήμα μεταφοράς');
  update public.department_registers set version = version + 1,
    history = coalesce(history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'actor', 'Ενημέρωση προτύπου ΜΕΘ', 'action', 'updated'))
  where id = rid;
end $$;
