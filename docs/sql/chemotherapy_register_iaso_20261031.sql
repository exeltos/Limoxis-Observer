-- ΧΗΜΕΙΟΘΕΡΑΠΕΙΑ ΙΑΣΩ (REG-006, εγκρίθηκε από τον ιδιοκτήτη 31/10/2026): λίστα όλων των ασθενών, ενεργός μέχρι να μπει λήξη θεραπείας.
-- 1) Τρεις ενότητες φόρμας: Ασθενής, Θεραπεία, Λήξη. 2) Η διάγνωση φαίνεται στη λίστα και αναλύεται (ανά διάγνωση).
-- 3) Ο δείκτης «Ενεργοί ασθενείς» πρώτος (μετράει όσους έχουν ξεκινήσει και δεν έχουν λήξει στο τέλος της περιόδου, όλους τους ενεργούς).
-- Δεν περιέχει delete/drop. Οι 302 υπάρχοντες ασθενείς μένουν ανέγγιχτοι (χωρίς ημερομηνία έναρξης: μετράνε από την ημέρα καταχώρισης).
do $$
declare rid uuid := '7f7457e7-5948-4ee2-a1ec-932bbab88ea3'; org uuid;
begin
  select organization_id into org from public.department_registers where id = rid;
  if org is null then raise exception 'Chemotherapy register not found'; end if;
  if exists (select 1 from public.department_register_sections where register_id = rid and key = 'treatment') then return; end if;
  perform set_config('request.jwt.claims', '{"sub":"84066ee0-57b7-4cae-9186-09e491d3ea6d","role":"authenticated"}', true);

  update public.department_register_sections set key = 'patient' where register_id = rid and key = 'main';
  insert into public.department_register_sections (organization_id, register_id, key, label_el, label_en, position) values
    (org, rid, 'treatment', 'Θεραπεία', 'Treatment', 1),
    (org, rid, 'end', 'Λήξη', 'End', 2);

  update public.department_register_fields f set section_key = v.sec, position = v.pos
  from (values ('birth_date','patient',0),('age','patient',1),('sex','patient',2),('start_date','treatment',3),('diagnosis','treatment',4),('physician','treatment',5),('regimen','treatment',6),('end_date','end',7),('end_reason','end',8),('notes','end',9)) as v(k, sec, pos)
  where f.register_id = rid and f.key = v.k;
  update public.department_register_fields set in_list = true, in_breakdown = true where register_id = rid and key = 'diagnosis';
  update public.department_register_fields set help_el = 'Όσο μένει κενή, ο ασθενής είναι ενεργός.', help_en = 'While it is empty, the patient is active.' where register_id = rid and key = 'end_date';

  update public.department_register_indicators set position = case key when 'active_patients' then 0 when 'new_patients' then 1 when 'ended' then 2 else 3 end,
    note_el = case key when 'active_patients' then 'Όσοι έχουν ξεκινήσει και δεν έχουν λήξει στο τέλος της περιόδου.' else note_el end,
    note_en = case key when 'active_patients' then 'Patients who have started and not ended by the end of the period.' else note_en end
  where register_id = rid;

  update public.department_registers set version = coalesce(version, 1) + 1,
    history = coalesce(history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'actor', 'Ενημέρωση Χημειοθεραπείας (λίστα ασθενών, ενεργοί)', 'action', 'updated'))
  where id = rid;
  perform public.department_register_sync(rid);
  perform public.department_register_fast_reads(rid);
end $$;
