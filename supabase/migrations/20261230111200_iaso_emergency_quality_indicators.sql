-- ΤΕΠ ΙΑΣΩ: τρεις νέες γραμμές στο ημερήσιο φύλλο και τρεις δείκτες ποιότητας (εγκρίθηκαν από τον ιδιοκτήτη).
-- Γραμμές: αποχωρήσεις χωρίς εξέταση, επανεπισκέψεις 72 ωρών, διακομιδές. Οι δείκτες διαιρούν με τα περιστατικά του ΤΕΠ
-- (οι ίδιες γραμμές με τον δείκτη «Σύνολο περιστατικών»). Η αλλαγή ορισμού ανεβάζει την έκδοση του μητρώου· οι παλιές
-- καταχωρίσεις μένουν όπως είναι και οι νέες στήλες του πίνακα προστίθενται από το department_register_sync.
do $$
declare
  org uuid;
  reg public.department_registers;
begin
  select id into org from public.organizations where name = 'ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ';
  if org is null then return; end if;
  select * into reg from public.department_registers where organization_id = org and code = 'REG-007';
  if reg.id is null then return; end if;
  if exists (select 1 from public.department_register_sheet_axes where register_id = reg.id and axis = 'row' and key = 'left_without_seen') then return; end if;

  perform set_config('request.jwt.claims', '{"sub":"84066ee0-57b7-4cae-9186-09e491d3ea6d","role":"authenticated"}', true);

  insert into public.department_register_sheet_axes (organization_id, register_id, axis, key, label_el, label_en, position)
  values
    (org, reg.id, 'row', 'left_without_seen', 'Αποχώρησαν χωρίς εξέταση', 'Left without being seen', 8),
    (org, reg.id, 'row', 'revisit_72h', 'Επανεπισκέψεις εντός 72 ωρών', 'Return visits within 72 hours', 9),
    (org, reg.id, 'row', 'transfers', 'Διακομιδές σε άλλο νοσοκομείο', 'Transfers to another hospital', 10);

  insert into public.department_register_indicators
    (organization_id, register_id, key, position, title_el, title_en, aggregation, sheet_rows, denominator_rows, unit_el, unit_en, target, direction, note_el, note_en)
  values
    (org, reg.id, 'left_without_seen_rate', 4, '% αποχωρήσεων χωρίς εξέταση', '% left without being seen', 'percent',
      array['left_without_seen'], array['surgical','urgent','checkup','preop','assessments','septic'], '%', '%', 2, 'lower',
      'Οι ασθενείς που έφυγαν πριν εξεταστούν, ως ποσοστό των περιστατικών του ΤΕΠ.', 'Patients who left before being seen, as a share of the emergency department''s cases.'),
    (org, reg.id, 'revisit_72h_rate', 5, '% επανεπισκέψεων εντός 72 ωρών', '% return visits within 72 hours', 'percent',
      array['revisit_72h'], array['surgical','urgent','checkup','preop','assessments','septic'], '%', '%', 5, 'lower',
      'Ασθενείς που ξαναήρθαν στο ΤΕΠ εντός 72 ωρών από προηγούμενη επίσκεψη.', 'Patients who came back to the emergency department within 72 hours of a previous visit.'),
    (org, reg.id, 'transfer_rate', 6, '% διακομιδών σε άλλο νοσοκομείο', '% transfers to another hospital', 'percent',
      array['transfers'], array['surgical','urgent','checkup','preop','assessments','septic'], '%', '%', null, 'context',
      'Πληροφοριακός δείκτης: δεν κρίνεται ως καλός ή κακός.', 'Informative: it is not judged as good or bad.');

  update public.department_registers
  set version = coalesce(version, 1) + 1,
      history = coalesce(history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('at', now(), 'action', 'updated', 'actor', 'Platform Owner'))
  where id = reg.id;

  perform public.department_register_sync(reg.id);
  perform public.department_register_fast_reads(reg.id);
end $$;
