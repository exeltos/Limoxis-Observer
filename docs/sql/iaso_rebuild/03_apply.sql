-- ΙΑΣΩ Θεσσαλίας — εφαρμογή του πίνακα public.rebuild_stage (μέσω της προβολής rebuild_stage_u που αφαιρεί διπλές γραμμές) (ασθενείς, νοσηλείες, δείγματα, μικρόβια).
-- Δεν περιέχει δεδομένα ασθενών: τα δεδομένα βρίσκονται στον πίνακα rebuild_stage_u (όχι στο git).
-- Μόνο ΕΓΓΡΑΦΕΣ και ενημερώσεις· καμία διαγραφή. Δοκιμή: v_dry := true (ακυρώνεται με εξαίρεση που δείχνει την αναφορά).
-- Πραγματική εκτέλεση: v_dry := false.
do $$
declare
  v_dry boolean := true;
  v_org uuid; v_uid uuid; v_report jsonb;
  n_new_pat int; n_unarch int; n_adm int; n_smp int; n_res int; n_fix int; n_dept int;
begin
  select id into v_org from organizations where name = 'ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ';
  select created_by into v_uid from laboratory_samples where organization_id = v_org and created_by is not null order by created_at limit 1;
  if v_org is null or v_uid is null then raise exception 'org/user not found'; end if;

  -- Είδος δείγματος (Excel) → βιβλιοθήκη του οργανισμού + sample_type της εφαρμογής.
  create temporary table _spec(raw text primary key, code text not null, stype text not null) on commit drop;
  insert into _spec values
   ('Ούρα','SAMPLE-URINE','urineCulture'),('Ολικό αίμα','SAMPLE-BLOOD','bloodCulture'),
   ('Υλικό τραύματος','SAMPLE-WOUND','woundCulture'),('Πτύελα','SAMPLE-SPUTUM','respiratorySample'),
   ('Βιολογικό Υλικό','SAMPLE-BRONCHIAL-SECRETIONS','respiratorySample'),('Υλικό Καθετήρα','SAMPLE-CATHETER-TIP','specimen'),
   ('Πύο','SAMPLE-PUS','woundCulture'),('Κολπικό Επίχρισμα','SAMPLE-VAGINAL-SWAB','specimen'),
   ('Περιτοναϊκό υγρό','SAMPLE-PERITONEAL-FLUID','specimen'),('Υλικό παροχέτευσης','SAMPLE-DRAINAGE','woundCulture'),
   ('Οφθαλμικό','SAMPLE-EYE','specimen'),('Υλικό ράμματος','SAMPLE-SUTURE','woundCulture'),
   ('Κόπρανα','SAMPLE-STOOL','specimen'),('Ουρηθρικό','SAMPLE-URETHRAL-SWAB','specimen'),
   ('Φαρυγγικό','SAMPLE-THROAT-SWAB','respiratorySample'),('Πλευριτικό υγρό','SAMPLE-PLEURAL-FLUID','specimen'),
   ('Υγρό ρινοφάρυγγα','SAMPLE-NASOPHARYNGEAL','respiratorySample'),('Ρινικό','SAMPLE-NASAL-SWAB','respiratorySample'),
   ('Ε.Ν.Υ.','SAMPLE-CSF','specimen'),('Αμνιακό υγρό','SAMPLE-AMNIOTIC-FLUID','specimen'),
   ('Σπερματικό υγρό','SAMPLE-SEMEN','specimen');
  if exists (select 1 from rebuild_stage_u s where not exists (select 1 from _spec p where p.raw = s.specimen_raw)) then
    raise exception 'Άγνωστο είδος δείγματος: %', (select string_agg(distinct specimen_raw, ', ') from rebuild_stage_u s where not exists (select 1 from _spec p where p.raw = s.specimen_raw));
  end if;
  create temporary table _lib on commit drop as
    select m.code, m.id, m.name_el from master_library_items m where m.organization_id = v_org and m.code like 'SAMPLE-%' and m.is_active;
  if exists (select 1 from _spec p where not exists (select 1 from _lib l where l.code = p.code)) then raise exception 'Λείπει είδος δείγματος από τη βιβλιοθήκη'; end if;
  create temporary table _dep on commit drop as select id, name from departments where organization_id = v_org;
  if exists (select 1 from rebuild_stage_u s where not exists (select 1 from _dep d where d.name = s.dept_name)) then raise exception 'Άγνωστο τμήμα στο stage'; end if;

  -- Ένας ασθενής = ένας αριθμός φακέλου (his). Πρώτα ταύτιση με υπάρχοντα (μη αρχειοθετημένος προτιμάται).
  create temporary table _pat on commit drop as
    select s.his, (array_agg(s.patient_name order by s.ts))[1] pname, (array_agg(s.gender order by s.ts))[1] gender,
           max(s.age) age, (array_agg(s.dept_name order by s.ts desc))[1] dept_name, min(s.ts) first_ts, max(s.ts) last_ts,
           null::uuid patient_id, false existing, false was_archived
    from rebuild_stage_u s group by s.his;
  update _pat p set patient_id = x.id, existing = true, was_archived = x.archived_at is not null
    from (select distinct on (hospital_record_number) id, hospital_record_number, archived_at
          from patients where organization_id = v_org and hospital_record_number is not null
          order by hospital_record_number, (archived_at is null) desc, created_at) x
   where x.hospital_record_number = p.his;

  -- Υπάρχουσα αρχειοθετημένη εγγραφή που ανήκει στην επιλογή: επαναφορά (όχι διπλότυπο).
  update patients set archived_at = null, archived_by = null, archive_reason = null, updated_at = now()
   where id in (select patient_id from _pat where was_archived);
  get diagnostics n_unarch = row_count;

  -- Νέοι ασθενείς.
  update _pat set patient_id = gen_random_uuid() where not existing;
  insert into patients(id, organization_id, patient_code, first_name, last_name, father_name, sex, date_of_birth, department_id,
                       status, hospital_record_number, created_by, notes)
  select p.patient_id, v_org, 'LIS-' || p.his,
         split_part(p.pname, ' ', 1),
         case when array_length(string_to_array(trim(p.pname), ' '), 1) >= 2 then (string_to_array(trim(p.pname), ' '))[array_length(string_to_array(trim(p.pname), ' '), 1)] else split_part(p.pname, ' ', 1) end,
         case when array_length(string_to_array(trim(p.pname), ' '), 1) >= 3 then (string_to_array(trim(p.pname), ' '))[2] end,
         case upper(p.gender) when 'ΓΥΝΑΙΚΑ' then 'female' when 'ΑΝΔΡΑΣ' then 'male' end,
         case when p.age between 0 and 110 then make_date(extract(year from p.first_ts)::int - p.age, 7, 1) end,
         (select id from _dep d where d.name = p.dept_name),
         case when p.last_ts < now() - interval '30 days' then 'discharged' else 'active' end,
         p.his, v_uid,
         'Από τα Excel καλλιεργειών 2024–2026. Ημερομηνία γέννησης εκτιμώμενη από την ηλικία (1/7).'
  from _pat p where not p.existing;
  get diagnostics n_new_pat = row_count;

  -- Τμήμα σε υπάρχοντες ασθενείς που δεν έχουν.
  update patients pt set department_id = (select id from _dep d where d.name = p.dept_name), updated_at = now()
    from _pat p where p.existing and pt.id = p.patient_id and pt.department_id is null;
  get diagnostics n_dept = row_count;

  -- Μία νοσηλεία σε όσους δεν έχουν καμία (οι υπάρχουσες δεν πειράζονται εδώ).
  insert into patient_admissions(organization_id, patient_id, department_id, admission_date, discharge_date, status, notes, created_by)
  select v_org, p.patient_id, (select id from _dep d where d.name = p.dept_name), p.first_ts::date,
         case when p.last_ts < now() - interval '30 days' then p.last_ts::date end,
         case when p.last_ts < now() - interval '30 days' then 'discharged' else 'active' end,
         'lab_import_backfill: εκτίμηση από τις καλλιέργειες των Excel', v_uid
  from _pat p where not exists (select 1 from patient_admissions a where a.patient_id = p.patient_id);
  get diagnostics n_adm = row_count;

  -- Δείγματα: όχι διπλά (ίδιος ασθενής + ημέρα + είδος).
  create temporary table _smp on commit drop as
    select gen_random_uuid() id, s.id stage_id, p.patient_id, d.id dept_id, sp.stype, l.id lib_id, l.name_el lib_name, sp.code lib_code,
           'LIS-' || s.y || '-' || s.seq code, (s.ts at time zone 'Europe/Athens') ts, s
    from rebuild_stage_u s join _pat p on p.his = s.his join _spec sp on sp.raw = s.specimen_raw
         join _lib l on l.code = sp.code join _dep d on d.name = s.dept_name
    where not exists (select 1 from laboratory_samples e where e.patient_id = p.patient_id and e.specimen_type_id = l.id
                        and (e.collected_at at time zone 'Europe/Athens')::date = s.ts::date)
      and not exists (select 1 from laboratory_samples e where e.organization_id = v_org and e.sample_code = 'LIS-' || s.y || '-' || s.seq);
  insert into laboratory_samples(id, organization_id, patient_id, department_id, sample_code, sample_type, source_site, status, collected_at, received_at,
                                 created_by, priority, subject_type, specimen_type_id, clinical_context)
  select id, v_org, patient_id, dept_id, code, stype, lib_name, 'completed', ts, ts, v_uid, 'routine', 'patient', lib_id,
         jsonb_build_object('source', 'cultures_excel_2024_2026', 'source_year', (s).y, 'source_sample_number', (s).seq,
                            'specimen_source_raw', (s).specimen_raw, 'specimen_library_code', lib_code,
                            'source_department_code', (s).ward, 'age_at_result', (s).age)
  from _smp;
  get diagnostics n_smp = row_count;

  -- Αποτελέσματα (το trigger συμπληρώνει τα μικρόβια ανά θέση από το κείμενο).
  insert into microbiology_results(organization_id, sample_id, result_status, organism, validation_status, preliminary, resulted_at, created_by, resistance_class)
  select v_org, m.id, 'positive', array_to_string((m.s).organisms, ', '), 'validated', false, m.ts, v_uid, case when (m.s).mdr then 'MDR' end
  from _smp m;
  get diagnostics n_res = row_count;

  -- Είδος δείγματος στα υπάρχοντα δείγματα που δεν έχουν (ίδιος ασθενής + ημέρα).
  update laboratory_samples e set specimen_type_id = sub.lib_id, source_site = sub.lib_name, sample_type = sub.stype,
         clinical_context = coalesce(e.clinical_context, '{}'::jsonb) || jsonb_build_object('specimen_source_raw', sub.raw, 'specimen_library_code', sub.code, 'specimen_mapping_status', 'filled_from_cultures_excel'),
         updated_at = now()
  from (select distinct on (e2.id) e2.id, l.id lib_id, l.name_el lib_name, sp.stype, sp.raw, sp.code
        from laboratory_samples e2 join _pat p on p.patient_id = e2.patient_id
             join rebuild_stage_u s on s.his = p.his and (e2.collected_at at time zone 'Europe/Athens')::date = s.ts::date
             join _spec sp on sp.raw = s.specimen_raw join _lib l on l.code = sp.code
        where e2.specimen_type_id is null and e2.organization_id = v_org order by e2.id) sub
  where sub.id = e.id;
  get diagnostics n_fix = row_count;

  v_report := jsonb_build_object(
    'stage_rows', (select count(*) from rebuild_stage_u), 'stage_patients', (select count(*) from _pat),
    'patients_existing', (select count(*) from _pat where existing), 'patients_unarchived', n_unarch, 'patients_new', n_new_pat,
    'patients_department_filled', n_dept, 'admissions_created', n_adm, 'samples_created', n_smp, 'results_created', n_res,
    'existing_samples_specimen_filled', n_fix,
    'organism_rows_created', (select count(*) from microbiology_result_organisms o join microbiology_results r on r.id = o.microbiology_result_id join _smp m on m.id = r.sample_id),
    'stage_samples_skipped_as_duplicates', (select count(*) from rebuild_stage_u) - n_smp,
    'selected_without_admission', (select count(*) from _pat p where not exists (select 1 from patient_admissions a where a.patient_id = p.patient_id)),
    'selected_without_department', (select count(*) from _pat p join patients pt on pt.id = p.patient_id where pt.department_id is null),
    'selected_without_sample', (select count(*) from _pat p where not exists (select 1 from laboratory_samples s where s.patient_id = p.patient_id)),
    'samples_without_specimen', (select count(*) from laboratory_samples s join _pat p on p.patient_id = s.patient_id where s.specimen_type_id is null));
  if v_dry then raise exception 'DRY_RUN_OK %', v_report::text; end if;
  raise notice '%', v_report::text;
end $$;
