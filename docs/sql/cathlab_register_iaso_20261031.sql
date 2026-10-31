-- ΑΙΜΟΔΥΝΑΜΙΚΟ ΙΑΣΩ (REG-005 «Πράξεις Αιμοδυναμικού», εγκρίθηκε από τον ιδιοκτήτη 31/10/2026).
-- 1) Τρεις ενότητες φόρμας (Πράξη, Ασθενής, Έκβαση και επιπλοκές) αντί για μία.
-- 2) Νέα πεδία «Ένδειξη» (λίστα) και «Επείγουσα πράξη» (ναι/όχι). Οι παλιές καταχωρίσεις μένουν κενές σε αυτά.
-- 3) Νέοι δείκτες: % επείγουσες πράξεις, % με οξύ έμφραγμα (ανάσπαση ST), % αγγειοπλαστικής στο οξύ έμφραγμα.
-- Δεν περιέχει delete/drop. Οι στήλες του πίνακα προστίθενται από το department_register_sync.
do $$
declare
  rid uuid := '68dec235-76b0-4785-9427-89e8b74d3411';
  org uuid; fid uuid; iid uuid;
begin
  select organization_id into org from public.department_registers where id = rid;
  if org is null then raise exception 'Cath lab register not found'; end if;
  if exists (select 1 from public.department_register_fields where register_id = rid and key = 'urgent') then return; end if;
  perform set_config('request.jwt.claims', '{"sub":"84066ee0-57b7-4cae-9186-09e491d3ea6d","role":"authenticated"}', true);

  -- Ενότητες: η «main» γίνεται «procedure».
  update public.department_register_sections set key = 'procedure' where register_id = rid and key = 'main';
  insert into public.department_register_sections (organization_id, register_id, key, label_el, label_en, position) values
    (org, rid, 'patient', 'Ασθενής', 'Patient', 1),
    (org, rid, 'outcome', 'Έκβαση και επιπλοκές', 'Outcome and complications', 2);

  -- Πεδία: σειρά και ενότητες.
  update public.department_register_fields set section_key = 'procedure', position = 0 where register_id = rid and key = 'date';
  update public.department_register_fields set section_key = 'procedure', position = 1 where register_id = rid and key = 'procedures';
  update public.department_register_fields set section_key = 'patient', position = 4 where register_id = rid and key = 'age';
  update public.department_register_fields set section_key = 'patient', position = 5 where register_id = rid and key = 'sex';
  update public.department_register_fields set section_key = 'outcome', position = 6 where register_id = rid and key = 'to_surgery';
  update public.department_register_fields set section_key = 'outcome', position = 7 where register_id = rid and key = 'iabp';
  update public.department_register_fields set section_key = 'outcome', position = 8 where register_id = rid and key = 'complication';

  insert into public.department_register_fields (organization_id, register_id, key, section_key, position, field_type, label_el, label_en, in_list)
  values (org, rid, 'indication', 'procedure', 2, 'choice', 'Ένδειξη', 'Indication', true) returning id into fid;
  insert into public.department_register_options (organization_id, register_id, field_id, value, label_el, label_en, position) values
    (org, rid, fid, 'stemi', 'Οξύ έμφραγμα με ανάσπαση ST', 'ST-elevation myocardial infarction', 0),
    (org, rid, fid, 'nstemi', 'Έμφραγμα χωρίς ανάσπαση ST', 'Non-ST-elevation myocardial infarction', 1),
    (org, rid, fid, 'unstable_angina', 'Ασταθής στηθάγχη', 'Unstable angina', 2),
    (org, rid, fid, 'stable', 'Σταθερή στεφανιαία νόσος', 'Stable coronary disease', 3),
    (org, rid, fid, 'rhythm', 'Αρρυθμία ή συσκευή', 'Arrhythmia or device', 4),
    (org, rid, fid, 'other', 'Άλλη', 'Other', 5);
  insert into public.department_register_fields (organization_id, register_id, key, section_key, position, field_type, label_el, label_en)
  values (org, rid, 'urgent', 'procedure', 3, 'yes_no', 'Επείγουσα πράξη', 'Urgent procedure');
  update public.department_register_fields set in_breakdown = true where register_id = rid and key = 'indication';

  -- Δείκτες: οι νέοι μετά τη «Μέση ηλικία».
  update public.department_register_indicators set position = position + 3 where register_id = rid and position >= 6;
  insert into public.department_register_indicators (organization_id, register_id, key, position, title_el, title_en, aggregation, unit_el, unit_en, direction, note_el, note_en)
  values (org, rid, 'urgent_share', 6, '% επείγουσες πράξεις', '% urgent procedures', 'percent', '%', '%', 'context', 'Μόνο όσες πράξεις έχουν καταγραφή (ναι/όχι).', 'Only procedures with the answer recorded (yes/no).') returning id into iid;
  insert into public.department_register_indicator_filters (organization_id, register_id, indicator_id, part, position, field_key, op, value) values
    (org, rid, iid, 'numerator', 0, 'urgent', 'yes', null), (org, rid, iid, 'denominator', 0, 'urgent', 'filled', null);
  insert into public.department_register_indicators (organization_id, register_id, key, position, title_el, title_en, aggregation, unit_el, unit_en, direction, note_el, note_en)
  values (org, rid, 'stemi_share', 7, '% με οξύ έμφραγμα (ανάσπαση ST)', '% with ST-elevation infarction', 'percent', '%', '%', 'context', 'Μόνο όσες πράξεις έχουν καταγεγραμμένη ένδειξη.', 'Only procedures with the indication recorded.') returning id into iid;
  insert into public.department_register_indicator_filters (organization_id, register_id, indicator_id, part, position, field_key, op, value) values
    (org, rid, iid, 'numerator', 0, 'indication', 'eq', 'stemi'), (org, rid, iid, 'denominator', 0, 'indication', 'filled', null);
  insert into public.department_register_indicators (organization_id, register_id, key, position, title_el, title_en, aggregation, unit_el, unit_en, direction, note_el, note_en)
  values (org, rid, 'primary_pci', 8, '% αγγειοπλαστικής στο οξύ έμφραγμα', '% angioplasty in ST-elevation infarction', 'percent', '%', '%', 'higher', 'Από τους ασθενείς με οξύ έμφραγμα, όσοι έκαναν αγγειοπλαστική.', 'Of the patients with ST-elevation infarction, those who had an angioplasty.') returning id into iid;
  insert into public.department_register_indicator_filters (organization_id, register_id, indicator_id, part, position, field_key, op, value) values
    (org, rid, iid, 'numerator', 0, 'indication', 'eq', 'stemi'), (org, rid, iid, 'numerator', 1, 'procedures', 'eq', 'angioplasty'), (org, rid, iid, 'denominator', 0, 'indication', 'eq', 'stemi');

  update public.department_registers set version = coalesce(version, 1) + 1,
    history = coalesce(history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'actor', 'Ενημέρωση Αιμοδυναμικού (ενότητες, ένδειξη, επείγον)', 'action', 'updated'))
  where id = rid;
  perform public.department_register_sync(rid);
  perform public.department_register_fast_reads(rid);
end $$;
