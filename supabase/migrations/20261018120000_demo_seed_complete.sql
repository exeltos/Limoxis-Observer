-- Demo data pack, complete: every screen of a Demo has coherent data for
-- experimentation and learning (design §6). Adds, after the existing pack:
--   * clinical: ΠΑΙΔ/ΜΕΝΝ patients, devices, assessments, reassessments,
--     outcomes, antimicrobial therapy, a Klebsiella KPC cluster in ΜΕΘ with a
--     LIRA outbreak investigation, critical-result communications, staff and
--     environmental screening;
--   * quality: audits, findings, CAPA root cause and steps, indicator history,
--     point prevalence surveys, notifiable reports, structure snapshots;
--   * people: clinical scales, training material/questions/feedback, staff
--     certificates, evaluations, job-description acknowledgements, OH dates;
--   * governance: committee members, attendance, decisions, annual plan,
--     minutes approvals, document versions, announcements and acknowledgements.
-- No SELECT/EXECUTE/RETURNING ... INTO (the Supabase SQL editor rewrites those).

-- Demo data pack — clinical area (patients, surveillance depth, laboratory,
-- KPC cluster + LIRA outbreak investigation, employee and environmental
-- surveillance).
--
-- Functions, in call order (private.demo_seed_clinical calls the others):
--   1. private.demo_seed_clinical(p_organization_id, p_actor)                     -- entry point
--   2. private.demo_seed_clinical_patients(p_organization_id, p_actor)            -- ΠΑΙΔ / ΜΕΝΝ / ΜΕΘ patients, transfer admission, patient-days, waste/antiseptic patient-days
--   3. private.demo_seed_clinical_lab_fixes(p_organization_id, p_actor)           -- ABX-LZD -> ABX-LNZ, critical result communications for the seeded results
--   4. private.demo_seed_clinical_paediatric(p_organization_id, p_actor)          -- ΠΑΙΔ / ΜΕΝΝ samples and the neonatal CLABSI case
--   5. private.demo_seed_clinical_case_depth(p_organization_id, p_actor)          -- devices, assessments, reassessments, outcomes, therapies, administrations, isolation, events
--   6. private.demo_seed_clinical_kpc_cluster(p_organization_id, p_actor)         -- KPC Klebsiella pneumoniae cluster in ΜΕΘ (samples, results, AST, AMR, cases, isolation, communications)
--   7. private.demo_seed_clinical_outbreak(p_organization_id, p_actor)            -- LIRA outbreak investigations (active KPC, closed Acinetobacter), events, case reviews, CAPA
--   8. private.demo_seed_clinical_employee_environment(p_organization_id, p_actor) -- employee MRSA screening batch, environmental samples and standards
--
-- Same rules as the other demo_seed_* functions: no SELECT/EXECUTE/RETURNING
-- ... INTO, no DELETE/DROP, everything schema-qualified, dates relative to
-- current_date. Rows are found again by patient code (P-YYnnnn), department
-- code and sample code, never by fixed ids.

create or replace function private.demo_seed_clinical_patients(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := current_date;
  v_yy text := to_char(current_date, 'YY');
  v_icu uuid := (select dep.id from public.departments dep where dep.organization_id = p_organization_id and dep.code = 'ΜΕΘ');
  v_surg uuid := (select dep.id from public.departments dep where dep.organization_id = p_organization_id and dep.code = 'ΧΕΙΡ');
  v_ped uuid := (select dep.id from public.departments dep where dep.organization_id = p_organization_id and dep.code = 'ΠΑΙΔ');
  v_nicu uuid := (select dep.id from public.departments dep where dep.organization_id = p_organization_id and dep.code = 'ΜΕΝΝ');
begin
  -- New patients: one ΜΕΘ patient (transferred from surgery, part of the KPC
  -- cluster), four children in Paediatrics and four neonates in the NICU.
  -- The patients trigger creates each one's admission.
  insert into public.patients(organization_id, patient_code, first_name, last_name, father_name, sex, date_of_birth,
    hospital_record_number, department_id, admission_date, discharge_date, status, birth_weight_grams, gestational_age_weeks, notes, created_by)
  select v_org, 'P-' || v_yy || lpad(x.g::text, 4, '0'), x.fn, x.ln, x.father, x.sex, x.dob,
    'ΑΜ-' || (240000 + x.g * 137), x.dep, x.adm, x.dis, case when x.dis is null then 'active' else 'discharged' end, x.bw, x.ga, x.notes, p_actor
  from (values
    (49, 'Ευάγγελος', 'Ραφτόπουλος', 'Ιωάννης', 'male', d0 - 24510, v_icu, d0 - 8, null::date, null::integer, null::integer,
         'Μεταφορά από τη Χειρουργική Κλινική μετά από επανεπέμβαση για διαφυγή αναστόμωσης.'),
    (50, 'Ελπίδα', 'Χατζηγεωργίου', 'Αλέξανδρος', 'female', d0 - 1520, v_ped, d0 - 6, null, null, null, 'Πνευμονία της κοινότητας.'),
    (51, 'Άγγελος', 'Λαμπράκης', 'Μιχάλης', 'male', d0 - 3330, v_ped, d0 - 15, d0 - 10, null, null, 'Οξεία πυελονεφρίτιδα — ολοκλήρωση αγωγής.'),
    (52, 'Ζωή', 'Μπακάλη', 'Στέφανος', 'female', d0 - 335, v_ped, d0 - 3, null, null, null, 'Οξεία γαστρεντερίτιδα με αφυδάτωση.'),
    (53, 'Φώτης', 'Αλεξίου', 'Ηλίας', 'male', d0 - 5150, v_ped, d0 - 9, null, null, null, 'Οξεία αιματογενής οστεομυελίτιδα κνήμης.'),
    (54, 'Νεογνό', 'Καραγιάννης', 'Δημήτριος', 'male', d0 - 21, v_nicu, d0 - 21, null, 1150, 29, 'Πρόωρο 29 εβδομάδων — σύνδρομο αναπνευστικής δυσχέρειας.'),
    (55, 'Νεογνό', 'Σταυροπούλου', 'Πέτρος', 'female', d0 - 10, v_nicu, d0 - 10, null, 2100, 34, 'Πρόωρο 34 εβδομάδων — παρακολούθηση σίτισης.'),
    (56, 'Νεογνό', 'Μιχαηλίδης', 'Χαράλαμπος', 'male', d0 - 25, v_nicu, d0 - 25, d0 - 14, 3350, 39, 'Τελειόμηνο — παροδική ταχύπνοια του νεογνού.'),
    (57, 'Νεογνό', 'Ζαχαρίου', 'Κυριάκος', 'female', d0 - 40, v_nicu, d0 - 40, null, 890, 26, 'Εξαιρετικά πρόωρο 26 εβδομάδων.')
  ) x(g, fn, ln, father, sex, dob, dep, adm, dis, bw, ga, notes)
  where x.dep is not null
    and not exists (select 1 from public.patients p where p.organization_id = v_org and p.patient_code = 'P-' || v_yy || lpad(x.g::text, 4, '0'));

  -- The ΜΕΘ patient's earlier stay in Surgery (before the transfer)
  insert into public.patient_admissions(organization_id, patient_id, department_id, admission_date, discharge_date, status, notes, created_by)
  select v_org, p.id, v_surg, d0 - 12, d0 - 8, 'transferred', 'Λαπαροτομία για απόφραξη εντέρου· μεταφορά στη ΜΕΘ μετά την επανεπέμβαση.', p_actor
  from public.patients p
  where p.organization_id = v_org and p.patient_code = 'P-' || v_yy || '0049' and v_surg is not null
    and not exists (select 1 from public.patient_admissions a where a.patient_id = p.id and a.department_id = v_surg);

  -- Patient days for Paediatrics and NICU, same six full months as the other departments
  insert into public.patient_day_periods(organization_id, department_id, period_start, period_end, patient_days, source, review_status, notes, created_by, updated_by)
  select v_org, dep.id, m.ms::date, (m.ms + interval '1 month - 1 day')::date,
    (b.beds * extract(day from (m.ms + interval '1 month - 1 day'))::int * (68 + (b.k * 7 + m.mi * 5) % 22) / 100),
    'manual', 'approved', 'Demo', p_actor, p_actor
  from (values ('ΠΑΙΔ', 16, 7), ('ΜΕΝΝ', 12, 8)) b(code, beds, k)
  join public.departments dep on dep.organization_id = v_org and dep.code = b.code
  cross join lateral (select mi, (date_trunc('month', d0) - mi * interval '1 month') as ms from generate_series(1, 6) mi) m
  where not exists (select 1 from public.patient_day_periods pd where pd.organization_id = v_org and pd.department_id = dep.id and pd.period_start = m.ms::date);

  -- Waste and antiseptic rows written without patient-days (they were scaled
  -- to 400 patient-days): take that month's patient-days and rescale.
  update public.waste_measurements w
     set weight_kg = round(w.weight_kg * pd.patient_days / 400.0, 1),
         containers = greatest(1, round(coalesce(w.containers, 1) * pd.patient_days / 400.0)::int),
         patient_days = pd.patient_days, patient_days_source = 'library', updated_at = now()
    from public.patient_day_periods pd
   where w.organization_id = v_org and w.patient_days is null
     and pd.organization_id = v_org and pd.department_id = w.department_id and pd.period_start = w.period_start;

  update public.antiseptic_consumption_periods a
     set litres = round(a.litres * pd.patient_days / 400.0, 1),
         patient_days = pd.patient_days, patient_days_source = 'library', updated_at = now()
    from public.patient_day_periods pd
   where a.organization_id = v_org and a.patient_days is null
     and pd.organization_id = v_org and pd.department_id = a.department_id and pd.period_start = a.period_start;
end;
$function$;

create or replace function private.demo_seed_clinical_lab_fixes(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
begin
  -- The library and the DDD table use ABX-LNZ for linezolid
  update public.antimicrobial_susceptibility_results
     set antimicrobial_code = 'ABX-LNZ', updated_at = now()
   where organization_id = v_org and antimicrobial_code = 'ABX-LZD';

  -- Critical results already marked as communicated: name the doctor who was
  -- called (a doctor of that department when there is one) ...
  update public.microbiology_results mr
     set critical_communicated_to = x.recipient
    from (
      select m.id,
        coalesce((select 'Δρ. ' || e.last_name || ' ' || e.first_name from public.employees e
                   where e.organization_id = v_org and e.department_id = ls.department_id and e.profession_name = 'Ιατρός'
                   order by (e.employment_status <> 'active'), e.employee_code limit 1),
                 'Εφημερεύων ιατρός ' || coalesce(dep.code, '')) as recipient
      from public.microbiology_results m
      join public.laboratory_samples ls on ls.id = m.sample_id
      left join public.departments dep on dep.id = ls.department_id
      where m.organization_id = v_org and m.is_critical and m.critical_communicated_at is not null
    ) x
   where mr.id = x.id and mr.critical_communicated_to is distinct from x.recipient
     and not exists (select 1 from public.critical_result_communications c where c.microbiology_result_id = mr.id);

  -- ... and record the communication itself (the laboratory screen counts a
  -- critical result as pending until a communication row exists).
  insert into public.critical_result_communications(organization_id, microbiology_result_id, communicated_at, communicated_by,
    recipient_name, recipient_role, communication_method, read_back_confirmed, notes)
  select v_org, m.id, m.critical_communicated_at, p_actor, m.critical_communicated_to,
    case when m.critical_communicated_to like 'Δρ.%' then 'Θεράπων ιατρός' else 'Εφημερεύων ιατρός' end,
    'phone', true,
    'Τηλεφωνική ενημέρωση για θετική αιμοκαλλιέργεια (' || coalesce(m.organism, '—') || ') με επανάληψη του αποτελέσματος (read-back).'
  from public.microbiology_results m
  where m.organization_id = v_org and m.is_critical and m.critical_communicated_at is not null
    and not exists (select 1 from public.critical_result_communications c where c.microbiology_result_id = m.id);
end;
$function$;

create or replace function private.demo_seed_clinical_paediatric(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := current_date;
  v_now timestamptz := now();
  v_yy text := to_char(current_date, 'YY');
  v_nicu uuid := (select dep.id from public.departments dep where dep.organization_id = p_organization_id and dep.code = 'ΜΕΝΝ');
  v_neo uuid := (select p.id from public.patients p where p.organization_id = p_organization_id and p.patient_code = 'P-' || to_char(current_date, 'YY') || '0054');
  v_case uuid;
  v_doctor text;
begin
  if v_neo is null or v_nicu is null then
    return;
  end if;
  v_doctor := coalesce((select 'Δρ. ' || e.last_name || ' ' || e.first_name from public.employees e
                         where e.organization_id = v_org and e.department_id = v_nicu and e.profession_name = 'Ιατρός'
                         order by (e.employment_status <> 'active'), e.employee_code limit 1), 'Εφημερεύων νεογνολόγος');

  -- Neonatal CLABSI: PICC since day 2 of life, positive blood cultures six days ago
  if not exists (select 1 from public.surveillance_cases sc where sc.organization_id = v_org and sc.patient_id = v_neo) then
    v_case := gen_random_uuid();
    insert into public.surveillance_cases(id, organization_id, patient_id, department_id, status, started_at, created_by, admission_id)
    values (v_case, v_org, v_neo, v_nicu, 'active', (d0 - 6) + time '10:00', p_actor,
      (select a.id from public.patient_admissions a where a.patient_id = v_neo order by a.admission_date desc limit 1));

    insert into public.surveillance_events(organization_id, surveillance_case_id, event_type, event_status, occurred_at, payload, created_by, completed_by, completed_at)
    values (v_org, v_case, 'surveillance_start', 'completed', (d0 - 6) + time '10:00',
      jsonb_build_object('reviewDue', to_char(d0 + 1, 'YYYY-MM-DD'), 'room', 'Θερμοκοιτίδα 4',
        'reason', 'Θερμοκρασιακή αστάθεια, επεισόδια άπνοιας και θετική αιμοκαλλιέργεια σε νεογνό με PICC',
        'reasonEn', 'Temperature instability, apnoea episodes and a positive blood culture in a neonate with a PICC',
        'suspectedSource', 'bloodstream', 'detail', 'created'),
      p_actor, p_actor, (d0 - 6) + time '10:00');

    insert into public.hai_classifications(organization_id, surveillance_case_id, patient_id, case_status, hai_type, definition_set, definition_version,
      criteria_met, rationale, classified_at, classified_by)
    values (v_org, v_case, v_neo, 'confirmed', 'CLABSI', 'NHSN', 'PSC 2026 — κριτήρια ≤1 έτους', true,
      'Staphylococcus aureus σε αιμοκαλλιέργεια από PICC και σε επαναληπτική περιφερική αιμοκαλλιέργεια· PICC > 2 ημέρες· νεογνικά κριτήρια (άπνοια, θερμοκρασιακή αστάθεια).',
      (d0 - 4) + time '11:00', p_actor);

    insert into public.laboratory_samples(organization_id, patient_id, surveillance_case_id, department_id, sample_code, sample_type, source_site,
      requested_at, requested_by, collected_at, received_at, status, priority, subject_type, created_by, created_at)
    -- the peripheral culture is the next morning's repeat (persistent bacteraemia)
    select v_org, v_neo, v_case, v_nicu, 'LAB-' || to_char(s.d, 'YYMMDD') || '-' || s.n, 'bloodCulture', s.site,
      s.d + s.t - interval '20 minutes', p_actor, s.d + s.t, s.d + s.t + interval '25 minutes', 'completed', 'critical', 'patient', p_actor, s.d + s.t
    from (values ('121', 'Κεντρική φλεβική γραμμή (PICC)', d0 - 6, time '08:30'), ('122', 'Περιφερική αιμοληψία', d0 - 5, time '07:40')) s(n, site, d, t);
  end if;

  -- Paediatric samples (community infections — no surveillance case)
  insert into public.laboratory_samples(organization_id, patient_id, department_id, sample_code, sample_type, source_site,
    requested_at, requested_by, collected_at, received_at, status, priority, subject_type, created_by, created_at)
  select v_org, p.id, p.department_id, 'LAB-' || to_char(s.d, 'YYMMDD') || '-' || s.n, s.stype, s.site,
    coalesce(s.d + s.t, v_now) - interval '30 minutes', p_actor,
    case when s.st <> 'requested' then s.d + s.t end,
    case when s.st in ('received', 'processing', 'completed') then s.d + s.t + interval '30 minutes' end,
    s.st, s.pri, 'patient', p_actor, coalesce(s.d + s.t, v_now)
  from (values
    ('0050', d0 - 6, time '11:00', '123', 'bloodCulture', 'Περιφερική αιμοληψία', 'completed', 'routine'),
    ('0053', d0 - 9, time '13:00', '124', 'bloodCulture', 'Περιφερική αιμοληψία', 'completed', 'critical'),
    ('0051', d0 - 15, time '10:00', '125', 'urineCulture', 'Μέσο ρεύμα ούρων', 'completed', 'routine'),
    ('0052', d0 - 2, time '09:00', '126', 'other', 'Κόπρανα — καλλιέργεια και αντιγόνο ροταϊού', 'processing', 'routine'),
    ('0055', d0, time '07:30', '127', 'urineCulture', 'Ουροσυλλέκτης', 'requested', 'routine')
  ) s(code, d, t, n, stype, site, st, pri)
  join public.patients p on p.organization_id = v_org and p.patient_code = 'P-' || v_yy || s.code
  where not exists (select 1 from public.laboratory_samples x where x.organization_id = v_org and x.sample_code = 'LAB-' || to_char(s.d, 'YYMMDD') || '-' || s.n);

  -- Results: MSSA in the neonate's two blood cultures and the osteomyelitis
  -- blood culture, E. coli in the pyelonephritis urine, the rest negative.
  insert into public.microbiology_results(organization_id, sample_id, result_status, organism, resistance_class, susceptibility_summary,
    is_critical, critical_communicated_at, critical_communicated_to, resulted_at, validated_by, validated_at, created_by, method,
    preliminary, validation_status, interpretation_standard, interpretation_version)
  select v_org, ls.id, r.res, r.organism, null, r.summary, r.crit,
    case when r.crit then ls.collected_at + r.after + interval '15 minutes' end,
    case when r.crit then r.recipient end,
    ls.collected_at + r.after, p_actor, ls.collected_at + r.after, p_actor, 'culture', false, 'validated', 'EUCAST', '15.0'
  from (values
    ('121', 'positive', 'Staphylococcus aureus', 'Ευαίσθητο στη μεθικιλλίνη (MSSA)', true, interval '40 hours', v_doctor),
    ('122', 'positive', 'Staphylococcus aureus', 'Ευαίσθητο στη μεθικιλλίνη (MSSA)', true, interval '30 hours', v_doctor),
    ('123', 'negative', null, null, false, interval '5 days', null),
    ('124', 'positive', 'Staphylococcus aureus', 'Ευαίσθητο στη μεθικιλλίνη (MSSA)', true, interval '30 hours', 'Εφημερεύων παιδίατρος'),
    ('125', 'positive', 'Escherichia coli', 'Ευαίσθητο', false, interval '30 hours', null)
  ) r(n, res, organism, summary, crit, after, recipient)
  join public.laboratory_samples ls on ls.organization_id = v_org and ls.sample_code like 'LAB-%-' || r.n
    and ls.patient_id in (select p.id from public.patients p where p.organization_id = v_org and p.patient_code in ('P-' || v_yy || '0050', 'P-' || v_yy || '0051', 'P-' || v_yy || '0053', 'P-' || v_yy || '0054'))
  where not exists (select 1 from public.microbiology_results m where m.sample_id = ls.id);

  insert into public.antimicrobial_susceptibility_results(organization_id, microbiology_result_id, antimicrobial_code, antimicrobial_name, method,
    mic_value, mic_operator, sir_category, breakpoint_standard, breakpoint_version, created_by, organism_name, organism)
  select v_org, mr.id, a.code, a.name, 'MIC', a.mic, a.op, a.sir, 'EUCAST', '15.0', p_actor, mr.organism, mr.organism
  from public.microbiology_results mr
  join public.laboratory_samples ls on ls.id = mr.sample_id
  join (values
    ('Staphylococcus aureus', 'ABX-OXA', 'Oxacillin', 0.5, '=', 'S'), ('Staphylococcus aureus', 'ABX-VAN', 'Vancomycin', 1, '=', 'S'),
    ('Staphylococcus aureus', 'ABX-LNZ', 'Linezolid', 2, '=', 'S'), ('Staphylococcus aureus', 'ABX-AMP', 'Ampicillin', 4, '>=', 'R'),
    ('Escherichia coli', 'ABX-AMC', 'Amoxicillin/clavulanic acid', 4, '=', 'S'), ('Escherichia coli', 'ABX-CRO', 'Ceftriaxone', 0.5, '<=', 'S'),
    ('Escherichia coli', 'ABX-CIP', 'Ciprofloxacin', 0.25, '<=', 'S'), ('Escherichia coli', 'ABX-AMK', 'Amikacin', 2, '<=', 'S'),
    ('Escherichia coli', 'ABX-MEM', 'Meropenem', 0.125, '<=', 'S')
  ) a(organism, code, name, mic, op, sir) on a.organism = mr.organism
  where mr.organization_id = v_org and mr.result_status = 'positive'
    and ls.department_id in (select dep.id from public.departments dep where dep.organization_id = v_org and dep.code in ('ΠΑΙΔ', 'ΜΕΝΝ'))
    and not exists (select 1 from public.antimicrobial_susceptibility_results x where x.microbiology_result_id = mr.id);

  insert into public.critical_result_communications(organization_id, microbiology_result_id, communicated_at, communicated_by,
    recipient_name, recipient_role, communication_method, read_back_confirmed, notes)
  select v_org, mr.id, mr.critical_communicated_at, p_actor, mr.critical_communicated_to,
    case when dep.code = 'ΜΕΝΝ' then 'Νεογνολόγος' else 'Παιδίατρος' end, 'phone', true,
    'Gram θετικοί κόκκοι σε σωρούς στην αιμοκαλλιέργεια· ενημέρωση με επανάληψη (read-back).'
  from public.microbiology_results mr
  join public.laboratory_samples ls on ls.id = mr.sample_id
  join public.departments dep on dep.id = ls.department_id and dep.code in ('ΠΑΙΔ', 'ΜΕΝΝ')
  where mr.organization_id = v_org and mr.is_critical and mr.critical_communicated_at is not null
    and not exists (select 1 from public.critical_result_communications c where c.microbiology_result_id = mr.id);
end;
$function$;

-- Devices, assessments, reassessments, outcomes, antimicrobial therapy with
-- its administrations, isolation history and timeline events for every case
-- that has none yet (the 14 seeded cases and the neonatal case).
create or replace function private.demo_seed_clinical_case_depth(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  v_now timestamptz := now();
  r record;
  v_end timestamptz;
  v_neo boolean;
  v_age integer;
  v_kinds text[];
  v_ins timestamptz;
  v_step interval;
  v_isolated boolean;
  v_plan uuid;
  v_t1 uuid;
  v_t2 uuid;
  v_t1_code text; v_t1_dose text; v_t1_every interval; v_t1_end timestamptz; v_t1_status text;
  v_t2_code text; v_t2_dose text; v_t2_every interval; v_t2_route text; v_t2_start timestamptz; v_t2_plan_end timestamptz; v_t2_end timestamptz;
  v_signs jsonb;
  v_risks jsonb;
begin
  -- Start events: the application writes detail 'created' and an English reason
  update public.surveillance_events e
     set payload = e.payload || jsonb_build_object('detail', 'created',
           'reasonEn', coalesce(e.payload->>'reasonEn', case e.payload->>'reason'
             when 'Πυρετός και θετική αιμοκαλλιέργεια' then 'Fever and positive blood culture'
             when 'Ουρολοίμωξη σε ασθενή με καθετήρα' then 'Urinary tract infection in a catheterised patient'
             when 'Υποψία πνευμονίας σχετιζόμενης με αναπνευστήρα' then 'Suspected ventilator-associated pneumonia'
             when 'Φλεγμονή χειρουργικού τραύματος' then 'Surgical wound inflammation'
             when 'Αποικισμός με πολυανθεκτικό μικροοργανισμό' then 'Colonisation with a multidrug-resistant organism'
             else e.payload->>'reason' end)),
         updated_at = now()
   where e.organization_id = v_org and e.event_type = 'surveillance_start' and coalesce(e.payload->>'detail', '') = 'Demo';

  for r in
    select sc.id, sc.patient_id, sc.department_id, dep.code as dep_code, sc.status, sc.started_at as s, sc.closed_at as e, sc.close_reason,
      p.date_of_birth as dob, p.status as p_status,
      coalesce(pa.admission_date, p.admission_date, sc.started_at::date) as adm,
      coalesce(ev.payload->>'suspectedSource', 'other') as src, coalesce(ev.payload->>'reason', '') as reason,
      h.hai_type, h.case_status as hai_status,
      m.id as mr_id, m.sample_id, m.organism, m.resistance_class, m.resulted_at
    from public.surveillance_cases sc
    join public.patients p on p.id = sc.patient_id
    left join public.departments dep on dep.id = sc.department_id
    left join public.patient_admissions pa on pa.id = sc.admission_id
    left join lateral (select x.payload from public.surveillance_events x where x.surveillance_case_id = sc.id and x.event_type = 'surveillance_start' order by x.occurred_at limit 1) ev on true
    left join lateral (select x.hai_type, x.case_status from public.hai_classifications x where x.surveillance_case_id = sc.id order by x.classified_at desc limit 1) h on true
    left join lateral (
      select mr.id, mr.sample_id, mr.organism, mr.resistance_class, mr.resulted_at
      from public.microbiology_results mr join public.laboratory_samples ls on ls.id = mr.sample_id
      where ls.surveillance_case_id = sc.id and mr.result_status = 'positive' and mr.validation_status = 'validated'
      order by mr.resulted_at, mr.id limit 1) m on true
    where sc.organization_id = v_org and sc.status <> 'cancelled'
      and not exists (select 1 from public.surveillance_devices d where d.surveillance_case_id = sc.id)
      and not exists (select 1 from public.antimicrobial_therapies t where t.surveillance_case_id = sc.id)
    order by sc.started_at
  loop
    v_end := coalesce(r.e, v_now);
    v_age := extract(year from age(r.s::date, r.dob))::int;
    v_neo := r.dob is not null and r.s::date - r.dob <= 60;

    -- 1. Devices ------------------------------------------------------------
    v_kinds := array_remove(array[
      case when r.hai_type = 'CLABSI' or r.src = 'bloodstream' or r.dep_code in ('ΜΕΘ', 'ΜΕΝΝ') then 'cvc' end,
      case when r.hai_type = 'CAUTI' or r.src = 'urinary' or r.dep_code = 'ΜΕΘ' then 'uc' end,
      case when r.hai_type = 'VAP' or (r.src = 'respiratory' and r.dep_code = 'ΜΕΘ') then 'vent' end,
      case when r.dep_code not in ('ΜΕΘ', 'ΜΕΝΝ') and (r.src in ('surgicalSite', 'other') or coalesce(r.hai_type, '') not in ('CLABSI', 'CAUTI', 'VAP')) then 'piv' end
    ], null);
    v_ins := greatest(r.adm + time '08:00', r.s - interval '10 days');

    insert into public.surveillance_devices(organization_id, surveillance_case_id, patient_id, department_id, device_type, site, indication,
      inserted_at, review_due_at, removed_at, status, created_by, updated_by)
    select v_org, r.id, r.patient_id, r.department_id, k.dtype, k.site, k.ind, k.ins,
      case when k.rem is null then (current_date + (abs(hashtext(r.id::text || k.kind)) % 3) - 1) + time '09:00' end,
      k.rem, case when k.rem is null then 'active' else 'removed' end, p_actor, p_actor
    from (
      select k.kind, k.dtype, k.site, k.ind, k.ins,
        case when r.status = 'closed' then greatest(k.ins + interval '1 day', r.e - interval '1 day')
             when k.planned_rem is not null and k.planned_rem < v_now - interval '6 hours' then k.planned_rem end as rem
      from (values
        ('cvc', case when v_neo then 'Κεντρικός φλεβικός καθετήρας (CVC) — PICC' else 'Κεντρικός φλεβικός καθετήρας (CVC)' end,
                case when v_neo then 'Δεξιά βασιλική φλέβα' else 'Δεξιά έσω σφαγίτιδα' end,
                case when v_neo then 'Παρεντερική σίτιση' else 'Ενδοφλέβια αγωγή / αγγειοδραστικά' end,
                v_ins, case when r.hai_type = 'CLABSI' then r.s + interval '2 days' end),
        ('uc', 'Ουροκαθετήρας (Foley)', 'Ουρήθρα', 'Παρακολούθηση διούρησης', v_ins + interval '1 hour',
                case when r.hai_type = 'CAUTI' then r.s + interval '1 day' else r.s + interval '6 days' end),
        ('vent', 'Μηχανικός αερισμός (ventilator)', 'Ενδοτραχειακός σωλήνας', 'Οξεία αναπνευστική ανεπάρκεια', v_ins + interval '30 minutes',
                r.s + interval '8 days'),
        ('piv', 'Περιφερικός φλεβικός καθετήρας', 'Αριστερό αντιβράχιο', 'Ενδοφλέβια ενυδάτωση και φάρμακα', v_ins + interval '2 hours',
                r.s + interval '3 days')
      ) k(kind, dtype, site, ind, ins, planned_rem)
      where k.kind = any(v_kinds)
    ) k;

    -- 2. Clinical assessments: initial, then after the laboratory result -----
    v_signs := case r.src
      when 'bloodstream' then '["Πυρετός","Ρίγος","Υπόταση"]'::jsonb
      when 'urinary' then '["Πυρετός","Δυσουρία","Άλγος"]'::jsonb
      when 'respiratory' then '["Πυρετός","Βήχας","Δύσπνοια"]'::jsonb
      when 'surgicalSite' then '["Πυρετός","Άλγος","Ερύθημα / εκροή"]'::jsonb
      else '["Πυρετός"]'::jsonb end;
    if v_neo then v_signs := '["Θερμοκρασιακή αστάθεια","Άπνοια","Βραδυκαρδία"]'::jsonb; end if;
    v_risks := to_jsonb(array_remove(array[
      case when r.dep_code = 'ΜΕΘ' then 'Νοσηλεία σε ΜΕΘ' end,
      case when v_age >= 65 then 'Ηλικία ≥ 65 ετών' end,
      case when v_neo then 'Προωρότητα / χαμηλό βάρος γέννησης' end,
      case when r.dep_code = 'ΝΕΦ' then 'Χρόνια νεφρική νόσος' end,
      case when r.dep_code in ('ΧΕΙΡ', 'ΟΡΘ') then 'Πρόσφατη χειρουργική επέμβαση' end,
      case when r.dep_code = 'ΚΑΡΔ' then 'Καρδιακή ανεπάρκεια' end,
      case when r.dep_code = 'ΠΑΘ' then 'Σακχαρώδης διαβήτης' end,
      'Πρόσφατη αντιμικροβιακή αγωγή'
    ], null));

    insert into public.clinical_assessments(organization_id, surveillance_case_id, patient_id, department_id, assessment_type, classification,
      signs_symptoms, risk_factors, summary, assessed_at, created_by, updated_by)
    values (v_org, r.id, r.patient_id, r.department_id, 'initial', 'under_investigation', v_signs, v_risks,
      'Αρχική αξιολόγηση: ' || coalesce(nullif(r.reason, ''), 'κλινική υποψία λοίμωξης') || '. Λήψη καλλιεργειών πριν από την έναρξη εμπειρικής αγωγής.',
      r.s + interval '1 hour', p_actor, p_actor);

    if r.s + interval '2 days' < v_end then
      insert into public.clinical_assessments(organization_id, surveillance_case_id, patient_id, department_id, assessment_type, classification,
        signs_symptoms, risk_factors, summary, assessed_at, created_by, updated_by)
      select v_org, r.id, r.patient_id, r.department_id, x.atype, x.cls, v_signs, v_risks, x.summary,
        least(r.s + interval '2 days 3 hours', v_end - interval '1 hour'), p_actor, p_actor
      from (select
          case when r.hai_status = 'confirmed' then 'confirmed_infection' when r.hai_status = 'probable' then 'hai_review'
               when r.hai_status = 'suspected' then 'suspected_infection' when r.organism is not null then 'confirmed_infection' else 'follow_up' end as atype,
          case when r.hai_status = 'confirmed' then 'confirmed_infection' when r.hai_status = 'probable' then 'probable_infection'
               when r.hai_status = 'suspected' then 'under_investigation' when r.organism is not null then 'infection' else 'no_infection' end as cls,
          case when r.organism is not null then 'Απομονώθηκε ' || r.organism || coalesce(' (' || r.resistance_class || ')', '') ||
                 case when r.hai_type is not null then ' — αξιολόγηση ως ' || r.hai_type || ' (' || r.hai_status || ').' else '.' end
               when r.hai_type is not null then 'Αρνητικές καλλιέργειες μέχρι στιγμής· τα κριτήρια ' || r.hai_type || ' παραμένουν υπό διερεύνηση.'
               else 'Αρνητικές καλλιέργειες· δεν τεκμηριώνεται νοσοκομειακή λοίμωξη.' end as summary) x
      where r.organism is not null or r.hai_type is not null or r.status = 'closed';
    end if;

    -- 3. Isolation: resistant isolates of closed cases were isolated until the end
    if r.status = 'closed' and r.resistance_class is not null and r.resulted_at is not null
       and not exists (select 1 from public.isolation_episodes i where i.surveillance_case_id = r.id) then
      insert into public.isolation_episodes(organization_id, patient_id, surveillance_case_id, department_id, precautions, room, reason,
        started_at, review_due_at, ended_at, end_reason, status, created_by, updated_by, ended_by)
      values (v_org, r.patient_id, r.id, r.department_id, '["contact"]'::jsonb, 'Θάλαμος απομόνωσης ' || (1 + abs(hashtext(r.id::text)) % 6),
        'Απομόνωση επαφής — ' || r.organism || ' ' || r.resistance_class, r.resulted_at, r.resulted_at + interval '72 hours',
        r.e, 'Λήξη επιτήρησης — κλινική ίαση και αρνητικές καλλιέργειες επιτήρησης', 'ended', p_actor, p_actor, p_actor);
    end if;
    v_isolated := exists (select 1 from public.isolation_episodes i where i.surveillance_case_id = r.id);
    if not v_isolated then
      insert into public.surveillance_events(organization_id, surveillance_case_id, event_type, event_status, occurred_at, payload, created_by, completed_by, completed_at)
      values (v_org, r.id, 'isolation_not_required', 'completed', r.s + interval '6 hours', '{"required":false,"detail":"no"}'::jsonb, p_actor, p_actor, r.s + interval '6 hours');
    end if;

    -- 4. Reassessments -------------------------------------------------------
    v_step := greatest(interval '3 days', (v_end - r.s) / 5);
    insert into public.surveillance_reassessments(organization_id, surveillance_case_id, patient_id, clinical_status, isolation_decision, therapy_decision,
      notes, reassessed_at, next_review_due_at, created_by)
    select v_org, r.id, r.patient_id,
      case when k = 1 and r.hai_type = 'VAP' then 'deteriorated' when k = 1 then 'stable' else 'improved' end,
      case when v_isolated then 'continue' else 'not_applicable' end,
      case when k = 1 and r.organism is not null then 'modify' else 'continue' end,
      case when k = 1 and r.organism is not null then 'Αποκλιμάκωση σε στοχευμένη αγωγή βάσει αντιβιογράμματος.'
           when k = 1 then 'Αναμονή αποτελεσμάτων καλλιεργειών· συνέχιση εμπειρικής αγωγής.'
           else 'Κλινική βελτίωση, απύρετος/η· συνέχιση παρακολούθησης.' end,
      r.s + k * v_step, r.s + (k + 1) * v_step, p_actor
    from generate_series(1, 5) k
    where r.s + k * v_step < v_end - case when r.status = 'closed' then interval '1 day' else interval '2 hours' end;

    if r.status = 'closed' then
      insert into public.surveillance_reassessments(organization_id, surveillance_case_id, patient_id, clinical_status, isolation_decision, therapy_decision,
        notes, reassessed_at, next_review_due_at, created_by)
      values (v_org, r.id, r.patient_id, 'resolved', case when v_isolated then 'discontinue' else 'not_applicable' end, 'stop',
        'Ολοκλήρωση θεραπείας, κλινική ίαση· λήξη επιτήρησης.', r.e - interval '2 hours', null, p_actor);

      -- 5. Outcome of the closed cases
      insert into public.surveillance_outcomes(organization_id, surveillance_case_id, patient_id, outcome, occurred_at, notes, created_by)
      values (v_org, r.id, r.patient_id, case when r.p_status = 'discharged' then 'discharged' else 'resolved' end, r.e,
        coalesce(r.close_reason, 'Κλινική ίαση'), p_actor)
      on conflict (surveillance_case_id) do nothing;
    end if;

    -- 6. Antimicrobial therapy: empirical, then targeted on the isolate -------
    v_plan := gen_random_uuid();
    if v_neo then v_t1_code := 'ABX-VAN'; v_t1_dose := '15 mg/kg'; v_t1_every := interval '12 hours';
    elsif r.dep_code = 'ΜΕΘ' then v_t1_code := 'ABX-MEM'; v_t1_dose := '1 g'; v_t1_every := interval '8 hours';
    elsif r.src = 'urinary' then v_t1_code := 'ABX-CRO'; v_t1_dose := '2 g'; v_t1_every := interval '24 hours';
    elsif r.src = 'surgicalSite' then v_t1_code := 'ABX-AMC'; v_t1_dose := '1,2 g'; v_t1_every := interval '8 hours';
    else v_t1_code := 'ABX-PTZ'; v_t1_dose := '4,5 g'; v_t1_every := interval '8 hours';
    end if;
    if r.organism is not null and r.resulted_at is not null then
      v_t1_end := least(r.resulted_at + interval '1 hour', v_end - interval '2 hours'); v_t1_status := 'stopped';
    elsif r.status = 'closed' or r.s < v_now - interval '10 days' then
      v_t1_end := least(r.s + interval '3 days', v_end - interval '2 hours'); v_t1_status := 'stopped';
    else
      v_t1_end := null; v_t1_status := 'active';
    end if;

    v_t1 := gen_random_uuid();
    insert into public.antimicrobial_therapies(id, organization_id, patient_id, surveillance_case_id, antimicrobial, dose, route, indication,
      started_at, planned_end_at, ended_at, approval_status, status, created_by, updated_by, therapy_plan_id, source)
    values (v_t1, v_org, r.patient_id, r.id,
      coalesce((select mli.name_el from public.master_library_items mli where mli.organization_id = v_org and mli.library_key = 'antibiotics' and mli.code = v_t1_code limit 1),
               case v_t1_code when 'ABX-VAN' then 'Βανκομυκίνη' when 'ABX-MEM' then 'Μεροπενέμη' when 'ABX-CRO' then 'Κεφτριαξόνη'
                              when 'ABX-AMC' then 'Αμοξικιλλίνη/Κλαβουλανικό' else 'Πιπερακιλλίνη/Ταζομπακτάμη' end),
      v_t1_dose, 'IV',
      'Εμπειρική αγωγή — ' || coalesce(nullif(r.reason, ''), 'υποψία λοίμωξης') ||
        case when v_t1_status = 'stopped' and r.organism is null then '. Διακοπή: αρνητικές καλλιέργειες.' else '' end,
      r.s + interval '2 hours', r.s + interval '7 days', v_t1_end,
      case when v_t1_code in ('ABX-MEM', 'ABX-COL', 'ABX-LNZ', 'ABX-CZA') then 'approved' else 'not_required' end,
      v_t1_status, p_actor, p_actor, v_plan, 'patient_record');

    v_t2 := null;
    if r.organism is not null and r.resulted_at is not null then
      if r.organism ilike 'Klebsiella%' and r.resistance_class is not null then v_t2_code := 'ABX-CZA'; v_t2_dose := '2,5 g'; v_t2_every := interval '8 hours'; v_t2_route := 'IV';
      elsif r.organism ilike 'Pseudomonas%' and r.resistance_class = 'XDR' then v_t2_code := 'ABX-COL'; v_t2_dose := '4,5 MU'; v_t2_every := interval '12 hours'; v_t2_route := 'IV';
      elsif r.organism ilike 'Pseudomonas%' then v_t2_code := 'ABX-PTZ'; v_t2_dose := '4,5 g'; v_t2_every := interval '8 hours'; v_t2_route := 'IV';
      elsif r.organism ilike 'Acinetobacter%' then v_t2_code := 'ABX-MEM'; v_t2_dose := '2 g (παρατεταμένη έγχυση)'; v_t2_every := interval '8 hours'; v_t2_route := 'IV';
      elsif r.organism ilike 'Staphylococcus aureus%' then v_t2_code := 'ABX-OXA'; v_t2_dose := case when v_neo then '50 mg/kg' else '2 g' end;
            v_t2_every := case when v_neo then interval '8 hours' else interval '6 hours' end; v_t2_route := 'IV';
      elsif r.organism ilike 'Enterococcus%' then v_t2_code := 'ABX-VAN'; v_t2_dose := '1 g'; v_t2_every := interval '12 hours'; v_t2_route := 'IV';
      elsif r.organism ilike 'Escherichia coli%' then v_t2_code := 'ABX-AMC'; v_t2_dose := '1 g'; v_t2_every := interval '12 hours'; v_t2_route := 'PO';
      else v_t2_code := 'ABX-PTZ'; v_t2_dose := '4,5 g'; v_t2_every := interval '8 hours'; v_t2_route := 'IV';
      end if;
      v_t2_start := r.resulted_at + interval '2 hours';
      v_t2_plan_end := v_t2_start + case when v_neo then interval '10 days' else interval '10 days' end;
      v_t2_end := case when v_t2_plan_end <= least(v_now, v_end) then v_t2_plan_end
                       when r.status = 'closed' then r.e - interval '3 hours' end;
      if v_t2_start < v_end - interval '1 hour' then
        v_t2 := gen_random_uuid();
        insert into public.antimicrobial_therapies(id, organization_id, patient_id, surveillance_case_id, antimicrobial, dose, route, indication,
          started_at, planned_end_at, ended_at, approval_status, status, created_by, updated_by, therapy_plan_id, source, laboratory_result_id, laboratory_sample_id)
        values (v_t2, v_org, r.patient_id, r.id,
          coalesce((select mli.name_el from public.master_library_items mli where mli.organization_id = v_org and mli.library_key = 'antibiotics' and mli.code = v_t2_code limit 1),
                   case v_t2_code when 'ABX-VAN' then 'Βανκομυκίνη' when 'ABX-MEM' then 'Μεροπενέμη' when 'ABX-OXA' then 'Οξακιλλίνη' when 'ABX-COL' then 'Κολιστίνη'
                                  when 'ABX-CZA' then 'Κεφταζιδίμη/Αβιμπακτάμη' when 'ABX-AMC' then 'Αμοξικιλλίνη/Κλαβουλανικό' else 'Πιπερακιλλίνη/Ταζομπακτάμη' end),
          v_t2_dose, v_t2_route,
          'Στοχευμένη αγωγή βάσει αντιβιογράμματος — ' || r.organism || coalesce(' ' || r.resistance_class, ''),
          v_t2_start, v_t2_plan_end, v_t2_end,
          case when v_t2_code in ('ABX-MEM', 'ABX-COL', 'ABX-LNZ', 'ABX-CZA') then 'approved' else 'not_required' end,
          case when v_t2_end is null then 'active' else 'completed' end, p_actor, p_actor, v_plan, 'laboratory', r.mr_id, r.sample_id);
      end if;
    end if;

    -- Administrations, one per dosing interval; now and then a dose is withheld
    insert into public.antimicrobial_therapy_administrations(organization_id, therapy_id, administered_at, dose, route, status, withheld_reason, administered_by, notes, created_by)
    select v_org, t.id, a.at, t.dose, t.route,
      case when a.n % 13 = 7 then 'withheld' else 'administered' end,
      case when a.n % 13 = 7 then (array['Ο ασθενής βρισκόταν σε απεικονιστικό έλεγχο', 'Αναμονή επιπέδων φαρμάκου', 'Νηστεία για επέμβαση'])[1 + (a.n / 13) % 3] end,
      p_actor, null, p_actor
    from public.antimicrobial_therapies t
    cross join lateral (
      select row_number() over (order by g) as n, g as at
      from generate_series(t.started_at,
                           coalesce(t.ended_at, v_now) - interval '1 minute',
                           case when t.id = v_t1 then v_t1_every else coalesce(v_t2_every, interval '8 hours') end) g
    ) a
    where t.id in (v_t1, v_t2) and t.approval_status in ('not_required', 'approved');
  end loop;
end;
$function$;

-- Klebsiella pneumoniae KPC cluster in the ICU over the last ten days: the
-- index patient (VAP), a colonised neighbour, a CLABSI in the patient
-- transferred from Surgery and an acquisition in a long-stay patient.
create or replace function private.demo_seed_clinical_kpc_cluster(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := current_date;
  v_now timestamptz := now();
  v_yy text := to_char(current_date, 'YY');
  v_icu uuid := (select dep.id from public.departments dep where dep.organization_id = p_organization_id and dep.code = 'ΜΕΘ');
  v_p42 uuid := (select p.id from public.patients p where p.organization_id = p_organization_id and p.patient_code = 'P-' || to_char(current_date, 'YY') || '0042');
  v_p30 uuid := (select p.id from public.patients p where p.organization_id = p_organization_id and p.patient_code = 'P-' || to_char(current_date, 'YY') || '0030');
  v_p49 uuid := (select p.id from public.patients p where p.organization_id = p_organization_id and p.patient_code = 'P-' || to_char(current_date, 'YY') || '0049');
  v_p06 uuid := (select p.id from public.patients p where p.organization_id = p_organization_id and p.patient_code = 'P-' || to_char(current_date, 'YY') || '0006');
  v_p18 uuid := (select p.id from public.patients p where p.organization_id = p_organization_id and p.patient_code = 'P-' || to_char(current_date, 'YY') || '0018');
  v_p48 uuid := (select p.id from public.patients p where p.organization_id = p_organization_id and p.patient_code = 'P-' || to_char(current_date, 'YY') || '0048');
  v_c42 uuid; v_c30 uuid; v_c49 uuid; v_c06 uuid;
  v_plan uuid := gen_random_uuid();
  v_plan49 uuid := gen_random_uuid();
  v_kpc text := 'Παραγωγός καρβαπενεμάσης KPC (blaKPC+) — ανθεκτικό σε καρβαπενέμες, κεφαλοσπορίνες, πιπερακιλλίνη/ταζομπακτάμη και κινολόνες· ευαίσθητο σε κεφταζιδίμη/αβιμπακτάμη, αμικασίνη και κολιστίνη';
begin
  if v_icu is null or v_p42 is null or v_p30 is null or v_p49 is null or v_p06 is null then
    return;
  end if;
  if exists (select 1 from public.laboratory_samples ls where ls.organization_id = v_org and ls.sample_code = 'LAB-' || to_char(d0 - 9, 'YYMMDD') || '-101') then
    return;
  end if;
  v_c06 := (select sc.id from public.surveillance_cases sc where sc.organization_id = v_org and sc.patient_id = v_p06 and sc.status = 'active' order by sc.started_at desc limit 1);

  -- Cases ------------------------------------------------------------------
  v_c42 := gen_random_uuid(); v_c30 := gen_random_uuid(); v_c49 := gen_random_uuid();
  insert into public.surveillance_cases(id, organization_id, patient_id, department_id, status, started_at, created_by, admission_id)
  select x.id, v_org, x.pid, v_icu, 'active', x.s, p_actor,
    (select a.id from public.patient_admissions a where a.patient_id = x.pid and a.department_id = v_icu order by a.admission_date desc limit 1)
  from (values (v_c42, v_p42, (d0 - 9) + time '11:00'), (v_c30, v_p30, (d0 - 5) + time '12:00'), (v_c49, v_p49, (d0 - 5) + time '07:00')) x(id, pid, s);

  insert into public.surveillance_events(organization_id, surveillance_case_id, event_type, event_status, occurred_at, payload, created_by, completed_by, completed_at)
  select v_org, x.id, 'surveillance_start', 'completed', x.s,
    jsonb_build_object('reviewDue', to_char(x.due, 'YYYY-MM-DD'), 'room', x.room, 'reason', x.reason, 'reasonEn', x.reason_en,
      'suspectedSource', x.src, 'detail', 'created'),
    p_actor, p_actor, x.s
  from (values
    (v_c42, (d0 - 9) + time '11:00', d0 - 1, 'ΜΕΘ — Κλίνη 8', 'Υποψία πνευμονίας σχετιζόμενης με αναπνευστήρα', 'Suspected ventilator-associated pneumonia', 'respiratory'),
    (v_c30, (d0 - 5) + time '12:00', d0 + 2, 'ΜΕΘ — Κλίνη 9', 'Αποικισμός με πολυανθεκτικό μικροοργανισμό', 'Colonisation with a multidrug-resistant organism', 'other'),
    (v_c49, (d0 - 5) + time '07:00', d0, 'ΜΕΘ — Κλίνη 10', 'Πυρετός και θετική αιμοκαλλιέργεια', 'Fever and positive blood culture', 'bloodstream')
  ) x(id, s, due, room, reason, reason_en, src);

  insert into public.hai_classifications(organization_id, surveillance_case_id, patient_id, case_status, hai_type, definition_set, definition_version, criteria_met, rationale, classified_at, classified_by)
  values
    (v_org, v_c42, v_p42, 'probable', 'VAP', 'ECDC', 'HAI-Net 2023', true,
     'PN2: νέο διήθημα στην ακτινογραφία, πυώδεις εκκρίσεις, επιδείνωση οξυγόνωσης· ποσοτική καλλιέργεια BAL ≥ 10⁴ CFU/mL KPC-Kp.', (d0 - 6) + time '10:00', p_actor),
    (v_org, v_c49, v_p49, 'confirmed', 'CLABSI', 'ECDC', 'HAI-Net 2023', true,
     'Βακτηριαιμία από KPC-Kp σε ασθενή με ΚΦΚ > 48 ώρες, χωρίς άλλη εστία· ταυτόσημο στέλεχος σε κεντρική και περιφερική αιμοκαλλιέργεια.', (d0 - 3) + time '09:00', p_actor);

  -- Samples ------------------------------------------------------------------
  insert into public.laboratory_samples(organization_id, patient_id, surveillance_case_id, department_id, sample_code, sample_type, source_site,
    requested_at, requested_by, collected_at, received_at, status, priority, subject_type, created_by, created_at)
  select v_org, s.pid, s.cid, v_icu, 'LAB-' || to_char(s.at, 'YYMMDD') || '-' || s.n, s.stype, s.site,
    s.at - interval '30 minutes', p_actor, s.at, s.at + interval '30 minutes', s.st, s.pri, 'patient', p_actor, s.at
  from (values
    ('101', v_p42, v_c42, (d0 - 9) + time '08:30', 'respiratorySample', 'BAL', 'completed', 'urgent'),
    ('102', v_p42, v_c42, (d0 - 8) + time '09:00', 'other', 'Ορθικό επίχρισμα — screening CPE', 'completed', 'routine'),
    ('103', v_p30, v_c30, (d0 - 7) + time '09:00', 'other', 'Ορθικό επίχρισμα — screening CPE', 'completed', 'routine'),
    ('104', v_p06, v_c06, (d0 - 7) + time '09:10', 'other', 'Ορθικό επίχρισμα — screening CPE', 'completed', 'routine'),
    ('105', v_p18, null, (d0 - 7) + time '09:20', 'other', 'Ορθικό επίχρισμα — screening CPE', 'completed', 'routine'),
    ('106', v_p48, null, (d0 - 7) + time '09:30', 'other', 'Ορθικό επίχρισμα — screening CPE', 'completed', 'routine'),
    ('107', v_p49, v_c49, (d0 - 5) + time '06:00', 'bloodCulture', 'Κεντρική φλεβική γραμμή', 'completed', 'critical'),
    ('108', v_p49, v_c49, (d0 - 5) + time '06:10', 'bloodCulture', 'Περιφερική αιμοληψία', 'completed', 'critical'),
    ('109', v_p06, v_c06, (d0 - 3) + time '09:00', 'other', 'Ορθικό επίχρισμα — screening CPE', 'completed', 'routine'),
    ('110', v_p49, v_c49, (d0 - 2) + time '06:00', 'bloodCulture', 'Περιφερική αιμοληψία', 'processing', 'urgent'),
    ('111', v_p42, v_c42, (d0 - 1) + time '07:00', 'bloodCulture', 'Περιφερική αιμοληψία', 'processing', 'urgent'),
    ('112', v_p30, v_c30, (d0 - 1) + time '08:00', 'urineCulture', 'Ουροκαθετήρας', 'received', 'routine')
  ) s(n, pid, cid, at, stype, site, st, pri)
  where s.pid is not null;

  -- Results (validated): six KPC isolates in four patients, three negative screens
  insert into public.microbiology_results(organization_id, sample_id, result_status, organism, resistance_class, susceptibility_summary,
    is_critical, critical_communicated_at, critical_communicated_to, resulted_at, validated_by, validated_at, created_by, method,
    preliminary, validation_status, interpretation_standard, interpretation_version)
  select v_org, ls.id, case when r.pos then 'positive' else 'negative' end,
    case when r.pos then 'Klebsiella pneumoniae' end, case when r.pos then 'MDR' end, case when r.pos then v_kpc end,
    r.crit, case when r.crit then ls.collected_at + r.after + interval '15 minutes' end,
    case when r.crit then 'Εφημερεύων εντατικολόγος ΜΕΘ' end,
    ls.collected_at + r.after, p_actor, ls.collected_at + r.after, p_actor,
    case when r.pos then 'culture + carba-NP / ανοσοχρωματογραφία KPC' else 'culture (chromogenic CPE agar)' end,
    false, 'validated', 'EUCAST', '15.0'
  from (values
    ('101', true, true, interval '49 hours 30 minutes'), ('102', true, false, interval '50 hours'), ('103', true, false, interval '49 hours'),
    ('104', false, false, interval '49 hours'), ('105', false, false, interval '49 hours'), ('106', false, false, interval '48 hours 30 minutes'),
    ('107', true, true, interval '32 hours'), ('108', true, true, interval '32 hours'), ('109', true, false, interval '49 hours')
  ) r(n, pos, crit, after)
  join public.laboratory_samples ls on ls.organization_id = v_org and ls.department_id = v_icu and ls.sample_code like 'LAB-%-' || r.n
   and ls.collected_at >= (d0 - 12)::timestamptz;

  insert into public.antimicrobial_susceptibility_results(organization_id, microbiology_result_id, antimicrobial_code, antimicrobial_name, method,
    mic_value, mic_operator, sir_category, breakpoint_standard, breakpoint_version, notes, created_by, organism_name, organism)
  select v_org, mr.id, a.code, a.name, 'MIC', a.mic, a.op, a.sir, 'EUCAST', '15.0', a.note, p_actor, mr.organism, mr.organism
  from public.microbiology_results mr
  join public.laboratory_samples ls on ls.id = mr.sample_id and ls.department_id = v_icu and ls.collected_at >= (d0 - 12)::timestamptz
  cross join (values
    ('ABX-MEM', 'Meropenem', 16, '>=', 'R', 'Καρβαπενεμάση KPC (ανοσοχρωματογραφία)'), ('ABX-CRO', 'Ceftriaxone', 64, '>=', 'R', null),
    ('ABX-PTZ', 'Piperacillin/Tazobactam', 128, '>=', 'R', null), ('ABX-CIP', 'Ciprofloxacin', 4, '>=', 'R', null),
    ('ABX-AMK', 'Amikacin', 4, '=', 'S', null), ('ABX-COL', 'Colistin', 0.5, '=', 'S', 'Broth microdilution'),
    ('ABX-CZA', 'Ceftazidime/avibactam', 2, '=', 'S', null)
  ) a(code, name, mic, op, sir, note)
  where mr.organization_id = v_org and mr.organism = 'Klebsiella pneumoniae' and mr.result_status = 'positive'
    and not exists (select 1 from public.antimicrobial_susceptibility_results x where x.microbiology_result_id = mr.id);

  insert into public.amr_classifications(organization_id, microbiology_result_id, classification, definition_source, definition_version, calculation_snapshot,
    status, rationale, classified_by, classified_at, organism)
  select v_org, mr.id, 'MDR', 'Magiorakos et al. (ECDC/CDC)', '2012',
    jsonb_build_object('mechanism', 'KPC', 'categoriesTested', 6,
      'nonSusceptibleCategories', jsonb_build_array('carbapenems', 'extendedSpectrumCephalosporins', 'antipseudomonalPenicillinsBetaLactamaseInhibitors', 'fluoroquinolones'),
      'susceptibleCategories', jsonb_build_array('aminoglycosides', 'polymyxins')),
    'confirmed', 'Μη ευαισθησία σε ≥ 3 κατηγορίες αντιμικροβιακών (καρβαπενέμες, κεφαλοσπορίνες, πιπερακιλλίνη/ταζομπακτάμη, κινολόνες) — CPE / KPC.',
    p_actor, mr.resulted_at + interval '30 minutes', mr.organism
  from public.microbiology_results mr
  join public.laboratory_samples ls on ls.id = mr.sample_id and ls.department_id = v_icu and ls.collected_at >= (d0 - 12)::timestamptz
  where mr.organization_id = v_org and mr.organism = 'Klebsiella pneumoniae'
    and not exists (select 1 from public.amr_classifications x where x.microbiology_result_id = mr.id);

  -- Critical result communications: first CPE detection in the unit, and the bacteraemia
  insert into public.critical_result_communications(organization_id, microbiology_result_id, communicated_at, communicated_by,
    recipient_name, recipient_role, communication_method, read_back_confirmed, notes)
  select v_org, mr.id, mr.critical_communicated_at + c.lag, p_actor, c.recipient, c.role, c.method, c.readback, c.notes
  from public.microbiology_results mr
  join public.laboratory_samples ls on ls.id = mr.sample_id and ls.department_id = v_icu and ls.collected_at >= (d0 - 12)::timestamptz
  join (values
    ('101', interval '0', 'Εφημερεύων εντατικολόγος ΜΕΘ', 'Ιατρός ΜΕΘ', 'phone', true, 'Πρώτη ανίχνευση KPC-Kp στη ΜΕΘ (BAL). Συστάθηκαν άμεσα προφυλάξεις επαφής.'),
    ('101', interval '15 minutes', 'Νοσηλεύτρια Επιτήρησης Λοιμώξεων', 'Ομάδα Ελέγχου Λοιμώξεων', 'in_person', true, 'Ενημέρωση ΟΕΛ για νέο CPE — έναρξη screening επαφών.'),
    ('107', interval '0', 'Εφημερεύων εντατικολόγος ΜΕΘ', 'Ιατρός ΜΕΘ', 'phone', true, 'Gram αρνητικά βακτήρια σε αιμοκαλλιέργεια από ΚΦΚ — KPC θετικό. Read-back επιβεβαιώθηκε.'),
    ('108', interval '0', 'Εφημερεύων εντατικολόγος ΜΕΘ', 'Ιατρός ΜΕΘ', 'phone', true, 'Περιφερική αιμοκαλλιέργεια θετική για KPC-Kp (ίδιο επεισόδιο).')
  ) c(n, lag, recipient, role, method, readback, notes) on ls.sample_code like 'LAB-%-' || c.n
  where mr.organization_id = v_org and mr.is_critical;

  -- Contact precautions (active) — single room for the index patient, CPE cohort for the others
  insert into public.isolation_episodes(organization_id, patient_id, surveillance_case_id, department_id, precautions, room, reason, started_at, review_due_at, status, created_by, updated_by)
  select v_org, x.pid, x.cid, v_icu, '["contact"]'::jsonb, x.room, 'Προφυλάξεις επαφής — Klebsiella pneumoniae KPC (CPE)', x.st, x.due, 'active', p_actor, p_actor
  from (values
    (v_p42, v_c42, 'Θάλαμος απομόνωσης 1 (κλίνη 8)', (d0 - 7) + time '10:30', (d0 - 1) + time '10:00'),
    (v_p30, v_c30, 'Κοόρτη CPE — κλίνη 9', (d0 - 5) + time '10:30', (d0 + 2) + time '10:00'),
    (v_p49, v_c49, 'Κοόρτη CPE — κλίνη 10', (d0 - 4) + time '14:30', (d0 + 1) + time '10:00'),
    (v_p06, v_c06, 'Κοόρτη CPE — κλίνη 7', (d0 - 1) + time '10:30', (d0 + 2) + time '10:00')
  ) x(pid, cid, room, st, due)
  where x.cid is not null;

  -- Devices
  insert into public.surveillance_devices(organization_id, surveillance_case_id, patient_id, department_id, device_type, site, indication,
    inserted_at, review_due_at, removed_at, status, created_by, updated_by)
  select v_org, x.cid, x.pid, v_icu, x.dtype, x.site, x.ind, x.ins, case when x.rem is null then x.due end, x.rem,
    case when x.rem is null then 'active' else 'removed' end, p_actor, p_actor
  from (values
    (v_c42, v_p42, 'Μηχανικός αερισμός (ventilator)', 'Ενδοτραχειακός σωλήνας', 'Οξεία αναπνευστική ανεπάρκεια', (d0 - 15) + time '06:00', null::timestamptz, (d0 + 1) + time '09:00'),
    (v_c42, v_p42, 'Κεντρικός φλεβικός καθετήρας (CVC)', 'Δεξιά υποκλείδιος', 'Αγγειοδραστικά / ενδοφλέβια αγωγή', (d0 - 15) + time '07:00', null, d0 + time '09:00'),
    (v_c42, v_p42, 'Ουροκαθετήρας (Foley)', 'Ουρήθρα', 'Παρακολούθηση διούρησης', (d0 - 15) + time '07:30', null, (d0 - 1) + time '09:00'),
    (v_c49, v_p49, 'Κεντρικός φλεβικός καθετήρας (CVC)', 'Δεξιά υποκλείδιος', 'Παρεντερική σίτιση / ενδοφλέβια αγωγή', (d0 - 8) + time '14:00', (d0 - 4) + time '16:00', null),
    (v_c49, v_p49, 'Κεντρικός φλεβικός καθετήρας (CVC)', 'Αριστερή έσω σφαγίτιδα', 'Αντικατάσταση ΚΦΚ μετά από CLABSI', (d0 - 4) + time '17:00', null, (d0 + 1) + time '09:00'),
    (v_c49, v_p49, 'Μηχανικός αερισμός (ventilator)', 'Ενδοτραχειακός σωλήνας', 'Μετεγχειρητική υποστήριξη', (d0 - 8) + time '14:00', (d0 - 5) + time '10:00', null),
    (v_c49, v_p49, 'Ουροκαθετήρας (Foley)', 'Ουρήθρα', 'Παρακολούθηση διούρησης', (d0 - 8) + time '14:30', (d0 - 2) + time '11:00', null),
    (v_c30, v_p30, 'Ουροκαθετήρας (Foley)', 'Ουρήθρα', 'Κατακράτηση ούρων', (d0 - 10) + time '09:00', null, d0 + time '09:00')
  ) x(cid, pid, dtype, site, ind, ins, rem, due);

  -- Clinical assessments
  insert into public.clinical_assessments(organization_id, surveillance_case_id, patient_id, department_id, assessment_type, classification,
    signs_symptoms, risk_factors, summary, assessed_at, created_by, updated_by)
  select v_org, x.cid, x.pid, v_icu, x.atype, x.cls, x.signs, x.risks, x.summary, x.at, p_actor, p_actor
  from (values
    (v_c42, v_p42, 'suspected_infection', 'under_investigation', '["Πυρετός","Πυώδεις βρογχικές εκκρίσεις","Επιδείνωση οξυγόνωσης"]'::jsonb,
      '["Νοσηλεία σε ΜΕΘ","Μηχανικός αερισμός > 48 ώρες","Πρόσφατη αντιμικροβιακή αγωγή"]'::jsonb,
      'Νέο διήθημα δεξιού κάτω λοβού με πυώδεις εκκρίσεις την 6η ημέρα μηχανικού αερισμού. Λήψη BAL και ορθικού επιχρίσματος.', (d0 - 9) + time '11:30'),
    (v_c42, v_p42, 'hai_review', 'probable_infection', '["Πυρετός","Πυώδεις βρογχικές εκκρίσεις","Επιδείνωση οξυγόνωσης"]'::jsonb,
      '["Νοσηλεία σε ΜΕΘ","Μηχανικός αερισμός > 48 ώρες","Πρόσφατη αντιμικροβιακή αγωγή"]'::jsonb,
      'BAL ≥ 10⁴ CFU/mL Klebsiella pneumoniae KPC (MDR). Πιθανή VAP (PN2) — περιστατικό-δείκτης συρροής CPE στη ΜΕΘ.', (d0 - 6) + time '10:30'),
    (v_c30, v_p30, 'colonization_review', 'colonization', '[]'::jsonb, '["Νοσηλεία σε ΜΕΘ","Παρατεταμένη νοσηλεία","Ουροκαθετήρας"]'::jsonb,
      'Ασυμπτωματικός αποικισμός με KPC-Kp (ορθικό επίχρισμα επιτήρησης). Γειτονική κλίνη με το περιστατικό-δείκτη. Δεν απαιτείται θεραπεία.', (d0 - 5) + time '12:30'),
    (v_c49, v_p49, 'suspected_infection', 'under_investigation', '["Πυρετός","Ρίγος","Υπόταση"]'::jsonb,
      '["Νοσηλεία σε ΜΕΘ","Πρόσφατη χειρουργική επέμβαση","Ηλικία ≥ 65 ετών","Κεντρικός φλεβικός καθετήρας"]'::jsonb,
      'Πυρετός 39,2°C με ρίγος και ανάγκη νοραδρεναλίνης. Λήψη αιμοκαλλιεργειών από ΚΦΚ και περιφέρεια.', (d0 - 5) + time '07:30'),
    (v_c49, v_p49, 'confirmed_infection', 'confirmed_infection', '["Πυρετός","Ρίγος","Υπόταση"]'::jsonb,
      '["Νοσηλεία σε ΜΕΘ","Πρόσφατη χειρουργική επέμβαση","Ηλικία ≥ 65 ετών","Κεντρικός φλεβικός καθετήρας"]'::jsonb,
      'Επιβεβαιωμένη CLABSI από KPC-Kp. Αφαίρεση και αντικατάσταση ΚΦΚ, έναρξη κεφταζιδίμης/αβιμπακτάμης.', (d0 - 3) + time '09:30'),
    (v_c06, v_p06, 'amr_review', 'colonization', '[]'::jsonb, '["Νοσηλεία σε ΜΕΘ","Παρατεταμένη νοσηλεία"]'::jsonb,
      'Νέος αποικισμός με KPC-Kp στο εβδομαδιαίο screening (προηγούμενο ορθικό επίχρισμα αρνητικό). Ένταξη στην κοόρτη CPE.', (d0 - 1) + time '11:00')
  ) x(cid, pid, atype, cls, signs, risks, summary, at)
  where x.cid is not null;

  -- Reassessments
  insert into public.surveillance_reassessments(organization_id, surveillance_case_id, patient_id, clinical_status, isolation_decision, therapy_decision,
    notes, reassessed_at, next_review_due_at, created_by)
  select v_org, x.cid, x.pid, x.st, x.iso, x.thr, x.notes, x.at, x.due, p_actor
  from (values
    (v_c42, v_p42, 'stable', 'continue', 'modify', 'Αλλαγή σε κεφταζιδίμη/αβιμπακτάμη βάσει αντιβιογράμματος. Συνέχιση απομόνωσης σε μονόκλινο.', (d0 - 6) + time '12:00', (d0 - 3) + time '12:00'),
    (v_c42, v_p42, 'improved', 'continue', 'continue', 'Βελτίωση οξυγόνωσης, μείωση εκκρίσεων. Επανεκτίμηση για αποδιασωλήνωση.', (d0 - 3) + time '12:00', d0 + time '12:00'),
    (v_c49, v_p49, 'deteriorated', 'continue', 'modify', 'Σηπτική καταπληξία· αφαίρεση ΚΦΚ και έναρξη στοχευμένης αγωγής.', (d0 - 4) + time '18:00', (d0 - 2) + time '12:00'),
    (v_c49, v_p49, 'stable', 'continue', 'continue', 'Αιμοδυναμικά σταθερός χωρίς αγγειοσυσπαστικά. Επανάληψη αιμοκαλλιεργειών σε εξέλιξη.', (d0 - 2) + time '12:00', (d0 + 1) + time '12:00'),
    (v_c30, v_p30, 'stable', 'continue', 'not_applicable', 'Παραμένει ασυμπτωματικός. Συνέχιση προφυλάξεων επαφής στην κοόρτη.', (d0 - 2) + time '11:00', (d0 + 5) + time '11:00')
  ) x(cid, pid, st, iso, thr, notes, at, due);

  -- Antimicrobial therapy (one plan per patient)
  insert into public.antimicrobial_therapies(organization_id, patient_id, surveillance_case_id, antimicrobial, dose, route, indication,
    started_at, planned_end_at, ended_at, approval_status, status, created_by, updated_by, therapy_plan_id, source, laboratory_result_id, laboratory_sample_id)
  select v_org, x.pid, x.cid,
    coalesce((select mli.name_el from public.master_library_items mli where mli.organization_id = v_org and mli.library_key = 'antibiotics' and mli.code = x.code limit 1), x.fallback),
    x.dose, 'IV', x.ind, x.st, x.plan_end, x.ended, x.appr, x.status, p_actor, p_actor, x.plan, x.src,
    case when x.src = 'laboratory' then (select mr.id from public.microbiology_results mr join public.laboratory_samples ls on ls.id = mr.sample_id where ls.organization_id = v_org and ls.sample_code = x.sample_code) end,
    case when x.src = 'laboratory' then (select ls.id from public.laboratory_samples ls where ls.organization_id = v_org and ls.sample_code = x.sample_code) end
  from (values
    (v_p42, v_c42, 'ABX-MEM', 'Μεροπενέμη', '1 g', 'Εμπειρική αγωγή — υποψία VAP', (d0 - 9) + time '12:00', (d0 - 2) + time '12:00', ((d0 - 7) + time '11:00')::timestamptz, 'approved', 'stopped', v_plan, 'patient_record', null::text),
    (v_p42, v_c42, 'ABX-CZA', 'Κεφταζιδίμη/Αβιμπακτάμη', '2,5 g (έγχυση 2 ωρών)', 'Στοχευμένη αγωγή — Klebsiella pneumoniae KPC (MDR)', (d0 - 7) + time '12:00', (d0 + 4) + time '12:00', null, 'approved', 'active', v_plan, 'laboratory', 'LAB-' || to_char(d0 - 9, 'YYMMDD') || '-101'),
    (v_p49, v_c49, 'ABX-MEM', 'Μεροπενέμη', '2 g (παρατεταμένη έγχυση)', 'Εμπειρική αγωγή — σηπτική καταπληξία σε ασθενή με ΚΦΚ', (d0 - 5) + time '08:00', (d0 + 2) + time '08:00', (d0 - 4) + time '15:00', 'approved', 'stopped', v_plan49, 'patient_record', null),
    (v_p49, v_c49, 'ABX-CZA', 'Κεφταζιδίμη/Αβιμπακτάμη', '2,5 g (έγχυση 2 ωρών)', 'Στοχευμένη αγωγή — CLABSI από Klebsiella pneumoniae KPC', (d0 - 4) + time '16:00', (d0 + 10) + time '16:00', null, 'approved', 'active', v_plan49, 'laboratory', 'LAB-' || to_char(d0 - 5, 'YYMMDD') || '-107'),
    (v_p49, v_c49, 'ABX-COL', 'Κολιστίνη', '4,5 MU', 'Προτεινόμενος συνδυασμός λόγω επιμένουσας βακτηριαιμίας — αναμένεται έγκριση της Επιτροπής Αντιμικροβιακής Πολιτικής', v_now - interval '3 hours', v_now + interval '7 days', null, 'pending', 'planned', v_plan49, 'patient_record', null)
  ) x(pid, cid, code, fallback, dose, ind, st, plan_end, ended, appr, status, plan, src, sample_code);

  insert into public.antimicrobial_therapy_administrations(organization_id, therapy_id, administered_at, dose, route, status, withheld_reason, administered_by, created_by)
  select v_org, t.id, g, t.dose, t.route, 'administered', null, p_actor, p_actor
  from public.antimicrobial_therapies t
  cross join lateral generate_series(t.started_at, coalesce(t.ended_at, v_now) - interval '1 minute', interval '8 hours') g
  where t.surveillance_case_id in (v_c42, v_c49) and t.approval_status in ('not_required', 'approved');
end;
$function$;

-- LIRA outbreak investigations: the active KPC investigation (events, case
-- reviews with supersedes chains, CAPA) and an earlier, closed one.
create or replace function private.demo_seed_clinical_outbreak(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := current_date;
  v_icu uuid := (select dep.id from public.departments dep where dep.organization_id = p_organization_id and dep.code = 'ΜΕΘ');
  v_icu_name text := (select dep.name from public.departments dep where dep.organization_id = p_organization_id and dep.code = 'ΜΕΘ');
  v_inv uuid;
  v_old uuid;
  v_capa1 uuid := gen_random_uuid();
  v_capa2 uuid := gen_random_uuid();
  v_capa3 uuid := gen_random_uuid();
  v_r101 uuid := gen_random_uuid();
  v_r107 uuid := gen_random_uuid();
  v_from date;
  r record;
begin
  if v_icu is null then
    return;
  end if;

  -- 1. Active investigation of the KPC cluster ----------------------------
  if not exists (select 1 from public.lira_outbreak_investigations i where i.organization_id = v_org and i.organism = 'Klebsiella pneumoniae' and i.department_id = v_icu)
     and exists (select 1 from public.microbiology_results mr join public.laboratory_samples ls on ls.id = mr.sample_id
                  where ls.organization_id = v_org and ls.department_id = v_icu and mr.organism = 'Klebsiella pneumoniae' and ls.collected_at >= (d0 - 12)::timestamptz) then
    v_inv := gen_random_uuid();
    insert into public.lira_outbreak_investigations(id, organization_id, title, organism, department_id, status, definition_id, definition_version, definition_json,
      scope_from, scope_to, hypotheses, decisions, created_by, created_at, updated_by, updated_at)
    values (v_inv, v_org, 'Συρροή Klebsiella pneumoniae KPC — ΜΕΘ', 'Klebsiella pneumoniae', v_icu, 'active', 'CD-KPC-ICU', '1.0',
      jsonb_build_object('id', 'CD-KPC-ICU', 'version', '1.0',
        'label', 'Ασθενής της ΜΕΘ με κλινικό δείγμα ή δείγμα επιτήρησης θετικό για Klebsiella pneumoniae KPC από ' || to_char(d0 - 12, 'DD/MM/YYYY'),
        'organism', 'Klebsiella pneumoniae', 'department', v_icu_name, 'from', to_char(d0 - 12, 'YYYY-MM-DD'), 'to', to_char(d0 + 14, 'YYYY-MM-DD')),
      d0 - 12, d0 + 14,
      jsonb_build_array(
        jsonb_build_object('id', 'H1', 'text', 'Διασπορά μέσω χεριών προσωπικού και κοινόχρηστου εξοπλισμού (υπερηχογράφος) μεταξύ των κλινών 7–10.', 'status', 'addressed', 'at', to_char((d0 - 6) + time '10:00', 'YYYY-MM-DD"T"HH24:MI:SS')),
        jsonb_build_object('id', 'H2', 'text', 'Πιθανή περιβαλλοντική δεξαμενή στους σιφώνες των νιπτήρων της ΜΕΘ.', 'status', 'open', 'at', to_char((d0 - 2) + time '09:00', 'YYYY-MM-DD"T"HH24:MI:SS'))),
      jsonb_build_array(
        jsonb_build_object('id', 'D1', 'text', 'Κοόρτη ασθενών CPE με αφιερωμένο νοσηλευτικό προσωπικό, εβδομαδιαίο screening όλων των ασθενών της ΜΕΘ.', 'at', to_char((d0 - 6) + time '11:00', 'YYYY-MM-DD"T"HH24:MI:SS')),
        jsonb_build_object('id', 'D2', 'text', 'Επέκταση του screening σε κάθε εισαγωγή στη ΜΕΘ και σε μεταφορές προς τη Χειρουργική.', 'at', to_char((d0 - 3) + time '12:30', 'YYYY-MM-DD"T"HH24:MI:SS'))),
      p_actor, (d0 - 6) + time '09:00', p_actor, (d0 - 2) + time '09:00');

    -- Linked IPC / CAPA actions
    insert into public.quality_capa_actions(id, organization_id, code, title, department_id, source_type, source_id, action_type, priority, status, description,
      due_date, effectiveness_due, effectiveness_status, owner_label, owner_labels, created_at, updated_at)
    values
      (v_capa1, v_org, 'CAPA-OUT-' || to_char(d0 - 6, 'YYMMDD') || '1105', 'Κοόρτη CPE και αφιερωμένο προσωπικό στη ΜΕΘ', v_icu, 'outbreak_investigation', v_inv::text,
       'corrective', 'high', 'in_progress', 'Συγκέντρωση των ασθενών με KPC στις κλίνες 7–10, αφιερωμένο νοσηλευτικό προσωπικό ανά βάρδια, ενισχυμένες παρατηρήσεις υγιεινής χεριών.',
       d0 + 3, d0 + 33, 'pending', 'Προϊσταμένη ΜΕΘ', array['Προϊσταμένη ΜΕΘ'], (d0 - 6) + time '11:05', (d0 - 3) + time '12:00'),
      (v_capa2, v_org, 'CAPA-OUT-' || to_char(d0 - 6, 'YYMMDD') || '1110', 'Εβδομαδιαίο screening CPE όλων των ασθενών της ΜΕΘ', v_icu, 'outbreak_investigation', v_inv::text,
       'preventive', 'medium', 'open', 'Ορθικό επίχρισμα κατά την εισαγωγή και κάθε Δευτέρα για όλους τους ασθενείς της ΜΕΘ, μέχρι 4 εβδομάδες χωρίς νέο περιστατικό.',
       d0 + 7, d0 + 37, 'pending', 'Νοσηλεύτρια Επιτήρησης Λοιμώξεων', array['Νοσηλεύτρια Επιτήρησης Λοιμώξεων'], (d0 - 6) + time '11:10', (d0 - 6) + time '11:10'),
      (v_capa3, v_org, 'CAPA-OUT-' || to_char(d0 - 6, 'YYMMDD') || '1115', 'Απολύμανση υπερηχογράφου μετά από κάθε χρήση', v_icu, 'outbreak_investigation', v_inv::text,
       'corrective', 'medium', 'verification', 'Απολύμανση κεφαλής και καλωδίου με μαντηλάκια χλωρίνης μετά από κάθε ασθενή· καταγραφή σε φύλλο ελέγχου.',
       d0 - 1, d0 + 29, 'pending', 'Διευθυντής ΜΕΘ', array['Διευθυντής ΜΕΘ'], (d0 - 6) + time '11:15', (d0 - 3) + time '12:00');

    -- Case reviews (record_key = microbiology result id), with supersedes chains
    for r in
      select mr.id as mr_id, ls.patient_id, right(ls.sample_code, 3) as n
      from public.microbiology_results mr join public.laboratory_samples ls on ls.id = mr.sample_id
      where ls.organization_id = v_org and ls.department_id = v_icu and mr.organism = 'Klebsiella pneumoniae' and ls.collected_at >= (d0 - 12)::timestamptz
    loop
      if r.n = '101' then
        insert into public.lira_outbreak_case_reviews(id, organization_id, investigation_id, record_key, patient_id, classification, rationale, reviewer_id, reviewed_at, created_at)
        values (v_r101, v_org, v_inv, r.mr_id::text, r.patient_id, 'probable', 'Περιστατικό-δείκτης: KPC-Kp σε BAL με κλινική εικόνα VAP· αναμένεται επιβεβαίωση μηχανισμού.', p_actor, (d0 - 6) + time '10:15', (d0 - 6) + time '10:15');
        insert into public.lira_outbreak_case_reviews(organization_id, investigation_id, record_key, patient_id, classification, rationale, reviewer_id, reviewed_at, supersedes_review_id, created_at)
        values (v_org, v_inv, r.mr_id::text, r.patient_id, 'confirmed', 'Επιβεβαίωση KPC (ανοσοχρωματογραφία) και ίδιο αντιβιόγραμμα με τα υπόλοιπα στελέχη.', p_actor, (d0 - 4) + time '10:00', v_r101, (d0 - 4) + time '10:00');
      elsif r.n = '102' then
        insert into public.lira_outbreak_case_reviews(organization_id, investigation_id, record_key, patient_id, classification, rationale, reviewer_id, reviewed_at, created_at)
        values (v_org, v_inv, r.mr_id::text, r.patient_id, 'confirmed', 'Ίδιος ασθενής με το περιστατικό-δείκτη — δείγμα επιτήρησης (ορθικό επίχρισμα).', p_actor, (d0 - 4) + time '10:05', (d0 - 4) + time '10:05');
      elsif r.n = '103' then
        insert into public.lira_outbreak_case_reviews(organization_id, investigation_id, record_key, patient_id, classification, rationale, reviewer_id, reviewed_at, created_at)
        values (v_org, v_inv, r.mr_id::text, r.patient_id, 'probable', 'Αποικισμός χωρίς λοίμωξη σε γειτονική κλίνη· χρονική και χωρική σύνδεση με το περιστατικό-δείκτη.', p_actor, (d0 - 4) + time '10:10', (d0 - 4) + time '10:10');
      elsif r.n = '107' then
        insert into public.lira_outbreak_case_reviews(id, organization_id, investigation_id, record_key, patient_id, classification, rationale, reviewer_id, reviewed_at, created_at)
        values (v_r107, v_org, v_inv, r.mr_id::text, r.patient_id, 'suspected', 'Βακτηριαιμία σε ασθενή που μεταφέρθηκε από τη Χειρουργική· διερεύνηση αν αποικίστηκε πριν από τη μεταφορά.', p_actor, (d0 - 4) + time '15:00', (d0 - 4) + time '15:00');
        insert into public.lira_outbreak_case_reviews(organization_id, investigation_id, record_key, patient_id, classification, rationale, reviewer_id, reviewed_at, supersedes_review_id, created_at)
        values (v_org, v_inv, r.mr_id::text, r.patient_id, 'confirmed', 'Αρνητικό screening κατά την εισαγωγή στη ΜΕΘ· απόκτηση εντός της μονάδας μετά από 72 ώρες νοσηλείας.', p_actor, (d0 - 3) + time '10:00', v_r107, (d0 - 3) + time '10:00');
      elsif r.n = '108' then
        insert into public.lira_outbreak_case_reviews(organization_id, investigation_id, record_key, patient_id, classification, rationale, reviewer_id, reviewed_at, created_at)
        values (v_org, v_inv, r.mr_id::text, r.patient_id, 'confirmed', 'Δεύτερη αιμοκαλλιέργεια του ίδιου επεισοδίου βακτηριαιμίας.', p_actor, (d0 - 3) + time '10:05', (d0 - 3) + time '10:05');
      end if;
      -- 109 (latest acquisition) is left unreviewed on purpose
    end loop;

    -- Evidence trail (append-only, in order)
    insert into public.lira_outbreak_investigation_events(organization_id, investigation_id, event_type, payload, created_by, created_at)
    select v_org, v_inv, x.etype, x.payload, p_actor, x.at
    from (values
      ('decision', jsonb_build_object('action', 'lira_signal_handoff', 'source', jsonb_build_object('type', 'lira_signal', 'method', 'descriptive_spatial_concentration', 'evidence', '[]'::jsonb,
         'guardrails', jsonb_build_object('outbreakDeclared', false, 'transmissionInferred', false, 'humanInitiationRequired', true))), (d0 - 6) + time '09:00'),
      ('status', jsonb_build_object('from', 'draft', 'to', 'active'), (d0 - 6) + time '09:20'),
      ('hypothesis', jsonb_build_object('text', 'Διασπορά μέσω χεριών προσωπικού και κοινόχρηστου εξοπλισμού (υπερηχογράφος) μεταξύ των κλινών 7–10.'), (d0 - 6) + time '10:00'),
      ('case_review', jsonb_build_object('recordKey', (select x.record_key from public.lira_outbreak_case_reviews x where x.id = v_r101), 'classification', 'probable'), (d0 - 6) + time '10:15'),
      ('decision', jsonb_build_object('text', 'Κοόρτη ασθενών CPE με αφιερωμένο νοσηλευτικό προσωπικό, εβδομαδιαίο screening όλων των ασθενών της ΜΕΘ.'), (d0 - 6) + time '11:00'),
      ('decision', jsonb_build_object('action', 'capa_created', 'capaId', v_capa1, 'title', 'Κοόρτη CPE και αφιερωμένο προσωπικό στη ΜΕΘ'), (d0 - 6) + time '11:05'),
      ('decision', jsonb_build_object('action', 'capa_created', 'capaId', v_capa2, 'title', 'Εβδομαδιαίο screening CPE όλων των ασθενών της ΜΕΘ'), (d0 - 6) + time '11:10'),
      ('decision', jsonb_build_object('action', 'capa_created', 'capaId', v_capa3, 'title', 'Απολύμανση υπερηχογράφου μετά από κάθε χρήση'), (d0 - 6) + time '11:15'),
      ('decision', jsonb_build_object('action', 'capa_status', 'capaId', v_capa1, 'status', 'in_progress'), (d0 - 5) + time '08:30')
    ) x(etype, payload, at);

    insert into public.lira_outbreak_investigation_events(organization_id, investigation_id, event_type, payload, created_by, created_at)
    select v_org, v_inv, 'case_review', jsonb_build_object('recordKey', cr.record_key, 'classification', cr.classification), p_actor, cr.reviewed_at
    from public.lira_outbreak_case_reviews cr
    where cr.investigation_id = v_inv and cr.id <> v_r101;

    insert into public.lira_outbreak_investigation_events(organization_id, investigation_id, event_type, payload, created_by, created_at)
    values
      (v_org, v_inv, 'decision', jsonb_build_object('action', 'capa_status', 'capaId', v_capa3, 'status', 'verification'), p_actor, (d0 - 3) + time '12:00'),
      (v_org, v_inv, 'decision', jsonb_build_object('text', 'Επέκταση του screening σε κάθε εισαγωγή στη ΜΕΘ και σε μεταφορές προς τη Χειρουργική.'), p_actor, (d0 - 3) + time '12:30'),
      (v_org, v_inv, 'hypothesis', jsonb_build_object('text', 'Πιθανή περιβαλλοντική δεξαμενή στους σιφώνες των νιπτήρων της ΜΕΘ — αναμένονται οι περιβαλλοντικές καλλιέργειες.'), p_actor, (d0 - 2) + time '09:00');
  end if;

  -- 2. An earlier investigation, closed: single-patient Acinetobacter signal --
  v_from := (select min(ls.collected_at)::date from public.microbiology_results mr join public.laboratory_samples ls on ls.id = mr.sample_id
              where ls.organization_id = v_org and ls.department_id = v_icu and mr.organism = 'Acinetobacter baumannii');
  if v_from is not null
     and not exists (select 1 from public.lira_outbreak_investigations i where i.organization_id = v_org and i.organism = 'Acinetobacter baumannii') then
    v_old := gen_random_uuid();
    insert into public.lira_outbreak_investigations(id, organization_id, title, organism, department_id, status, definition_id, definition_version, definition_json,
      scope_from, scope_to, created_by, created_at, updated_by, updated_at, closed_at)
    values (v_old, v_org, 'Πιθανή συρροή Acinetobacter baumannii — ΜΕΘ', 'Acinetobacter baumannii', v_icu, 'closed', 'CD-ACB-ICU', '1.0',
      jsonb_build_object('id', 'CD-ACB-ICU', 'version', '1.0', 'label', 'Ασθενής της ΜΕΘ με κλινικό δείγμα θετικό για Acinetobacter baumannii',
        'organism', 'Acinetobacter baumannii', 'department', v_icu_name, 'from', to_char(v_from - 3, 'YYYY-MM-DD'), 'to', to_char(v_from + 14, 'YYYY-MM-DD')),
      v_from - 3, v_from + 14, p_actor, (v_from + 3) + time '09:00', p_actor, (v_from + 9) + time '13:00', (v_from + 9) + time '13:00');

    insert into public.lira_outbreak_case_reviews(organization_id, investigation_id, record_key, patient_id, classification, rationale, reviewer_id, reviewed_at, created_at)
    select v_org, v_old, mr.id::text, ls.patient_id, 'excluded',
      'Μεμονωμένος ασθενής (αιμοκαλλιέργεια και βρογχικές εκκρίσεις του ίδιου επεισοδίου)· χωρίς επιδημιολογική σύνδεση με άλλο ασθενή.',
      p_actor, (v_from + 5) + time '10:00' + (row_number() over (order by ls.collected_at)) * interval '5 minutes',
      (v_from + 5) + time '10:00' + (row_number() over (order by ls.collected_at)) * interval '5 minutes'
    from public.microbiology_results mr join public.laboratory_samples ls on ls.id = mr.sample_id
    where ls.organization_id = v_org and ls.department_id = v_icu and mr.organism = 'Acinetobacter baumannii';

    insert into public.lira_outbreak_investigation_events(organization_id, investigation_id, event_type, payload, created_by, created_at)
    select v_org, v_old, x.etype, x.payload, p_actor, x.at
    from (values
      ('status', jsonb_build_object('status', 'draft', 'action', 'created'), (v_from + 3) + time '09:00'),
      ('status', jsonb_build_object('from', 'draft', 'to', 'active'), (v_from + 3) + time '09:10'),
      ('hypothesis', jsonb_build_object('text', 'Δύο θετικά δείγματα A. baumannii στη ΜΕΘ μέσα σε 24 ώρες — έλεγχος αν πρόκειται για διασπορά.'), (v_from + 3) + time '09:30')
    ) x(etype, payload, at);

    insert into public.lira_outbreak_investigation_events(organization_id, investigation_id, event_type, payload, created_by, created_at)
    select v_org, v_old, 'case_review', jsonb_build_object('recordKey', cr.record_key, 'classification', cr.classification), p_actor, cr.reviewed_at
    from public.lira_outbreak_case_reviews cr where cr.investigation_id = v_old;

    insert into public.lira_outbreak_investigation_events(organization_id, investigation_id, event_type, payload, created_by, created_at)
    values
      (v_org, v_old, 'decision', jsonb_build_object('text', 'Τα δύο δείγματα αφορούν τον ίδιο ασθενή· το screening των επαφών ήταν αρνητικό. Δεν πρόκειται για συρροή.'), p_actor, (v_from + 9) + time '12:30'),
      (v_org, v_old, 'decision', jsonb_build_object('action', 'closure_review', 'text', 'Κλείσιμο μετά από έλεγχο ετοιμότητας: όλα τα υποψήφια αξιολογήθηκαν, χωρίς ανοικτές ενέργειες.',
         'readiness', jsonb_build_object('candidates', 2, 'reviewed', 2, 'confirmed', 0, 'excluded', 2, 'openActions', 0, 'unresolvedHypotheses', 0)), p_actor, (v_from + 9) + time '12:55'),
      (v_org, v_old, 'status', jsonb_build_object('from', 'active', 'to', 'closed'), p_actor, (v_from + 9) + time '13:00');
  end if;
end;
$function$;

-- Employee MRSA screening of the ICU staff, two individual screenings,
-- Legionella water samples matching the Legionella control, ICU sink drains
-- (part of the KPC investigation) and operating-theatre surface plates.
create or replace function private.demo_seed_clinical_employee_environment(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := current_date;
  v_now timestamptz := now();
  v_icu uuid := (select dep.id from public.departments dep where dep.organization_id = p_organization_id and dep.code = 'ΜΕΘ');
  v_surg uuid := (select dep.id from public.departments dep where dep.organization_id = p_organization_id and dep.code = 'ΧΕΙΡ');
  v_batch uuid;
  v_batch_code text := 'EBAT-' || to_char(current_date - 20, 'YYMMDD') || '-001';
  r record;
  v_n integer := 0;
begin
  -- 1. Employee surveillance -------------------------------------------------
  if v_icu is not null and not exists (select 1 from public.employee_surveillance_batches b where b.organization_id = v_org and b.batch_code = v_batch_code) then
    v_batch := gen_random_uuid();
    insert into public.employee_surveillance_batches(id, organization_id, batch_code, department_id, started_at, screening_types, notes, created_by, created_at)
    values (v_batch, v_org, v_batch_code, v_icu, d0 - 20, array['nasalSwab'],
      'Ετήσιος έλεγχος φορείας MRSA του προσωπικού της ΜΕΘ (ρινικό επίχρισμα).', p_actor, (d0 - 20) + time '08:00');

    for r in
      select e.id, e.employee_code, row_number() over (order by e.employee_code) as n
      from public.employees e
      where e.organization_id = v_org and e.department_id = v_icu and e.employment_status = 'active'
      order by e.employee_code
      limit 6
    loop
      insert into public.employee_surveillance_records(organization_id, surveillance_code, employee_id, batch_id, started_at, screening_types,
        status, result_status, intervention_status, recheck_due, notes, created_by, updated_by, created_at,
        intervention, intervention_type, intervention_start, intervention_end, timeline)
      values (v_org, 'ESUR-' || to_char(d0 - 20, 'YYMMDD') || '-' || lpad(r.n::text, 3, '0'), r.id, v_batch, d0 - 20, array['nasalSwab'],
        case when r.n = 2 then 'active' else 'completed' end,
        case when r.n = 2 then 'positive' else 'negative' end,
        case when r.n = 2 then 'in_progress' else 'none' end,
        case when r.n = 2 then d0 + 3 end,
        case when r.n = 2 then 'Φορέας MRSA — προσωρινή απομάκρυνση από ασθενείς υψηλού κινδύνου μέχρι την ολοκλήρωση του αποαποικισμού.' end,
        p_actor, p_actor, (d0 - 20) + time '08:00',
        case when r.n = 2 then 'Μουπιροσίνη 2% ρινικά ×3/ημ. και λουτρό χλωρεξιδίνης 4% για 5 ημέρες' end,
        case when r.n = 2 then 'Αποαποικισμός' end,
        case when r.n = 2 then d0 - 17 end, case when r.n = 2 then d0 - 13 end,
        case when r.n = 2 then jsonb_build_array(
            jsonb_build_object('at', to_char((d0 - 17) + time '10:00', 'YYYY-MM-DD"T"HH24:MI:SS'), 'type', 'employeeFollowupRecorded', 'actorId', p_actor, 'detail', null),
            jsonb_build_object('at', to_char((d0 - 20) + time '08:00', 'YYYY-MM-DD"T"HH24:MI:SS'), 'type', 'employeeSurveillanceStarted', 'actorId', p_actor))
          else jsonb_build_array(jsonb_build_object('at', to_char((d0 - 20) + time '08:00', 'YYYY-MM-DD"T"HH24:MI:SS'), 'type', 'employeeSurveillanceStarted', 'actorId', p_actor)) end);
    end loop;
  end if;

  -- Individual screenings
  insert into public.employee_surveillance_records(organization_id, surveillance_code, employee_id, started_at, screening_types,
    status, result_status, intervention_status, notes, created_by, updated_by, created_at, no_intervention, no_recheck, timeline)
  select v_org, 'ESUR-' || to_char(d0 - x.ago, 'YYMMDD') || '-' || x.n, e.id, d0 - x.ago, x.types, x.st, x.res, 'none', x.notes, p_actor, p_actor,
    (d0 - x.ago) + time '09:00', x.st = 'completed', x.st = 'completed',
    jsonb_build_array(jsonb_build_object('at', to_char((d0 - x.ago) + time '09:00', 'YYYY-MM-DD"T"HH24:MI:SS'), 'type', 'employeeSurveillanceStarted', 'actorId', p_actor))
  from (values
    ('EMP-003', 75, '101', array['handSwab'], 'completed', 'negative', 'Έλεγχος χεριών μετά από εκπαίδευση στην υγιεινή χεριών.'),
    ('EMP-012', 2, '102', array['nasalSwab', 'throatSwab'], 'active', 'pending', 'Προληπτικός έλεγχος πριν από την τοποθέτηση στη ΜΕΘ.')
  ) x(code, ago, n, types, st, res, notes)
  join public.employees e on e.organization_id = v_org and e.employee_code = x.code
  where not exists (select 1 from public.employee_surveillance_records s where s.organization_id = v_org and s.surveillance_code = 'ESUR-' || to_char(d0 - x.ago, 'YYMMDD') || '-' || x.n);

  -- The trigger created one laboratory request per record; the completed ones
  -- were collected the next morning and resulted two days later.
  update public.laboratory_samples ls
     set collected_at = (s.started_at + 1) + time '08:30', received_at = (s.started_at + 1) + time '09:00',
         status = 'completed', priority = 'routine', updated_by = p_actor, updated_at = now()
    from public.employee_surveillance_records s
   where ls.organization_id = v_org and ls.employee_surveillance_id = s.id and s.result_status in ('negative', 'positive') and ls.status = 'requested';

  insert into public.microbiology_results(organization_id, sample_id, result_status, organism, resistance_class, susceptibility_summary,
    is_critical, resulted_at, validated_by, validated_at, created_by, method, preliminary, validation_status, interpretation_standard, interpretation_version)
  select v_org, ls.id, s.result_status, case when s.result_status = 'positive' then 'Staphylococcus aureus' end, null,
    case when s.result_status = 'positive' then 'Ανθεκτικός στη μεθικιλλίνη (MRSA) — mecA θετικό' end,
    false, ls.collected_at + interval '46 hours', p_actor, ls.collected_at + interval '46 hours', p_actor,
    'culture (chromogenic MRSA agar)', false, 'validated', 'EUCAST', '15.0'
  from public.laboratory_samples ls
  join public.employee_surveillance_records s on s.id = ls.employee_surveillance_id
  where ls.organization_id = v_org and ls.status = 'completed' and s.result_status in ('negative', 'positive')
    and not exists (select 1 from public.microbiology_results m where m.sample_id = ls.id);

  insert into public.antimicrobial_susceptibility_results(organization_id, microbiology_result_id, antimicrobial_code, antimicrobial_name, method,
    mic_value, mic_operator, sir_category, breakpoint_standard, breakpoint_version, created_by, organism_name, organism)
  select v_org, mr.id, a.code, a.name, 'MIC', a.mic, a.op, a.sir, 'EUCAST', '15.0', p_actor, mr.organism, mr.organism
  from public.microbiology_results mr
  join public.laboratory_samples ls on ls.id = mr.sample_id and ls.subject_type = 'employee'
  cross join (values ('ABX-OXA', 'Oxacillin', 4, '>=', 'R'), ('ABX-VAN', 'Vancomycin', 1, '=', 'S'), ('ABX-LNZ', 'Linezolid', 2, '=', 'S')) a(code, name, mic, op, sir)
  where mr.organization_id = v_org and mr.result_status = 'positive'
    and not exists (select 1 from public.antimicrobial_susceptibility_results x where x.microbiology_result_id = mr.id);

  -- 2. Environmental standards (kept across resets) ---------------------------
  insert into public.environmental_standards(organization_id, record_key, payload, created_by, updated_by)
  select v_org, x.id, jsonb_build_object('id', x.id, 'protocolCode', x.id, 'subjectType', x.subject, 'sourceCode', x.source, 'unit', x.unit,
    'limitCfu', x.lim, 'active', true, 'system', false, 'locked', false, 'source', 'Hospital', 'version', 'local', 'notes', x.notes), p_actor, p_actor
  from (values
    ('ENV-WATER-LEG', 'water', 'waterSampling', 'CFU/L', 1000, 'Legionella spp. στο δίκτυο ζεστού νερού — όριο δράσης 1.000 CFU/L.'),
    ('ENV-SURF-PLATE-OR', 'surface', 'contactPlate', 'CFU/πλάκα', 5, 'Επιφάνειες χειρουργείου μετά την απολύμανση — έως 5 CFU ανά πλάκα επαφής (25 cm²).')
  ) x(id, subject, source, unit, lim, notes)
  on conflict (organization_id, record_key) do nothing;

  -- 3. Environmental samples ----------------------------------------------------
  -- Legionella: one water sample for each of the last four executions of the
  -- Legionella control in each department, with the control's result.
  for r in
    select ce.id, ce.department_id, ce.performed_at, ce.value_text, ce.has_finding, dep.code as dep_code,
      row_number() over (partition by ce.department_id order by ce.performed_at desc) as k
    from public.control_executions ce
    join public.control_definitions cd on cd.id = ce.control_id and cd.code = 'CTRL-0005'
    join public.departments dep on dep.id = ce.department_id
    where ce.organization_id = v_org and ce.status = 'completed'
    order by ce.performed_at
  loop
    continue when r.k > 4;
    v_n := v_n + 1;
    continue when exists (select 1 from public.laboratory_samples ls where ls.organization_id = v_org and ls.sample_code = 'LAB-' || to_char(r.performed_at, 'YYMMDD') || '-' || (200 + v_n));
    insert into public.laboratory_samples(organization_id, department_id, sample_code, sample_type, source_site, requested_at, requested_by,
      collected_at, received_at, status, priority, subject_type, subject_name, subject_code, environmental_method, location, point, created_by, created_at)
    values (v_org, r.department_id, 'LAB-' || to_char(r.performed_at, 'YYMMDD') || '-' || (200 + v_n), 'water', 'Ζεστό νερό χρήσης (έλεγχος Legionella)',
      r.performed_at - interval '1 day', p_actor, r.performed_at, r.performed_at + interval '2 hours',
      case when r.performed_at + interval '7 days' < v_now then 'completed' else 'processing' end, 'routine', 'environment',
      r.dep_code || ' · ' || case when r.k % 2 = 0 then 'Ντους θαλάμου 3' else 'Βρύση νιπτήρα στάσης νοσηλευτών' end, 'ENV',
      'waterSampling', r.dep_code, case when r.k % 2 = 0 then 'Ντους θαλάμου 3' else 'Βρύση νιπτήρα στάσης νοσηλευτών' end, p_actor, r.performed_at);

    insert into public.microbiology_results(organization_id, sample_id, result_status, organism, susceptibility_summary, is_critical, resulted_at,
      validated_by, validated_at, created_by, method, preliminary, validation_status, interpretation_standard, interpretation_version, cfu_count, cfu_limit, within_limit)
    select v_org, ls.id, case when r.has_finding then 'positive' else 'negative' end,
      case when r.has_finding then 'Legionella pneumophila ορότυπος 2-14' end,
      case when r.has_finding then 'Υπέρβαση ορίου δράσης — θερμική απολύμανση δικτύου και επαναληπτική δειγματοληψία.' end,
      false, r.performed_at + interval '7 days', p_actor, r.performed_at + interval '7 days', p_actor, 'culture (ISO 11731)', false, 'validated', 'ISO', '11731:2017',
      case when r.has_finding then 1200 else 0 end, 1000, not r.has_finding
    from public.laboratory_samples ls
    where ls.organization_id = v_org and ls.sample_code = 'LAB-' || to_char(r.performed_at, 'YYMMDD') || '-' || (200 + v_n)
      and r.performed_at + interval '7 days' < v_now;
  end loop;

  -- ICU sink drains (KPC investigation, hypothesis H2) — still in the laboratory
  insert into public.laboratory_samples(organization_id, department_id, sample_code, sample_type, source_site, requested_at, requested_by,
    collected_at, received_at, status, priority, subject_type, subject_name, subject_code, environmental_method, location, point, environmental_batch_id, created_by, created_at)
  select v_org, v_icu, 'LAB-' || to_char(d0 - 2, 'YYMMDD') || '-' || x.n, 'surface', 'Σιφώνι νιπτήρα', (d0 - 2) + time '10:00', p_actor,
    (d0 - 2) + x.t, (d0 - 2) + x.t + interval '1 hour', 'processing', 'urgent', 'environment', 'ΜΕΘ · ' || x.point, 'ENV',
    'surfaceSwab', 'ΜΕΘ', x.point, 'ENVB-' || to_char(d0 - 2, 'YYMMDD') || '-ICU', p_actor, (d0 - 2) + x.t
  from (values ('231', 'Σιφώνι νιπτήρα κλίνης 8', time '10:30'), ('232', 'Σιφώνι νιπτήρα κλίνης 10', time '10:40'), ('233', 'Σιφώνι νιπτήρα στάσης νοσηλευτών', time '10:50')) x(n, point, t)
  where v_icu is not null
    and not exists (select 1 from public.laboratory_samples ls where ls.organization_id = v_org and ls.sample_code = 'LAB-' || to_char(d0 - 2, 'YYMMDD') || '-' || x.n);

  -- Operating theatre surfaces after terminal cleaning (Surgery) — within limits
  insert into public.laboratory_samples(organization_id, department_id, sample_code, sample_type, source_site, requested_at, requested_by,
    collected_at, received_at, status, priority, subject_type, subject_name, subject_code, environmental_method, location, point, environmental_batch_id, created_by, created_at)
  select v_org, v_surg, 'LAB-' || to_char(d0 - 12, 'YYMMDD') || '-' || x.n, 'surface', 'Πλάκα επαφής', (d0 - 12) + time '07:00', p_actor,
    (d0 - 12) + x.t, (d0 - 12) + x.t + interval '1 hour', 'completed', 'routine', 'environment', 'Χειρουργική αίθουσα 2 · ' || x.point, 'ENV',
    'contactPlate', 'Χειρουργική αίθουσα 2', x.point, 'ENVB-' || to_char(d0 - 12, 'YYMMDD') || '-OR2', p_actor, (d0 - 12) + x.t
  from (values ('241', 'Χειρουργική τράπεζα', time '07:30'), ('242', 'Τροχήλατο αναισθησίας', time '07:35'), ('243', 'Λαβή χειρουργικού φωτός', time '07:40')) x(n, point, t)
  where v_surg is not null
    and not exists (select 1 from public.laboratory_samples ls where ls.organization_id = v_org and ls.sample_code = 'LAB-' || to_char(d0 - 12, 'YYMMDD') || '-' || x.n);

  insert into public.microbiology_results(organization_id, sample_id, result_status, organism, susceptibility_summary, is_critical, resulted_at,
    validated_by, validated_at, created_by, method, preliminary, validation_status, interpretation_standard, interpretation_version, cfu_count, cfu_limit, within_limit)
  select v_org, ls.id, case when x.cfu > 0 then 'positive' else 'negative' end,
    case when x.cfu > 0 then 'Σταφυλόκοκκοι κοαγκουλάσης-αρνητικοί (CoNS)' end,
    case when x.cfu > 0 then 'Χλωρίδα δέρματος εντός ορίων.' end,
    false, ls.collected_at + interval '48 hours', p_actor, ls.collected_at + interval '48 hours', p_actor, 'culture (πλάκα επαφής TSA)', false, 'validated', 'ISO', '14698-1',
    x.cfu, 5, x.cfu <= 5
  from (values ('241', 0), ('242', 2), ('243', 0)) x(n, cfu)
  join public.laboratory_samples ls on ls.organization_id = v_org and ls.sample_code = 'LAB-' || to_char(d0 - 12, 'YYMMDD') || '-' || x.n
  where not exists (select 1 from public.microbiology_results m where m.sample_id = ls.id);
end;
$function$;

-- Entry point ------------------------------------------------------------------
create or replace function private.demo_seed_clinical(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
begin
  perform set_config('limoxis.test_reset', 'on', true);
  perform private.demo_seed_clinical_patients(p_organization_id, p_actor);
  perform private.demo_seed_clinical_lab_fixes(p_organization_id, p_actor);
  perform private.demo_seed_clinical_paediatric(p_organization_id, p_actor);
  perform private.demo_seed_clinical_case_depth(p_organization_id, p_actor);
  perform private.demo_seed_clinical_kpc_cluster(p_organization_id, p_actor);
  perform private.demo_seed_clinical_outbreak(p_organization_id, p_actor);
  perform private.demo_seed_clinical_employee_environment(p_organization_id, p_actor);
end;
$function$;

revoke all on function private.demo_seed_clinical(uuid, uuid) from public, anon, authenticated;
revoke all on function private.demo_seed_clinical_patients(uuid, uuid) from public, anon, authenticated;
revoke all on function private.demo_seed_clinical_lab_fixes(uuid, uuid) from public, anon, authenticated;
revoke all on function private.demo_seed_clinical_paediatric(uuid, uuid) from public, anon, authenticated;
revoke all on function private.demo_seed_clinical_case_depth(uuid, uuid) from public, anon, authenticated;
revoke all on function private.demo_seed_clinical_kpc_cluster(uuid, uuid) from public, anon, authenticated;
revoke all on function private.demo_seed_clinical_outbreak(uuid, uuid) from public, anon, authenticated;
revoke all on function private.demo_seed_clinical_employee_environment(uuid, uuid) from public, anon, authenticated;


-- Limoxis Observer — Demo data: Quality, indicators, PPS, ΕΟΔΥ notifications.
--
-- Functions, in call order (private.demo_seed_quality calls them all):
--   1. private.demo_seed_quality_audits     — audits, findings, CAPAs raised by findings
--                                             or by a bundle deviation, quality_record_links
--   2. private.demo_seed_quality_enrich     — investigation of the 10 incidents, steps /
--                                             root-cause analysis / verification of the 6 CAPAs
--   3. private.demo_seed_quality_surveys    — point prevalence surveys, hospital structure,
--                                             ΕΟΔΥ notifiable-disease reports (+ one Legionella isolate)
--   4. private.demo_seed_quality_indicators — hospital indicator definitions (targets, CLABSI /
--                                             VAP manual indicators) and 6 months of indicator_snapshots
--   private.demo_seed_quality(org, actor)   — wrapper that runs 1..4 in that order.
--
-- Runs after every other demo_seed_* function. Idempotent: codes are unique
-- (ON CONFLICT DO NOTHING) and non-keyed blocks are skipped when already present.

create or replace function private.demo_seed_quality_audits(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := current_date;
  v_now timestamptz := now();
  v_bundle uuid;
begin
  -- Audits ---------------------------------------------------------------------
  insert into public.quality_audits(organization_id, code, title, audit_type, department_id, scope, planned_date, completed_date, status,
    lead_auditor_label, owner_label, owner_labels, history, created_at, updated_at)
  select v_org, 'AUD-' || to_char(d0 + a.pd, 'YYMMDD') || '-' || lpad((90000 + a.n)::text, 6, '0'), a.title, a.kind,
    (select dep.id from public.departments dep where dep.organization_id = v_org and dep.code = a.dep),
    a.scope, d0 + a.pd, case when a.cd is not null then d0 + a.cd end, a.st, a.lead, a.lead, array[a.lead],
    jsonb_build_array(jsonb_build_object('id', 'AUD-demo-' || a.n || '-1', 'at', (d0 + least(a.pd, 0) - 14) + time '09:00', 'action', 'recordCreated',
        'actorId', p_actor::text, 'actor', 'Υπεύθυνη Ποιότητας', 'actorEmail', '', 'reason', null, 'detail', null))
      || case when a.cd is not null then jsonb_build_array(jsonb_build_object('id', 'AUD-demo-' || a.n || '-2', 'at', (d0 + a.cd) + time '14:30', 'action', 'auditCompleted',
        'actorId', p_actor::text, 'actor', a.lead, 'actorEmail', '', 'reason', null, 'detail', null)) else '[]'::jsonb end,
    (d0 + least(a.pd, 0) - 14) + time '09:00', v_now
  from (values
    (1, -75, -74, 'ΠΑΘ', 'Επιθεώρηση υγιεινής χεριών — WHO 5 Moments', 'internal', 'completed', 'Παπαδοπούλου Μαρία',
        'Άμεση παρατήρηση 24 ευκαιριών ανά βάρδια (WHO Hand Hygiene Observation Tool), διαθεσιμότητα αλκοολούχου διαλύματος στο σημείο φροντίδας.'),
    (2, -48, -47, 'ΧΕΙΡ', 'Επιθεώρηση αποστείρωσης χειρουργικών εργαλείων (ΚΑΠ)', 'internal', 'completed', 'Υπεύθυνη Ποιότητας',
        'Ιχνηλασιμότητα σετ εργαλείων, καταγραφή φυσικών / χημικών / βιολογικών δεικτών κλιβάνου, συνθήκες αποθήκευσης αποστειρωμένων.'),
    (3, -20, -19, 'ΜΕΘ', 'Επιθεώρηση δεσμών μέτρων ΜΕΘ (CLABSI / VAP)', 'internal', 'completed', 'Παπαδοπούλου Μαρία',
        'Τήρηση δεσμών εισαγωγής και συντήρησης ΚΦΚ και πρόληψης πνευμονίας από αναπνευστήρα σε όλους τους νοσηλευόμενους της ΜΕΘ.'),
    (4, -3, null, 'ΜΕΘ', 'Επιθεώρηση προφυλάξεων επαφής ΜΕΘ — συρροή KPC', 'internal', 'in_progress', 'Υπεύθυνη Ποιότητας',
        'Έκτακτη επιθεώρηση μετά τη συρροή Klebsiella pneumoniae KPC: σήμανση, ΜΑΠ στην είσοδο, αποκλειστικός εξοπλισμός, καθαρισμός περιβάλλοντος κλίνης.'),
    (5, 10, null, 'ΟΡΘ', 'Επιθεώρηση καθαριότητας θαλάμων με μέτρηση ATP', 'internal', 'planned', 'Οικονόμου Κώστας',
        'Μέτρηση ATP σε 10 επιφάνειες υψηλής επαφής ανά θάλαμο και έλεγχος τήρησης του προγράμματος καθαρισμού (μετά από παράπονο συνοδού).'),
    (6, 21, null, null, 'Εξωτερική επιθεώρηση ΕΟΔΥ — σχέδιο δράσης για τα ανθεκτικά παθογόνα', 'external', 'planned', 'Υπεύθυνη Ποιότητας',
        'Επίσκεψη κλιμακίου ΕΟΔΥ: επιτήρηση CPE, προφυλάξεις επαφής, κατανάλωση αντιβιοτικών, πληρότητα δηλώσεων υποχρεωτικά δηλούμενων νοσημάτων.')
  ) a(n, pd, cd, dep, title, kind, st, lead, scope)
  on conflict (organization_id, code) do nothing;

  -- Findings (from audits and from one incident) --------------------------------
  insert into public.quality_findings(organization_id, code, title, department_id, identified_at, severity, status, description,
    source_type, source_id, owner_label, owner_labels, history, created_at, updated_at)
  select v_org, 'FND-' || to_char(d0 - f.ago, 'YYMMDD') || '-' || lpad((90000 + f.n)::text, 6, '0'), f.title,
    (select dep.id from public.departments dep where dep.organization_id = v_org and dep.code = f.dep),
    (d0 - f.ago) + time '12:00', f.sev, f.st, f.descr, f.src,
    case f.src
      when 'audit' then (select qa.code from public.quality_audits qa where qa.organization_id = v_org and right(qa.code, 2) = lpad(f.ref::text, 2, '0') limit 1)
      when 'incident' then (select qi.code from public.quality_incidents qi where qi.organization_id = v_org and right(qi.code, 2) = lpad(f.ref::text, 2, '0') limit 1)
    end,
    f.owner, array[f.owner],
    jsonb_build_array(jsonb_build_object('id', 'FND-demo-' || f.n, 'at', (d0 - f.ago) + time '12:00', 'action', 'findingCreated',
      'actorId', p_actor::text, 'actor', 'Υπεύθυνη Ποιότητας', 'actorEmail', '', 'reason', null, 'detail', null)),
    (d0 - f.ago) + time '12:00', v_now
  from (values
    (1, 74, 'audit', 1, 'ΠΑΘ', 'Χαμηλή συμμόρφωση στη Στιγμή 2 (πριν από άσηπτο χειρισμό)', 'medium', 'closed', 'Οικονόμου Κώστας',
        'Συμμόρφωση 58% (14/24 ευκαιρίες) πριν από άσηπτους χειρισμούς, έναντι στόχου ≥ 80%. Η συνολική συμμόρφωση του τμήματος ήταν 71%.'),
    (2, 47, 'audit', 2, 'ΧΕΙΡ', 'Ελλιπής τεκμηρίωση βιολογικών δεικτών κλιβάνου', 'medium', 'in_progress', 'Ιωάννου Δήμητρα',
        'Σε 3 από 20 ελεγχθέντες κύκλους αποστείρωσης δεν είχε καταγραφεί το αποτέλεσμα του βιολογικού δείκτη πριν από την αποδέσμευση των εργαλείων.'),
    (3, 47, 'audit', 2, 'ΧΕΙΡ', 'Φθαρμένα περιτυλίγματα σετ εργαλείων στην αποθήκη', 'low', 'closed', 'Μαυρίδου Δήμητρα',
        'Δύο σετ με σκισμένο περιτύλιγμα απομακρύνθηκαν και επαναποστειρώθηκαν επί τόπου· δεν απαιτήθηκε διορθωτική ενέργεια.'),
    (4, 19, 'audit', 3, 'ΜΕΘ', 'Μη τεκμηριωμένη καθημερινή αξιολόγηση ανάγκης ΚΦΚ', 'high', 'in_progress', 'Παπαδοπούλου Μαρία',
        'Σε 5 από 11 ασθενείς με κεντρικό φλεβικό καθετήρα δεν υπήρχε καθημερινή τεκμηρίωση της ανάγκης διατήρησης· 2 γραμμές > 10 ημερών χωρίς αιτιολόγηση.'),
    (5, 19, 'audit', 3, 'ΜΕΘ', 'Ανύψωση κεφαλής κλίνης < 30° σε διασωληνωμένους ασθενείς', 'medium', 'open', 'Παπαδάκη Μαρία',
        '3 από 7 διασωληνωμένους ασθενείς βρέθηκαν με ανύψωση κεφαλής κάτω από 30° (στοιχείο της δέσμης πρόληψης VAP).'),
    (6, 2, 'audit', 4, 'ΜΕΘ', 'Κοινός εξοπλισμός μεταξύ ασθενών με KPC χωρίς απολύμανση', 'high', 'open', 'Παπαδοπούλου Μαρία',
        'Στηθοσκόπιο και περιχειρίδα πιεσόμετρου χρησιμοποιούνταν σε διαδοχικές κλίνες ασθενών της συρροής Klebsiella pneumoniae KPC χωρίς ενδιάμεση απολύμανση.'),
    (7, 2, 'audit', 4, 'ΜΕΘ', 'Ελλείψεις ποδιών μιας χρήσης στην είσοδο θαλάμων απομόνωσης', 'medium', 'in_progress', 'Παπαδάκη Μαρία',
        'Σε 2 από 4 θαλάμους απομόνωσης δεν υπήρχαν διαθέσιμες ποδιές στο τροχήλατο ΜΑΠ κατά τη νυχτερινή βάρδια.'),
    (8, 17, 'incident', 5, 'ΚΑΡΔ', 'Απουσία σήμανσης προφυλάξεων επαφής σε θάλαμο ασθενούς με CPE', 'low', 'closed', 'Βασιλείου Σπύρος',
        'Το εύρημα προέκυψε από τη διερεύνηση του συμβάντος ελλιπούς σήμανσης· αντιμετωπίστηκε με την τυποποίηση των καρτών προφυλάξεων σε όλα τα τμήματα.')
  ) f(n, ago, src, ref, dep, title, sev, st, owner, descr)
  on conflict (organization_id, code) do nothing;

  -- CAPAs raised by findings and by an ICU bundle deviation ---------------------------
  v_bundle := (select b.id from public.prevention_bundle_assessments b
               join public.departments dep on dep.id = b.department_id and dep.code = 'ΜΕΘ'
               where b.organization_id = v_org and b.status = 'completed' and b.assessment_date >= d0 - 30
                 and exists (select 1 from jsonb_each_text(case when jsonb_typeof(b.criteria->'answers') = 'object' then b.criteria->'answers' else '{}'::jsonb end) x where x.value = 'no')
               order by b.assessment_date desc limit 1);

  insert into public.quality_capa_actions(organization_id, code, title, department_id, source_type, source_id, action_type, priority, status, description,
    due_date, effectiveness_due, effectiveness_status, verified_by, verified_at, owner_label, owner_labels, sub_actions, root_cause_analysis, history, created_at, updated_at)
  select v_org, 'CAPA-' || to_char(d0 - c.ago, 'YYMMDD') || '-' || lpad((90000 + c.n)::text, 6, '0'), c.title,
    (select dep.id from public.departments dep where dep.organization_id = v_org and dep.code = c.dep),
    c.src,
    case when c.src = 'finding' then (select qf.code from public.quality_findings qf where qf.organization_id = v_org and right(qf.code, 2) = lpad(c.ref::text, 2, '0') limit 1)
         else 'BND-' || v_bundle::text end,
    c.kind, c.pri, c.st, c.descr, d0 + c.due, d0 + c.due + 30,
    c.eff, case when c.eff = 'effective' then p_actor end, case when c.eff = 'effective' then (d0 + c.due + 25) + time '11:00' end,
    c.owner, array[c.owner, 'Υπεύθυνη Ποιότητας'], c.steps::jsonb, c.rca::jsonb,
    jsonb_build_array(jsonb_build_object('id', 'CAPA-demo-' || c.n, 'at', (d0 - c.ago) + time '10:00', 'action', 'capaAssigned',
      'actorId', p_actor::text, 'actor', 'Υπεύθυνη Ποιότητας', 'actorEmail', '', 'reason', null, 'detail', null)),
    (d0 - c.ago) + time '10:00', v_now
  from (values
    (7, 72, 'finding', 1, 'ΠΑΘ', 'Στοχευμένη επανεκπαίδευση στις 5 Στιγμές WHO', 'corrective', 'medium', 'closed', -45, 'effective', 'Οικονόμου Κώστας',
      'Μικροεκπαιδεύσεις 15 λεπτών ανά βάρδια, βάσεις αλκοολούχου διαλύματος σε κάθε κλίνη και επαναληπτικές παρατηρήσεις. Τεκμήρια επαλήθευσης: επαναληπτική παρατήρηση με συμμόρφωση 84% στη Στιγμή 2.',
      jsonb_build_array(
        jsonb_build_object('id','sa-demo-7-1','title','Τοποθέτηση βάσεων αλκοολούχου διαλύματος σε όλες τις κλίνες','owner','Οικονόμου Κώστας','dueDate',to_char(d0-62,'YYYY-MM-DD'),'done',true,'doneAt',(d0-63)+time '10:00','doneBy','Οικονόμου Κώστας'),
        jsonb_build_object('id','sa-demo-7-2','title','Μικροεκπαίδευση 5 Στιγμών σε όλες τις βάρδιες','owner','Σταθόπουλος Κώστας','dueDate',to_char(d0-50,'YYYY-MM-DD'),'done',true,'doneAt',(d0-52)+time '13:00','doneBy','Σταθόπουλος Κώστας'),
        jsonb_build_object('id','sa-demo-7-3','title','Επαναληπτική παρατήρηση υγιεινής χεριών (στόχος ≥ 80%)','owner','Παπαδοπούλου Μαρία','dueDate',to_char(d0-25,'YYYY-MM-DD'),'done',true,'doneAt',(d0-24)+time '12:00','doneBy','Παπαδοπούλου Μαρία'))::text,
      jsonb_build_object('problem','Συμμόρφωση 58% στη Στιγμή 2 (πριν από άσηπτο χειρισμό) στην Παθολογική, έναντι στόχου ≥ 80%.',
        'whys',jsonb_build_array('Παραλείπεται η αντισηψία χεριών πριν από χειρισμούς σε περιφερικούς φλεβοκαθετήρες.','Το αλκοολούχο διάλυμα δεν βρίσκεται στο σημείο φροντίδας σε 6 από 30 κλίνες.','Οι βάσεις δεν αντικαταστάθηκαν μετά την αλλαγή προμηθευτή φιαλών.','Δεν υπάρχει υπεύθυνος για τον έλεγχο διαθεσιμότητας ανά βάρδια.',''),
        'causes',jsonb_build_object('people',jsonb_build_array('Νέο επικουρικό προσωπικό χωρίς εκπαίδευση στις 5 Στιγμές'),'methods',jsonb_build_array('Δεν υπάρχει λίστα ελέγχου διαθεσιμότητας αντισηπτικού'),'equipment',jsonb_build_array('Ασύμβατες βάσεις με τις νέες φιάλες'),'materials',jsonb_build_array(),'environment',jsonb_build_array('Υψηλή πληρότητα κλινών (> 95%)'),'communication',jsonb_build_array('Δεν ενημερώθηκε η ΕΝΛ για την αλλαγή προμηθευτή')),
        'rootCause','Η αλλαγή προμηθευτή αντισηπτικού έγινε χωρίς έλεγχο συμβατότητας των βάσεων, με αποτέλεσμα να λείπει το διάλυμα από το σημείο φροντίδας.',
        'updatedAt',(d0-66)+time '10:30','updatedBy','Παπαδοπούλου Μαρία')::text),
    (8, 45, 'finding', 2, 'ΧΕΙΡ', 'Υποχρεωτική καταγραφή βιολογικού δείκτη πριν από την αποδέσμευση', 'corrective', 'medium', 'in_progress', 7, 'pending', 'Ιωάννου Δήμητρα',
      'Κανένα σετ δεν αποδεσμεύεται χωρίς καταγεγραμμένο αρνητικό βιολογικό δείκτη· προσθήκη πεδίου στο έντυπο ιχνηλασιμότητας.',
      jsonb_build_array(
        jsonb_build_object('id','sa-demo-8-1','title','Αναθεώρηση εντύπου ιχνηλασιμότητας κύκλων κλιβάνου','owner','Ιωάννου Δήμητρα','dueDate',to_char(d0-30,'YYYY-MM-DD'),'done',true,'doneAt',(d0-31)+time '09:30','doneBy','Ιωάννου Δήμητρα'),
        jsonb_build_object('id','sa-demo-8-2','title','Εκπαίδευση προσωπικού ΚΑΠ στη νέα διαδικασία αποδέσμευσης','owner','Μαυρίδου Δήμητρα','dueDate',to_char(d0-14,'YYYY-MM-DD'),'done',true,'doneAt',(d0-15)+time '12:00','doneBy','Μαυρίδου Δήμητρα'),
        jsonb_build_object('id','sa-demo-8-3','title','Δειγματοληπτικός έλεγχος 20 κύκλων μετά την αλλαγή','owner','Υπεύθυνη Ποιότητας','dueDate',to_char(d0+7,'YYYY-MM-DD'),'done',false,'doneAt',null,'doneBy',''))::text,
      jsonb_build_object('problem','3 από 20 κύκλους αποστείρωσης αποδεσμεύτηκαν χωρίς καταγεγραμμένο αποτέλεσμα βιολογικού δείκτη.',
        'whys',jsonb_build_array('Τα εργαλεία αποδεσμεύτηκαν πριν από την ανάγνωση του δείκτη.','Υπήρχε πίεση χρόνου για επείγοντα χειρουργεία.','Δεν υπάρχει εφεδρικό σετ για τις συχνές επεμβάσεις.','','' ),
        'causes',jsonb_build_object('people',jsonb_build_array(),'methods',jsonb_build_array('Το έντυπο δεν έχει υποχρεωτικό πεδίο βιολογικού δείκτη'),'equipment',jsonb_build_array('Επωαστήρας ταχείας ανάγνωσης μόνο ένας'),'materials',jsonb_build_array('Ανεπαρκής αριθμός εφεδρικών σετ'),'environment',jsonb_build_array(),'communication',jsonb_build_array('Δεν προγραμματίζονται οι επείγουσες επεμβάσεις με την ΚΑΠ')),
        'rootCause','','updatedAt',(d0-40)+time '11:00','updatedBy','Ιωάννου Δήμητρα')::text),
    (9, 18, 'finding', 4, 'ΜΕΘ', 'Καθημερινή αξιολόγηση ανάγκης ΚΦΚ (daily line review)', 'preventive', 'high', 'in_progress', 12, 'pending', 'Παπαδοπούλου Μαρία',
      'Καθημερινή λίστα ελέγχου στην πρωινή επίσκεψη για κάθε ΚΦΚ: ένδειξη, ημέρες καθετήρα, κατάσταση επιδέσμου· άμεση αφαίρεση όταν δεν χρειάζεται.',
      jsonb_build_array(
        jsonb_build_object('id','sa-demo-9-1','title','Σύνταξη λίστας ελέγχου daily line review','owner','Παπαδοπούλου Μαρία','dueDate',to_char(d0-10,'YYYY-MM-DD'),'done',true,'doneAt',(d0-11)+time '14:00','doneBy','Παπαδοπούλου Μαρία'),
        jsonb_build_object('id','sa-demo-9-2','title','Ενσωμάτωση στην πρωινή ιατρική επίσκεψη','owner','Αντωνίου Μαρία','dueDate',to_char(d0-3,'YYYY-MM-DD'),'done',false,'doneAt',null,'doneBy',''),
        jsonb_build_object('id','sa-demo-9-3','title','Εβδομαδιαία αναφορά ημερών ΚΦΚ στην ΕΝΛ','owner','Παπαδάκη Μαρία','dueDate',to_char(d0+5,'YYYY-MM-DD'),'done',false,'doneAt',null,'doneBy',''),
        jsonb_build_object('id','sa-demo-9-4','title','Επαναληπτική επιθεώρηση δέσμης ΚΦΚ','owner','Υπεύθυνη Ποιότητας','dueDate',to_char(d0+12,'YYYY-MM-DD'),'done',false,'doneAt',null,'doneBy',''))::text,
      null::text),
    (10, 1, 'finding', 6, 'ΜΕΘ', 'Αποκλειστικός εξοπλισμός ανά ασθενή με CPE / KPC', 'corrective', 'critical', 'open', 5, 'pending', 'Παπαδοπούλου Μαρία',
      'Στο πλαίσιο της συρροής Klebsiella pneumoniae KPC στη ΜΕΘ: αποκλειστικό στηθοσκόπιο, περιχειρίδα και θερμόμετρο ανά κλίνη ασθενούς με CPE, απολύμανση κοινού εξοπλισμού μετά από κάθε χρήση.',
      jsonb_build_array(
        jsonb_build_object('id','sa-demo-10-1','title','Προμήθεια ατομικών στηθοσκοπίων και περιχειρίδων μιας χρήσης','owner','Υπεύθυνη Ποιότητας','dueDate',to_char(d0+2,'YYYY-MM-DD'),'done',false,'doneAt',null,'doneBy',''),
        jsonb_build_object('id','sa-demo-10-2','title','Ενημέρωση όλων των βαρδιών για τις προφυλάξεις επαφής στη συρροή','owner','Παπαδοπούλου Μαρία','dueDate',to_char(d0+1,'YYYY-MM-DD'),'done',false,'doneAt',null,'doneBy',''),
        jsonb_build_object('id','sa-demo-10-3','title','Καθημερινός έλεγχος τήρησης για 2 εβδομάδες','owner','Παπαδάκη Μαρία','dueDate',to_char(d0+14,'YYYY-MM-DD'),'done',false,'doneAt',null,'doneBy',''))::text,
      jsonb_build_object('problem','Διασπορά Klebsiella pneumoniae KPC μεταξύ ασθενών της ΜΕΘ· κοινός εξοπλισμός μεταξύ κλινών χωρίς απολύμανση.',
        'whys',jsonb_build_array('Ο εξοπλισμός μεταφέρεται από κλίνη σε κλίνη.','Δεν υπάρχει ατομικός εξοπλισμός για τους ασθενείς σε απομόνωση.','','',''),
        'causes',jsonb_build_object('people',jsonb_build_array('Υψηλός φόρτος εργασίας νυχτερινής βάρδιας'),'methods',jsonb_build_array('Το πρωτόκολλο απομόνωσης δεν ορίζει αποκλειστικό εξοπλισμό'),'equipment',jsonb_build_array('Ένα στηθοσκόπιο ανά θάλαμο 4 κλινών'),'materials',jsonb_build_array('Έλλειψη υφασμάτων απολύμανσης στο τροχήλατο'),'environment',jsonb_build_array(),'communication',jsonb_build_array()),
        'rootCause','','updatedAt',(d0-1)+time '16:00','updatedBy','Υπεύθυνη Ποιότητας')::text),
    (11, 6, 'bundle', null, 'ΜΕΘ', 'Διορθωτική ενέργεια: απόκλιση δέσμης μέτρων ΜΕΘ', 'corrective', 'high', 'in_progress', 9, 'pending', 'Παπαδάκη Μαρία',
      'Αξιολόγηση δέσμης μέτρων στη ΜΕΘ με κριτήρια που δεν τηρήθηκαν. Επανεκπαίδευση της βάρδιας και επαναληπτική αξιολόγηση.',
      jsonb_build_array(
        jsonb_build_object('id','sa-demo-11-1','title','Συζήτηση της απόκλισης στην αναφορά βάρδιας','owner','Παπαδάκη Μαρία','dueDate',to_char(d0-4,'YYYY-MM-DD'),'done',true,'doneAt',(d0-5)+time '08:00','doneBy','Παπαδάκη Μαρία'),
        jsonb_build_object('id','sa-demo-11-2','title','Επαναληπτική αξιολόγηση δέσμης σε 10 ασθενείς','owner','Παπαδοπούλου Μαρία','dueDate',to_char(d0+9,'YYYY-MM-DD'),'done',false,'doneAt',null,'doneBy',''))::text,
      null::text)
  ) c(n, ago, src, ref, dep, title, kind, pri, st, due, eff, owner, descr, steps, rca)
  where c.src <> 'bundle' or v_bundle is not null
  on conflict (organization_id, code) do nothing;

  -- Explicit links (audit → finding → CAPA, incident → finding / CAPA) ---------------
  if not exists (select 1 from public.quality_record_links l where l.organization_id = v_org) then
    insert into public.quality_record_links(organization_id, source_type, source_id, target_type, target_id, relationship, created_by, created_at)
    select v_org, 'audit', qf.source_id, 'finding', qf.code, 'raised_finding', p_actor, qf.identified_at
    from public.quality_findings qf where qf.organization_id = v_org and qf.source_type = 'audit' and qf.source_id is not null
    union all
    select v_org, 'incident', qf.source_id, 'finding', qf.code, 'raised_finding', p_actor, qf.identified_at
    from public.quality_findings qf where qf.organization_id = v_org and qf.source_type = 'incident' and qf.source_id is not null
    union all
    select v_org, qc.source_type, qc.source_id, 'capa', qc.code, 'addressed_by', p_actor, qc.created_at
    from public.quality_capa_actions qc where qc.organization_id = v_org and qc.source_type in ('finding', 'incident') and qc.source_id is not null;
  end if;
end;
$function$;

create or replace function private.demo_seed_quality_enrich(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := current_date;
  v_icu_case uuid;
  v_icu_case2 uuid;
  v_cpe_case uuid;
  v_med_case uuid;
  v_med_patient uuid;
begin
  v_icu_case := (select sc.id from public.surveillance_cases sc join public.departments dep on dep.id = sc.department_id and dep.code = 'ΜΕΘ'
                 where sc.organization_id = v_org and sc.status = 'active' order by sc.started_at, sc.id limit 1);
  v_icu_case2 := (select sc.id from public.surveillance_cases sc join public.departments dep on dep.id = sc.department_id and dep.code = 'ΜΕΘ'
                  where sc.organization_id = v_org and sc.status = 'active' and sc.id is distinct from v_icu_case order by sc.started_at desc, sc.id limit 1);
  -- the cardiology case with the resistant Klebsiella isolate (CPE signage incident)
  v_cpe_case := (select ls.surveillance_case_id from public.laboratory_samples ls
                 join public.microbiology_results mr on mr.sample_id = ls.id and mr.result_status = 'positive' and mr.organism ilike 'klebsiella%' and mr.resistance_class is not null
                 join public.departments dep on dep.id = ls.department_id and dep.code = 'ΚΑΡΔ'
                 where ls.organization_id = v_org and ls.surveillance_case_id is not null order by ls.collected_at limit 1);
  v_med_case := (select sc.id from public.surveillance_cases sc join public.departments dep on dep.id = sc.department_id and dep.code = 'ΠΑΘ'
                 where sc.organization_id = v_org order by sc.started_at, sc.id limit 1);
  v_med_patient := (select p.id from public.patients p join public.departments dep on dep.id = p.department_id and dep.code = 'ΠΑΘ'
                    where p.organization_id = v_org and p.status = 'active' order by p.patient_code desc limit 1);

  -- Incidents: investigation, time, links ---------------------------------------
  update public.quality_incidents qi set
    event_time = i.t::time,
    immediate_actions = i.imm,
    root_cause = nullif(i.rc, ''),
    contributing_factors = nullif(i.cf, ''),
    owner_labels = array[i.owner, 'Υπεύθυνη Ποιότητας'],
    owner_label = i.owner,
    reported_by_label = i.rep,
    linked_surveillance_id = case i.link when 'icu' then v_icu_case when 'icu2' then v_icu_case2 when 'cpe' then v_cpe_case when 'med' then v_med_case end,
    linked_patient_id = case i.link
      when 'icu' then (select sc.patient_id from public.surveillance_cases sc where sc.id = v_icu_case)
      when 'icu2' then coalesce((select sc.patient_id from public.surveillance_cases sc where sc.id = v_icu_case2),
        (select p.id from public.patients p join public.departments dep on dep.id = p.department_id and dep.code = 'ΜΕΘ'
         where p.organization_id = v_org and p.status = 'active' and p.id is distinct from (select sc.patient_id from public.surveillance_cases sc where sc.id = v_icu_case)
         order by p.admission_date, p.patient_code limit 1))
      when 'cpe' then (select sc.patient_id from public.surveillance_cases sc where sc.id = v_cpe_case)
      when 'med' then (select sc.patient_id from public.surveillance_cases sc where sc.id = v_med_case)
      when 'medp' then v_med_patient end,
    history = jsonb_build_array(jsonb_build_object('id', 'INC-demo-' || i.n || '-1', 'at', qi.occurred_at + interval '40 minutes', 'action', 'incidentReported',
        'actorId', p_actor::text, 'actor', i.rep, 'actorEmail', '', 'reason', null, 'detail', null))
      || case when qi.status = 'closed' then jsonb_build_array(jsonb_build_object('id', 'INC-demo-' || i.n || '-2', 'at', qi.occurred_at + interval '9 days', 'action', 'incidentClosed',
        'actorId', p_actor::text, 'actor', 'Υπεύθυνη Ποιότητας', 'actorEmail', '', 'reason', null, 'detail', null)) else '[]'::jsonb end,
    updated_at = now()
  from (values
    (1, '03:40', 'Οικονόμου Κώστας', 'Παπαδάκη Μαρία', 'icu',
      'Κλινική εξέταση από εφημερεύοντα ιατρό, αξονική εγκεφάλου (χωρίς ευρήματα), ενημέρωση οικογένειας, ανύψωση πλαϊνών κιγκλιδωμάτων.',
      'Δεν είχε γίνει εκτίμηση κινδύνου πτώσης (κλίμακα Morse) κατά τη μεταφορά του ασθενούς από την Παθολογική.',
      'Νυχτερινή βάρδια με 1 νοσηλευτή ανά 4 ασθενείς· ηρεμιστικά τις προηγούμενες ώρες· συναγερμός κλίνης απενεργοποιημένος.'),
    (2, '21:10', 'Σταθόπουλος Κώστας', 'Οικονόμου Κώστας', 'medp',
      'Διακοπή της επόμενης δόσης, μέτρηση κατώτατων επιπέδων βανκομυκίνης και κρεατινίνης, ενημέρωση θεράποντος και φαρμακείου.',
      '', ''),
    (3, '06:30', 'Ιωάννου Δήμητρα', 'Μαυρίδου Δήμητρα', null,
      'Καραντίνα των εμβολίων, επικοινωνία με τον παρασκευαστή για τη σταθερότητα, μεταφορά σε εφεδρικό ψυγείο.',
      'Ο θερμοστάτης του ψυγείου απορρύθμισε μετά από διακοπή ρεύματος και δεν υπήρχε συναγερμός θερμοκρασίας.',
      'Ο έλεγχος θερμοκρασίας γινόταν χειροκίνητα μία φορά ανά βάρδια· το ψυγείο δεν ήταν συνδεδεμένο σε UPS.'),
    (4, '14:20', 'Παπαδοπούλου Μαρία', 'Αντωνίου Μαρία', null,
      'Πλύση με νερό και σαπούνι, δήλωση στην Ιατρική Εργασίας, έλεγχος ορολογίας πηγής και εργαζόμενης, προφύλαξη μετά από έκθεση εντός 2 ωρών.',
      'Επανατοποθέτηση καλύμματος σε χρησιμοποιημένη βελόνα (recapping) λόγω υπερπλήρους περιέκτη αιχμηρών.',
      'Περιέκτης αιχμηρών πάνω από τη γραμμή πλήρωσης· έλλειψη βελονών ασφαλείας στο τμήμα τη συγκεκριμένη εβδομάδα.'),
    (5, '10:05', 'Βασιλείου Σπύρος', 'Δημητρίου Σπύρος', 'cpe',
      'Άμεση τοποθέτηση κάρτας προφυλάξεων επαφής και ενημέρωση προσωπικού και επισκεπτών.',
      'Δεν υπήρχαν διαθέσιμες τυποποιημένες κάρτες προφυλάξεων στο τμήμα και η σήμανση γινόταν χειρόγραφα.',
      'Η εισαγωγή έγινε απόγευμα Παρασκευής· το αποτέλεσμα της καλλιέργειας κοινοποιήθηκε τηλεφωνικά χωρίς γραπτή ειδοποίηση.'),
    (6, '17:45', 'Οικονόμου Κώστας', 'Παπαδάκη Μαρία', null,
      'Έκτακτος καθαρισμός του χώρου και ενημέρωση της εταιρείας καθαριότητας.',
      '', ''),
    (7, '11:50', 'Οικονόμου Κώστας', 'Κωνσταντίνου Κώστας', null,
      'Αντικατάσταση της αντλίας, απομάκρυνση από τη χρήση και αποστολή στη Βιοϊατρική Τεχνολογία.',
      'Αποτυχία της μπαταρίας του συναγερμού λόγω καθυστερημένης προληπτικής συντήρησης.',
      'Το πρόγραμμα συντήρησης δεν περιλάμβανε τις αντλίες που μεταφέρθηκαν από άλλο τμήμα.'),
    (8, '08:15', 'Σταθόπουλος Κώστας', 'Οικονόμου Κώστας', 'med',
      'Επανάληψη αιμοκαλλιέργειας πριν από την έναρξη αντιβιοτικού και ενημέρωση του εργαστηρίου.',
      'Δεν υπήρχε προγραμματισμένη διακομιδή δειγμάτων στο εργαστήριο κατά την αλλαγή βάρδιας.',
      'Μη διαθεσιμότητα τραυματιοφορέα· δεν υπάρχει πνευματικό ταχυδρομείο στην πτέρυγα.'),
    (9, '15:30', 'Παπαδοπούλου Μαρία', 'Αντωνίου Μαρία', 'icu2',
      'Πίεση στο σημείο εισόδου, αφαίρεση του καθετήρα, τοποθέτηση νέου ΚΦΚ με πλήρη άσηπτη τεχνική, λήψη αιμοκαλλιεργειών.',
      'Ο ΚΦΚ δεν ήταν στερεωμένος με συσκευή στερέωσης χωρίς ράμματα και η γραμμή δεν ελέγχθηκε πριν από τη μετακίνηση για αξονική.',
      'Μετακίνηση με 2 άτομα αντί για 3· μεγάλο μήκος προεκτάσεων· απουσία λίστας ελέγχου ενδονοσοκομειακής μεταφοράς.'),
    (10, '12:40', 'Ιωάννου Δήμητρα', 'Ιωάννου Δήμητρα', null,
      'Άμεση αναπλήρωση των διανομέων από την αποθήκη του τμήματος.',
      'Δεν είχε οριστεί υπεύθυνος για τον καθημερινό έλεγχο των διανομέων στους διαδρόμους.',
      'Καθυστέρηση παραγγελίας από την αποθήκη· αυξημένη κατανάλωση λόγω επίσκεψης ελέγχου.')
  ) i(n, t, owner, rep, link, imm, rc, cf)
  where qi.organization_id = v_org and right(qi.code, 2) = lpad(i.n::text, 2, '0');

  -- The 6 seeded CAPAs: steps, root cause analysis, effectiveness ------------------
  update public.quality_capa_actions qc set
    owner_label = c.owner,
    owner_labels = array[c.owner, 'Υπεύθυνη Ποιότητας'],
    sub_actions = c.steps,
    root_cause_analysis = c.rca,
    description = c.descr,
    effectiveness_status = c.eff,
    verified_by = case when c.eff = 'effective' then p_actor end,
    verified_at = case when c.eff = 'effective' then (qc.due_date + 25) + time '11:00' end,
    created_at = to_date(substr(qc.code, 6, 6), 'YYMMDD') + time '10:00',
    history = jsonb_build_array(jsonb_build_object('id', 'CAPA-demo-' || c.n || '-1', 'at', to_date(substr(qc.code, 6, 6), 'YYMMDD') + time '10:00', 'action', 'capaAssigned',
        'actorId', p_actor::text, 'actor', 'Υπεύθυνη Ποιότητας', 'actorEmail', '', 'reason', null, 'detail', null))
      || case when qc.status in ('verification', 'closed') then jsonb_build_array(jsonb_build_object('id', 'CAPA-demo-' || c.n || '-2', 'at', (qc.due_date) + time '13:00', 'action', 'recordUpdated',
        'actorId', p_actor::text, 'actor', 'Υπεύθυνη Ποιότητας', 'actorEmail', '', 'reason', null, 'detail', jsonb_build_object('field', 'status'))) else '[]'::jsonb end,
    updated_at = now()
  from (values
    (1, 'Οικονόμου Κώστας', 'pending',
      'Εφαρμογή κλίμακας Morse σε κάθε εισαγωγή και μεταφορά, πλαϊνά κιγκλιδώματα και συναγερμός κλίνης για ασθενείς υψηλού κινδύνου.',
      jsonb_build_array(
        jsonb_build_object('id','sa-demo-c1-1','title','Ενσωμάτωση κλίμακας Morse στο έντυπο εισαγωγής','owner','Οικονόμου Κώστας','dueDate',to_char(d0-1,'YYYY-MM-DD'),'done',true,'doneAt',(d0-1)+time '12:00','doneBy','Οικονόμου Κώστας'),
        jsonb_build_object('id','sa-demo-c1-2','title','Έλεγχος λειτουργίας συναγερμών κλίνης στη ΜΕΘ','owner','Παπαδάκη Μαρία','dueDate',to_char(d0+2,'YYYY-MM-DD'),'done',true,'doneAt',(d0)+time '09:00','doneBy','Παπαδάκη Μαρία'),
        jsonb_build_object('id','sa-demo-c1-3','title','Εκπαίδευση νυχτερινής βάρδιας στην πρόληψη πτώσεων','owner','Παπαδοπούλου Μαρία','dueDate',to_char(d0+7,'YYYY-MM-DD'),'done',false,'doneAt',null,'doneBy',''),
        jsonb_build_object('id','sa-demo-c1-4','title','Μηνιαίος έλεγχος τεκμηρίωσης Morse (10 φάκελοι)','owner','Υπεύθυνη Ποιότητας','dueDate',to_char(d0+10,'YYYY-MM-DD'),'done',false,'doneAt',null,'doneBy','')),
      jsonb_build_object('problem','Πτώση ηλικιωμένου ασθενούς από την κλίνη στη ΜΕΘ κατά τη νυχτερινή βάρδια.',
        'whys',jsonb_build_array('Ο ασθενής προσπάθησε να σηκωθεί μόνος του.','Τα πλαϊνά κιγκλιδώματα ήταν κατεβασμένα και ο συναγερμός κλίνης ανενεργός.','Δεν είχε αναγνωριστεί ως υψηλού κινδύνου για πτώση.','Δεν έγινε εκτίμηση Morse κατά τη μεταφορά από την Παθολογική.','Η εκτίμηση κινδύνου δεν είναι υποχρεωτικό πεδίο στη μεταφορά.'),
        'causes',jsonb_build_object('people',jsonb_build_array('Κόπωση νυχτερινής βάρδιας'),'methods',jsonb_build_array('Η κλίμακα Morse δεν επαναλαμβάνεται στη μεταφορά'),'equipment',jsonb_build_array('Συναγερμός κλίνης απενεργοποιημένος'),'materials',jsonb_build_array('Ηρεμιστικά τις προηγούμενες ώρες'),'environment',jsonb_build_array('Χαμηλός φωτισμός θαλάμου'),'communication',jsonb_build_array('Ελλιπής παράδοση στη μεταφορά')),
        'rootCause','Η εκτίμηση κινδύνου πτώσης δεν επαναλαμβάνεται όταν ο ασθενής μεταφέρεται μεταξύ τμημάτων.',
        'updatedAt',(d0-2)+time '12:00','updatedBy','Υπεύθυνη Ποιότητας')),
    (2, 'Σταθόπουλος Κώστας', 'pending',
      'Διπλή ανεξάρτητη επαλήθευση και υπογραφή για βανκομυκίνη και αμινογλυκοσίδες· επισήμανση στο σύστημα συνταγογράφησης.',
      jsonb_build_array(
        jsonb_build_object('id','sa-demo-c2-1','title','Ορισμός λίστας αντιβιοτικών υψηλού κινδύνου','owner','Σταθόπουλος Κώστας','dueDate',to_char(d0-3,'YYYY-MM-DD'),'done',false,'doneAt',null,'doneBy',''),
        jsonb_build_object('id','sa-demo-c2-2','title','Πεδίο διπλής υπογραφής στο φύλλο χορήγησης','owner','Οικονόμου Κώστας','dueDate',to_char(d0+4,'YYYY-MM-DD'),'done',false,'doneAt',null,'doneBy',''),
        jsonb_build_object('id','sa-demo-c2-3','title','Ενημέρωση νοσηλευτών Παθολογικής','owner','Οικονόμου Κώστας','dueDate',to_char(d0+10,'YYYY-MM-DD'),'done',false,'doneAt',null,'doneBy','')),
      jsonb_build_object('problem','Χορήγηση διπλής δόσης βανκομυκίνης σε ασθενή της Παθολογικής.',
        'whys',jsonb_build_array('Η δόση χορηγήθηκε δύο φορές στην αλλαγή βάρδιας.','Η πρώτη χορήγηση δεν είχε καταγραφεί έγκαιρα.','','',''),
        'causes',jsonb_build_object('people',jsonb_build_array(),'methods',jsonb_build_array('Καμία διπλή επαλήθευση για φάρμακα υψηλού κινδύνου'),'equipment',jsonb_build_array(),'materials',jsonb_build_array(),'environment',jsonb_build_array(),'communication',jsonb_build_array('Προφορική παράδοση βάρδιας')),
        'rootCause','','updatedAt',(d0-4)+time '15:00','updatedBy','Σταθόπουλος Κώστας')),
    (3, 'Ιωάννου Δήμητρα', 'effective',
      'Καταγραφικό θερμοκρασίας με ειδοποίηση SMS και σύνδεση του ψυγείου σε UPS. Τεκμήρια επαλήθευσης: 30 ημέρες καταγραφής χωρίς απόκλιση, δοκιμή συναγερμού στις 2 βάρδιες.',
      jsonb_build_array(
        jsonb_build_object('id','sa-demo-c3-1','title','Εγκατάσταση καταγραφικού με ειδοποίηση SMS','owner','Ιωάννου Δήμητρα','dueDate',to_char(d0-25,'YYYY-MM-DD'),'done',true,'doneAt',(d0-26)+time '11:00','doneBy','Ιωάννου Δήμητρα'),
        jsonb_build_object('id','sa-demo-c3-2','title','Σύνδεση ψυγείου εμβολίων σε UPS','owner','Μαυρίδου Δήμητρα','dueDate',to_char(d0-22,'YYYY-MM-DD'),'done',true,'doneAt',(d0-23)+time '10:00','doneBy','Μαυρίδου Δήμητρα'),
        jsonb_build_object('id','sa-demo-c3-3','title','Επαλήθευση: δοκιμή συναγερμού και ανασκόπηση καταγραφών 30 ημερών','owner','Υπεύθυνη Ποιότητας','dueDate',to_char(d0-20,'YYYY-MM-DD'),'done',true,'doneAt',(d0-20)+time '13:00','doneBy','Υπεύθυνη Ποιότητας')),
      jsonb_build_object('problem','Το ψυγείο εμβολίων της Χειρουργικής ξεπέρασε τους 8°C για 2 ώρες.',
        'whys',jsonb_build_array('Ο θερμοστάτης απορρύθμισε μετά από διακοπή ρεύματος.','Το ψυγείο δεν ήταν συνδεδεμένο σε UPS.','Δεν υπήρχε συναγερμός θερμοκρασίας.','Ο έλεγχος γινόταν μόνο χειροκίνητα ανά βάρδια.',''),
        'causes',jsonb_build_object('people',jsonb_build_array(),'methods',jsonb_build_array('Χειροκίνητη καταγραφή μία φορά ανά βάρδια'),'equipment',jsonb_build_array('Χωρίς καταγραφικό με συναγερμό','Χωρίς UPS'),'materials',jsonb_build_array(),'environment',jsonb_build_array('Διακοπή ρεύματος'),'communication',jsonb_build_array()),
        'rootCause','Η ψυχρή αλυσίδα βασιζόταν μόνο σε χειροκίνητους ελέγχους χωρίς αυτόματο συναγερμό ή εφεδρική τροφοδοσία.',
        'updatedAt',(d0-28)+time '10:00','updatedBy','Ιωάννου Δήμητρα')),
    (4, 'Παπαδοπούλου Μαρία', 'pending',
      'Υποχρεωτική εκπαίδευση στην ασφαλή απόρριψη αιχμηρών και αντικατάσταση με βελόνες ασφαλείας. Σε επαλήθευση: έλεγχος περιεκτών σε 4 εβδομάδες.',
      jsonb_build_array(
        jsonb_build_object('id','sa-demo-c4-1','title','Εκπαίδευση νοσηλευτικού προσωπικού ΜΕΘ (2 κύκλοι)','owner','Παπαδοπούλου Μαρία','dueDate',to_char(d0-6,'YYYY-MM-DD'),'done',true,'doneAt',(d0-7)+time '13:00','doneBy','Παπαδοπούλου Μαρία'),
        jsonb_build_object('id','sa-demo-c4-2','title','Διάθεση βελονών ασφαλείας σε όλα τα τροχήλατα','owner','Παπαδάκη Μαρία','dueDate',to_char(d0-4,'YYYY-MM-DD'),'done',true,'doneAt',(d0-5)+time '09:00','doneBy','Παπαδάκη Μαρία'),
        jsonb_build_object('id','sa-demo-c4-3','title','Επαλήθευση: έλεγχος πλήρωσης περιεκτών αιχμηρών σε 4 εβδομάδες','owner','Υπεύθυνη Ποιότητας','dueDate',to_char(d0-2,'YYYY-MM-DD'),'done',true,'doneAt',(d0-2)+time '12:00','doneBy','Υπεύθυνη Ποιότητας')),
      jsonb_build_object('problem','Νυγμός νοσηλεύτριας της ΜΕΘ κατά την απόρριψη χρησιμοποιημένης βελόνας.',
        'whys',jsonb_build_array('Η νοσηλεύτρια επανατοποθέτησε το κάλυμμα στη βελόνα.','Ο περιέκτης αιχμηρών ήταν υπερπλήρης.','Οι περιέκτες δεν αντικαθίστανται σε σταθερό χρόνο.','Δεν υπήρχαν βελόνες ασφαλείας εκείνη την εβδομάδα.',''),
        'causes',jsonb_build_object('people',jsonb_build_array('Συνήθεια recapping'),'methods',jsonb_build_array('Χωρίς πρόγραμμα αντικατάστασης περιεκτών'),'equipment',jsonb_build_array(),'materials',jsonb_build_array('Έλλειψη βελονών ασφαλείας'),'environment',jsonb_build_array('Περιορισμένος χώρος στο τροχήλατο'),'communication',jsonb_build_array()),
        'rootCause','Απουσία βελονών ασφαλείας και προγράμματος αντικατάστασης περιεκτών, σε συνδυασμό με την πρακτική του recapping.',
        'updatedAt',(d0-10)+time '10:00','updatedBy','Παπαδοπούλου Μαρία')),
    (5, 'Βασιλείου Σπύρος', 'effective',
      'Νέες τυποποιημένες κάρτες προφυλάξεων (επαφής, σταγονιδίων, αερογενούς) σε όλα τα τμήματα. Τεκμήρια επαλήθευσης: έλεγχος 12 θαλάμων απομόνωσης με 100% σωστή σήμανση.',
      jsonb_build_array(
        jsonb_build_object('id','sa-demo-c5-1','title','Σχεδιασμός και εκτύπωση καρτών προφυλάξεων','owner','Υπεύθυνη Ποιότητας','dueDate',to_char(d0-16,'YYYY-MM-DD'),'done',true,'doneAt',(d0-16)+time '10:00','doneBy','Υπεύθυνη Ποιότητας'),
        jsonb_build_object('id','sa-demo-c5-2','title','Διανομή σε όλα τα τμήματα','owner','Βασιλείου Σπύρος','dueDate',to_char(d0-13,'YYYY-MM-DD'),'done',true,'doneAt',(d0-14)+time '11:30','doneBy','Βασιλείου Σπύρος'),
        jsonb_build_object('id','sa-demo-c5-3','title','Επαλήθευση: έλεγχος σήμανσης σε όλους τους θαλάμους απομόνωσης','owner','Παπαδοπούλου Μαρία','dueDate',to_char(d0-12,'YYYY-MM-DD'),'done',true,'doneAt',(d0-12)+time '12:00','doneBy','Παπαδοπούλου Μαρία')),
      jsonb_build_object('problem','Θάλαμος ασθενούς με CPE στην Καρδιολογική χωρίς σήμανση προφυλάξεων επαφής.',
        'whys',jsonb_build_array('Δεν τοποθετήθηκε κάρτα μετά το αποτέλεσμα της καλλιέργειας.','Δεν υπήρχαν διαθέσιμες κάρτες στο τμήμα.','Η σήμανση γινόταν χειρόγραφα κατά περίπτωση.','',''),
        'causes',jsonb_build_object('people',jsonb_build_array(),'methods',jsonb_build_array('Μη τυποποιημένη σήμανση'),'equipment',jsonb_build_array(),'materials',jsonb_build_array('Έλλειψη καρτών'),'environment',jsonb_build_array(),'communication',jsonb_build_array('Τηλεφωνική μόνο κοινοποίηση του αποτελέσματος')),
        'rootCause','Δεν υπήρχε τυποποιημένο υλικό σήμανσης ούτε γραπτή ειδοποίηση του τμήματος για τους φορείς CPE.',
        'updatedAt',(d0-17)+time '09:00','updatedBy','Βασιλείου Σπύρος')),
    (6, 'Παπαδοπούλου Μαρία', 'pending',
      'Έλεγχος στερέωσης ΚΦΚ πριν από κάθε μετακίνηση, συσκευές στερέωσης χωρίς ράμματα και λίστα ελέγχου ενδονοσοκομειακής μεταφοράς.',
      jsonb_build_array(
        jsonb_build_object('id','sa-demo-c6-1','title','Προμήθεια συσκευών στερέωσης ΚΦΚ χωρίς ράμματα','owner','Υπεύθυνη Ποιότητας','dueDate',to_char(d0-20,'YYYY-MM-DD'),'done',true,'doneAt',(d0-22)+time '10:00','doneBy','Υπεύθυνη Ποιότητας'),
        jsonb_build_object('id','sa-demo-c6-2','title','Λίστα ελέγχου ενδονοσοκομειακής μεταφοράς ασθενών ΜΕΘ','owner','Παπαδοπούλου Μαρία','dueDate',to_char(d0-8,'YYYY-MM-DD'),'done',true,'doneAt',(d0-9)+time '14:00','doneBy','Παπαδοπούλου Μαρία'),
        jsonb_build_object('id','sa-demo-c6-3','title','Εκπαίδευση ομάδας μεταφοράς (3 άτομα ανά μετακίνηση)','owner','Αντωνίου Μαρία','dueDate',to_char(d0-2,'YYYY-MM-DD'),'done',false,'doneAt',null,'doneBy',''),
        jsonb_build_object('id','sa-demo-c6-4','title','Έλεγχος 20 μεταφορών με τη νέα λίστα','owner','Παπαδάκη Μαρία','dueDate',to_char(d0+14,'YYYY-MM-DD'),'done',false,'doneAt',null,'doneBy','')),
      jsonb_build_object('problem','Τυχαία αποσύνδεση κεντρικού φλεβικού καθετήρα κατά τη μετακίνηση ασθενούς της ΜΕΘ για αξονική.',
        'whys',jsonb_build_array('Ο καθετήρας τραβήχτηκε κατά τη μεταφορά στο φορείο.','Δεν ήταν στερεωμένος με συσκευή στερέωσης.','Η στερέωση με ράμμα είχε χαλαρώσει και δεν ελέγχθηκε.','Δεν υπάρχει έλεγχος γραμμών πριν από τη μετακίνηση.','Δεν υπάρχει λίστα ελέγχου ενδονοσοκομειακής μεταφοράς.'),
        'causes',jsonb_build_object('people',jsonb_build_array('Μεταφορά με 2 άτομα αντί για 3'),'methods',jsonb_build_array('Χωρίς λίστα ελέγχου μεταφοράς'),'equipment',jsonb_build_array('Χωρίς συσκευές στερέωσης χωρίς ράμματα'),'materials',jsonb_build_array('Μεγάλο μήκος προεκτάσεων'),'environment',jsonb_build_array('Στενός ανελκυστήρας'),'communication',jsonb_build_array('Μη ενημέρωση του Ακτινολογικού για ασθενή με ΚΦΚ')),
        'rootCause','Δεν υπάρχει τυποποιημένη προετοιμασία της ενδονοσοκομειακής μεταφοράς που να περιλαμβάνει τον έλεγχο στερέωσης των γραμμών.',
        'updatedAt',(d0-25)+time '12:00','updatedBy','Παπαδοπούλου Μαρία'))
  ) c(n, owner, eff, descr, steps, rca)
  where qc.organization_id = v_org and qc.source_type = 'incident'
    and right(qc.code, 2) = lpad(c.n::text, 2, '0');
end;
$function$;

create or replace function private.demo_seed_quality_surveys(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := current_date;
  v_now timestamptz := now();
  v_patient uuid;
  v_dep uuid;
  v_sample uuid;
  v_code text;
  r record;
begin
  -- Point prevalence surveys: a completed ECDC PPS about two months ago (one row
  -- per department) and the current one, still in progress.
  if not exists (select 1 from public.point_prevalence_surveys x where x.organization_id = v_org) then
    insert into public.point_prevalence_surveys(organization_id, department_id, survey_date, patients_total, patients_with_hai, patients_on_antibiotics,
      responsible_name, notes, created_by, updated_by, created_at, updated_at)
    select v_org, dep.id, s.d, s.tot, s.hai, s.abx, s.resp, s.notes, p_actor, p_actor, s.d + time '15:00', s.d + time '15:00'
    from (values
      ('ΜΕΘ', d0 - 61, 11, 4, 9, 'ΕΝΛ', 'ECDC PPS (πρωτόκολλο 6.1) — ολοκληρώθηκε. 2 CLABSI, 1 VAP, 1 CAUTI.'),
      ('ΠΑΘ', d0 - 61, 27, 2, 15, 'ΕΝΛ', 'ECDC PPS (πρωτόκολλο 6.1) — ολοκληρώθηκε. 1 CAUTI, 1 λοίμωξη από C. difficile.'),
      ('ΧΕΙΡ', d0 - 61, 24, 2, 14, 'ΕΝΛ', 'ECDC PPS (πρωτόκολλο 6.1) — ολοκληρώθηκε. 2 SSI. Χειρουργική προφύλαξη > 24 ώρες σε 5 ασθενείς.'),
      ('ΚΑΡΔ', d0 - 60, 20, 1, 8, 'ΕΝΛ', 'ECDC PPS (πρωτόκολλο 6.1) — ολοκληρώθηκε. 1 πνευμονία.'),
      ('ΟΡΘ', d0 - 60, 17, 1, 8, 'ΕΝΛ', 'ECDC PPS (πρωτόκολλο 6.1) — ολοκληρώθηκε. 1 SSI μετά από αρθροπλαστική.'),
      ('ΝΕΦ', d0 - 60, 15, 1, 7, 'ΕΝΛ', 'ECDC PPS (πρωτόκολλο 6.1) — ολοκληρώθηκε. 1 βακτηριαιμία σχετιζόμενη με καθετήρα αιμοκάθαρσης.'),
      ('ΠΑΙΔ', d0 - 59, 12, 0, 4, 'ΕΝΛ', 'ECDC PPS (πρωτόκολλο 6.1) — ολοκληρώθηκε. Χωρίς ενεργή ΝΝΛ.'),
      ('ΜΕΝΝ', d0 - 59, 8, 1, 4, 'ΕΝΛ', 'ECDC PPS (πρωτόκολλο 6.1) — ολοκληρώθηκε. 1 κλινική σήψη νεογνού.'),
      ('ΜΕΘ', d0 - 1, 12, 5, 10, 'Παπαδοπούλου Μαρία', 'Επισκόπηση σε εξέλιξη (ημέρα 1/3). Περιλαμβάνει τους ασθενείς της συρροής Klebsiella pneumoniae KPC.'),
      ('ΠΑΘ', d0 - 1, 28, 2, 14, 'Οικονόμου Κώστας', 'Επισκόπηση σε εξέλιξη (ημέρα 1/3) — εκκρεμεί επιβεβαίωση 1 πιθανής CAUTI.'),
      ('ΧΕΙΡ', d0, 23, 1, 12, 'Ιωάννου Δήμητρα', 'Επισκόπηση σε εξέλιξη (ημέρα 2/3). Τα υπόλοιπα τμήματα προγραμματίζονται για αύριο.')
    ) s(dep, d, tot, hai, abx, resp, notes)
    join public.departments dep on dep.organization_id = v_org and dep.code = s.dep;
  end if;

  -- Hospital structure (Management → structure history) -------------------------
  if not exists (select 1 from public.hospital_structure_snapshots x where x.organization_id = v_org) then
    insert into public.hospital_structure_snapshots(organization_id, effective_date, total_beds, icu_beds, single_rooms, infection_control_nurses,
      infectious_disease_physicians, microbiologists, notes, created_by, created_at)
    values
      (v_org, (date_trunc('year', d0) - interval '1 year')::date, 152, 10, 18, 2, 1, 1, 'Ετήσια δήλωση δομής προς ΕΟΔΥ.', p_actor, (date_trunc('year', d0) - interval '1 year')::date + time '10:00'),
      (v_org, (date_trunc('year', d0))::date + 14, 156, 10, 20, 2, 1, 2, 'Ετήσια δήλωση δομής. Πρόσληψη δεύτερου μικροβιολόγου.', p_actor, (date_trunc('year', d0))::date + 14 + time '10:00'),
      (v_org, d0 - 95, 162, 12, 24, 3, 1, 2, 'Επέκταση ΜΕΘ κατά 2 κλίνες, 4 νέοι μονόκλινοι θάλαμοι απομόνωσης, τρίτη Νοσηλεύτρια Επιτήρησης Λοιμώξεων.', p_actor, (d0 - 95) + time '10:00');
  end if;

  -- A Legionella isolate (community-acquired pneumonia, internal medicine) so the
  -- ΕΟΔΥ notification list has a classic notifiable disease beside the CR bacteraemias.
  v_code := 'LAB-' || to_char(d0 - 12, 'YYMMDD') || '-971';
  if not exists (select 1 from public.laboratory_samples ls where ls.organization_id = v_org and ls.sample_code = v_code) then
    v_patient := (select p.id from public.patients p join public.departments dep on dep.id = p.department_id and dep.code = 'ΠΑΘ'
                  where p.organization_id = v_org and p.status = 'active'
                    and not exists (select 1 from public.surveillance_cases sc where sc.patient_id = p.id)
                  order by p.admission_date, p.patient_code limit 1);
    v_dep := (select p.department_id from public.patients p where p.id = v_patient);
    if v_patient is not null then
      v_sample := gen_random_uuid();
      insert into public.laboratory_samples(id, organization_id, patient_id, department_id, sample_code, sample_type, source_site,
        requested_at, requested_by, collected_at, received_at, status, priority, subject_type, created_by, created_at)
      values (v_sample, v_org, v_patient, v_dep, v_code, 'respiratorySample', 'Βρογχοκυψελιδικό έκπλυμα (BAL)',
        (d0 - 12) + time '08:20', p_actor, (d0 - 12) + time '09:00', (d0 - 12) + time '09:30', 'completed', 'urgent', 'patient', p_actor, (d0 - 12) + time '09:00');
      insert into public.microbiology_results(organization_id, sample_id, result_status, organism, resistance_class, susceptibility_summary,
        is_critical, critical_communicated_at, critical_communicated_to, resulted_at, validated_by, validated_at, created_by, method,
        preliminary, validation_status, interpretation_standard, interpretation_version)
      values (v_org, v_sample, 'positive', 'Legionella pneumophila', null, 'Καλλιέργεια BCYE θετική· θετικό αντιγόνο ούρων (ορότυπος 1).',
        true, (d0 - 8) + time '11:20', 'Θεράπων ιατρός', (d0 - 8) + time '11:00', p_actor, (d0 - 8) + time '11:00', p_actor, 'culture',
        false, 'validated', 'EUCAST', '15.0');
    end if;
  end if;

  -- ΕΟΔΥ notifiable-disease reports for the laboratory findings (keys as the
  -- Reporting screen builds them: sample code | first result id | rule id).
  for r in
    select x.*, row_number() over (partition by x.rule_id order by x.collected_at) rn, count(*) over (partition by x.rule_id) cnt from (
      select ls.sample_code, ls.id as sample_id, mr.id as result_id, ls.collected_at, mr.organism,
        case when mr.organism ilike 'legionella%' then 'legionellosis' else 'carbapenem_resistant_bacteraemia' end as rule_id
      from public.microbiology_results mr
      join public.laboratory_samples ls on ls.id = mr.sample_id
      where mr.organization_id = v_org and mr.result_status = 'positive' and mr.validation_status in ('validated', 'amended')
        and coalesce(ls.subject_type, 'patient') = 'patient' and mr.amended_from is null
        and (mr.organism ilike 'legionella%'
          or (ls.sample_type = 'bloodCulture'
              and mr.organism ~* '(klebsiella|escherichia|enterobacter|acinetobacter|pseudomonas|serratia|citrobacter|proteus|morganella)'
              and exists (select 1 from public.antimicrobial_susceptibility_results a where a.microbiology_result_id = mr.id
                          and a.antimicrobial_code in ('ABX-MEM', 'ABX-IPM', 'ABX-ETP') and a.sir_category = 'R')))
        -- findings of the last few days stay without a report (pending on the Reporting screen)
        and ls.collected_at < v_now - interval '5 days'
    ) x
  loop
    insert into public.notifiable_disease_reports(organization_id, finding_key, sample_id, disease_code, status, notified_at, reference, notes, updated_by, created_at, updated_at)
    values (v_org, r.sample_code || '|' || r.result_id::text || '|' || r.rule_id, r.sample_id, r.rule_id,
      case when r.rn = r.cnt and r.rule_id <> 'legionellosis' then 'pending' else 'notified' end,
      case when r.rn = r.cnt and r.rule_id <> 'legionellosis' then null else (r.collected_at + interval '3 days')::date end,
      case when r.rn = r.cnt and r.rule_id <> 'legionellosis' then null else 'ΕΟΔΥ ' || to_char(r.collected_at, 'YYYY') || '/' || lpad((1400 + r.rn * 37 + case when r.rule_id = 'legionellosis' then 211 else 0 end)::text, 5, '0') end,
      case when r.rule_id = 'legionellosis' then 'Δήλωση εντός 24 ωρών· ενημερώθηκε το Τμήμα Περιβαλλοντικής Υγιεινής για έλεγχο του δικτύου νερού.'
           when r.rn = r.cnt then 'Πρόχειρο δελτίο — εκκρεμεί η επιβεβαίωση καρβαπενεμάσης από το εργαστήριο αναφοράς.'
           else 'Δελτίο δήλωσης ανθεκτικού στις καρβαπενέμες στελέχους (Σχέδιο δράσης «Προκρούστης»).' end,
      p_actor, r.collected_at + interval '2 days', r.collected_at + interval '3 days')
    on conflict (organization_id, finding_key) do nothing;
  end loop;
end;
$function$;

create or replace function private.demo_seed_quality_indicators(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := current_date;
  v_icu uuid := (select dep.id from public.departments dep where dep.organization_id = p_organization_id and dep.code = 'ΜΕΘ');
  v_scopes uuid[];
  v_dep uuid;
  v_si integer;
  k integer;
  ms date; me date;
  v_pd numeric; v_daily integer;
  v_active numeric; v_mdro numeric; v_bact numeric; v_hh_ok numeric; v_hh_tot numeric; v_b_ok numeric; v_b_tot numeric;
  v_abhr numeric; v_ddd numeric; v_tr_ok numeric; v_tr_tot numeric; v_iso numeric; v_kl_t numeric; v_kl_r numeric;
  v_pps_t numeric; v_pps_h numeric; v_pps_a numeric;
  -- history for the months before the Demo's own records (index = months ago)
  syn_hh_ok numeric[] := array[0, 0, 0, 152, 147, 143];
  syn_hh_icu numeric[] := array[0, 0, 0, 44, 42, 40];
  syn_b_ok numeric[] := array[0, 0, 4, 5, 4, 4];
  syn_active numeric[] := array[0, 0, 10, 9, 11, 8];
  syn_mdro numeric[] := array[0, 0, 1, 1, 2, 1];
  syn_bact numeric[] := array[0, 0, 4, 4, 5, 3];
  syn_iso numeric[] := array[0, 0, 2, 2, 3, 2];
  syn_tr numeric[] := array[0, 0, 0, 21, 19, 18];
  syn_kl_r numeric[] := array[0, 0, 2, 1, 2, 1];
  m_eody_n numeric[] := array[8, 7, 9, 8, 11, 7];
  m_eody_d numeric[] := array[8, 8, 9, 8, 12, 7];
  m_clabsi_n numeric[] := array[2, 1, 1, 0, 1, 0];
  m_clabsi_icu_d numeric[] := array[312, 296, 305, 288, 301, 279];
  m_clabsi_all_d numeric[] := array[468, 441, 452, 430, 447, 419];
  m_vap_n numeric[] := array[1, 1, 0, 1, 0, 1];
  m_vap_d numeric[] := array[204, 196, 210, 188, 199, 192];
begin
  -- Hospital definitions: CLABSI / VAP (entered manually from the ICU device-day
  -- register) and hospital targets for antibiotic use and the PPS prevalence.
  -- Definitions are kept by the Demo wipe, hence the upsert.
  insert into public.indicator_definitions(organization_id, indicator_key, version, title_el, title_en, category, numerator_definition, denominator_definition,
    multiplier, unit, unit_en, source_authority, effective_from, status, created_by, approved_by, approved_at, calculation_type, numerator_metric, denominator_metric,
    target_value, direction, visible_department_ids)
  select v_org, x.k, x.ver, x.el, x.en, x.cat, x.numd::jsonb, x.dend::jsonb, x.mult, x.unit, x.unit_en, x.src, date_trunc('year', d0)::date, 'active',
    p_actor, p_actor, now(), x.calc, x.num, x.den, x.target, x.dir, '[]'::jsonb
  from (values
    ('clabsi-per-1000-cvc-days', '2026.1', 'CLABSI ανά 1.000 ημέρες κεντρικού φλεβικού καθετήρα', 'CLABSI per 1,000 central-line days', 'surveillance',
      '{"description":"Επεισόδια CLABSI (ορισμός ECDC HAI-Net ICU)"}', '{"description":"Ημέρες κεντρικού φλεβικού καθετήρα (ημερήσια καταγραφή ΜΕΘ)"}',
      1000, '/1.000 ημέρες ΚΦΚ', '/1,000 central-line days', 'ECDC HAI-Net ICU · Νοσοκομειακός στόχος ΕΝΛ', 'manual', null, null, 2.0, 'lower'),
    ('vap-per-1000-ventilator-days', '2026.1', 'VAP ανά 1.000 ημέρες μηχανικού αερισμού', 'VAP per 1,000 ventilator days', 'surveillance',
      '{"description":"Επεισόδια πνευμονίας από αναπνευστήρα (PN1–PN5, ECDC)"}', '{"description":"Ημέρες μηχανικού αερισμού"}',
      1000, '/1.000 ημέρες αναπνευστήρα', '/1,000 ventilator days', 'ECDC HAI-Net ICU · Νοσοκομειακός στόχος ΕΝΛ', 'manual', null, null, 8.0, 'lower'),
    ('antibiotic-ddd-per-100-patient-days', '2026.1-ΝΟΣ', 'Κατανάλωση αντιβιοτικών (DDD ανά 100 ασθενοημέρες)', 'Antibiotic consumption (DDD per 100 patient-days)', 'pharmacy',
      '{"description":"Σύνολο DDD αντιβιοτικών (ATC J01)"}', '{"description":"Ασθενοημέρες"}',
      100, 'DDD/100 ασθενοημέρες', 'DDD/100 patient-days', 'Φαρμακείο · ΕΟΔΥ / WHO ATC-DDD · στόχος Επιτροπής Αντιμικροβιακών', 'auto', 'antibiotic_ddd_total', 'patient_days', 75.0, 'lower'),
    ('hai-prevalence-pps', '1.0-ΝΟΣ', 'Σημειακός επιπολασμός νοσοκομειακών λοιμώξεων (PPS)', 'HAI point prevalence (PPS)', 'surveillance',
      '{"description":"Ασθενείς με τουλάχιστον μία ενεργή ΝΝΛ"}', '{"description":"Νοσηλευόμενοι ασθενείς την ημέρα της επισκόπησης"}',
      100, '%', '%', 'ECDC PPS · στόχος ΕΝΛ (εθνικός μέσος όρος ~10%)', 'auto', 'pps_patients_with_hai', 'pps_patients_total', 8.0, 'lower')
  ) x(k, ver, el, en, cat, numd, dend, mult, unit, unit_en, src, calc, num, den, target, dir)
  on conflict (organization_id, indicator_key, version) do update set
    title_el = excluded.title_el, title_en = excluded.title_en, numerator_definition = excluded.numerator_definition,
    denominator_definition = excluded.denominator_definition, multiplier = excluded.multiplier, unit = excluded.unit, unit_en = excluded.unit_en,
    source_authority = excluded.source_authority, status = 'active', calculation_type = excluded.calculation_type,
    numerator_metric = excluded.numerator_metric, denominator_metric = excluded.denominator_metric, target_value = excluded.target_value, direction = excluded.direction;

  if exists (select 1 from public.indicator_snapshots s where s.organization_id = v_org) then
    return;
  end if;

  v_scopes := array[null::uuid, v_icu];
  for v_si in 1 .. 2 loop
    v_dep := v_scopes[v_si];
    continue when v_si = 2 and v_icu is null;
    for k in 1 .. 6 loop
      ms := (date_trunc('month', d0) - k * interval '1 month')::date;
      me := (ms + interval '1 month - 1 day')::date;

      -- the same sources private.indicator_metric_snapshot reads
      v_daily := (select count(*) from public.patient_days pd where pd.organization_id = v_org and pd.census_date between ms and me and (v_dep is null or pd.department_id = v_dep));
      v_pd := case when v_daily > 0
        then (select coalesce(sum(pd.patient_days), 0) from public.patient_days pd where pd.organization_id = v_org and pd.census_date between ms and me and (v_dep is null or pd.department_id = v_dep))
        else (select coalesce(sum(pp.patient_days), 0) from public.patient_day_periods pp where pp.organization_id = v_org and pp.period_start >= ms and pp.period_end <= me and (v_dep is null or pp.department_id = v_dep)) end;
      v_active := (select count(*) from public.surveillance_cases s where s.organization_id = v_org and s.voided_at is null and s.started_at::date <= me
        and (s.closed_at is null or s.closed_at::date >= ms) and (v_dep is null or s.department_id = v_dep));
      v_hh_ok := (select coalesce(sum(h.compliant_observations), 0) from public.hand_hygiene_sessions h where h.organization_id = v_org and h.status = 'completed' and h.observation_date between ms and me and (v_dep is null or h.department_id = v_dep));
      v_hh_tot := (select coalesce(sum(h.observations), 0) from public.hand_hygiene_sessions h where h.organization_id = v_org and h.status = 'completed' and h.observation_date between ms and me and (v_dep is null or h.department_id = v_dep));
      v_b_ok := (select count(*) from public.prevention_bundle_assessments b where b.organization_id = v_org and b.status = 'completed' and b.assessment_date between ms and me and b.score >= 100 and (v_dep is null or b.department_id = v_dep));
      v_b_tot := (select count(*) from public.prevention_bundle_assessments b where b.organization_id = v_org and b.status = 'completed' and b.assessment_date between ms and me and (v_dep is null or b.department_id = v_dep));
      v_abhr := (select coalesce(sum(a.litres), 0) from public.antiseptic_consumption_periods a where a.organization_id = v_org and a.period_start >= ms and a.period_end <= me and (v_dep is null or a.department_id = v_dep));
      v_tr_ok := (select count(*) from public.training_records t where t.organization_id = v_org and t.record_type = 'assignment' and coalesce(t.payload->>'status', '') = 'completed'
        and coalesce(nullif(t.payload->>'assignedDate', '')::date, t.created_at::date) between ms and me and (v_dep is null or t.department_id = v_dep));
      v_tr_tot := (select count(*) from public.training_records t where t.organization_id = v_org and t.record_type = 'assignment'
        and coalesce(nullif(t.payload->>'assignedDate', '')::date, t.created_at::date) between ms and me and (v_dep is null or t.department_id = v_dep));
      v_mdro := (select count(distinct m.id) from public.microbiology_results m join public.laboratory_samples l on l.id = m.sample_id
        where m.organization_id = v_org and m.result_status = 'positive' and l.collected_at::date between ms and me and (v_dep is null or l.department_id = v_dep)
          and lower(coalesce(l.sample_type, '')) like '%blood%'
          and (upper(coalesce(m.resistance_class, '')) in ('MDR', 'XDR', 'PDR') or exists (select 1 from public.amr_classifications a where a.organization_id = v_org and a.microbiology_result_id = m.id and a.status <> 'rejected' and upper(coalesce(a.classification, '')) in ('MDR', 'XDR', 'PDR'))));
      v_bact := (select count(distinct m.id) from public.microbiology_results m join public.laboratory_samples l on l.id = m.sample_id
        where m.organization_id = v_org and m.result_status = 'positive' and m.validation_status in ('validated', 'amended') and m.organism is not null
          and l.collected_at::date between ms and me and (v_dep is null or l.department_id = v_dep) and lower(coalesce(l.sample_type, '')) like '%blood%'
          and lower(m.organism) ~ '(escherichia coli|proteus|acinetobacter|klebsiella|enterobacter|pseudomonas|staphylococcus aureus|enterococcus)'
          and not exists (select 1 from public.microbiology_results m2 where m2.organization_id = m.organization_id and m2.amended_from = m.id));
      v_kl_t := (select count(*) from public.antimicrobial_susceptibility_results a join public.microbiology_results m on m.id = a.microbiology_result_id and m.organization_id = a.organization_id
        join public.laboratory_samples l on l.id = m.sample_id
        where a.organization_id = v_org and m.result_status = 'positive' and m.validation_status in ('validated', 'amended') and l.collected_at::date between ms and me
          and (v_dep is null or l.department_id = v_dep) and lower(coalesce(a.organism, '')) like '%klebsiella%' and (a.antimicrobial_code = 'ABX-MEM' or lower(coalesce(a.antimicrobial_name, '')) like '%meropenem%')
          and not exists (select 1 from public.microbiology_results m2 where m2.organization_id = m.organization_id and m2.amended_from = m.id));
      v_kl_r := (select count(*) from public.antimicrobial_susceptibility_results a join public.microbiology_results m on m.id = a.microbiology_result_id and m.organization_id = a.organization_id
        join public.laboratory_samples l on l.id = m.sample_id
        where a.organization_id = v_org and m.result_status = 'positive' and m.validation_status in ('validated', 'amended') and l.collected_at::date between ms and me
          and (v_dep is null or l.department_id = v_dep) and lower(coalesce(a.organism, '')) like '%klebsiella%' and (a.antimicrobial_code = 'ABX-MEM' or lower(coalesce(a.antimicrobial_name, '')) like '%meropenem%')
          and a.sir_category = 'R'
          and not exists (select 1 from public.microbiology_results m2 where m2.organization_id = m.organization_id and m2.amended_from = m.id));
      v_ddd := (select coalesce(sum(d.quantity_grams / nullif((select r.ddd_grams from public.who_ddd_reference r
                    where r.antibiotic_code = lib.code and (r.organization_id = d.organization_id or r.organization_id is null)
                    order by r.organization_id nulls last limit 1), 0)), 0)
        from public.antibiotic_dispensing_periods d join public.master_library_items lib on lib.id = d.antibiotic_item_id
        where d.organization_id = v_org and d.period_start >= ms and d.period_end <= me and (v_dep is null or d.department_id = v_dep));
      v_iso := (select count(distinct ie.id) from public.isolation_episodes ie
        join public.surveillance_cases s on s.id = ie.surveillance_case_id and s.organization_id = ie.organization_id
        join public.laboratory_samples l on l.surveillance_case_id = s.id and l.organization_id = s.organization_id
        join public.microbiology_results m on m.sample_id = l.id and m.organization_id = s.organization_id
        where ie.organization_id = v_org and s.voided_at is null and ie.started_at::date between ms and me and (v_dep is null or ie.department_id = v_dep)
          and m.result_status = 'positive' and m.validation_status in ('validated', 'amended')
          and lower(coalesce(m.organism, '')) ~ '(escherichia coli|proteus|acinetobacter|klebsiella|enterobacter|pseudomonas|staphylococcus aureus|enterococcus)'
          and not exists (select 1 from public.microbiology_results m2 where m2.organization_id = m.organization_id and m2.amended_from = m.id)
          and (upper(coalesce(m.resistance_class, '')) in ('MDR', 'XDR', 'PDR') or exists (select 1 from public.amr_classifications am where am.organization_id = m.organization_id and am.microbiology_result_id = m.id and am.status <> 'rejected' and upper(coalesce(am.classification, '')) in ('MDR', 'XDR', 'PDR'))));
      v_pps_t := (select coalesce(sum(p.patients_total), 0) from public.point_prevalence_surveys p where p.organization_id = v_org and p.survey_date between ms and me and (v_dep is null or p.department_id = v_dep));
      v_pps_h := (select coalesce(sum(p.patients_with_hai), 0) from public.point_prevalence_surveys p where p.organization_id = v_org and p.survey_date between ms and me and (v_dep is null or p.department_id = v_dep));
      v_pps_a := (select coalesce(sum(p.patients_on_antibiotics), 0) from public.point_prevalence_surveys p where p.organization_id = v_org and p.survey_date between ms and me and (v_dep is null or p.department_id = v_dep));

      insert into public.indicator_snapshots(organization_id, indicator_key, definition_id, department_id, period_start, period_end, numerator, denominator, value,
        unit, target_value, direction, calculation_type, source_snapshot, status, calculated_at, calculated_by, reviewed_at, reviewed_by, notes, created_at, updated_at)
      select v_org, x.key, def.id, v_dep, ms, me, x.num, x.den,
        case when x.den is null then round(x.num * def.multiplier, 1)
             when def.calculation_type = 'manual' and def.unit = '%' then round(x.num / x.den * 100, 1)
             else round(x.num / x.den * def.multiplier, 1) end,
        def.unit, def.target_value, def.direction, def.calculation_type,
        jsonb_build_object('source', coalesce(def.source_authority, ''), 'version', def.version,
          'evidence', case when def.calculation_type = 'manual' then 'manual' when x.den is null then trim(trailing '.' from to_char(x.num, 'FM999999990.##'))
            else trim(trailing '.' from to_char(x.num, 'FM999999990.##')) || ' / ' || trim(trailing '.' from to_char(x.den, 'FM999999990.##')) end,
          'numerator_definition', def.numerator_definition, 'denominator_definition', def.denominator_definition),
        case when k = 1 then 'calculated' else 'approved' end,
        least(me + 3 + time '10:00', now() - interval '1 hour'), p_actor,
        case when k = 1 then null else least(me + 9 + time '13:00', now() - interval '1 hour') end,
        case when k = 1 then null else p_actor end,
        case when x.syn then 'Ιστορική τιμή — μεταφορά από το προηγούμενο σύστημα καταγραφής.'
             when k = 1 then null
             else 'Εγκρίθηκε στη μηνιαία συνεδρίαση της ΕΝΛ.' end,
        least(me + 3 + time '10:00', now() - interval '1 hour'), least(me + 9 + time '13:00', now() - interval '1 hour')
      from (values
        ('hh-compliance', case when v_hh_tot > 0 then v_hh_ok else case when v_dep is null then syn_hh_ok[k] else syn_hh_icu[k] end end,
                          case when v_hh_tot > 0 then v_hh_tot else case when v_dep is null then 210 else 60 end end, v_hh_tot = 0),
        ('bundle-compliance', case when v_b_tot > 0 then v_b_ok else round(syn_b_ok[k] / case when v_dep is null then 1 else 3 end) end,
                              case when v_b_tot > 0 then v_b_tot else case when v_dep is null then 21 else 7 end end, v_b_tot = 0),
        ('hai-per-1000', case when k <= 2 or v_active > 0 then v_active else round(syn_active[k] / case when v_dep is null then 1 else 3 end) end, nullif(v_pd, 0), not (k <= 2 or v_active > 0)),
        ('mdro-bsi-rate', case when k <= 2 or v_mdro > 0 then v_mdro else round(syn_mdro[k] / case when v_dep is null then 1 else 2 end) end, nullif(v_pd, 0), not (k <= 2 or v_mdro > 0)),
        ('bacteremia-incidence-rate', case when k <= 2 or v_bact > 0 then v_bact else round(syn_bact[k] / case when v_dep is null then 1 else 2 end) end, nullif(v_pd, 0), not (k <= 2 or v_bact > 0)),
        ('mdr-isolation-new-cases', case when k <= 2 or v_iso > 0 then v_iso else round(syn_iso[k] / case when v_dep is null then 1 else 2 end) end, null, not (k <= 2 or v_iso > 0)),
        ('training-completion', case when v_tr_tot > 0 then v_tr_ok else syn_tr[k] end, case when v_tr_tot > 0 then v_tr_tot else 24 end, v_tr_tot = 0),
        ('abhr-use', v_abhr, case when v_abhr > 0 then nullif(v_pd, 0) end, false),
        ('antibiotic-ddd-per-100-patient-days', round(v_ddd, 1), case when v_ddd > 0 then nullif(v_pd, 0) end, false),
        ('amr-klebsiella-meropenem-rate', case when v_kl_t > 0 then v_kl_r else syn_kl_r[k] end, case when v_kl_t > 0 then v_kl_t when k >= 3 then 3 end, v_kl_t = 0),
        ('hai-prevalence-pps', v_pps_h, nullif(v_pps_t, 0), false),
        ('antibiotic-use-prevalence-pps', v_pps_a, nullif(v_pps_t, 0), false),
        ('eody-reporting-completeness', m_eody_n[k], m_eody_d[k], false),
        ('clabsi-per-1000-cvc-days', m_clabsi_n[k], case when v_dep is null then m_clabsi_all_d[k] else m_clabsi_icu_d[k] end, false),
        ('vap-per-1000-ventilator-days', m_vap_n[k], m_vap_d[k], false)
      ) x(key, num, den, syn)
      cross join lateral (
        select d.* from public.indicator_definitions d
        where d.indicator_key = x.key and (d.organization_id = v_org or d.organization_id is null) and d.status = 'active'
        order by d.organization_id nulls last limit 1
      ) def
      where x.num is not null
        and (def.calculation_type = 'manual' or def.denominator_metric is null or x.den is not null)
        and (v_dep is null or x.key in ('hh-compliance', 'bundle-compliance', 'hai-per-1000', 'mdr-isolation-new-cases', 'clabsi-per-1000-cvc-days', 'vap-per-1000-ventilator-days'));
    end loop;
  end loop;

  -- Manual values for the current month so far (the default period of the
  -- Indicators screen is "first of the month → today"), waiting for approval.
  insert into public.indicator_snapshots(organization_id, indicator_key, definition_id, department_id, period_start, period_end, numerator, denominator, value,
    unit, target_value, direction, calculation_type, source_snapshot, status, calculated_at, calculated_by, notes)
  select v_org, x.key, def.id, null, date_trunc('month', d0)::date, d0, null, null, x.val, def.unit, def.target_value, def.direction, 'manual',
    jsonb_build_object('source', coalesce(def.source_authority, ''), 'version', def.version, 'evidence', 'manual',
      'numerator_definition', def.numerator_definition, 'denominator_definition', def.denominator_definition),
    'calculated', now() - interval '2 hours', p_actor, x.note
  from (values
    ('eody-reporting-completeness', 66.7::numeric, '2 από 3 δηλώσεις του μήνα έχουν υποβληθεί· εκκρεμεί η δήλωση του νέου στελέχους KPC της ΜΕΘ.'),
    ('clabsi-per-1000-cvc-days', 9.4::numeric, '1 CLABSI σε 106 ημέρες ΚΦΚ (μέχρι σήμερα) — σχετίζεται με τη συρροή KPC της ΜΕΘ.')
  ) x(key, val, note)
  cross join lateral (
    select d.* from public.indicator_definitions d
    where d.indicator_key = x.key and (d.organization_id = v_org or d.organization_id is null) and d.status = 'active'
    order by d.organization_id nulls last limit 1
  ) def;
end;
$function$;

create or replace function private.demo_seed_quality(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
begin
  perform private.demo_seed_quality_audits(p_organization_id, p_actor);
  perform private.demo_seed_quality_enrich(p_organization_id, p_actor);
  perform private.demo_seed_quality_surveys(p_organization_id, p_actor);
  perform private.demo_seed_quality_indicators(p_organization_id, p_actor);
end;
$function$;

revoke all on function private.demo_seed_quality_audits(uuid, uuid) from public, anon, authenticated;
revoke all on function private.demo_seed_quality_enrich(uuid, uuid) from public, anon, authenticated;
revoke all on function private.demo_seed_quality_surveys(uuid, uuid) from public, anon, authenticated;
revoke all on function private.demo_seed_quality_indicators(uuid, uuid) from public, anon, authenticated;
revoke all on function private.demo_seed_quality(uuid, uuid) from public, anon, authenticated;


-- Demo data pack, people area: clinical scales, training content, employee
-- records and occupational health KPIs. Runs AFTER every existing
-- private.demo_seed_* function and enriches the rows they wrote.
--
-- Functions, in call order:
--   1. private.demo_seed_people_clinical_scales(org, actor)
--        clinical scale policy (clinical_scale_org_settings, kept across resets,
--        an existing choice is left alone) and a history of NEWS2, Glasgow,
--        Braden, Morse, SOFA and APACHE II assessments for every patient's
--        latest admission (scores computed as the app's scoring engine does).
--   2. private.demo_seed_people_training(org, actor)
--        trainer feedback template, programme material / assessment questions /
--        feedback / effectiveness, assignments moved to the app's values
--        (attendanceResponse 'confirmed' | 'sent' | 'not_sent', attendance
--        true | null) with answers that give their score, participants for the
--        planned programme, and the training history snapshot.
--   3. private.demo_seed_people_employees(org, actor)
--        job positions with a job description (Management > Libraries, kept
--        across resets), acknowledgements of it, certificates and performance
--        evaluations for the 24 Demo employees.
--   4. private.demo_seed_people_occupational_health(org, actor)
--        visits today, follow-ups due this week and vaccinations due in the next
--        30 days, so the dashboard KPIs are not zero.
--
-- Same rules as the other Demo migrations: rows are only added or updated,
-- query results are assigned with :=, everything is schema-qualified and dates
-- are relative to today.
-- Every insert is guarded, so running a function twice adds nothing.

-- 1. Clinical scales -------------------------------------------------------------
create or replace function private.demo_seed_people_clinical_scales(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := current_date;
  v_now timestamptz := now();
begin
  -- Hospital policy: suggested tools and reassessment intervals.
  insert into public.clinical_scale_org_settings(organization_id, scale_definition_id, availability, reassessment_hours, enabled)
  select v_org, d.id, s.availability, s.hours, true
  from (values ('news2', 'recommended', 12), ('morse', 'recommended', 72), ('braden', 'recommended', 48),
               ('sofa', 'available', 24), ('gcs', 'available', null::integer), ('apache-ii', 'available', null::integer)) s(scale_key, availability, hours)
  cross join lateral (select cd.id from public.clinical_scale_definitions cd
                      where cd.scale_key = s.scale_key and cd.status = 'approved' order by cd.updated_at desc limit 1) d
  on conflict (organization_id, scale_definition_id) do nothing;

  -- Assessments: one plan per kind of department, the patient's severity
  -- (row number mod 3) picks a worse or a milder answer set at each step, and
  -- patients get better over the stay. Only steps already in the past and
  -- inside the admission are written.
  with variants(scale_key, n, answers, score, parts, risk) as (values
    ('news2', 1, '{"respiratoryRate":26,"spo2":91,"supplementalOxygen":true,"systolicBp":96,"pulse":118,"temperature":38.9,"newConfusion":false}'::jsonb, 13, '{"respiratory":3,"oxygenSaturation":3,"supplementalOxygen":2,"systolicBp":2,"pulse":2,"consciousness":0,"temperature":1}'::jsonb, 'high'),
    ('news2', 2, '{"respiratoryRate":22,"spo2":94,"supplementalOxygen":true,"systolicBp":108,"pulse":104,"temperature":38.1,"newConfusion":false}'::jsonb, 8, '{"respiratory":2,"oxygenSaturation":1,"supplementalOxygen":2,"systolicBp":1,"pulse":1,"consciousness":0,"temperature":1}'::jsonb, 'high'),
    ('news2', 3, '{"respiratoryRate":21,"spo2":95,"supplementalOxygen":false,"systolicBp":112,"pulse":96,"temperature":38.4,"newConfusion":false}'::jsonb, 5, '{"respiratory":2,"oxygenSaturation":1,"supplementalOxygen":0,"systolicBp":0,"pulse":1,"consciousness":0,"temperature":1}'::jsonb, 'medium'),
    ('news2', 4, '{"respiratoryRate":19,"spo2":96,"supplementalOxygen":false,"systolicBp":118,"pulse":92,"temperature":37.6,"newConfusion":false}'::jsonb, 1, '{"respiratory":0,"oxygenSaturation":0,"supplementalOxygen":0,"systolicBp":0,"pulse":1,"consciousness":0,"temperature":0}'::jsonb, 'low'),
    ('news2', 5, '{"respiratoryRate":18,"spo2":97,"supplementalOxygen":false,"systolicBp":124,"pulse":84,"temperature":37.2,"newConfusion":false}'::jsonb, 0, '{"respiratory":0,"oxygenSaturation":0,"supplementalOxygen":0,"systolicBp":0,"pulse":0,"consciousness":0,"temperature":0}'::jsonb, 'baseline'),
    ('news2', 6, '{"respiratoryRate":16,"spo2":98,"supplementalOxygen":false,"systolicBp":128,"pulse":76,"temperature":36.8,"newConfusion":false}'::jsonb, 0, '{"respiratory":0,"oxygenSaturation":0,"supplementalOxygen":0,"systolicBp":0,"pulse":0,"consciousness":0,"temperature":0}'::jsonb, 'baseline'),
    ('gcs', 1, '{"eye":2,"verbal":2,"motor":4}'::jsonb, 8, '{"eye":2,"verbal":2,"motor":4}'::jsonb, 'severe'),
    ('gcs', 2, '{"eye":3,"verbal":4,"motor":6}'::jsonb, 13, '{"eye":3,"verbal":4,"motor":6}'::jsonb, 'mild_or_normal_range'),
    ('gcs', 3, '{"eye":4,"verbal":4,"motor":6}'::jsonb, 14, '{"eye":4,"verbal":4,"motor":6}'::jsonb, 'mild_or_normal_range'),
    ('gcs', 4, '{"eye":4,"verbal":5,"motor":6}'::jsonb, 15, '{"eye":4,"verbal":5,"motor":6}'::jsonb, 'mild_or_normal_range'),
    ('braden', 1, '{"sensoryPerception":2,"moisture":2,"activity":1,"mobility":2,"nutrition":2,"frictionShear":1}'::jsonb, 10, '{"sensoryPerception":2,"moisture":2,"activity":1,"mobility":2,"nutrition":2,"frictionShear":1}'::jsonb, null),
    ('braden', 2, '{"sensoryPerception":2,"moisture":3,"activity":2,"mobility":2,"nutrition":2,"frictionShear":2}'::jsonb, 13, '{"sensoryPerception":2,"moisture":3,"activity":2,"mobility":2,"nutrition":2,"frictionShear":2}'::jsonb, null),
    ('braden', 3, '{"sensoryPerception":3,"moisture":3,"activity":3,"mobility":3,"nutrition":3,"frictionShear":2}'::jsonb, 17, '{"sensoryPerception":3,"moisture":3,"activity":3,"mobility":3,"nutrition":3,"frictionShear":2}'::jsonb, null),
    ('braden', 4, '{"sensoryPerception":4,"moisture":3,"activity":3,"mobility":3,"nutrition":3,"frictionShear":2}'::jsonb, 18, '{"sensoryPerception":4,"moisture":3,"activity":3,"mobility":3,"nutrition":3,"frictionShear":2}'::jsonb, null),
    ('braden', 5, '{"sensoryPerception":4,"moisture":4,"activity":4,"mobility":4,"nutrition":3,"frictionShear":3}'::jsonb, 22, '{"sensoryPerception":4,"moisture":4,"activity":4,"mobility":4,"nutrition":3,"frictionShear":3}'::jsonb, null),
    ('morse', 1, '{"fallHistory":25,"secondaryDiagnosis":15,"ambulatoryAid":15,"ivTherapy":20,"gait":10,"mentalStatus":0}'::jsonb, 85, '{"fallHistory":25,"secondaryDiagnosis":15,"ambulatoryAid":15,"ivTherapy":20,"gait":10,"mentalStatus":0}'::jsonb, 'high'),
    ('morse', 2, '{"fallHistory":25,"secondaryDiagnosis":15,"ambulatoryAid":30,"ivTherapy":20,"gait":20,"mentalStatus":15}'::jsonb, 125, '{"fallHistory":25,"secondaryDiagnosis":15,"ambulatoryAid":30,"ivTherapy":20,"gait":20,"mentalStatus":15}'::jsonb, 'high'),
    ('morse', 3, '{"fallHistory":0,"secondaryDiagnosis":15,"ambulatoryAid":15,"ivTherapy":20,"gait":10,"mentalStatus":0}'::jsonb, 60, '{"fallHistory":0,"secondaryDiagnosis":15,"ambulatoryAid":15,"ivTherapy":20,"gait":10,"mentalStatus":0}'::jsonb, 'high'),
    ('morse', 4, '{"fallHistory":0,"secondaryDiagnosis":15,"ambulatoryAid":0,"ivTherapy":20,"gait":0,"mentalStatus":0}'::jsonb, 35, '{"fallHistory":0,"secondaryDiagnosis":15,"ambulatoryAid":0,"ivTherapy":20,"gait":0,"mentalStatus":0}'::jsonb, 'medium'),
    ('morse', 5, '{"fallHistory":0,"secondaryDiagnosis":0,"ambulatoryAid":0,"ivTherapy":0,"gait":0,"mentalStatus":0}'::jsonb, 0, '{"fallHistory":0,"secondaryDiagnosis":0,"ambulatoryAid":0,"ivTherapy":0,"gait":0,"mentalStatus":0}'::jsonb, 'low'),
    ('sofa', 1, '{"pao2Fio2":180,"respiratorySupport":true,"platelets":90,"bilirubin":2.4,"map":62,"norepinephrine":0.08,"gcs":11,"creatinine":2.3,"urineOutput24h":650}'::jsonb, 14, '{"respiratory":3,"coagulation":2,"liver":2,"cardiovascular":3,"cns":2,"renal":2}'::jsonb, null),
    ('sofa', 2, '{"pao2Fio2":250,"respiratorySupport":true,"platelets":130,"bilirubin":1.4,"map":68,"gcs":13,"creatinine":1.6,"urineOutput24h":1100}'::jsonb, 7, '{"respiratory":2,"coagulation":1,"liver":1,"cardiovascular":1,"cns":1,"renal":1}'::jsonb, null),
    ('sofa', 3, '{"pao2Fio2":340,"respiratorySupport":false,"platelets":170,"bilirubin":0.9,"map":78,"gcs":15,"creatinine":1,"urineOutput24h":1600}'::jsonb, 1, '{"respiratory":1,"coagulation":0,"liver":0,"cardiovascular":0,"cns":0,"renal":0}'::jsonb, null),
    ('apache-ii', 1, '{"temperature":38.9,"map":64,"heartRate":122,"respiratoryRate":28,"fio2":0.4,"pao2":68,"ph":7.31,"sodium":136,"potassium":4.1,"creatinine":1.8,"acuteRenalFailure":false,"hematocrit":33,"wbc":17.5,"gcs":13,"age":68,"chronicHealthPoints":2}'::jsonb, 21, '{"temperature":1,"map":2,"heartRate":2,"respiratoryRate":1,"ph":2,"sodium":0,"potassium":0,"hematocrit":0,"wbc":1,"oxygenation":1,"creatinine":2,"gcs":2}'::jsonb, null),
    ('apache-ii', 2, '{"temperature":37.8,"map":76,"heartRate":104,"respiratoryRate":22,"fio2":0.3,"pao2":82,"ph":7.38,"sodium":139,"potassium":3.9,"creatinine":1.1,"acuteRenalFailure":false,"hematocrit":38,"wbc":12,"gcs":15,"age":54,"chronicHealthPoints":0}'::jsonb, 2, '{"temperature":0,"map":0,"heartRate":0,"respiratoryRate":0,"ph":0,"sodium":0,"potassium":0,"hematocrit":0,"wbc":0,"oxygenation":0,"creatinine":0,"gcs":0}'::jsonb, null)
  ), plan(grp, step, scale_key, day, at_time, v_severe, v_moderate, v_mild) as (values
    ('icu', 1, 'news2', 0, time '08:30', 1, 2, 3), ('icu', 2, 'gcs', 0, time '09:00', 1, 2, 3),
    ('icu', 3, 'sofa', 0, time '10:00', 1, 2, 3), ('icu', 4, 'apache-ii', 0, time '11:00', 1, 1, 2),
    ('icu', 5, 'braden', 1, time '10:00', 1, 2, 3), ('icu', 6, 'news2', 2, time '08:30', 2, 3, 4),
    ('icu', 7, 'sofa', 3, time '10:00', 2, 3, 3), ('icu', 8, 'news2', 4, time '08:30', 3, 4, 5),
    ('icu', 9, 'gcs', 4, time '09:00', 2, 3, 4), ('icu', 10, 'braden', 6, time '10:00', 2, 3, 4),
    ('icu', 11, 'news2', 7, time '08:30', 4, 5, 6),
    ('ward', 1, 'news2', 0, time '09:15', 2, 3, 4), ('ward', 2, 'morse', 0, time '11:00', 2, 1, 4),
    ('ward', 3, 'braden', 1, time '10:30', 2, 3, 4), ('ward', 4, 'news2', 2, time '09:15', 3, 4, 5),
    ('ward', 5, 'morse', 4, time '11:00', 1, 3, 4), ('ward', 6, 'news2', 5, time '09:15', 4, 5, 6),
    ('ward', 7, 'braden', 7, time '10:30', 3, 4, 5), ('ward', 8, 'news2', 10, time '09:15', 5, 6, 6),
    ('surgical', 1, 'news2', 0, time '07:45', 3, 4, 5), ('surgical', 2, 'morse', 0, time '12:00', 1, 3, 4),
    ('surgical', 3, 'news2', 1, time '07:45', 3, 4, 5), ('surgical', 4, 'braden', 2, time '10:00', 2, 3, 4),
    ('surgical', 5, 'news2', 3, time '07:45', 4, 5, 6), ('surgical', 6, 'morse', 5, time '12:00', 3, 4, 5),
    ('surgical', 7, 'news2', 8, time '07:45', 5, 6, 6)
  ), assessors(n, name, title) as (values
    (0, 'Ελένη Παπαδοπούλου', 'Νοσηλεύτρια ΜΕΘ'), (1, 'Νικόλαος Δημητρίου', 'Ιατρός Παθολόγος'),
    (2, 'Μαρία Κωνσταντίνου', 'Νοσηλεύτρια'), (3, 'Γιώργος Αντωνίου', 'Επιμελητής Β΄')
  ), pt as (
    select p.id patient_id, p.status, dep.code dep_code, adm.id admission_id, adm.admission_date,
      coalesce(adm.discharge_date, d0) last_day, floor((d0 - p.date_of_birth) / 365.2425)::int age,
      row_number() over (order by p.patient_code) rn
    from public.patients p
    join public.departments dep on dep.id = p.department_id
    cross join lateral (select a.id, a.admission_date, a.discharge_date from public.patient_admissions a
                        where a.patient_id = p.id order by a.admission_date desc, a.created_at desc limit 1) adm
    where p.organization_id = v_org and p.date_of_birth is not null
  ), steps as (
    select pt.*, pl.step, pl.scale_key, (pt.admission_date + pl.day) + pl.at_time assessed_at,
      case pt.rn % 3 when 0 then pl.v_severe when 1 then pl.v_moderate else pl.v_mild end variant
    from pt
    join plan pl on pl.grp = case when pt.dep_code = 'ΜΕΘ' then 'icu' when pt.dep_code in ('ΧΕΙΡ', 'ΟΡΘ') then 'surgical' else 'ward' end
    where pt.admission_date + pl.day <= pt.last_day
    union all
    -- This morning's NEWS2 for half of the inpatients
    select pt.*, 20, 'news2', d0 + time '06:30', case pt.rn % 3 when 0 then 3 when 1 then 4 else 5 end
    from pt where pt.status = 'active' and pt.rn % 2 = 0 and pt.admission_date < d0
  ), rows_ as (
    select s.patient_id, s.admission_id, s.assessed_at, s.scale_key, d.id definition_id, d.version, d.name_el, d.name_en,
      d.source_authority, d.source_reference, s.rn, s.step,
      case when s.scale_key = 'apache-ii' then jsonb_set(v.answers, '{age}', to_jsonb(s.age)) else v.answers end answers,
      case when s.scale_key = 'apache-ii'
        then v.score - private_age.points_stated + private_age.points_patient else v.score end score,
      v.parts, v.risk
    from steps s
    join variants v on v.scale_key = s.scale_key and v.n = s.variant
    cross join lateral (select cd.id, cd.version, cd.name_el, cd.name_en, cd.source_authority, cd.source_reference
                        from public.clinical_scale_definitions cd
                        where cd.scale_key = s.scale_key and cd.status = 'approved' order by cd.updated_at desc limit 1) d
    cross join lateral (select
        case when (v.answers->>'age')::int >= 75 then 6 when (v.answers->>'age')::int >= 65 then 5 when (v.answers->>'age')::int >= 55 then 3 when (v.answers->>'age')::int >= 45 then 2 else 0 end points_stated,
        case when s.age >= 75 then 6 when s.age >= 65 then 5 when s.age >= 55 then 3 when s.age >= 45 then 2 else 0 end points_patient) private_age
    where s.assessed_at <= v_now - interval '20 minutes'
  )
  insert into public.patient_clinical_scale_assessments(organization_id, patient_id, admission_id, scale_definition_id, scale_key, scale_version,
    assessed_at, answers, score, score_parts, interpretation, status, created_by, created_at,
    assessor_name, assessor_job_title, assessor_email, report_snapshot, amended_at)
  select v_org, r.patient_id, r.admission_id, r.definition_id, r.scale_key, r.version, r.assessed_at, r.answers, r.score, r.parts, r.risk,
    case when (r.rn + r.step) % 17 = 0 and r.assessed_at < v_now - interval '4 hours' then 'amended' else 'final' end,
    p_actor, r.assessed_at, a.name, a.title, null,
    jsonb_build_object('scaleNameEl', r.name_el, 'scaleNameEn', r.name_en, 'sourceAuthority', r.source_authority, 'sourceReference', r.source_reference,
      'version', r.version, 'score', r.score, 'parts', r.parts, 'interpretation', r.risk, 'answers', r.answers,
      'generatedAt', to_char(r.assessed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
    case when (r.rn + r.step) % 17 = 0 and r.assessed_at < v_now - interval '4 hours' then r.assessed_at + interval '3 hours' end
  from rows_ r
  join assessors a on a.n = (r.rn + r.step) % 4
  where not exists (select 1 from public.patient_clinical_scale_assessments x
                    where x.organization_id = v_org and x.patient_id = r.patient_id and x.scale_key = r.scale_key and x.assessed_at = r.assessed_at);
end;
$function$;

-- 2. Training ------------------------------------------------------------------------
create or replace function private.demo_seed_people_training(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := current_date;
  v_now timestamptz := now();
  v_template jsonb := jsonb_build_object('id', 'TRAINER-FEEDBACK-DEFAULT', 'titleEl', 'Αξιολόγηση εκπαιδευτή', 'titleEn', 'Trainer evaluation',
    'questions', jsonb_build_array(
      jsonb_build_object('id', 'clarity', 'labelEl', 'Σαφήνεια παρουσίασης', 'labelEn', 'Clarity of presentation'),
      jsonb_build_object('id', 'knowledge', 'labelEl', 'Γνώση και επάρκεια εκπαιδευτή', 'labelEn', 'Trainer knowledge and competence'),
      jsonb_build_object('id', 'usefulness', 'labelEl', 'Χρησιμότητα για την εργασία μου', 'labelEn', 'Usefulness for my work'),
      jsonb_build_object('id', 'organization', 'labelEl', 'Οργάνωση της εκπαίδευσης', 'labelEn', 'Organization of the training'),
      jsonb_build_object('id', 'materials', 'labelEl', 'Ποιότητα εκπαιδευτικού υλικού', 'labelEn', 'Quality of training material')));
  v_comments text[] := array['Πολύ πρακτική παρουσίαση.', '', 'Χρήσιμη η επίδειξη στο ομοίωμα.', 'Θα βοηθούσε ένα σύντομο βίντεο.', '',
    'Σαφείς οδηγίες, εφαρμόσιμες στο τμήμα.', 'Χρειάζομαι περισσότερη εξάσκηση.', ''];
begin
  -- The trainer evaluation questionnaire new programmes copy.
  insert into public.training_records(organization_id, record_key, record_type, payload, created_by, updated_by)
  values (v_org, 'TRAINER-FEEDBACK-DEFAULT', 'feedback_template', v_template || jsonb_build_object('updatedAt', to_char((d0 - 160) + time '09:00', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')), p_actor, p_actor)
  on conflict (organization_id, record_key) do nothing;

  -- Participants of the planned programme (sharps / PEP): invitations not sent yet.
  insert into public.training_records(organization_id, record_key, record_type, payload, created_by, updated_by)
  select v_org, 'TRA-DEMO-5-' || lpad(n.g::text, 3, '0'), 'assignment',
    jsonb_build_object('id', 'TRA-DEMO-5-' || lpad(n.g::text, 3, '0'), 'programId', 'TRN-DEMO-005',
      'employeeId', e.employee_code, 'employeeName', e.last_name || ' ' || e.first_name, 'department', e.department_name, 'email', e.email,
      'assignedDate', (d0 - 3)::text, 'dueDate', (d0 + 60)::text, 'status', 'assigned', 'invitationSentAt', null,
      'attendanceResponse', 'not_sent', 'attendance', null, 'attendanceConfirmedAt', null, 'completionConfirmedAt', null,
      'feedbackSubmittedAt', null, 'assessmentSubmittedAt', null, 'score', null, 'completedDate', null, 'competent', null, 'certificateId', null),
    p_actor, p_actor
  from public.employees e
  cross join lateral (select substring(e.employee_code from 5)::int g) n
  where e.organization_id = v_org and e.employee_code like 'EMP-%' and e.user_id is null
    and e.profession_name in ('Νοσηλευτής / Νοσηλεύτρια', 'Ιατρός') and n.g % 3 <> 0
  on conflict (organization_id, record_key) do nothing;

  -- Assignments: the app's attendance values, the learner's answers (the score
  -- follows from them, on the same side of the pass mark as before), the
  -- trainer evaluation, and the owner's review for the older programmes.
  with cand(program_id, score, answers) as (values
    ('TRN-DEMO-001', 100, '{"Q-001":"Q-001-O2","Q-002":false,"Q-003":["Q-003-O1","Q-003-O2","Q-003-O4"],"Q-004":"Q-004-O2","Q-005":true,"Q-006":"Q-006-O3","Q-007":"Όταν μετακινούμαι από μολυσμένη σε καθαρή περιοχή του σώματος του ίδιου ασθενούς."}'::jsonb),
    ('TRN-DEMO-001', 80, '{"Q-001":"Q-001-O1","Q-002":false,"Q-003":["Q-003-O1","Q-003-O2","Q-003-O4"],"Q-004":"Q-004-O2","Q-005":true,"Q-006":"Q-006-O3","Q-007":"Όταν μετακινούμαι από μολυσμένη σε καθαρή περιοχή του σώματος του ίδιου ασθενούς."}'::jsonb),
    ('TRN-DEMO-001', 60, '{"Q-001":"Q-001-O1","Q-002":true,"Q-003":["Q-003-O1","Q-003-O2","Q-003-O4"],"Q-004":"Q-004-O2","Q-005":true,"Q-006":"Q-006-O3","Q-007":"Όταν μετακινούμαι από μολυσμένη σε καθαρή περιοχή του σώματος του ίδιου ασθενούς."}'::jsonb),
    ('TRN-DEMO-001', 40, '{"Q-001":"Q-001-O1","Q-002":true,"Q-003":["Q-003-O3"],"Q-004":"Q-004-O2","Q-005":true,"Q-006":"Q-006-O3","Q-007":"Όταν μετακινούμαι από μολυσμένη σε καθαρή περιοχή του σώματος του ίδιου ασθενούς."}'::jsonb),
    ('TRN-DEMO-001', 88, '{"Q-001":"Q-001-O2","Q-002":false,"Q-003":["Q-003-O1","Q-003-O2","Q-003-O4"],"Q-004":"Q-004-O2","Q-005":false,"Q-006":"Q-006-O3","Q-007":"Όταν μετακινούμαι από μολυσμένη σε καθαρή περιοχή του σώματος του ίδιου ασθενούς."}'::jsonb),
    ('TRN-DEMO-001', 68, '{"Q-001":"Q-001-O1","Q-002":false,"Q-003":["Q-003-O1","Q-003-O2","Q-003-O4"],"Q-004":"Q-004-O2","Q-005":false,"Q-006":"Q-006-O3","Q-007":"Όταν μετακινούμαι από μολυσμένη σε καθαρή περιοχή του σώματος του ίδιου ασθενούς."}'::jsonb),
    ('TRN-DEMO-001', 48, '{"Q-001":"Q-001-O1","Q-002":true,"Q-003":["Q-003-O1","Q-003-O2","Q-003-O4"],"Q-004":"Q-004-O2","Q-005":false,"Q-006":"Q-006-O3","Q-007":"Όταν μετακινούμαι από μολυσμένη σε καθαρή περιοχή του σώματος του ίδιου ασθενούς."}'::jsonb),
    ('TRN-DEMO-001', 92, '{"Q-001":"Q-001-O2","Q-002":false,"Q-003":["Q-003-O1","Q-003-O2","Q-003-O4"],"Q-004":"Q-004-O2","Q-005":true,"Q-006":"Q-006-O1","Q-007":"Όταν μετακινούμαι από μολυσμένη σε καθαρή περιοχή του σώματος του ίδιου ασθενούς."}'::jsonb),
    ('TRN-DEMO-001', 72, '{"Q-001":"Q-001-O1","Q-002":false,"Q-003":["Q-003-O1","Q-003-O2","Q-003-O4"],"Q-004":"Q-004-O2","Q-005":true,"Q-006":"Q-006-O1","Q-007":"Όταν μετακινούμαι από μολυσμένη σε καθαρή περιοχή του σώματος του ίδιου ασθενούς."}'::jsonb),
    ('TRN-DEMO-001', 52, '{"Q-001":"Q-001-O1","Q-002":true,"Q-003":["Q-003-O1","Q-003-O2","Q-003-O4"],"Q-004":"Q-004-O2","Q-005":true,"Q-006":"Q-006-O1","Q-007":"Όταν μετακινούμαι από μολυσμένη σε καθαρή περιοχή του σώματος του ίδιου ασθενούς."}'::jsonb),
    ('TRN-DEMO-002', 100, '{"Q-101":"Q-101-O2","Q-102":true,"Q-103":["Q-103-O1","Q-103-O2","Q-103-O4"],"Q-104":false,"Q-105":"Αναδιπλώνεται με τη μολυσμένη πλευρά προς τα μέσα, χωρίς επαφή με τη στολή."}'::jsonb),
    ('TRN-DEMO-002', 70, '{"Q-101":"Q-101-O1","Q-102":true,"Q-103":["Q-103-O1","Q-103-O2","Q-103-O4"],"Q-104":false,"Q-105":"Αναδιπλώνεται με τη μολυσμένη πλευρά προς τα μέσα, χωρίς επαφή με τη στολή."}'::jsonb),
    ('TRN-DEMO-002', 80, '{"Q-101":"Q-101-O2","Q-102":false,"Q-103":["Q-103-O1","Q-103-O2","Q-103-O4"],"Q-104":false,"Q-105":"Αναδιπλώνεται με τη μολυσμένη πλευρά προς τα μέσα, χωρίς επαφή με τη στολή."}'::jsonb),
    ('TRN-DEMO-002', 50, '{"Q-101":"Q-101-O1","Q-102":false,"Q-103":["Q-103-O1","Q-103-O2","Q-103-O4"],"Q-104":false,"Q-105":"Αναδιπλώνεται με τη μολυσμένη πλευρά προς τα μέσα, χωρίς επαφή με τη στολή."}'::jsonb),
    ('TRN-DEMO-002', 40, '{"Q-101":"Q-101-O1","Q-102":true,"Q-103":["Q-103-O3"],"Q-104":false,"Q-105":"Αναδιπλώνεται με τη μολυσμένη πλευρά προς τα μέσα, χωρίς επαφή με τη στολή."}'::jsonb),
    ('TRN-DEMO-002', 20, '{"Q-101":"Q-101-O1","Q-102":false,"Q-103":["Q-103-O3"],"Q-104":false,"Q-105":"Αναδιπλώνεται με τη μολυσμένη πλευρά προς τα μέσα, χωρίς επαφή με τη στολή."}'::jsonb),
    ('TRN-DEMO-002', 60, '{"Q-101":"Q-101-O2","Q-102":false,"Q-103":["Q-103-O1","Q-103-O2","Q-103-O4"],"Q-104":true,"Q-105":"Αναδιπλώνεται με τη μολυσμένη πλευρά προς τα μέσα, χωρίς επαφή με τη στολή."}'::jsonb),
    ('TRN-DEMO-002', 30, '{"Q-101":"Q-101-O1","Q-102":false,"Q-103":["Q-103-O1","Q-103-O2","Q-103-O4"],"Q-104":true,"Q-105":"Αναδιπλώνεται με τη μολυσμένη πλευρά προς τα μέσα, χωρίς επαφή με τη στολή."}'::jsonb),
    ('TRN-DEMO-003', 100, '{"Q-201":"Q-201-O2","Q-202":["Q-202-O1","Q-202-O2","Q-202-O3"],"Q-203":true,"Q-204":"Q-204-O3","Q-205":false,"Q-206":"Q-206-O2","Q-207":"Αλλάζω άμεσα το επίθεμα με άσηπτη τεχνική και καταγράφω την αλλαγή."}'::jsonb),
    ('TRN-DEMO-003', 80, '{"Q-201":"Q-201-O1","Q-202":["Q-202-O1","Q-202-O2","Q-202-O3"],"Q-203":true,"Q-204":"Q-204-O3","Q-205":false,"Q-206":"Q-206-O2","Q-207":"Αλλάζω άμεσα το επίθεμα με άσηπτη τεχνική και καταγράφω την αλλαγή."}'::jsonb),
    ('TRN-DEMO-003', 70, '{"Q-201":"Q-201-O2","Q-202":["Q-202-O4"],"Q-203":true,"Q-204":"Q-204-O3","Q-205":false,"Q-206":"Q-206-O2","Q-207":"Αλλάζω άμεσα το επίθεμα με άσηπτη τεχνική και καταγράφω την αλλαγή."}'::jsonb),
    ('TRN-DEMO-003', 50, '{"Q-201":"Q-201-O1","Q-202":["Q-202-O4"],"Q-203":true,"Q-204":"Q-204-O3","Q-205":false,"Q-206":"Q-206-O2","Q-207":"Αλλάζω άμεσα το επίθεμα με άσηπτη τεχνική και καταγράφω την αλλαγή."}'::jsonb),
    ('TRN-DEMO-003', 90, '{"Q-201":"Q-201-O2","Q-202":["Q-202-O1","Q-202-O2","Q-202-O3"],"Q-203":false,"Q-204":"Q-204-O3","Q-205":false,"Q-206":"Q-206-O2","Q-207":"Αλλάζω άμεσα το επίθεμα με άσηπτη τεχνική και καταγράφω την αλλαγή."}'::jsonb),
    ('TRN-DEMO-003', 60, '{"Q-201":"Q-201-O2","Q-202":["Q-202-O4"],"Q-203":false,"Q-204":"Q-204-O3","Q-205":false,"Q-206":"Q-206-O2","Q-207":"Αλλάζω άμεσα το επίθεμα με άσηπτη τεχνική και καταγράφω την αλλαγή."}'::jsonb),
    ('TRN-DEMO-003', 40, '{"Q-201":"Q-201-O1","Q-202":["Q-202-O4"],"Q-203":false,"Q-204":"Q-204-O3","Q-205":false,"Q-206":"Q-206-O2","Q-207":"Αλλάζω άμεσα το επίθεμα με άσηπτη τεχνική και καταγράφω την αλλαγή."}'::jsonb),
    ('TRN-DEMO-003', 30, '{"Q-201":"Q-201-O1","Q-202":["Q-202-O4"],"Q-203":true,"Q-204":"Q-204-O1","Q-205":false,"Q-206":"Q-206-O2","Q-207":"Αλλάζω άμεσα το επίθεμα με άσηπτη τεχνική και καταγράφω την αλλαγή."}'::jsonb),
    ('TRN-DEMO-004', 100, '{"Q-401":"Q-401-O2","Q-402":true,"Q-403":["Q-403-O1","Q-403-O3"],"Q-404":"Q-404-O1","Q-405":true,"Q-406":"Τον τοποθετώ σε δεύτερο σάκο, καθαρίζω και απολυμαίνω τον χώρο και ενημερώνω τον υπεύθυνο."}'::jsonb),
    ('TRN-DEMO-004', 75, '{"Q-401":"Q-401-O1","Q-402":true,"Q-403":["Q-403-O1","Q-403-O3"],"Q-404":"Q-404-O1","Q-405":true,"Q-406":"Τον τοποθετώ σε δεύτερο σάκο, καθαρίζω και απολυμαίνω τον χώρο και ενημερώνω τον υπεύθυνο."}'::jsonb),
    ('TRN-DEMO-004', 50, '{"Q-401":"Q-401-O1","Q-402":false,"Q-403":["Q-403-O1","Q-403-O3"],"Q-404":"Q-404-O1","Q-405":true,"Q-406":"Τον τοποθετώ σε δεύτερο σάκο, καθαρίζω και απολυμαίνω τον χώρο και ενημερώνω τον υπεύθυνο."}'::jsonb),
    ('TRN-DEMO-004', 25, '{"Q-401":"Q-401-O1","Q-402":false,"Q-403":["Q-403-O2"],"Q-404":"Q-404-O1","Q-405":true,"Q-406":"Τον τοποθετώ σε δεύτερο σάκο, καθαρίζω και απολυμαίνω τον χώρο και ενημερώνω τον υπεύθυνο."}'::jsonb),
    ('TRN-DEMO-004', 85, '{"Q-401":"Q-401-O2","Q-402":true,"Q-403":["Q-403-O1","Q-403-O3"],"Q-404":"Q-404-O2","Q-405":true,"Q-406":"Τον τοποθετώ σε δεύτερο σάκο, καθαρίζω και απολυμαίνω τον χώρο και ενημερώνω τον υπεύθυνο."}'::jsonb),
    ('TRN-DEMO-004', 60, '{"Q-401":"Q-401-O1","Q-402":true,"Q-403":["Q-403-O1","Q-403-O3"],"Q-404":"Q-404-O2","Q-405":true,"Q-406":"Τον τοποθετώ σε δεύτερο σάκο, καθαρίζω και απολυμαίνω τον χώρο και ενημερώνω τον υπεύθυνο."}'::jsonb),
    ('TRN-DEMO-004', 35, '{"Q-401":"Q-401-O1","Q-402":false,"Q-403":["Q-403-O1","Q-403-O3"],"Q-404":"Q-404-O2","Q-405":true,"Q-406":"Τον τοποθετώ σε δεύτερο σάκο, καθαρίζω και απολυμαίνω τον χώρο και ενημερώνω τον υπεύθυνο."}'::jsonb),
    ('TRN-DEMO-004', 90, '{"Q-401":"Q-401-O2","Q-402":true,"Q-403":["Q-403-O1","Q-403-O3"],"Q-404":"Q-404-O1","Q-405":false,"Q-406":"Τον τοποθετώ σε δεύτερο σάκο, καθαρίζω και απολυμαίνω τον χώρο και ενημερώνω τον υπεύθυνο."}'::jsonb),
    ('TRN-DEMO-004', 65, '{"Q-401":"Q-401-O1","Q-402":true,"Q-403":["Q-403-O1","Q-403-O3"],"Q-404":"Q-404-O1","Q-405":false,"Q-406":"Τον τοποθετώ σε δεύτερο σάκο, καθαρίζω και απολυμαίνω τον χώρο και ενημερώνω τον υπεύθυνο."}'::jsonb),
    ('TRN-DEMO-004', 40, '{"Q-401":"Q-401-O1","Q-402":false,"Q-403":["Q-403-O1","Q-403-O3"],"Q-404":"Q-404-O1","Q-405":false,"Q-406":"Τον τοποθετώ σε δεύτερο σάκο, καθαρίζω και απολυμαίνω τον χώρο και ενημερώνω τον υπεύθυνο."}'::jsonb),
    ('TRN-DEMO-005', 100, '{"Q-301":"Q-301-O2","Q-302":false,"Q-303":"Q-303-O2","Q-304":["Q-304-O1","Q-304-O2","Q-304-O4"],"Q-305":true,"Q-306":"Q-306-O2","Q-307":"Τον προϊστάμενο και το Ιατρείο Εργασίας, με καταγραφή του περιστατικού."}'::jsonb),
    ('TRN-DEMO-005', 80, '{"Q-301":"Q-301-O1","Q-302":false,"Q-303":"Q-303-O2","Q-304":["Q-304-O1","Q-304-O2","Q-304-O4"],"Q-305":true,"Q-306":"Q-306-O2","Q-307":"Τον προϊστάμενο και το Ιατρείο Εργασίας, με καταγραφή του περιστατικού."}'::jsonb),
    ('TRN-DEMO-005', 60, '{"Q-301":"Q-301-O1","Q-302":true,"Q-303":"Q-303-O2","Q-304":["Q-304-O1","Q-304-O2","Q-304-O4"],"Q-305":true,"Q-306":"Q-306-O2","Q-307":"Τον προϊστάμενο και το Ιατρείο Εργασίας, με καταγραφή του περιστατικού."}'::jsonb),
    ('TRN-DEMO-005', 40, '{"Q-301":"Q-301-O1","Q-302":true,"Q-303":"Q-303-O1","Q-304":["Q-304-O1","Q-304-O2","Q-304-O4"],"Q-305":true,"Q-306":"Q-306-O2","Q-307":"Τον προϊστάμενο και το Ιατρείο Εργασίας, με καταγραφή του περιστατικού."}'::jsonb),
    ('TRN-DEMO-005', 92, '{"Q-301":"Q-301-O2","Q-302":false,"Q-303":"Q-303-O2","Q-304":["Q-304-O1","Q-304-O2","Q-304-O4"],"Q-305":false,"Q-306":"Q-306-O2","Q-307":"Τον προϊστάμενο και το Ιατρείο Εργασίας, με καταγραφή του περιστατικού."}'::jsonb),
    ('TRN-DEMO-005', 72, '{"Q-301":"Q-301-O1","Q-302":false,"Q-303":"Q-303-O2","Q-304":["Q-304-O1","Q-304-O2","Q-304-O4"],"Q-305":false,"Q-306":"Q-306-O2","Q-307":"Τον προϊστάμενο και το Ιατρείο Εργασίας, με καταγραφή του περιστατικού."}'::jsonb),
    ('TRN-DEMO-005', 52, '{"Q-301":"Q-301-O1","Q-302":true,"Q-303":"Q-303-O2","Q-304":["Q-304-O1","Q-304-O2","Q-304-O4"],"Q-305":false,"Q-306":"Q-306-O2","Q-307":"Τον προϊστάμενο και το Ιατρείο Εργασίας, με καταγραφή του περιστατικού."}'::jsonb),
    ('TRN-DEMO-005', 88, '{"Q-301":"Q-301-O2","Q-302":false,"Q-303":"Q-303-O2","Q-304":["Q-304-O1","Q-304-O2","Q-304-O4"],"Q-305":true,"Q-306":"Q-306-O1","Q-307":"Τον προϊστάμενο και το Ιατρείο Εργασίας, με καταγραφή του περιστατικού."}'::jsonb),
    ('TRN-DEMO-005', 68, '{"Q-301":"Q-301-O1","Q-302":false,"Q-303":"Q-303-O2","Q-304":["Q-304-O1","Q-304-O2","Q-304-O4"],"Q-305":true,"Q-306":"Q-306-O1","Q-307":"Τον προϊστάμενο και το Ιατρείο Εργασίας, με καταγραφή του περιστατικού."}'::jsonb),
    ('TRN-DEMO-005', 48, '{"Q-301":"Q-301-O1","Q-302":true,"Q-303":"Q-303-O2","Q-304":["Q-304-O1","Q-304-O2","Q-304-O4"],"Q-305":true,"Q-306":"Q-306-O1","Q-307":"Τον προϊστάμενο και το Ιατρείο Εργασίας, με καταγραφή του περιστατικού."}'::jsonb)
  ), a as (
    select tr.id, tr.payload p, split_part(tr.record_key, '-', 3)::int pn, split_part(tr.record_key, '-', 4)::int g
    from public.training_records tr
    where tr.organization_id = v_org and tr.record_type = 'assignment' and tr.record_key like 'TRA-DEMO-_-___'
      and tr.payload->>'programId' <> 'TRN-DEMO-005'
  ), x as (
    select a.*, a.p->>'status' st,
      case when a.p->>'status' in ('completed', 'in_progress') then 'confirmed' when a.g % 2 = 0 then 'sent' else 'not_sent' end resp,
      (a.p->>'assignedDate')::date assigned, (a.p->>'completedDate')::date done
    from a
  )
  update public.training_records tr
  set payload = tr.payload || jsonb_build_object(
      'attendanceResponse', x.resp,
      'attendance', case when x.resp = 'confirmed' then to_jsonb(true) else 'null'::jsonb end,
      'invitationSentAt', case when x.resp = 'not_sent' then null else to_char(x.assigned + time '09:00', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') end,
      'attendanceConfirmedAt', case when x.resp = 'confirmed' then to_char(coalesce(x.done, x.assigned + 4) + time '08:55', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') end,
      'completionConfirmedAt', case when x.st = 'completed' then to_char(x.done + time '10:40', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') end,
      'feedbackSubmittedAt', case when x.st = 'completed' then to_char(x.done + time '10:42', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') end,
      'assessmentSubmittedAt', case when x.st = 'completed' then to_char(x.done + time '10:45', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') end,
      'assessmentAnswers', case when x.st = 'completed' then c.answers end,
      'score', case when x.st = 'completed' then to_jsonb(c.score) else 'null'::jsonb end,
      'feedbackScores', case when x.st = 'completed' then jsonb_build_object(
          'clarity', case when (x.g * 2 + x.pn * 2) % 5 = 0 then 3 when (x.g + x.pn) % 3 = 0 then 4 else 5 end,
          'knowledge', case when (x.g * 3 + x.pn) % 7 = 0 then 4 else 5 end,
          'usefulness', case when (x.g * 4 + x.pn * 2) % 5 = 0 then 3 when (x.g * 4 + x.pn) % 3 = 0 then 4 else 5 end,
          'organization', case when (x.g * 5 + x.pn) % 3 = 0 then 4 else 5 end,
          'materials', case when (x.g * 6 + x.pn * 2) % 5 = 0 then 3 when (x.g * 6 + x.pn) % 3 = 1 then 4 else 5 end) end,
      'feedbackComment', case when x.st = 'completed' then v_comments[1 + (x.g + x.pn) % 8] end,
      'assessmentReviewedAt', case when x.st = 'completed' and x.pn <= 2 then to_char(x.done + time '14:00', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') end,
      'assessmentReviewedBy', case when x.st = 'completed' and x.pn <= 2 then 'Νοσηλεύτρια Επιτήρησης Λοιμώξεων' end,
      'assessmentReviewAcknowledged', case when x.st = 'completed' and x.pn <= 2 then to_jsonb(true) else 'null'::jsonb end),
    updated_at = v_now
  from x
  left join lateral (select cd.score, cd.answers from cand cd
                     where cd.program_id = x.p->>'programId' and x.p->>'score' is not null
                     order by ((cd.score >= 80) <> ((x.p->>'score')::numeric >= 80)), abs(cd.score - (x.p->>'score')::numeric), cd.score desc
                     limit 1) c on true
  where tr.id = x.id;

  -- Programmes: material, assessment questions, the trainer evaluation they
  -- use, the evaluations collected, and the effectiveness follow-up.
  with q(program_id, questions) as (values
    ('TRN-DEMO-001', '[{"id":"Q-001","type":"single_choice","text":"Πότε εφαρμόζεται υγιεινή χεριών πριν από άσηπτη πράξη;","points":5,"required":true,"options":[{"id":"Q-001-O1","text":"Μόνο όταν δεν φοράμε γάντια","correct":false},{"id":"Q-001-O2","text":"Αμέσως πριν από κάθε άσηπτη πράξη","correct":true},{"id":"Q-001-O3","text":"Μόνο μετά την επαφή με τον ασθενή","correct":false},{"id":"Q-001-O4","text":"Μία φορά στην αρχή της βάρδιας","correct":false}],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-002","type":"true_false","text":"Τα γάντια αντικαθιστούν την υγιεινή χεριών.","points":5,"required":true,"options":[],"correctBoolean":false,"modelAnswer":"","manualReview":false},{"id":"Q-003","type":"multiple_choice","text":"Ποιες από τις παρακάτω είναι «στιγμές» του WHO για την υγιεινή χεριών;","points":5,"required":true,"options":[{"id":"Q-003-O1","text":"Πριν από την επαφή με τον ασθενή","correct":true},{"id":"Q-003-O2","text":"Μετά από έκθεση σε βιολογικά υγρά","correct":true},{"id":"Q-003-O3","text":"Πριν από την είσοδο στο γραφείο προσωπικού","correct":false},{"id":"Q-003-O4","text":"Μετά την επαφή με το περιβάλλον του ασθενούς","correct":true}],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-004","type":"single_choice","text":"Πόσο διαρκεί η σωστή εντριβή με αλκοολούχο αντισηπτικό;","points":5,"required":true,"options":[{"id":"Q-004-O1","text":"5–10 δευτερόλεπτα","correct":false},{"id":"Q-004-O2","text":"20–30 δευτερόλεπτα","correct":true},{"id":"Q-004-O3","text":"40–60 δευτερόλεπτα","correct":false},{"id":"Q-004-O4","text":"2 λεπτά","correct":false}],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-005","type":"true_false","text":"Σε λοίμωξη από Clostridioides difficile προτιμάται πλύσιμο με νερό και σαπούνι.","points":3,"required":true,"options":[],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-006","type":"single_choice","text":"Πόσο διαρκεί το πλύσιμο χεριών με νερό και σαπούνι;","points":2,"required":true,"options":[{"id":"Q-006-O1","text":"10–15 δευτερόλεπτα","correct":false},{"id":"Q-006-O2","text":"20–30 δευτερόλεπτα","correct":false},{"id":"Q-006-O3","text":"40–60 δευτερόλεπτα","correct":true},{"id":"Q-006-O4","text":"3 λεπτά","correct":false}],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-007","type":"free_text","text":"Περιγράψτε σε μία πρόταση πότε αλλάζετε γάντια στον ίδιο ασθενή.","points":0,"required":false,"options":[],"correctBoolean":true,"modelAnswer":"Όταν μετακινούμαι από μολυσμένη σε καθαρή περιοχή του σώματος του ίδιου ασθενούς.","manualReview":false}]'::jsonb),
    ('TRN-DEMO-002', '[{"id":"Q-101","type":"single_choice","text":"Ποια είναι η σωστή σειρά ένδυσης ΜΑΠ;","points":3,"required":true,"options":[{"id":"Q-101-O1","text":"Γάντια → ποδιά → μάσκα → γυαλιά","correct":false},{"id":"Q-101-O2","text":"Ποδιά → μάσκα → γυαλιά → γάντια","correct":true},{"id":"Q-101-O3","text":"Μάσκα → γάντια → ποδιά → γυαλιά","correct":false},{"id":"Q-101-O4","text":"Γυαλιά → γάντια → μάσκα → ποδιά","correct":false}],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-102","type":"true_false","text":"Η μάσκα FFP2 απαιτείται σε διαδικασίες που παράγουν αερολύματα.","points":2,"required":true,"options":[],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-103","type":"multiple_choice","text":"Ποιοι μικροοργανισμοί απαιτούν προφυλάξεις επαφής;","points":3,"required":true,"options":[{"id":"Q-103-O1","text":"CPE / KPC","correct":true},{"id":"Q-103-O2","text":"MRSA","correct":true},{"id":"Q-103-O3","text":"Mycobacterium tuberculosis","correct":false},{"id":"Q-103-O4","text":"Clostridioides difficile","correct":true}],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-104","type":"true_false","text":"Τα γάντια αφαιρούνται τελευταία, μετά τη μάσκα.","points":2,"required":true,"options":[],"correctBoolean":false,"modelAnswer":"","manualReview":false},{"id":"Q-105","type":"free_text","text":"Αναφέρετε ένα σημείο προσοχής κατά την αφαίρεση της ποδιάς.","points":0,"required":false,"options":[],"correctBoolean":true,"modelAnswer":"Αναδιπλώνεται με τη μολυσμένη πλευρά προς τα μέσα, χωρίς επαφή με τη στολή.","manualReview":false}]'::jsonb),
    ('TRN-DEMO-003', '[{"id":"Q-201","type":"single_choice","text":"Ποιο αντισηπτικό προτιμάται για την προετοιμασία του δέρματος πριν από τοποθέτηση CVC;","points":2,"required":true,"options":[{"id":"Q-201-O1","text":"Ποβιδόνη ιωδίνη 10%","correct":false},{"id":"Q-201-O2","text":"Χλωρεξιδίνη > 0,5% σε αλκοόλη","correct":true},{"id":"Q-201-O3","text":"Αλκοόλη 70% μόνη","correct":false},{"id":"Q-201-O4","text":"Φυσιολογικός ορός","correct":false}],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-202","type":"multiple_choice","text":"Ποια στοιχεία περιλαμβάνει το bundle τοποθέτησης CVC;","points":3,"required":true,"options":[{"id":"Q-202-O1","text":"Υγιεινή χεριών","correct":true},{"id":"Q-202-O2","text":"Πλήρη μέτρα άσηπτης τεχνικής (maximal barrier)","correct":true},{"id":"Q-202-O3","text":"Αποφυγή μηριαίας φλέβας σε ενήλικες","correct":true},{"id":"Q-202-O4","text":"Προφυλακτική χορήγηση αντιβιοτικού","correct":false}],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-203","type":"true_false","text":"Η ανάγκη διατήρησης της κεντρικής γραμμής επανεκτιμάται καθημερινά.","points":1,"required":true,"options":[],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-204","type":"single_choice","text":"Κάθε πότε αλλάζει ένα διαφανές επίθεμα CVC, εφόσον είναι ακέραιο;","points":2,"required":true,"options":[{"id":"Q-204-O1","text":"Κάθε 24 ώρες","correct":false},{"id":"Q-204-O2","text":"Κάθε 48 ώρες","correct":false},{"id":"Q-204-O3","text":"Κάθε 7 ημέρες","correct":true},{"id":"Q-204-O4","text":"Μόνο κατά την αφαίρεση","correct":false}],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-205","type":"true_false","text":"Τα σημεία πρόσβασης (hubs) δεν χρειάζονται απολύμανση όταν χρησιμοποιούνται συχνά.","points":1,"required":true,"options":[],"correctBoolean":false,"modelAnswer":"","manualReview":false},{"id":"Q-206","type":"single_choice","text":"Ποιος δείκτης μετρά τη συχνότητα CLABSI;","points":1,"required":true,"options":[{"id":"Q-206-O1","text":"Επεισόδια ανά 100 εισαγωγές","correct":false},{"id":"Q-206-O2","text":"Επεισόδια ανά 1.000 ημέρες κεντρικής γραμμής","correct":true},{"id":"Q-206-O3","text":"Επεισόδια ανά κλίνη","correct":false},{"id":"Q-206-O4","text":"Επεισόδια ανά μήνα","correct":false}],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-207","type":"free_text","text":"Τι κάνετε αν το επίθεμα είναι υγρό ή αποκολλημένο;","points":0,"required":false,"options":[],"correctBoolean":true,"modelAnswer":"Αλλάζω άμεσα το επίθεμα με άσηπτη τεχνική και καταγράφω την αλλαγή.","manualReview":false}]'::jsonb),
    ('TRN-DEMO-004', '[{"id":"Q-401","type":"single_choice","text":"Σε ποιον περιέκτη απορρίπτονται τα μολυσματικά απόβλητα (ΕΑΑ-ΜΧ);","points":5,"required":true,"options":[{"id":"Q-401-O1","text":"Μαύρη σακούλα οικιακών απορριμμάτων","correct":false},{"id":"Q-401-O2","text":"Κίτρινο κυτίο ή σάκος με σήμανση βιολογικού κινδύνου","correct":true},{"id":"Q-401-O3","text":"Μπλε κάδος ανακύκλωσης","correct":false},{"id":"Q-401-O4","text":"Οποιοσδήποτε διαθέσιμος κάδος","correct":false}],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-402","type":"true_false","text":"Τα αιχμηρά απορρίπτονται σε άκαμπτο περιέκτη ανθεκτικό στη διάτρηση.","points":5,"required":true,"options":[],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-403","type":"multiple_choice","text":"Ποια από τα παρακάτω χαρακτηρίζονται μολυσματικά απόβλητα (ΕΑΑ-ΜΧ);","points":5,"required":true,"options":[{"id":"Q-403-O1","text":"Γάζες εμποτισμένες με αίμα","correct":true},{"id":"Q-403-O2","text":"Χάρτινες συσκευασίες φαρμάκων","correct":false},{"id":"Q-403-O3","text":"Σωληνώσεις αιμοκάθαρσης","correct":true},{"id":"Q-403-O4","text":"Υπολείμματα τροφών από θάλαμο χωρίς απομόνωση","correct":false}],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-404","type":"single_choice","text":"Πόσο μπορούν να παραμείνουν τα ΕΑΑ-ΜΧ στον χώρο προσωρινής αποθήκευσης σε θερμοκρασία δωματίου;","points":3,"required":true,"options":[{"id":"Q-404-O1","text":"Έως 5 ημέρες","correct":true},{"id":"Q-404-O2","text":"Έως 30 ημέρες","correct":false},{"id":"Q-404-O3","text":"Χωρίς χρονικό όριο","correct":false},{"id":"Q-404-O4","text":"Έως 1 ώρα","correct":false}],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-405","type":"true_false","text":"Οι σάκοι γεμίζουν έως τα 3/4 και κλείνουν χωρίς συμπίεση του περιεχομένου.","points":2,"required":true,"options":[],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-406","type":"free_text","text":"Τι κάνετε αν σχιστεί σάκος μολυσματικών αποβλήτων;","points":0,"required":false,"options":[],"correctBoolean":true,"modelAnswer":"Τον τοποθετώ σε δεύτερο σάκο, καθαρίζω και απολυμαίνω τον χώρο και ενημερώνω τον υπεύθυνο.","manualReview":false}]'::jsonb),
    ('TRN-DEMO-005', '[{"id":"Q-301","type":"single_choice","text":"Τι κάνετε αμέσως μετά από τρύπημα με χρησιμοποιημένη βελόνα;","points":5,"required":true,"options":[{"id":"Q-301-O1","text":"Πιέζω για να σταματήσει η αιμορραγία","correct":false},{"id":"Q-301-O2","text":"Πλένω με νερό και σαπούνι και ενημερώνω αμέσως","correct":true},{"id":"Q-301-O3","text":"Εφαρμόζω χλωρίνη στο τραύμα","correct":false},{"id":"Q-301-O4","text":"Συνεχίζω και το αναφέρω στο τέλος της βάρδιας","correct":false}],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-302","type":"true_false","text":"Η επανατοποθέτηση του καλύμματος στη βελόνα με δύο χέρια επιτρέπεται.","points":5,"required":true,"options":[],"correctBoolean":false,"modelAnswer":"","manualReview":false},{"id":"Q-303","type":"single_choice","text":"Μέχρι πού γεμίζει ο περιέκτης αιχμηρών;","points":5,"required":true,"options":[{"id":"Q-303-O1","text":"Μέχρι επάνω","correct":false},{"id":"Q-303-O2","text":"Έως τα 3/4 ή τη γραμμή πλήρωσης","correct":true},{"id":"Q-303-O3","text":"Μέχρι τη μέση","correct":false},{"id":"Q-303-O4","text":"Δεν υπάρχει όριο","correct":false}],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-304","type":"multiple_choice","text":"Ποια μέτρα μειώνουν τους τραυματισμούς από αιχμηρά;","points":5,"required":true,"options":[{"id":"Q-304-O1","text":"Συσκευές ασφαλείας","correct":true},{"id":"Q-304-O2","text":"Περιέκτης στο σημείο χρήσης","correct":true},{"id":"Q-304-O3","text":"Μεταφορά βελονών στο χέρι","correct":false},{"id":"Q-304-O4","text":"Εκπαίδευση προσωπικού","correct":true}],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-305","type":"true_false","text":"Κάθε έκθεση σε αίμα καταγράφεται ως περιστατικό έκθεσης στο Ιατρείο Εργασίας.","points":2,"required":true,"options":[],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-306","type":"single_choice","text":"Εντός πόσου χρόνου ξεκινά ιδανικά η προφύλαξη μετά από έκθεση στον HIV;","points":3,"required":true,"options":[{"id":"Q-306-O1","text":"Εντός 2 ωρών","correct":false},{"id":"Q-306-O2","text":"Εντός 72 ωρών — ιδανικά στις 2 πρώτες ώρες","correct":true},{"id":"Q-306-O3","text":"Εντός 1 εβδομάδας","correct":false},{"id":"Q-306-O4","text":"Δεν απαιτείται προφύλαξη","correct":false}],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-307","type":"free_text","text":"Ποιον ενημερώνετε μετά από έκθεση;","points":0,"required":false,"options":[],"correctBoolean":true,"modelAnswer":"Τον προϊστάμενο και το Ιατρείο Εργασίας, με καταγραφή του περιστατικού.","manualReview":false}]'::jsonb)
  ), m(program_id, title_en, materials, effectiveness) as (values
    ('TRN-DEMO-001', 'Hand hygiene – WHO 5 Moments',
      jsonb_build_array(jsonb_build_object('id', 'MAT-DEMO-001-1', 'title', 'Οι 5 στιγμές υγιεινής χεριών (WHO) — αφίσα', 'type', 'PDF', 'url', ''),
        jsonb_build_object('id', 'MAT-DEMO-001-2', 'title', 'Τεχνική αντισηψίας χεριών με αλκοολούχο διάλυμα — βίντεο', 'type', 'Βίντεο', 'url', ''),
        jsonb_build_object('id', 'MAT-DEMO-001-3', 'title', 'Παρουσίαση εκπαίδευσης', 'type', 'Παρουσίαση', 'url', '')),
      jsonb_build_object('plannedDate', (d0 - 5)::text, 'method', 'observation', 'criterion', 'Συμμόρφωση στην υγιεινή χεριών ≥ 85% στις παρατηρήσεις WHO του τριμήνου',
        'result', 'partial', 'evaluatedAt', (d0 - 4)::text, 'evaluatedBy', 'Ομάδα Ελέγχου Λοιμώξεων',
        'notes', 'Συμμόρφωση 79%· χαμηλότερη στη στιγμή «μετά την επαφή με το περιβάλλον του ασθενούς». Επανεκπαίδευση στο τμήμα.')),
    ('TRN-DEMO-002', 'Personal protective equipment (PPE)',
      jsonb_build_array(jsonb_build_object('id', 'MAT-DEMO-002-1', 'title', 'Σειρά ένδυσης και αφαίρεσης ΑΠΕ — οδηγός', 'type', 'PDF', 'url', ''),
        jsonb_build_object('id', 'MAT-DEMO-002-2', 'title', 'Πρωτόκολλο απομόνωσης ασθενών με πολυανθεκτικά (DOC-003)', 'type', 'Διαδικασία', 'url', ''),
        jsonb_build_object('id', 'MAT-DEMO-002-3', 'title', 'Παρουσιολόγιο πρακτικής άσκησης', 'type', 'Έντυπο', 'url', '')),
      jsonb_build_object('plannedDate', (d0 - 2)::text, 'method', 'audit', 'criterion', 'Ορθή ένδυση/αφαίρεση ΑΠΕ σε ≥ 90% των ελέγχων θαλάμων απομόνωσης',
        'result', '', 'evaluatedAt', '', 'evaluatedBy', '', 'notes', '')),
    ('TRN-DEMO-003', 'CLABSI prevention bundle',
      jsonb_build_array(jsonb_build_object('id', 'MAT-DEMO-003-1', 'title', 'Δέσμη μέτρων πρόληψης CLABSI (DOC-004)', 'type', 'Διαδικασία', 'url', ''),
        jsonb_build_object('id', 'MAT-DEMO-003-2', 'title', 'Λίστα ελέγχου τοποθέτησης κεντρικού φλεβικού καθετήρα', 'type', 'Έντυπο', 'url', ''),
        jsonb_build_object('id', 'MAT-DEMO-003-3', 'title', 'Παρουσίαση εκπαίδευσης', 'type', 'Παρουσίαση', 'url', '')),
      jsonb_build_object('plannedDate', (d0 + 90)::text, 'method', 'indicator', 'criterion', 'Συχνότητα CLABSI στη ΜΕΘ < 2 ανά 1.000 ημέρες καθετήρα',
        'result', '', 'evaluatedAt', '', 'evaluatedBy', '', 'notes', '')),
    ('TRN-DEMO-004', 'Healthcare waste management',
      jsonb_build_array(jsonb_build_object('id', 'MAT-DEMO-004-1', 'title', 'Οδηγός διαλογής ΕΑΑ/ΜΑ', 'type', 'PDF', 'url', ''),
        jsonb_build_object('id', 'MAT-DEMO-004-2', 'title', 'Σήμανση περιεκτών αποβλήτων — αφίσα', 'type', 'PDF', 'url', '')),
      jsonb_build_object('plannedDate', d0::text, 'method', 'audit', 'criterion', 'Ορθή διαλογή αποβλήτων ≥ 95% στους ελέγχους τμημάτων',
        'result', 'effective', 'evaluatedAt', (d0 - 3)::text, 'evaluatedBy', 'Γραφείο Περιβαλλοντικής Υγιεινής',
        'notes', 'Ορθή διαλογή 97% σε 18 ελέγχους· καμία ανάμιξη αιχμηρών με κοινά απορρίμματα.')),
    ('TRN-DEMO-005', 'Safe use of sharps and PEP',
      jsonb_build_array(jsonb_build_object('id', 'MAT-DEMO-005-1', 'title', 'Διαδικασία μετά από έκθεση σε αίμα (PEP)', 'type', 'Διαδικασία', 'url', ''),
        jsonb_build_object('id', 'MAT-DEMO-005-2', 'title', 'Ασφαλής χρήση και απόρριψη αιχμηρών', 'type', 'Παρουσίαση', 'url', '')),
      jsonb_build_object('plannedDate', (d0 + 171)::text, 'method', 'indicator', 'criterion', 'Καμία μη αναφερθείσα έκθεση σε αιχμηρά στο τρίμηνο',
        'result', '', 'evaluatedAt', '', 'evaluatedBy', '', 'notes', ''))
  )
  update public.training_records pr
  set payload = pr.payload || jsonb_build_object(
      'titleEn', m.title_en, 'materials', m.materials, 'assessmentQuestions', q.questions, 'trainerFeedbackTemplate', v_template,
      'effectiveness', m.effectiveness,
      'feedbackResponses', coalesce((
        select jsonb_agg(jsonb_build_object('employeeId', a.payload->>'employeeId', 'assignmentId', a.record_key, 'scores', a.payload->'feedbackScores',
                 'comment', coalesce(a.payload->>'feedbackComment', ''), 'submittedAt', a.payload->>'feedbackSubmittedAt') order by a.payload->>'feedbackSubmittedAt', a.record_key)
        from public.training_records a
        where a.organization_id = v_org and a.record_type = 'assignment' and a.payload->>'programId' = pr.record_key
          and a.payload->>'feedbackSubmittedAt' is not null), '[]'::jsonb),
      'createdAt', coalesce(pr.payload->>'createdAt', to_char(((pr.payload->>'startDate')::date - 20) + time '09:00', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))),
    updated_at = v_now
  from q join m on m.program_id = q.program_id
  where pr.organization_id = v_org and pr.record_type = 'program' and pr.record_key = q.program_id;

  -- What happened in the training registry (Training > history snapshot).
  insert into public.training_records(organization_id, record_key, record_type, payload, created_by, updated_by)
  select v_org, 'training-history', 'history_snapshot', jsonb_build_object('id', 'training-history', 'items', jsonb_agg(jsonb_build_object(
      'at', to_char(h.at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'actor', h.actor, 'action', h.action) order by h.at desc)), p_actor, p_actor
  from (values
    ((d0 - 170) + time '09:00', 'Ομάδα Ελέγχου Λοιμώξεων', 'Δημιουργήθηκε το πρόγραμμα «Διαχείριση νοσοκομειακών αποβλήτων»'),
    ((d0 - 140) + time '09:10', 'Ομάδα Ελέγχου Λοιμώξεων', 'Δημιουργήθηκε ο ετήσιος κύκλος «Υγιεινή των χεριών – 5 στιγμές ΠΟΥ»'),
    ((d0 - 120) + time '09:00', 'Ομάδα Ελέγχου Λοιμώξεων', 'Στάλθηκαν προσκλήσεις για την υγιεινή των χεριών'),
    ((d0 - 110) + time '11:30', 'Νοσηλεύτρια Επιτήρησης Λοιμώξεων', 'Ορίστηκε απαίτηση «ΑΠΕ για νοσηλευτικό προσωπικό»'),
    ((d0 - 80) + time '10:00', 'Διευθυντής ΜΕΘ', 'Δημιουργήθηκε το πρόγραμμα «Bundle πρόληψης CLABSI»'),
    ((d0 - 4) + time '13:00', 'Ομάδα Ελέγχου Λοιμώξεων', 'Καταγράφηκε η αποτελεσματικότητα της εκπαίδευσης υγιεινής χεριών: μερικώς αποτελεσματική'),
    ((d0 - 3) + time '09:30', 'Ομάδα Ελέγχου Λοιμώξεων', 'Προστέθηκαν συμμετέχοντες στο «Ασφαλής χρήση αιχμηρών και PEP»')
  ) h(at, actor, action)
  on conflict (organization_id, record_key) do nothing;
end;
$function$;

-- 3. Employees: job descriptions, acknowledgements, certificates, evaluations -----
create or replace function private.demo_seed_people_employees(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := current_date;
  v_now timestamptz := now();
  v_notes text[] := array['Συνεπής και μεθοδική· πρότυπο στην τήρηση των πρωτοκόλλων απομόνωσης.',
    'Πολύ καλή συνεργασία με την ομάδα. Στόχος: εκπαίδευση στο bundle CLABSI.',
    'Χρειάζεται βελτίωση στην πληρότητα της τεκμηρίωσης της βάρδιας.',
    'Ανέλαβε με επιτυχία την εκπαίδευση νέων συναδέλφων.',
    'Καλή επαγγελματική επάρκεια· να ολοκληρώσει την εκπαίδευση ΑΠΕ.'];
begin
  -- Job positions (Management > Libraries) with their job description. The
  -- library is kept across resets: an existing description is not replaced.
  insert into public.master_library_items(organization_id, library_key, name_el, name_en, metadata, source_authority, source_version, created_by, updated_by)
  select v_org, 'positions', j.name_el, j.name_en,
    jsonb_build_object('system', false, 'locked', false, 'jobDescription', jsonb_build_object(
      'purpose', j.purpose, 'reportsTo', j.reports_to, 'duties', j.duties, 'responsibilities', j.resp, 'qualifications', j.quals, 'competencies', j.comp,
      'version', j.version, 'updatedAt', to_char((d0 - j.updated_ago) + time '09:00', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'updatedBy', 'Διεύθυνση Νοσηλευτικής Υπηρεσίας')),
    'Hospital', 'local', p_actor, p_actor
  from (values
    ('Νοσηλευτής Τμήματος', 'Ward Nurse', 2, 45,
      'Παροχή ασφαλούς νοσηλευτικής φροντίδας στους ασθενείς του τμήματος με τήρηση των πρωτοκόλλων πρόληψης λοιμώξεων.', 'Προϊστάμενος Τμήματος',
      E'Εκτίμηση και παρακολούθηση ασθενών (NEWS2, Morse, Braden)\nΧορήγηση φαρμάκων με διπλό έλεγχο για φάρμακα υψηλού κινδύνου\nΤήρηση υγιεινής χεριών (5 στιγμές ΠΟΥ) και μέτρων απομόνωσης\nΦροντίδα περιφερικών και κεντρικών γραμμών κατά τις δέσμες μέτρων',
      E'Άμεση αναφορά συμβάντων και αποκλίσεων\nΚαταγραφή των ελέγχων του τμήματος (ψυγείο φαρμάκων, τροχήλατο ανάνηψης)',
      E'Πτυχίο Νοσηλευτικής και άδεια άσκησης επαγγέλματος\nΠιστοποίηση BLS σε ισχύ', E'Ετήσια εκπαίδευση υγιεινής χεριών\nΕκπαίδευση στον ατομικό προστατευτικό εξοπλισμό'),
    ('Προϊστάμενος Τμήματος', 'Head Nurse', 1, 120,
      'Οργάνωση και εποπτεία της νοσηλευτικής φροντίδας του τμήματος και διασφάλιση της ποιότητας και της ασφάλειας των ασθενών.', 'Διευθυντής Νοσηλευτικής Υπηρεσίας',
      E'Κατανομή προσωπικού και προγραμματισμός βαρδιών\nΠαρακολούθηση δεικτών ποιότητας και λοιμώξεων του τμήματος\nΣυντονισμός διορθωτικών ενεργειών (CAPA) του τμήματος',
      E'Ετήσια αξιολόγηση απόδοσης του νοσηλευτικού προσωπικού\nΈγκριση αιτημάτων υλικών και φαρμάκων',
      E'Πτυχίο Νοσηλευτικής, άδεια άσκησης επαγγέλματος\nΤουλάχιστον 8 έτη κλινικής εμπειρίας', E'Διοίκηση νοσηλευτικών μονάδων\nΔιαχείριση κινδύνων και συμβάντων'),
    ('Βοηθός Νοσηλευτή', 'Nursing Assistant', 2, 30,
      'Υποστήριξη της νοσηλευτικής ομάδας στη βασική φροντίδα των ασθενών.', 'Νοσηλευτής Τμήματος',
      E'Ατομική υγιεινή και κινητοποίηση ασθενών\nΑλλαγή θέσης κατακεκλιμένων ασθενών κατά το πρόγραμμα πρόληψης κατακλίσεων\nΜεταφορά δειγμάτων στο εργαστήριο',
      E'Τήρηση της διαδικασίας διαλογής αποβλήτων', E'Πτυχίο Βοηθού Νοσηλευτή', E'Υγιεινή των χεριών\nΔιαχείριση νοσοκομειακών αποβλήτων'),
    ('Επιμελητής Β΄', 'Consultant (Grade B)', 1, 150,
      'Ιατρική διάγνωση και θεραπεία των ασθενών του τμήματος σύμφωνα με τις κατευθυντήριες οδηγίες.', 'Διευθυντής Τμήματος',
      E'Καθημερινή επίσκεψη και σχέδιο θεραπείας\nΟρθολογική συνταγογράφηση αντιμικροβιακών\nΕνημέρωση της Ομάδας Ελέγχου Λοιμώξεων για νέα κρούσματα πολυανθεκτικών',
      E'Εποπτεία ειδικευόμενων ιατρών', E'Τίτλος ειδικότητας και άδεια άσκησης επαγγέλματος', E'ALS\nΠολιτική χρήσης αντιμικροβιακών'),
    ('Διευθυντής Τμήματος', 'Head of Department', 1, 150,
      'Επιστημονική και διοικητική ευθύνη του τμήματος.', 'Διευθυντής Ιατρικής Υπηρεσίας',
      E'Κλινική εποπτεία και κατευθυντήριες οδηγίες του τμήματος\nΣυμμετοχή στην Επιτροπή Νοσοκομειακών Λοιμώξεων',
      E'Έγκριση πρωτοκόλλων του τμήματος\nΑξιολόγηση ιατρικού προσωπικού', E'Τίτλος ειδικότητας, θέση Διευθυντή ΕΣΥ', E'Διοίκηση υπηρεσιών υγείας'),
    ('Τεχνολόγος', 'Laboratory Technologist', 1, 90,
      'Εκτέλεση εργαστηριακών εξετάσεων με ακρίβεια και έγκαιρη αναφορά κρίσιμων αποτελεσμάτων.', 'Προϊστάμενος Εργαστηρίου',
      E'Επεξεργασία καλλιεργειών και αντιβιογραμμάτων (EUCAST)\nΕσωτερικός και εξωτερικός έλεγχος ποιότητας',
      E'Άμεση ενημέρωση για κρίσιμα αποτελέσματα και πολυανθεκτικά', E'Πτυχίο Ιατρικών Εργαστηρίων', E'Βιοασφάλεια εργαστηρίου')
  ) j(name_el, name_en, version, updated_ago, purpose, reports_to, duties, resp, quals, comp)
  on conflict (organization_id, library_key, name_el) do update
    set metadata = public.master_library_items.metadata || jsonb_build_object('jobDescription', excluded.metadata->'jobDescription')
    where not (public.master_library_items.metadata ? 'jobDescription');

  update public.employees e set position_name_en = li.name_en
  from public.master_library_items li
  where e.organization_id = v_org and e.user_id is null and e.employee_code like 'EMP-%'
    and li.organization_id = v_org and li.library_key = 'positions' and li.name_el = e.position_name
    and e.position_name_en is distinct from li.name_en;

  -- Acceptance of the job description: most accepted the current version, some
  -- only an earlier one (asked to accept again), one in five has not yet.
  insert into public.employee_position_acknowledgements(organization_id, employee_id, position_name, description_version, acknowledged_at, acknowledged_by, acknowledged_by_name)
  select v_org, e.id, e.position_name, k.version, k.at, p_actor, e.first_name || ' ' || e.last_name
  from public.employees e
  cross join lateral (select substring(e.employee_code from 5)::int g) n
  join public.master_library_items li on li.organization_id = v_org and li.library_key = 'positions' and li.name_el = e.position_name
  cross join lateral (select greatest(1, coalesce((li.metadata->'jobDescription'->>'version')::int, 1)) v) jd
  cross join lateral (values
      (jd.v - 1, (d0 - 200 - n.g) + time '10:00'),
      (jd.v, (d0 - 20 - n.g) + time '09:30')) k(version, at)
  where e.organization_id = v_org and e.user_id is null and e.employee_code like 'EMP-%'
    and n.g % 5 <> 0 and k.version >= 1
    and (k.version = jd.v - 1 or n.g % 5 <> 1 or jd.v = 1)
    and k.at::date >= e.hire_date
    and not exists (select 1 from public.employee_position_acknowledgements x
                    where x.organization_id = v_org and x.employee_id = e.id and x.description_version = k.version and x.position_name = e.position_name);

  -- Documents: BLS for everyone, licence, specialty title for physicians, ALS
  -- for ICU staff and physicians, an infection prevention e-learning for some.
  insert into public.employee_certificates(organization_id, employee_id, title, title_en, issuer, issue_date, valid_until, certificate_number, created_by)
  select v_org, e.id, c.title, c.title_en, c.issuer, c.issued, c.valid, c.num, p_actor
  from public.employees e
  cross join lateral (select substring(e.employee_code from 5)::int g) n
  join public.departments dep on dep.id = e.department_id
  cross join lateral (values
      ('Βασική Υποστήριξη Ζωής (BLS)', 'Basic Life Support (BLS)', 'Ελληνικό Συμβούλιο Αναζωογόνησης',
        d0 - (60 + (n.g * 41) % 700), d0 - (60 + (n.g * 41) % 700) + 730, 'BLS-' || to_char(d0 - (60 + (n.g * 41) % 700), 'YYYY') || '-' || lpad((n.g * 37)::text, 4, '0'), true),
      ('Άδεια άσκησης επαγγέλματος', 'Licence to practise',
        case when e.profession_name = 'Ιατρός' then 'Ιατρικός Σύλλογος Αθηνών' else 'Περιφέρεια Αττικής — Διεύθυνση Δημόσιας Υγείας' end,
        e.hire_date - 400, null::date, 'ΑΑΕ-' || (51000 + n.g * 113), true),
      ('Τίτλος ειδικότητας', 'Specialty title', 'Υπουργείο Υγείας',
        e.hire_date - 200, null::date, 'ΤΕ-' || (8000 + n.g * 29), e.profession_name = 'Ιατρός'),
      ('Εξειδικευμένη Υποστήριξη Ζωής (ALS)', 'Advanced Life Support (ALS)', 'European Resuscitation Council',
        d0 - (300 + (n.g * 53) % 600), d0 - (300 + (n.g * 53) % 600) + 1095, 'ALS-' || lpad((n.g * 71)::text, 5, '0'),
        dep.code = 'ΜΕΘ' or e.profession_name = 'Ιατρός'),
      ('Πρόληψη λοιμώξεων — e-learning ECDC', 'Infection prevention — ECDC e-learning', 'ECDC Virtual Academy',
        d0 - (30 + n.g * 7), null::date, 'ECDC-' || lpad((n.g * 13)::text, 5, '0'), n.g % 4 = 0)
  ) c(title, title_en, issuer, issued, valid, num, applies)
  where e.organization_id = v_org and e.user_id is null and e.employee_code like 'EMP-%' and c.applies
    and not exists (select 1 from public.employee_certificates x where x.organization_id = v_org and x.employee_id = e.id and x.title = c.title);

  -- Performance evaluations: last year's (finalized) and this year's cycle at
  -- every workflow step (draft, submitted, acknowledged, HR approved, final).
  with ev as (
    select e.id employee_id, n.g, k.kind, k.edate, k.period,
      case when k.kind = 'previous' then 'finalized'
           else (array['draft', 'submitted', 'employee_acknowledged', 'hr_approved', 'finalized'])[1 + n.g % 5] end st,
      (select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'score',
                case when (n.g * c.i + k.seed) % 11 = 0 then 2 when (n.g + c.i * 3 + k.seed) % 4 = 0 then 3 when (n.g * 2 + c.i + k.seed) % 3 = 0 then 5 else 4 end,
                'weight', 1) order by c.i)
       from (values (1, 'professional-competence', 'Επαγγελματική επάρκεια'), (2, 'quality-accuracy', 'Ποιότητα & ακρίβεια εργασίας'),
                    (3, 'procedures-protocols', 'Τήρηση διαδικασιών / πρωτοκόλλων'), (4, 'patient-safety-ipc', 'Ασφάλεια ασθενών & πρόληψη λοιμώξεων'),
                    (5, 'teamwork', 'Συνεργασία / ομαδικότητα'), (6, 'communication', 'Επικοινωνία'),
                    (7, 'responsibility', 'Υπευθυνότητα / συνέπεια'), (8, 'professional-development', 'Επαγγελματική ανάπτυξη')) c(i, id, name)) criteria
    from public.employees e
    cross join lateral (select substring(e.employee_code from 5)::int g) n
    cross join lateral (values
      ('previous', d0 - 300 - n.g, 'Ετήσια αξιολόγηση ' || to_char(d0 - 300 - n.g, 'YYYY'), 1),
      ('current', d0 - 5 - (n.g * 5) % 60, 'Ετήσια αξιολόγηση ' || to_char(d0, 'YYYY'), 2)) k(kind, edate, period, seed)
    where e.organization_id = v_org and e.user_id is null and e.employee_code like 'EMP-%' and k.edate >= e.hire_date
  ), scored as (
    select ev.*, round((select avg((c->>'score')::numeric) from jsonb_array_elements(ev.criteria) c), 2) overall
    from ev
  )
  insert into public.employee_evaluations(organization_id, employee_id, title, title_en, evaluation_date, evaluation_period, status, evaluator_user_id, created_by,
    criteria, overall_score, notes, result, result_en, employee_comment, employee_agreement, employee_acknowledged_at,
    hr_approved_at, hr_approved_by, admin_approved_at, admin_approved_by, finalized_at, created_at)
  select v_org, s.employee_id, 'Αξιολόγηση απόδοσης', 'Performance evaluation', s.edate, s.period, s.st, p_actor, p_actor,
    s.criteria, s.overall, v_notes[1 + (s.g + length(s.kind)) % 5],
    rtrim(rtrim(to_char(s.overall, 'FM990.00'), '0'), '.') || ' / 5', rtrim(rtrim(to_char(s.overall, 'FM990.00'), '0'), '.') || ' / 5',
    case when s.st in ('employee_acknowledged', 'hr_approved', 'finalized') then
      case when s.g = 11 and s.kind = 'current' then 'Θεωρώ ότι ο φόρτος της βάρδιας δεν λήφθηκε υπόψη στην τεκμηρίωση.' when s.g % 3 = 0 then 'Ευχαριστώ για την ανατροφοδότηση.' end end,
    case when s.st in ('employee_acknowledged', 'hr_approved', 'finalized') then case when s.g = 11 and s.kind = 'current' then 'disagree' else 'agree' end end,
    case when s.st in ('employee_acknowledged', 'hr_approved', 'finalized') then (s.edate + 3) + time '12:00' end,
    case when s.st in ('hr_approved', 'finalized') then (s.edate + 6) + time '10:00' end,
    case when s.st in ('hr_approved', 'finalized') then p_actor end,
    case when s.st = 'finalized' then (s.edate + 9) + time '11:00' end,
    case when s.st = 'finalized' then p_actor end,
    case when s.st = 'finalized' then (s.edate + 9) + time '11:00' end,
    s.edate + time '09:00'
  from scored s
  where not exists (select 1 from public.employee_evaluations x
                    where x.organization_id = v_org and x.employee_id = s.employee_id and x.evaluation_date = s.edate and x.title = 'Αξιολόγηση απόδοσης');
end;
$function$;

-- 4. Occupational health: today's visits, follow-ups due, vaccinations due ---------
create or replace function private.demo_seed_people_occupational_health(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := current_date;
begin
  -- Visits booked for today, and follow-ups that fell due this week and are
  -- still open (the dashboard counts follow_up_date <= today, not completed).
  insert into public.occupational_health_visits(organization_id, employee_id, visit_date, visit_type, status, fitness_status, follow_up_date, clinical_notes, created_by, updated_by)
  select v_org, e.id, d0 + v.visit_in, v.kind, 'scheduled', 'pending', case when v.due_ago is null then null else d0 - v.due_ago end, v.notes, p_actor, p_actor
  from (values
    ('EMP-002', 0, 'periodic', null::integer, 'Περιοδική εξέταση — 10:00.'),
    ('EMP-011', 0, 'vaccinationReview', null::integer, 'Έλεγχος αντισωμάτων Anti-HBs και αναμνηστική δόση.'),
    ('EMP-016', 0, 'followUp', 0, 'Επανεκτίμηση μετά από οσφυαλγία — επιστροφή στην εργασία.'),
    ('EMP-009', 1, 'followUp', 2, 'Επανεκτίμηση περιορισμού άρσης βάρους.'),
    ('EMP-021', 2, 'followUp', 4, 'Ορολογικός έλεγχος 6 εβδομάδων μετά από τρύπημα με βελόνα (HBV θετική πηγή).'),
    ('EMP-015', 3, 'followUp', 6, 'Αποτελέσματα πηγής και συνέχιση PEP.')
  ) v(code, visit_in, kind, due_ago, notes)
  join public.employees e on e.organization_id = v_org and e.employee_code = v.code
  where not exists (select 1 from public.occupational_health_visits x
                    where x.organization_id = v_org and x.employee_id = e.id and x.visit_date = d0 + v.visit_in and x.visit_type = v.kind);

  -- Influenza doses that expire in the next 30 days (to renew soon).
  update public.employee_vaccinations ev
  set vaccination_date = d0 + d.days - 365, valid_until = d0 + d.days, status = 'renew_soon',
      clinical_notes = 'Λήγει η εποχική δόση — προγραμματισμός εμβολιασμού.', updated_by = p_actor, updated_at = now()
  from (values ('EMP-001', 6), ('EMP-006', 11), ('EMP-012', 17), ('EMP-017', 23), ('EMP-022', 28)) d(code, days)
  join public.employees e on e.organization_id = v_org and e.employee_code = d.code
  where ev.organization_id = v_org and ev.employee_id = e.id and ev.vaccine_label_snapshot = 'Γρίπη εποχική';
end;
$function$;

revoke all on function private.demo_seed_people_clinical_scales(uuid, uuid) from public, anon, authenticated;
revoke all on function private.demo_seed_people_training(uuid, uuid) from public, anon, authenticated;
revoke all on function private.demo_seed_people_employees(uuid, uuid) from public, anon, authenticated;
revoke all on function private.demo_seed_people_occupational_health(uuid, uuid) from public, anon, authenticated;


-- Demo data pack — governance: committees, controlled-document versions,
-- announcements / read acknowledgements and the items of the notification bell.
--
-- Functions (call order; private.demo_seed_governance calls the others):
--   private.demo_seed_governance(org, actor)             -- entry point, calls 1..5
--     1. private.demo_seed_governance_committees(org, actor)
--          committee framework, members (employees), 6 meetings (agenda topics in the
--          shape CommitteeRecordPage expects), attendance, decisions, annual plan,
--          minutes approvals (+ history), committee documents, committee history
--     2. private.demo_seed_governance_documents(org, actor)
--          earlier (superseded) versions for 5 document families + a coherent
--          audit trail for the Versions tab
--     3. private.demo_seed_governance_announcements(org, actor)
--          general announcements + 6 document distributions (requires_ack, link_path /documents/DOC-xxx)
--     4. private.demo_seed_governance_members(org)
--          runs 5. for every active organization member that has an account
--     5. private.demo_seed_governance_member(org, user)   -- also usable as the "new evaluator" hook
--          the user joins the ΕΝΛ (approved) and is invited to the ΕΠΑΑ (pending → bell),
--          is a present member of the extraordinary meeting with a pending minutes
--          approval (→ bell), and has read most document distributions
--   helper: private.demo_seed_governance_topic(...) builds one agenda topic (jsonb)
--
-- Rules followed: no DELETE/DROP, no SELECT/EXECUTE/RETURNING ... INTO, everything
-- schema-qualified, dates relative to current_date, every part idempotent
-- (a second call in the same Demo adds nothing).

create or replace function private.demo_seed_governance_topic(
  p_id text, p_subject text, p_decision text default '', p_follow boolean default false,
  p_action text default '', p_owner text default '', p_due date default null, p_priority text default 'medium')
returns jsonb language sql immutable set search_path = ''
as $function$
  select jsonb_build_object('id', p_id, 'subject', p_subject, 'decision', coalesce(p_decision, ''), 'followUp', coalesce(p_follow, false),
    'action', coalesce(p_action, ''), 'owner', coalesce(p_owner, ''), 'dueDate', coalesce(to_char(p_due, 'YYYY-MM-DD'), ''), 'priority', coalesce(p_priority, 'medium'));
$function$;

-- 1. Committees ------------------------------------------------------------------
create or replace function private.demo_seed_governance_committees(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := current_date;
  v_c1 uuid := (select c.id from public.committees c where c.organization_id = p_organization_id and c.code = 'COM-001');
  v_c2 uuid := (select c.id from public.committees c where c.organization_id = p_organization_id and c.code = 'COM-002');
  v_term date := date_trunc('year', current_date - 180)::date;
  -- meetings
  v_m11 uuid; v_m12 uuid; v_m13 uuid; v_m14 uuid; v_m21 uuid; v_m22 uuid;
  v_t11 date := current_date - 58; v_t12 date := current_date - 28; v_t13 date := current_date - 6;
  v_t14 date := current_date + 5;  v_t21 date := current_date - 76; v_t22 date := current_date + 14;
  -- people (names come from the Demo employees)
  n_chair1 text; n_vice1 text; n_sec1 text; n_icu text; n_lab text; n_card text; n_chair2 text; n_sec2 text; n_qual text; n_icu2 text;
  -- facts from the rest of the Demo
  v_hh numeric; v_hh_low_dept text; v_hh_low numeric; v_clabsi int; v_kleb int; v_capa_kfk text; v_capa_abx text; v_capa_fall text; v_capa_open int;
  v_icu uuid := (select dep.id from public.departments dep where dep.organization_id = p_organization_id and dep.code = 'ΜΕΘ');
  v_kpc_text text;
  v_appr uuid;
begin
  if v_c1 is null or v_c2 is null then
    return;
  end if;
  -- Idempotent: the extraordinary meeting is the marker of a completed run.
  if exists (select 1 from public.committee_meetings m where m.committee_id = v_c1 and m.client_key = 'MTG-COM-001-03') then
    return;
  end if;

  n_chair1 := coalesce((select e.first_name || ' ' || e.last_name from public.employees e where e.organization_id = v_org and e.employee_code = 'EMP-005'), 'Πρόεδρος ΕΝΛ');
  n_vice1  := coalesce((select e.first_name || ' ' || e.last_name from public.employees e where e.organization_id = v_org and e.employee_code = 'EMP-001'), 'Αντιπρόεδρος ΕΝΛ');
  n_sec1   := coalesce((select e.first_name || ' ' || e.last_name from public.employees e where e.organization_id = v_org and e.employee_code = 'EMP-003'), 'ΝΕΛ');
  n_icu    := coalesce((select e.first_name || ' ' || e.last_name from public.employees e where e.organization_id = v_org and e.employee_code = 'EMP-024'), 'Νοσηλεύτρια ΜΕΘ');
  n_lab    := coalesce((select e.first_name || ' ' || e.last_name from public.employees e where e.organization_id = v_org and e.employee_code = 'EMP-016'), 'Μικροβιολογικό Εργαστήριο');
  n_card   := coalesce((select e.first_name || ' ' || e.last_name from public.employees e where e.organization_id = v_org and e.employee_code = 'EMP-011'), 'Ιατρική Υπηρεσία');
  n_chair2 := coalesce((select e.first_name || ' ' || e.last_name from public.employees e where e.organization_id = v_org and e.employee_code = 'EMP-009'), 'Πρόεδρος ΕΠΑΑ');
  n_sec2   := coalesce((select e.first_name || ' ' || e.last_name from public.employees e where e.organization_id = v_org and e.employee_code = 'EMP-006'), 'Γραμματέας ΕΠΑΑ');
  n_qual   := coalesce((select e.first_name || ' ' || e.last_name from public.employees e where e.organization_id = v_org and e.employee_code = 'EMP-002'), 'Γραφείο Ποιότητας');
  n_icu2   := coalesce((select e.first_name || ' ' || e.last_name from public.employees e where e.organization_id = v_org and e.employee_code = 'EMP-008'), 'ΜΕΘ');

  v_hh := (select round(100.0 * sum(s.compliant_observations) / nullif(sum(s.observations), 0), 1) from public.hand_hygiene_sessions s where s.organization_id = v_org);
  v_hh_low_dept := (select dep.name from public.hand_hygiene_sessions s join public.departments dep on dep.id = s.department_id
    where s.organization_id = v_org group by dep.name order by sum(s.compliant_observations)::numeric / nullif(sum(s.observations), 0) asc limit 1);
  v_hh_low := (select round(100.0 * sum(s.compliant_observations) / nullif(sum(s.observations), 0), 1) from public.hand_hygiene_sessions s
    join public.departments dep on dep.id = s.department_id where s.organization_id = v_org and dep.name = v_hh_low_dept);
  v_clabsi := (select count(*) from public.hai_classifications h where h.organization_id = v_org and h.hai_type = 'CLABSI' and h.case_status in ('confirmed', 'probable'));
  v_kleb := (select count(distinct ls.patient_id) from public.microbiology_results mr join public.laboratory_samples ls on ls.id = mr.sample_id
    where mr.organization_id = v_org and mr.organism ilike 'Klebsiella%' and ls.department_id = v_icu and mr.resulted_at > now() - interval '30 days');
  v_capa_kfk := coalesce((select q.code from public.quality_capa_actions q where q.organization_id = v_org and q.title like 'Πρωτόκολλο στερέωσης ΚΦΚ%' limit 1), 'CAPA ΚΦΚ');
  v_capa_abx := coalesce((select q.code from public.quality_capa_actions q where q.organization_id = v_org and q.title like 'Διπλός έλεγχος χορήγησης%' limit 1), 'CAPA αντιβιοτικών');
  v_capa_fall := coalesce((select q.code from public.quality_capa_actions q where q.organization_id = v_org and q.title like 'Εκτίμηση κινδύνου πτώσης%' limit 1), 'CAPA πτώσεων');
  v_capa_open := (select count(*) from public.quality_capa_actions q where q.organization_id = v_org and q.status <> 'closed');
  v_kpc_text := case when v_kleb >= 2
    then format('Επιβεβαιώθηκαν %s ασθενείς με Klebsiella pneumoniae παραγωγό καρβαπενεμάσης (KPC) στη ΜΕΘ τις τελευταίες 30 ημέρες. Ενεργοποιείται το σχέδιο διαχείρισης συρροής.', v_kleb)
    else 'Επιβεβαιώθηκε συρροή Klebsiella pneumoniae παραγωγού καρβαπενεμάσης (KPC) στη ΜΕΘ. Ενεργοποιείται το σχέδιο διαχείρισης συρροής.' end;

  -- Framework (Overview "Governance readiness" checks) and terms
  update public.committees c set
    term_start = v_term,
    term_end = (v_term + case when c.code = 'COM-001' then interval '4 years' else interval '2 years' end - interval '1 day')::date,
    legal_basis = case c.code when 'COM-001' then 'ΥΑ Υ1.Γ.Π.114971/2014, ΦΕΚ 388/Β/18-02-2014 · Εσωτερικός κανονισμός λειτουργίας ΕΝΛ · WHO IPC Core Components'
      else 'Απόφαση Διοικητή για τη σύσταση Επιτροπής Ποιότητας · Εσωτερικός κανονισμός ασφάλειας ασθενών' end,
    decision_number = case c.code when 'COM-001' then 'Απόφαση Διοικητή ' || 14 || '/' || to_char(v_term, 'YYYY') else 'Απόφαση Διοικητή ' || 22 || '/' || to_char(v_term, 'YYYY') end,
    committee_role = case c.code when 'COM-001' then 'Κεντρικό θεσμικό όργανο του νοσοκομείου για την επιτήρηση, πρόληψη και τον έλεγχο των λοιμώξεων που συνδέονται με τη φροντίδα υγείας.'
      else 'Παρακολούθηση δεικτών ποιότητας, ανάλυση συμβάντων ασφάλειας ασθενών και εποπτεία διορθωτικών / προληπτικών ενεργειών (CAPA).' end,
    quorum_rule = 'simple_majority',
    meeting_frequency = case c.code when 'COM-001' then 'monthly' else 'quarterly' end,
    notes = case c.code when 'COM-001' then 'Συνεδριάζει την τελευταία εβδομάδα κάθε μήνα· έκτακτα σε συρροή ή επιδημική έξαρση.' else 'Τριμηνιαία αναφορά προς τη Διοίκηση.' end,
    updated_by = p_actor
  where c.organization_id = v_org and c.id in (v_c1, v_c2);

  -- Members: employees without accounts (the evaluators are added by demo_seed_governance_member)
  insert into public.committee_members(committee_id, organization_id, employee_id, member_name, title, responsibilities, member_type, has_vote,
    approval_status, started_at, ended_at, client_key, created_at)
  select c.id, v_org, e.id, e.first_name || ' ' || e.last_name, m.title, m.resp, m.mtype, m.vote, 'not_required',
    v_term + m.s, case when m.ended is not null then d0 - m.ended end, m.ck, (v_term + m.s) + time '10:00'
  from (values
    (1, 'COM-001', 'CM-COM-001-01', 'EMP-005', 'Πρόεδρος', 'Συντονισμός της ΕΝΛ, έγκριση ετήσιου σχεδίου δράσης και εκπροσώπηση προς τη Διοίκηση.', 'regular', true, 0, null::int),
    (2, 'COM-001', 'CM-COM-001-02', 'EMP-001', 'Αντιπρόεδρος', 'Αναπλήρωση προέδρου· εκπρόσωπος Ιατρικής Υπηρεσίας.', 'regular', true, 0, null),
    (3, 'COM-001', 'CM-COM-001-03', 'EMP-003', 'Γραμματέας', 'Νοσηλευτής Επιτήρησης Λοιμώξεων (ΝΕΛ)· τήρηση πρακτικών και παρακολούθηση αποφάσεων.', 'regular', true, 0, null),
    (4, 'COM-001', 'CM-COM-001-04', 'EMP-024', 'Μέλος', 'Εκπρόσωπος ΜΕΘ· εφαρμογή δεσμών μέτρων και screening πολυανθεκτικών.', 'regular', true, 0, null),
    (5, 'COM-001', 'CM-COM-001-05', 'EMP-011', 'Μέλος', 'Εκπρόσωπος Παθολογικού Τομέα.', 'regular', true, 0, null),
    (6, 'COM-001', 'CM-COM-001-06', 'EMP-016', 'Σύμβουλος', 'Μικροβιολογικό Εργαστήριο· μηνιαία αναφορά μικροβιακής αντοχής.', 'advisor', false, 0, null),
    (7, 'COM-001', 'CM-COM-001-07', 'EMP-007', 'Μέλος', 'Εκπρόσωπος Χειρουργικού Τομέα.', 'regular', true, 0, 45),
    (8, 'COM-002', 'CM-COM-002-01', 'EMP-009', 'Πρόεδρος', 'Συντονισμός της ΕΠΑΑ και εισήγηση δεικτών ποιότητας.', 'regular', true, 0, null),
    (9, 'COM-002', 'CM-COM-002-02', 'EMP-006', 'Γραμματέας', 'Τήρηση πρακτικών και μητρώου συμβάντων.', 'regular', true, 0, null),
    (10, 'COM-002', 'CM-COM-002-03', 'EMP-001', 'Μέλος', 'Εκπρόσωπος Ιατρικής Υπηρεσίας.', 'regular', true, 0, null),
    (11, 'COM-002', 'CM-COM-002-04', 'EMP-002', 'Μέλος', 'Γραφείο Ποιότητας· παρακολούθηση CAPA.', 'regular', true, 0, null),
    (12, 'COM-002', 'CM-COM-002-05', 'EMP-008', 'Μέλος', 'Εκπρόσωπος Νοσηλευτικής Υπηρεσίας (ΜΕΘ).', 'regular', true, 0, null),
    (13, 'COM-002', 'CM-COM-002-06', 'EMP-010', 'Παρατηρητής', 'Εργαστηριακοί δείκτες ποιότητας.', 'observer', false, 30, null)
  ) m(ord, code, ck, emp, title, resp, mtype, vote, s, ended)
  join public.committees c on c.organization_id = v_org and c.code = m.code
  join public.employees e on e.organization_id = v_org and e.employee_code = m.emp
  order by m.ord
  on conflict (committee_id, client_key) where client_key is not null do nothing;

  -- Meetings: the three existing ones get the agenda shape the page reads
  -- ({id, subject, decision, followUp, action, owner, dueDate, priority}), three are new.
  v_m12 := (select m.id from public.committee_meetings m where m.committee_id = v_c1 and m.status = 'finalized' and m.client_key is null order by m.scheduled_at limit 1);
  v_m14 := (select m.id from public.committee_meetings m where m.committee_id = v_c1 and m.status = 'planned' and m.client_key is null order by m.scheduled_at limit 1);
  v_m22 := (select m.id from public.committee_meetings m where m.committee_id = v_c2 and m.status = 'planned' and m.client_key is null order by m.scheduled_at limit 1);
  v_m11 := gen_random_uuid(); v_m13 := gen_random_uuid(); v_m21 := gen_random_uuid();
  if v_m12 is null then
    v_m12 := gen_random_uuid();
    insert into public.committee_meetings(id, organization_id, committee_id, title, scheduled_at, status, meeting_type, created_by)
    values (v_m12, v_org, v_c1, 'Μηνιαία συνεδρίαση ΕΝΛ', v_t12 + time '12:00', 'finalized', 'regular', p_actor);
  end if;
  if v_m14 is null then
    v_m14 := gen_random_uuid();
    insert into public.committee_meetings(id, organization_id, committee_id, title, scheduled_at, status, meeting_type, created_by)
    values (v_m14, v_org, v_c1, 'Μηνιαία συνεδρίαση ΕΝΛ', v_t14 + time '12:00', 'planned', 'regular', p_actor);
  end if;
  if v_m22 is null then
    v_m22 := gen_random_uuid();
    insert into public.committee_meetings(id, organization_id, committee_id, title, scheduled_at, status, meeting_type, created_by)
    values (v_m22, v_org, v_c2, 'Τριμηνιαία συνεδρίαση ποιότητας', v_t22 + time '12:00', 'planned', 'regular', p_actor);
  end if;

  insert into public.committee_meetings(id, organization_id, committee_id, client_key, title, scheduled_at, status, meeting_type, location,
    minutes_number, quorum_met, agenda, minutes, finalized_at, finalized_by, created_by, created_at)
  values
    (v_m11, v_org, v_c1, 'MTG-COM-001-01', 'Μηνιαία συνεδρίαση ΕΝΛ', v_t11 + time '12:00', 'finalized', 'regular', 'Αίθουσα συσκέψεων Διοίκησης',
      '8/' || to_char(v_t11, 'YYYY'), true,
      jsonb_build_array(
        private.demo_seed_governance_topic('TOP-COM-001-01-1', 'Δείκτες λοιμώξεων (HAI) διμήνου',
          format('Καταγράφηκαν %s λοιμώξεις αίματος σχετιζόμενες με κεντρικό καθετήρα (CLABSI). Συνεχίζεται η ενεργητική επιτήρηση στη ΜΕΘ με εβδομαδιαία ανασκόπηση.', v_clabsi),
          true, 'Εβδομαδιαία ανασκόπηση CLABSI στη ΜΕΘ', n_sec1, v_t11 + 30, 'high'),
        private.demo_seed_governance_topic('TOP-COM-001-01-2', 'Δέσμη μέτρων ΚΦΚ — συμμόρφωση',
          'Επανεκπαίδευση του προσωπικού της ΜΕΘ στη δέσμη μέτρων ΚΦΚ (DOC-004) και μηνιαίος έλεγχος συμμόρφωσης.', true, 'Επανεκπαίδευση προσωπικού ΜΕΘ στη δέσμη ΚΦΚ', n_icu, v_t11 + 21, 'medium'),
        private.demo_seed_governance_topic('TOP-COM-001-01-3', 'Σημειακή μελέτη επιπολασμού (PPS)', 'Εγκρίθηκε το χρονοδιάγραμμα και η ομάδα καταγραφής της ετήσιας PPS.')),
      'Υπάρχει απαρτία. Τα πρακτικά εγκρίθηκαν από τον πρόεδρο.',
      (v_t11 + 2) + time '10:00', p_actor, p_actor, (v_t11 - 14) + time '09:00'),
    (v_m13, v_org, v_c1, 'MTG-COM-001-03', 'Έκτακτη συνεδρίαση ΕΝΛ — συρροή KPC στη ΜΕΘ', v_t13 + time '14:00', 'approval_pending', 'extraordinary', 'Αίθουσα συσκέψεων ΜΕΘ',
      '10/' || to_char(v_t13, 'YYYY'), true,
      jsonb_build_array(
        private.demo_seed_governance_topic('TOP-COM-001-03-1', 'Συρροή Klebsiella pneumoniae (KPC) στη ΜΕΘ', v_kpc_text,
          true, 'Cohorting ασθενών με KPC και αφιερωμένο νοσηλευτικό προσωπικό ανά βάρδια', n_icu, d0 - 1, 'critical'),
        private.demo_seed_governance_topic('TOP-COM-001-03-2', 'Screening εισαγωγών ΜΕΘ για CPE',
          'Ορθικό επίχρισμα για CPE σε κάθε εισαγωγή στη ΜΕΘ και εβδομαδιαία σε όλους τους νοσηλευόμενους μέχρι τη λήξη της συρροής.',
          true, 'Εφαρμογή screening CPE σε εισαγωγές και εβδομαδιαία', n_lab, d0 + 7, 'high'),
        private.demo_seed_governance_topic('TOP-COM-001-03-3', 'Ενημέρωση προσωπικού',
          'Ανακοίνωση προς όλο το προσωπικό με επιβεβαίωση γνώσης και υπενθύμιση του πρωτοκόλλου απομόνωσης (DOC-003).',
          true, 'Ανακοίνωση με επιβεβαίωση γνώσης προς όλο το προσωπικό', n_sec1, v_t13 + 1, 'medium')),
      'Έκτακτη συνεδρίαση μετά από ειδοποίηση του εργαστηρίου για πιθανό cluster. Τα πρακτικά έχουν υποβληθεί για έγκριση στα μέλη με λογαριασμό.',
      null, null, p_actor, (v_t13 - 1) + time '16:00'),
    (v_m21, v_org, v_c2, 'MTG-COM-002-01', 'Τριμηνιαία συνεδρίαση ποιότητας', v_t21 + time '12:00', 'finalized', 'regular', 'Αίθουσα συσκέψεων Διοίκησης',
      '2/' || to_char(v_t21, 'YYYY'), true,
      jsonb_build_array(
        private.demo_seed_governance_topic('TOP-COM-002-01-1', 'Δείκτες ποιότητας και συμβάντα τριμήνου', 'Ανασκοπήθηκαν οι δείκτες· προτεραιότητα στις πτώσεις ασθενών και στα λάθη φαρμακευτικής αγωγής.'),
        private.demo_seed_governance_topic('TOP-COM-002-01-2', 'Πρόγραμμα πρόληψης πτώσεων',
          'Εκπαίδευση του νοσηλευτικού προσωπικού στην εκτίμηση κινδύνου πτώσης.', true, 'Εκπαίδευση προσωπικού στην πρόληψη πτώσεων', n_sec2, v_t21 + 30, 'medium'),
        private.demo_seed_governance_topic('TOP-COM-002-01-3', 'Ασφάλεια φαρμάκων υψηλού κινδύνου',
          'Κατάρτιση λίστας φαρμάκων υψηλού κινδύνου ανά τμήμα σε συνεργασία με το Φαρμακείο.', true, 'Λίστα φαρμάκων υψηλού κινδύνου ανά τμήμα', n_qual, v_t21 + 21, 'high'),
        private.demo_seed_governance_topic('TOP-COM-002-01-4', 'Ικανοποίηση ασθενών',
          'Επανέναρξη του ερωτηματολογίου ικανοποίησης κατά το εξιτήριο.', true, 'Ερωτηματολόγιο ικανοποίησης ασθενών κατά το εξιτήριο', n_qual, d0 + 20, 'low'),
        private.demo_seed_governance_topic('TOP-COM-002-01-5', 'Ετήσια αναφορά προς τη Διοίκηση',
          'Η ετήσια αναφορά δεικτών ποιότητας θα κατατεθεί στο τέλος του έτους.', true, 'Σύνταξη ετήσιας αναφοράς δεικτών ποιότητας', n_chair2, d0 + 40, 'medium')),
      'Υπάρχει απαρτία. Εγκρίθηκε ο προγραμματισμός του επόμενου τριμήνου.',
      (v_t21 + 3) + time '10:00', p_actor, p_actor, (v_t21 - 20) + time '09:00');

  update public.committee_meetings m set
    client_key = 'MTG-COM-001-02', scheduled_at = v_t12 + time '12:00', location = 'Αίθουσα συσκέψεων Διοίκησης',
    minutes_number = '9/' || to_char(v_t12, 'YYYY'), quorum_met = true,
    agenda = jsonb_build_array(
      private.demo_seed_governance_topic('TOP-COM-001-02-1', 'Συμμόρφωση υγιεινής χεριών',
        format('Η συνολική συμμόρφωση στις παρατηρήσεις WHO είναι %s%% (στόχος 80%%). Χαμηλότερη επίδοση: %s (%s%%). Στοχευμένες παρατηρήσεις και ανατροφοδότηση.',
          coalesce(v_hh::text, '—'), coalesce(v_hh_low_dept, '—'), coalesce(v_hh_low::text, '—')),
        true, 'Στοχευμένες παρατηρήσεις υγιεινής χεριών και ανατροφοδότηση στα τμήματα με χαμηλή συμμόρφωση', n_sec1, d0 + 10, 'high'),
      private.demo_seed_governance_topic('TOP-COM-001-02-2', 'Πολυανθεκτικοί μικροοργανισμοί στη ΜΕΘ',
        'Αυξημένες απομονώσεις Klebsiella pneumoniae MDR. Αυστηρή εφαρμογή προφυλάξεων επαφής και εβδομαδιαία αναφορά από το εργαστήριο.',
        true, 'Εβδομαδιαία αναφορά πολυανθεκτικών ΜΕΘ από το Μικροβιολογικό', n_lab, d0 + 14, 'high'),
      private.demo_seed_governance_topic('TOP-COM-001-02-3', 'Πορεία CAPA ' || v_capa_kfk || ' — στερέωση ΚΦΚ',
        'Η διορθωτική ενέργεια παραμένει σε εξέλιξη· αναφορά προόδου στην επόμενη συνεδρίαση.',
        true, 'Αναφορά προόδου ' || v_capa_kfk || ' (στερέωση ΚΦΚ κατά τη μετακίνηση)', n_chair1, d0 - 3, 'high'),
      private.demo_seed_governance_topic('TOP-COM-001-02-4', 'Αναθεώρηση πρωτοκόλλου καθαρισμού (DOC-007)',
        'Η έκδοση 1.1 προωθείται για έλεγχο με τα νέα απολυμαντικά.', true, 'Έλεγχος και έγκριση DOC-007 v1.1', n_vice1, d0 + 20, 'medium')),
    minutes = 'Υπάρχει απαρτία. Ζητήθηκαν διορθώσεις στη διατύπωση του θέματος 1 πριν από την έγκριση.',
    finalized_at = (v_t12 + 3) + time '10:00', finalized_by = p_actor, created_at = (v_t12 - 14) + time '09:00'
  where m.id = v_m12;

  update public.committee_meetings m set
    client_key = 'MTG-COM-001-04', location = 'Αίθουσα συσκέψεων Διοίκησης', created_at = (d0 - 3) + time '09:00',
    agenda = jsonb_build_array(
      private.demo_seed_governance_topic('TOP-COM-001-04-1', 'Πορεία της συρροής KPC στη ΜΕΘ'),
      private.demo_seed_governance_topic('TOP-COM-001-04-2', 'Ανασκόπηση CLABSI τριμήνου'),
      private.demo_seed_governance_topic('TOP-COM-001-04-3', 'Έγκριση αναθεωρημένου πρωτοκόλλου καθαρισμού (DOC-007 v1.1)'),
      private.demo_seed_governance_topic('TOP-COM-001-04-4', 'Πρόγραμμα αντιγριπικού εμβολιασμού προσωπικού'))
  where m.id = v_m14;

  update public.committee_meetings m set
    client_key = 'MTG-COM-002-02', location = 'Αίθουσα συσκέψεων Διοίκησης', created_at = (d0 - 7) + time '09:00',
    agenda = jsonb_build_array(
      private.demo_seed_governance_topic('TOP-COM-002-02-1', format('Συμβάντα τριμήνου και πορεία CAPA (%s ανοιχτές ενέργειες)', v_capa_open)),
      private.demo_seed_governance_topic('TOP-COM-002-02-2', 'Πτώση ασθενούς — ' || v_capa_fall || ' εκτίμηση κινδύνου σε κάθε εισαγωγή'),
      private.demo_seed_governance_topic('TOP-COM-002-02-3', 'Λάθος δόσης αντιβιοτικού — ' || v_capa_abx || ' διπλός έλεγχος'),
      private.demo_seed_governance_topic('TOP-COM-002-02-4', 'Δείκτες ποιότητας τριμήνου'))
  where m.id = v_m22;

  -- Attendance: finalized meetings record every member active on that day;
  -- in the meeting awaiting approval the members without an account attend
  -- without a vote, so the evaluators' approval can finalize the minutes.
  insert into public.committee_meeting_attendance(meeting_id, committee_id, organization_id, member_id, employee_id, attendee_name,
    attendance_status, has_vote, recorded_by, client_key, created_at)
  select mt.id, mt.committee_id, v_org, cm.id, cm.employee_id, cm.member_name,
    case when mt.id = v_m13 then 'present'
         when (row_number() over (partition by mt.id order by cm.client_key) + extract(day from mt.scheduled_at)::int) % 6 = 0 then 'excused'
         else 'present' end,
    case when mt.id = v_m13 then false else cm.has_vote end,
    p_actor, 'ATT-' || cm.client_key, mt.scheduled_at + interval '2 hours'
  from public.committee_meetings mt
  join public.committee_members cm on cm.committee_id = mt.committee_id and cm.user_id is null
    and cm.started_at <= mt.scheduled_at::date and (cm.ended_at is null or cm.ended_at >= mt.scheduled_at::date)
  where mt.id in (v_m11, v_m12, v_m13, v_m21)
  on conflict do nothing;

  -- Minutes approvals: the chair's approval (the Platform Owner signs for the
  -- members without an account). The second meeting went through one revision
  -- round: the first answer asked for changes and is archived by the trigger.
  insert into public.committee_minutes_approvals(meeting_id, committee_id, organization_id, approver_id, member_id, status, comment, requested_by, requested_at, decided_at, created_at)
  select x.meeting, x.committee, v_org, p_actor,
    (select cm.id from public.committee_members cm where cm.committee_id = x.committee and cm.title = 'Πρόεδρος' and cm.user_id is null order by cm.client_key limit 1),
    x.st, x.cmt, p_actor, x.req, x.dec, x.req
  from (values
    (v_m11, v_c1, 'approved', null::text, (v_t11 + 1) + time '09:00', (v_t11 + 2) + time '09:30'),
    (v_m12, v_c1, 'rejected', 'Να διορθωθεί το ποσοστό συμμόρφωσης ανά τμήμα στο θέμα 1 και να προστεθεί η προθεσμία της ενέργειας.', (v_t12 + 1) + time '09:00', (v_t12 + 1) + time '15:00'),
    (v_m21, v_c2, 'approved', null, (v_t21 + 1) + time '09:00', (v_t21 + 3) + time '09:30'),
    (v_m13, v_c1, 'approved', null, (v_t13 + 1) + time '09:00', (v_t13 + 1) + time '12:00')
  ) x(meeting, committee, st, cmt, req, dec);
  -- Second round for meeting 2 (archives the "changes requested" answer)
  v_appr := gen_random_uuid();
  insert into public.committee_minutes_approvals(id, meeting_id, committee_id, organization_id, approver_id, member_id, status, comment, requested_by, requested_at, decided_at, created_at)
  values (v_appr, v_m12, v_c1, v_org, p_actor,
    (select cm.id from public.committee_members cm where cm.committee_id = v_c1 and cm.title = 'Πρόεδρος' and cm.user_id is null order by cm.client_key limit 1),
    'approved', null, p_actor, (v_t12 + 2) + time '09:00', (v_t12 + 3) + time '09:30', (v_t12 + 2) + time '09:00');
  update public.committee_minutes_approval_history h set archived_at = (v_t12 + 2) + time '09:00'
  where h.meeting_id = v_m12 and h.organization_id = v_org;

  -- Decisions & actions (topic_key links them to the agenda topic)
  insert into public.committee_decisions(committee_id, meeting_id, organization_id, client_key, topic_key, title, action, owner_label, due_date, priority, status, created_by, created_at, updated_at)
  select x.committee, x.meeting, v_org, x.ck, x.topic, x.title, x.action, x.owner, x.due, x.pri, x.st, p_actor, x.created, x.created
  from (values
    (v_c1, v_m11, 'DEC-COM-001-01', 'TOP-COM-001-01-1', 'Εντατικοποίηση επιτήρησης CLABSI στη ΜΕΘ', 'Εβδομαδιαία ανασκόπηση CLABSI στη ΜΕΘ με τον ΝΕΛ.', n_sec1, v_t11 + 30, 'high', 'completed', (v_t11 + 1) + time '11:00'),
    (v_c1, v_m11, 'DEC-COM-001-02', 'TOP-COM-001-01-2', 'Επανεκπαίδευση στη δέσμη μέτρων ΚΦΚ', 'Εκπαίδευση του προσωπικού της ΜΕΘ στη δέσμη ΚΦΚ (DOC-004).', n_icu, v_t11 + 21, 'medium', 'completed', (v_t11 + 1) + time '11:00'),
    (v_c1, v_m12, 'DEC-COM-001-03', 'TOP-COM-001-02-1', 'Βελτίωση συμμόρφωσης υγιεινής χεριών', 'Στοχευμένες παρατηρήσεις και ανατροφοδότηση στα τμήματα με χαμηλή συμμόρφωση (' || coalesce(v_hh_low_dept, '—') || ').', n_sec1, d0 + 10, 'high', 'in_progress', (v_t12 + 1) + time '11:00'),
    (v_c1, v_m12, 'DEC-COM-001-04', 'TOP-COM-001-02-2', 'Εβδομαδιαία αναφορά πολυανθεκτικών ΜΕΘ', 'Αναφορά του Μικροβιολογικού κάθε Δευτέρα προς ΕΝΛ και ΜΕΘ.', n_lab, d0 + 14, 'high', 'in_progress', (v_t12 + 1) + time '11:00'),
    (v_c1, v_m12, 'DEC-COM-001-05', 'TOP-COM-001-02-3', 'Παρακολούθηση ' || v_capa_kfk || ' — στερέωση ΚΦΚ', 'Αναφορά προόδου της διορθωτικής ενέργειας προς την ΕΝΛ.', n_chair1, d0 - 3, 'high', 'open', (v_t12 + 1) + time '11:00'),
    (v_c1, v_m12, 'DEC-COM-001-06', 'TOP-COM-001-02-4', 'Έγκριση αναθεωρημένου πρωτοκόλλου καθαρισμού', 'Ολοκλήρωση ελέγχου και έγκριση DOC-007 v1.1.', n_vice1, d0 + 20, 'medium', 'open', (v_t12 + 1) + time '11:00'),
    (v_c1, v_m13, 'DEC-COM-001-07', 'TOP-COM-001-03-1', 'Cohorting ασθενών με KPC στη ΜΕΘ', 'Συγκέντρωση των ασθενών με KPC σε ξεχωριστή πτέρυγα με αφιερωμένο νοσηλευτικό προσωπικό ανά βάρδια.', n_icu, d0 - 1, 'critical', 'in_progress', (v_t13) + time '17:00'),
    (v_c1, v_m13, 'DEC-COM-001-08', 'TOP-COM-001-03-2', 'Screening CPE σε εισαγωγές ΜΕΘ', 'Ορθικό επίχρισμα σε κάθε εισαγωγή και εβδομαδιαία σε όλους τους νοσηλευόμενους.', n_lab, d0 + 7, 'high', 'open', (v_t13) + time '17:00'),
    (v_c1, v_m13, 'DEC-COM-001-09', 'TOP-COM-001-03-3', 'Ενημέρωση προσωπικού για τη συρροή KPC', 'Ανακοίνωση με επιβεβαίωση γνώσης και υπενθύμιση του DOC-003.', n_sec1, v_t13 + 1, 'medium', 'completed', (v_t13) + time '17:00'),
    (v_c2, v_m21, 'DEC-COM-002-01', 'TOP-COM-002-01-2', 'Εκπαίδευση προσωπικού στην πρόληψη πτώσεων', 'Εκπαιδευτικές συναντήσεις σε όλες τις κλινικές.', n_sec2, v_t21 + 30, 'medium', 'completed', (v_t21 + 1) + time '11:00'),
    (v_c2, v_m21, 'DEC-COM-002-02', 'TOP-COM-002-01-3', 'Λίστα φαρμάκων υψηλού κινδύνου ανά τμήμα', 'Κατάρτιση με το Φαρμακείο και ανάρτηση σε κάθε φαρμακείο τμήματος.', n_qual, v_t21 + 21, 'high', 'completed', (v_t21 + 1) + time '11:00'),
    (v_c2, v_m21, 'DEC-COM-002-03', 'TOP-COM-002-01-4', 'Ερωτηματολόγιο ικανοποίησης ασθενών', 'Επανέναρξη διανομής κατά το εξιτήριο και μηνιαία ανάλυση.', n_qual, d0 + 20, 'low', 'in_progress', (v_t21 + 1) + time '11:00'),
    (v_c2, v_m21, 'DEC-COM-002-04', 'TOP-COM-002-01-5', 'Ετήσια αναφορά δεικτών ποιότητας', 'Σύνταξη και κατάθεση στη Διοίκηση.', n_chair2, d0 + 40, 'medium', 'open', (v_t21 + 1) + time '11:00')
  ) x(committee, meeting, ck, topic, title, action, owner, due, pri, st, created)
  on conflict (committee_id, client_key) where client_key is not null do nothing;

  -- Annual plan, linked to the indicator library where one fits
  insert into public.committee_plan_items(committee_id, organization_id, client_key, title, indicator, indicator_definition_id, baseline, target, owner_label, due_date, status, created_by, updated_by, created_at)
  select x.committee, v_org, x.ck, x.title,
    coalesce((select d.title_el from public.indicator_definitions d where d.organization_id is null and d.indicator_key = x.ikey and d.status = 'active' limit 1), x.itext),
    (select d.id from public.indicator_definitions d where d.organization_id is null and d.indicator_key = x.ikey and d.status = 'active' limit 1),
    x.base, x.target, x.owner, x.due, x.st, p_actor, p_actor, (v_term + 20) + time '10:00'
  from (values
    (v_c1, 'OBJ-COM-001-01', 'Συμμόρφωση υγιεινής χεριών ≥ 80% σε όλα τα τμήματα', 'hh-compliance', null::text, '68%', '80%', n_sec1, (date_trunc('year', d0) + interval '1 year - 1 day')::date, 'in_progress'),
    (v_c1, 'OBJ-COM-001-02', 'Συμμόρφωση στις δέσμες μέτρων ΚΦΚ και ουροκαθετήρα', 'bundle-compliance', null, '82%', '95%', n_icu, (date_trunc('year', d0) + interval '1 year - 1 day')::date, 'in_progress'),
    (v_c1, 'OBJ-COM-001-03', 'Περιορισμός νέων απομονώσεων MDR Klebsiella', 'mdr-isolation-klebsiella', null, '6 / τρίμηνο', '≤ 3 / τρίμηνο', n_lab, (date_trunc('year', d0) + interval '1 year - 1 day')::date, 'open'),
    (v_c1, 'OBJ-COM-001-04', 'Κατανάλωση αλκοολούχου αντισηπτικού', 'abhr-use', null, '14 L', '20 L / 1.000 ασθενοημέρες', n_sec1, (date_trunc('year', d0) + interval '1 year - 1 day')::date, 'in_progress'),
    (v_c1, 'OBJ-COM-001-05', 'Εκπαίδευση IPC ≥ 90% του κλινικού προσωπικού', 'training-completion', null, '62%', '90%', n_vice1, (date_trunc('year', d0) + interval '1 year - 1 day')::date, 'in_progress'),
    (v_c1, 'OBJ-COM-001-06', 'Αντιγριπικός εμβολιασμός προσωπικού ≥ 70%', 'vaccination-coverage', null, '48%', '70%', n_chair1, (date_trunc('year', d0) + interval '1 year - 1 day')::date, 'open'),
    (v_c1, 'OBJ-COM-001-07', 'Ετήσια σημειακή μελέτη επιπολασμού (PPS)', 'hai-prevalence-pps', null, '—', 'Ολοκλήρωση', n_sec1, d0 - 40, 'completed'),
    (v_c2, 'OBJ-COM-002-01', 'Πληρότητα αναφοράς δεικτών ΕΟΔΥ', 'eody-reporting-completeness', null, '85%', '100%', n_qual, (date_trunc('year', d0) + interval '1 year - 1 day')::date, 'in_progress'),
    (v_c2, 'OBJ-COM-002-02', 'Κλείσιμο CAPA εντός προθεσμίας', null, 'Ποσοστό CAPA που κλείνουν εντός προθεσμίας', '70%', '≥ 85%', n_qual, (date_trunc('year', d0) + interval '1 year - 1 day')::date, 'in_progress'),
    (v_c2, 'OBJ-COM-002-03', 'Μείωση πτώσεων ασθενών κατά 30%', null, 'Πτώσεις ανά 1.000 ασθενοημέρες', '1,8', '1,2', n_sec2, (date_trunc('year', d0) + interval '1 year - 1 day')::date, 'open'),
    (v_c2, 'OBJ-COM-002-04', 'Ετήσια αναφορά δεικτών ποιότητας', null, null, '—', 'Κατάθεση στη Διοίκηση', n_chair2, d0 + 40, 'open')
  ) x(committee, ck, title, ikey, itext, base, target, owner, due, st)
  on conflict (committee_id, client_key) where client_key is not null do nothing;

  -- Committee documents: controlled documents linked to each committee
  insert into public.committee_documents(committee_id, organization_id, document_id, document_kind, created_by, created_at)
  select x.committee, v_org, cd.id, x.kind, p_actor, (v_term + 10) + time '10:00'
  from (values (v_c1, 'DOC-001', 'establishment'), (v_c1, 'DOC-003', 'evidence'), (v_c1, 'DOC-007', 'decision'), (v_c2, 'DOC-006', 'evidence')) x(committee, code, kind)
  join public.controlled_documents cd on cd.organization_id = v_org and cd.code = x.code;

  -- History, oldest first (the page lists the rows as loaded)
  insert into public.committee_history(committee_id, organization_id, action, reason, event_data, actor_id, created_at)
  select h.committee, v_org, h.action, h.reason, h.data, p_actor, h.at
  from (
    select c.id as committee, 'Σύσταση επιτροπής' as action, c.decision_number as reason, jsonb_build_object('code', c.code) as data, v_term + time '09:00' as at
    from public.committees c where c.id in (v_c1, v_c2)
    union all
    select c.id, 'Ενημέρωση θεσμικού πλαισίου', c.decision_number, '{}'::jsonb, (v_term + 1) + time '09:00' from public.committees c where c.id in (v_c1, v_c2)
    union all
    select cm.committee_id, 'Προσθήκη μέλους', cm.member_name || ' — ' || cm.title, jsonb_build_object('member_id', cm.id, 'client_key', cm.client_key), cm.started_at + time '10:00'
    from public.committee_members cm where cm.committee_id in (v_c1, v_c2) and cm.user_id is null
    union all
    select p.committee_id, 'Προσθήκη στόχου ετήσιου σχεδίου', p.title, jsonb_build_object('plan_item_id', p.id, 'client_key', p.client_key), p.created_at
    from public.committee_plan_items p where p.committee_id in (v_c1, v_c2)
    union all
    select m.committee_id, 'Δημιουργία συνεδρίασης', m.title, jsonb_build_object('meeting_id', m.id, 'client_key', m.client_key), m.created_at
    from public.committee_meetings m where m.committee_id in (v_c1, v_c2)
    union all
    select m.committee_id, 'Υποβολή πρακτικών για έγκριση', m.title, jsonb_build_object('meeting_id', m.id, 'approval_count', 1), m.scheduled_at + interval '20 hours'
    from public.committee_meetings m where m.id in (v_m11, v_m12, v_m13, v_m21)
    union all
    select v_c1, 'Αίτημα διορθώσεων πρακτικών', 'Να διορθωθεί το ποσοστό συμμόρφωσης ανά τμήμα στο θέμα 1 και να προστεθεί η προθεσμία της ενέργειας.',
      jsonb_build_object('meeting_id', v_m12, 'revision_required', true), (v_t12 + 1) + time '15:00'
    union all
    select v_c1, 'Υποβολή πρακτικών για έγκριση', 'Μηνιαία συνεδρίαση ΕΝΛ — διορθωμένα πρακτικά', jsonb_build_object('meeting_id', v_m12, 'approval_count', 1), (v_t12 + 2) + time '09:00'
    union all
    select m.committee_id, 'Οριστικοποίηση πρακτικών', 'Όλες οι απαιτούμενες εγκρίσεις ολοκληρώθηκαν', jsonb_build_object('meeting_id', m.id, 'auto_finalized', true), m.finalized_at
    from public.committee_meetings m where m.id in (v_m11, v_m12, v_m21)
    union all
    select d.committee_id, 'Καταχώρηση απόφασης', d.title, jsonb_build_object('decision_id', d.id, 'client_key', d.client_key), d.created_at + interval '10 minutes'
    from public.committee_decisions d where d.committee_id in (v_c1, v_c2)
    union all
    select d.committee_id, 'Ενημέρωση απόφασης / ενέργειας', d.title, jsonb_build_object('decision_id', d.id, 'status', d.status), least(d.due_date - 2, d0 - 1) + time '13:00'
    from public.committee_decisions d where d.committee_id in (v_c1, v_c2) and d.status = 'completed'
    union all
    select cm.committee_id, 'Λήξη συμμετοχής μέλους', cm.member_name || ' — Μακροχρόνια άδεια', jsonb_build_object('member_id', cm.id, 'reason', 'Μακροχρόνια άδεια'), cm.ended_at + time '10:00'
    from public.committee_members cm where cm.committee_id in (v_c1, v_c2) and cm.ended_at is not null
  ) h
  order by h.at;
end;
$function$;

-- 2. Controlled documents: version history -------------------------------------
-- In the app a revision is a new row with the next free code whose
-- revision_of_id / supersedes_id point at the version it replaces; the family
-- is shown under its first version's code. Here the earlier versions are added
-- behind five of the existing documents (which keep their codes and links).
create or replace function private.demo_seed_governance_documents(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := current_date;
  v_next int;
  v_role public.app_role := case when exists (select 1 from public.profiles p where p.id = p_actor and coalesce(p.is_platform_owner, false))
    then 'platform_owner'::public.app_role
    else (select om.role from public.organization_members om where om.organization_id = p_organization_id and om.user_id = p_actor and om.status = 'active' limit 1) end;
  r record;
begin
  if not exists (select 1 from public.controlled_documents cd where cd.organization_id = v_org and cd.code = 'DOC-001') then
    return;
  end if;
  -- Idempotent: done once DOC-001 points at its previous version.
  if exists (select 1 from public.controlled_documents cd where cd.organization_id = v_org and cd.code = 'DOC-001' and cd.revision_of_id is not null) then
    return;
  end if;
  v_next := (select coalesce(max((substring(cd.code from 'DOC-(\d+)'))::int), 0) + 1 from public.controlled_documents cd where cd.organization_id = v_org);

  -- Earlier versions, oldest first so each one can point at its predecessor.
  for r in
    select x.*, cur.title, cur.document_type, cur.description cur_descr, cur.audience
    from (values
      (1, 'DOC-001', '1.0', 1095, 480, null::int, 'Πρώτη έκδοση της πολιτικής ελέγχου λοιμώξεων.', null::text),
      (2, 'DOC-001', '2.0', 480, 120, 1, 'Πολιτική ελέγχου λοιμώξεων — έκδοση με τη νέα σύνθεση της ΕΝΛ.', 'Ενσωμάτωση των οδηγιών ΕΟΔΥ για τα CPE και της νέας σύνθεσης της ΕΝΛ.'),
      (3, 'DOC-002', '2.0', 455, 90, null, 'Οι 5 στιγμές υγιεινής χεριών — έκδοση 2.0.', null),
      (4, 'DOC-003', '1.3', 400, 75, null, 'Προφυλάξεις επαφής, σταγονιδίων και αερογενούς μετάδοσης — έκδοση 1.3.', null),
      (5, 'DOC-006', '1.0', 500, 30, null, 'Αρχές ορθολογικής χρήσης αντιβιοτικών — πρώτη έκδοση.', null),
      (6, 'DOC-007', '1.0', 380, null, null, 'Καθαρισμός και απολύμανση χώρων — ισχύουσα έκδοση μέχρι τη δημοσίευση της αναθεώρησης.', null)
    ) x(n, base_code, ver, pub_ago, sup_ago, prev_n, descr, reason)
    join public.controlled_documents cur on cur.organization_id = v_org and cur.code = x.base_code
    order by x.n
  loop
    insert into public.controlled_documents(organization_id, code, title, document_type, department_id, audience, status, version, description,
      revision_of_id, supersedes_id, revision_reason, effective_date, review_date, published_at, published_by, approved_at, approved_by,
      created_by, updated_by, created_at)
    values (v_org, 'DOC-' || lpad((v_next + r.n - 1)::text, 3, '0'), r.title, r.document_type, null, r.audience,
      case when r.sup_ago is null then 'published' else 'superseded' end, r.ver, r.descr,
      case when r.prev_n is not null then (select cd.id from public.controlled_documents cd where cd.organization_id = v_org and cd.code = 'DOC-' || lpad((v_next + r.prev_n - 1)::text, 3, '0')) end,
      case when r.prev_n is not null then (select cd.id from public.controlled_documents cd where cd.organization_id = v_org and cd.code = 'DOC-' || lpad((v_next + r.prev_n - 1)::text, 3, '0')) end,
      r.reason, d0 - r.pub_ago, d0 - r.pub_ago + 365, (d0 - r.pub_ago) + time '09:00', p_actor, (d0 - r.pub_ago) + time '08:00', p_actor,
      p_actor, p_actor, (d0 - r.pub_ago - 25) + time '10:00');
  end loop;

  -- The existing versions point at the version they replaced; their creation
  -- dates move before their publication.
  update public.controlled_documents cd set
    revision_of_id = x.prev_id, supersedes_id = x.prev_id, revision_reason = coalesce(x.reason, cd.revision_reason),
    created_at = coalesce((cd.published_at - interval '25 days'), (d0 - x.draft_ago) + time '10:00'),
    updated_by = p_actor
  from (
    select cur.id, prev.id prev_id, v.reason, v.draft_ago
    from (values
      ('DOC-001', 2, 'Ετήσια αναθεώρηση σύμφωνα με τα WHO IPC Core Components· ρόλοι ΟΕΕ και κλινικών συνδέσμων.', 0),
      ('DOC-002', 3, 'Αξιολόγηση με το εργαλείο WHO HHSAF και ετήσιος στόχος συμμόρφωσης 80%.', 0),
      ('DOC-003', 4, 'Προσθήκη προφυλάξεων για KPC / CPE και κριτηρίων άρσης της απομόνωσης.', 0),
      ('DOC-004', null, null, 0),
      ('DOC-005', null, null, 0),
      ('DOC-006', 5, 'Νέος κατάλογος αντιβιοτικών περιορισμένης χορήγησης με έγκριση από την ΟΕΚΟΧΑ.', 0),
      ('DOC-007', 6, 'Αναθεώρηση για τα νέα απολυμαντικά και τον καθαρισμό θαλάμων απομόνωσης.', 18),
      ('DOC-008', null, null, 9)
    ) v(code, prev_n, reason, draft_ago)
    join public.controlled_documents cur on cur.organization_id = v_org and cur.code = v.code
    left join public.controlled_documents prev on prev.organization_id = v_org and v.prev_n is not null
      and prev.code = 'DOC-' || lpad((v_next + v.prev_n - 1)::text, 3, '0')
  ) x
  where cd.id = x.id;

  -- Audit trail for the Versions tab (system_audit_log, entity controlled_documents).
  -- The trigger stamped the inserts and the update above with the time of the
  -- seed: move them to the document's own dates, then add the workflow steps.
  update public.system_audit_log a set created_at = cd.created_at
  from public.controlled_documents cd
  where cd.organization_id = v_org and a.organization_id = v_org and a.entity_type = 'controlled_documents'
    and a.event_type = 'insert' and a.entity_id = cd.id::text;
  update public.system_audit_log a set created_at = cd.created_at + interval '1 day',
    metadata = a.metadata || jsonb_build_object('old_status', 'draft', 'new_status', 'draft')
  from public.controlled_documents cd
  where cd.organization_id = v_org and a.organization_id = v_org and a.entity_type = 'controlled_documents'
    and a.event_type = 'update' and a.entity_id = cd.id::text and a.created_at = now();

  insert into public.system_audit_log(organization_id, actor_user_id, actor_role, event_type, entity_type, entity_id, metadata, created_at)
  select v_org, p_actor, v_role, 'update', 'controlled_documents', cd.id::text,
    jsonb_build_object('source', 'management_center', 'operation', 'UPDATE', 'organization_id', v_org, 'code', cd.code, 'version', cd.version,
      'old_status', s.old_status, 'new_status', s.new_status), s.ts
  from public.controlled_documents cd
  cross join lateral (values
    ('draft', 'review', cd.created_at + interval '5 days', cd.status <> 'draft'),
    ('review', 'approved', cd.approved_at, cd.status in ('approved', 'published', 'superseded') and cd.approved_at is not null),
    ('approved', 'published', cd.published_at, cd.status in ('published', 'superseded') and cd.published_at is not null),
    ('published', 'superseded', (select nx.published_at from public.controlled_documents nx where nx.supersedes_id = cd.id limit 1), cd.status = 'superseded')
  ) s(old_status, new_status, ts, wanted)
  where cd.organization_id = v_org and s.wanted and s.ts is not null;
end;
$function$;

-- 3. Announcements and document distributions ----------------------------------
create or replace function private.demo_seed_governance_announcements(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := current_date;
  v_hh numeric := (select round(100.0 * sum(s.compliant_observations) / nullif(sum(s.observations), 0), 1) from public.hand_hygiene_sessions s where s.organization_id = p_organization_id);
  v_meeting date := (select m.scheduled_at::date from public.committee_meetings m join public.committees c on c.id = m.committee_id
    where c.organization_id = p_organization_id and c.code = 'COM-001' and m.status = 'planned' order by m.scheduled_at limit 1);
begin
  -- General announcements (the bell shows the ones inside their display window)
  insert into public.management_announcements(organization_id, title, message, priority, audience_type, audience_values, requires_ack,
    starts_at, ends_at, created_by, updated_by, created_at, updated_at, link_path)
  select v_org, x.title, x.msg, x.pri, x.aud, x.vals, x.ack, x.starts, x.ends, p_actor, p_actor, x.created, x.created, x.link
  from (values
    ('Συρροή KPC στη ΜΕΘ — ενισχυμένα μέτρα επαφής',
     'Η ΕΝΛ ενεργοποίησε το σχέδιο διαχείρισης συρροής για Klebsiella pneumoniae (KPC) στη ΜΕΘ: προφυλάξεις επαφής, cohorting, screening CPE σε κάθε εισαγωγή και αυστηρή υγιεινή χεριών. Επιβεβαιώστε ότι λάβατε γνώση.',
     'critical', 'all', '[]'::jsonb, true, null::timestamptz, null::timestamptz, (d0 - 5) + time '08:30', '/surveillance'),
    ('Εβδομάδα υγιεινής χεριών',
     format('Η συμμόρφωση στις παρατηρήσεις WHO είναι σήμερα %s%% (στόχος 80%%). Κατά την εβδομάδα θα γίνουν παρατηρήσεις σε όλα τα τμήματα.', coalesce(v_hh::text, '—')),
     'normal', 'all', '[]'::jsonb, false, (d0 - 12) + time '08:00', (d0 + 10) + time '20:00', (d0 - 12) + time '08:00', '/prevention'),
    ('Έναρξη αντιγριπικού εμβολιασμού προσωπικού',
     'Ο εμβολιασμός γίνεται στο Ιατρείο Εργασίας καθημερινά 08:00–14:00. Στόχος της ΕΝΛ για φέτος: κάλυψη ≥ 70%.',
     'high', 'all', '[]'::jsonb, false, (d0 - 3) + time '08:00', (d0 + 45) + time '20:00', (d0 - 3) + time '08:00', '/occupational-health'),
    ('Συνεδρίαση ΕΝΛ ' || coalesce(to_char(v_meeting, 'DD/MM/YYYY'), ''),
     'Η επόμενη τακτική συνεδρίαση της Επιτροπής Νοσοκομειακών Λοιμώξεων θα γίνει στην αίθουσα συσκέψεων της Διοίκησης στις 12:00. Θέματα: συρροή KPC, CLABSI τριμήνου, πρωτόκολλο καθαρισμού.',
     'normal', 'role', '["hospital_admin","infection_control_lead","infection_control_member","committee_secretariat","quality_manager"]'::jsonb, false, null, null, (d0 - 2) + time '10:00', '/committees/COM-001'),
    ('Νέα εκπαιδευτική ενότητα: πολυανθεκτικά (KPC / CPE)',
     'Στο Κέντρο Εκπαίδευσης είναι διαθέσιμη η ενότητα για τα πολυανθεκτικά Gram-αρνητικά και τις προφυλάξεις επαφής.',
     'normal', 'role', '["hospital_admin","infection_control_lead","infection_control_member","department_manager","link_nurse","department_user"]'::jsonb, false, null, null, (d0 - 20) + time '09:00', '/training'),
    ('Διακοπή ηλεκτροδότησης πτέρυγας Β',
     'Προγραμματισμένη εργασία της Τεχνικής Υπηρεσίας· τα ψυγεία φαρμάκων μεταφέρθηκαν προσωρινά.',
     'normal', 'all', '[]'::jsonb, false, (d0 - 40) + time '07:00', (d0 - 37) + time '20:00', (d0 - 41) + time '12:00', null),
    ('Άσκηση ετοιμότητας για επιδημική έξαρση',
     'Άσκηση επί χάρτου της ΕΝΛ με τα τμήματα ΜΕΘ, Παθολογική και Χειρουργική.',
     'high', 'all', '[]'::jsonb, false, (d0 + 3) + time '08:00', (d0 + 10) + time '20:00', (d0 - 1) + time '11:00', '/committees/COM-001')
  ) x(title, msg, pri, aud, vals, ack, starts, ends, created, link)
  where not exists (select 1 from public.management_announcements a where a.organization_id = v_org and a.title = x.title);

  -- Document distributions: a required acknowledgement whose link_path is the
  -- document (what DocumentDistributionPanel creates and the log reads).
  insert into public.management_announcements(organization_id, title, message, priority, audience_type, audience_values, requires_ack,
    created_by, updated_by, created_at, updated_at, link_path)
  select v_org, 'Δημοσιευμένο έγγραφο: ' || cd.title,
    format('Το έγγραφο «%s» (%s · v%s) δημοσιεύτηκε%s και απαιτεί επιβεβαίωση ανάγνωσης.', cd.title, cd.code, cd.version, x.scope_label),
    'normal', x.aud, x.vals, true, p_actor, p_actor, cd.published_at + interval '2 hours', cd.published_at + interval '2 hours', '/documents/' || cd.code
  from (values
    ('DOC-001', 'all', '[]'::jsonb, ''),
    ('DOC-002', 'all', '[]'::jsonb, ''),
    ('DOC-003', 'all', '[]'::jsonb, ''),
    ('DOC-004', 'role', '["hospital_admin","infection_control_lead","infection_control_member","department_manager","link_nurse","department_user"]'::jsonb, ' για τους ρόλους κλινικής φροντίδας'),
    ('DOC-005', 'all', '[]'::jsonb, ''),
    ('DOC-006', 'all', '[]'::jsonb, '')
  ) x(code, aud, vals, scope_label)
  join public.controlled_documents cd on cd.organization_id = v_org and cd.code = x.code and cd.status = 'published' and cd.published_at is not null
  where not exists (select 1 from public.management_announcements a where a.organization_id = v_org and a.link_path = '/documents/' || cd.code and a.requires_ack);
end;
$function$;

-- 5. One account in the Demo: committee roles, pending items and acknowledgements
-- Idempotent and independent of auth.uid(), so it can also run right after a
-- new evaluator is created (create-demo-access writes the data pack first).
create or replace function private.demo_seed_governance_member(p_organization_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := current_date;
  v_role text := (select om.role::text from public.organization_members om
    where om.organization_id = p_organization_id and om.user_id = p_user_id and om.status = 'active' order by om.created_at limit 1);
  v_rank int := (select x.rn from (select om.user_id, row_number() over (order by om.created_at, om.user_id) rn
    from public.organization_members om where om.organization_id = p_organization_id and om.status = 'active' and om.user_id is not null) x where x.user_id = p_user_id);
  v_emp uuid := (select e.id from public.employees e where e.organization_id = p_organization_id and e.user_id = p_user_id order by e.created_at limit 1);
  v_name text;
  v_c1 uuid := (select c.id from public.committees c where c.organization_id = p_organization_id and c.code = 'COM-001');
  v_c2 uuid := (select c.id from public.committees c where c.organization_id = p_organization_id and c.code = 'COM-002');
  v_m12 uuid := (select m.id from public.committee_meetings m where m.committee_id = v_c1 and m.client_key = 'MTG-COM-001-02');
  v_m13 uuid := (select m.id from public.committee_meetings m where m.committee_id = v_c1 and m.client_key = 'MTG-COM-001-03');
  v_mem1 uuid; v_mem2 uuid; v_appr uuid; v_title text; v_requester uuid;
begin
  if v_role is null or v_c1 is null or v_c2 is null then
    return;
  end if;
  v_name := coalesce(
    (select nullif(btrim(e.first_name || ' ' || e.last_name), '') from public.employees e where e.id = v_emp),
    (select nullif(btrim(p.full_name), '') from public.profiles p where p.id = p_user_id),
    'Χρήστης Demo');
  v_title := case v_role
    when 'hospital_admin' then 'Εκπρόσωπος Διοίκησης'
    when 'infection_control_lead' then 'Νοσηλευτής/τρια Επιτήρησης Λοιμώξεων (ΝΕΛ)'
    when 'infection_control_member' then 'Μέλος ομάδας IPC'
    when 'quality_manager' then 'Εκπρόσωπος Ποιότητας'
    when 'pharmacy' then 'Εκπρόσωπος Φαρμακείου'
    when 'laboratory' then 'Μικροβιολόγος / Εργαστήριο'
    when 'occupational_physician' then 'Ιατρός Εργασίας'
    when 'committee_secretariat' then 'Γραμματειακή υποστήριξη'
    else 'Μέλος' end;

  -- ΕΝΛ: approved member (gets the committee_member add-on through the trigger)
  insert into public.committee_members(committee_id, organization_id, employee_id, user_id, member_name, title, responsibilities, member_type, has_vote,
    approval_status, started_at, client_key, created_at)
  values (v_c1, v_org, v_emp, p_user_id, v_name, v_title, 'Συμμετοχή στις αποφάσεις και έγκριση πρακτικών μέσω της πλατφόρμας.', 'regular', true,
    'approved', d0 - 60, 'CM-COM-001-U-' || p_user_id::text, (d0 - 60) + time '10:00')
  on conflict (committee_id, client_key) where client_key is not null do nothing;
  -- ΕΠΑΑ: invitation waiting for the user's answer (bell: "Αποδοχή συμμετοχής σε επιτροπή")
  insert into public.committee_members(committee_id, organization_id, employee_id, user_id, member_name, title, responsibilities, member_type, has_vote,
    approval_status, started_at, client_key, created_at)
  values (v_c2, v_org, v_emp, p_user_id, v_name, 'Μέλος', 'Παρακολούθηση δεικτών ποιότητας και CAPA.', 'regular', true,
    'pending', d0 - 2, 'CM-COM-002-U-' || p_user_id::text, (d0 - 2) + time '10:00')
  on conflict (committee_id, client_key) where client_key is not null do nothing;
  v_mem1 := (select cm.id from public.committee_members cm where cm.committee_id = v_c1 and cm.client_key = 'CM-COM-001-U-' || p_user_id::text);
  v_mem2 := (select cm.id from public.committee_members cm where cm.committee_id = v_c2 and cm.client_key = 'CM-COM-002-U-' || p_user_id::text);

  if v_mem1 is not null and not exists (select 1 from public.committee_history h where h.committee_id = v_c1 and h.event_data->>'member_id' = v_mem1::text) then
    insert into public.committee_history(committee_id, organization_id, action, reason, event_data, actor_id, created_at)
    values (v_c1, v_org, 'Προσθήκη μέλους', v_name || ' — ' || v_title, jsonb_build_object('member_id', v_mem1), p_user_id, (d0 - 60) + time '10:00');
  end if;
  if v_mem2 is not null and not exists (select 1 from public.committee_history h where h.committee_id = v_c2 and h.event_data->>'member_id' = v_mem2::text) then
    insert into public.committee_history(committee_id, organization_id, action, reason, event_data, actor_id, created_at)
    values (v_c2, v_org, 'Προσθήκη μέλους', v_name || ' — Μέλος (αναμένεται αποδοχή)', jsonb_build_object('member_id', v_mem2), p_user_id, (d0 - 2) + time '10:00');
  end if;

  if v_mem1 is not null and v_m12 is not null then
    -- Present at the last monthly meeting, approved its minutes
    insert into public.committee_meeting_attendance(meeting_id, committee_id, organization_id, member_id, employee_id, attendee_name, attendance_status, has_vote, recorded_by, client_key, created_at)
    select m.id, m.committee_id, v_org, v_mem1, v_emp, v_name, 'present', true, m.created_by, 'ATT-CM-COM-001-U-' || p_user_id::text, m.scheduled_at + interval '2 hours'
    from public.committee_meetings m where m.id = v_m12
    on conflict do nothing;
    if not exists (select 1 from public.committee_minutes_approvals a where a.meeting_id = v_m12 and a.approver_id = p_user_id) then
      insert into public.committee_minutes_approvals(meeting_id, committee_id, organization_id, approver_id, member_id, status, requested_by, requested_at, decided_at, created_at)
      select m.id, m.committee_id, v_org, p_user_id, v_mem1, 'approved', m.created_by, m.finalized_at - interval '25 hours', m.finalized_at - interval '2 hours', m.finalized_at - interval '25 hours'
      from public.committee_meetings m where m.id = v_m12 and m.finalized_at is not null;
    end if;
  end if;

  if v_mem1 is not null and v_m13 is not null then
    -- Present at the extraordinary meeting; its minutes wait for this user's approval (bell)
    insert into public.committee_meeting_attendance(meeting_id, committee_id, organization_id, member_id, employee_id, attendee_name, attendance_status, has_vote, recorded_by, client_key, created_at)
    select m.id, m.committee_id, v_org, v_mem1, v_emp, v_name, 'present', true, m.created_by, 'ATT-CM-COM-001-U-' || p_user_id::text, m.scheduled_at + interval '2 hours'
    from public.committee_meetings m where m.id = v_m13
    on conflict do nothing;
    if not exists (select 1 from public.committee_minutes_approvals a where a.meeting_id = v_m13 and a.approver_id = p_user_id)
       and exists (select 1 from public.committee_meetings m where m.id = v_m13 and m.status = 'approval_pending') then
      v_appr := gen_random_uuid();
      v_requester := (select m.created_by from public.committee_meetings m where m.id = v_m13);
      insert into public.committee_minutes_approvals(id, meeting_id, committee_id, organization_id, approver_id, member_id, status, requested_by, requested_at, created_at)
      select v_appr, m.id, m.committee_id, v_org, p_user_id, v_mem1, 'pending', v_requester, m.scheduled_at + interval '19 hours', m.scheduled_at + interval '19 hours'
      from public.committee_meetings m where m.id = v_m13;
      -- The request is visible in the bell; no e-mail is sent for Demo data.
      update public.notification_outbox o set status = 'cancelled', updated_at = now(), last_error = null
      where o.organization_id = v_org and o.entity_type = 'committee_minutes_approval' and o.entity_id = v_appr and o.status in ('pending', 'failed');
    end if;
  end if;

  -- The first account owns the CPE screening action (DecisionDialog matches the owner by user)
  if v_rank = 1 then
    update public.committee_decisions d set owner_id = p_user_id, owner_label = v_name
    where d.committee_id = v_c1 and d.client_key = 'DEC-COM-001-08' and d.owner_id is null;
  end if;

  -- Read acknowledgements: older distributions mostly read, the newest one and the
  -- KPC alert still waiting (bell + acknowledgement log progress).
  insert into public.management_announcement_acknowledgements(announcement_id, organization_id, user_id, acknowledged_at)
  select x.id, v_org, p_user_id, least(x.created_at + ((coalesce(v_rank, 1) * 5 + x.rn * 3) || ' hours')::interval, now() - interval '1 hour')
  from (
    select a.id, a.created_at, row_number() over (order by a.created_at) rn, count(*) over () cnt
    from public.management_announcements a
    where a.organization_id = v_org and a.requires_ack and a.link_path like '/documents/%'
      and (a.audience_type = 'all' or (a.audience_type = 'role' and a.audience_values ? v_role) or (a.audience_type = 'user' and a.audience_values ? p_user_id::text))
  ) x
  where x.rn < x.cnt and (x.rn + coalesce(v_rank, 1)) % 4 <> 0
  on conflict (announcement_id, user_id) do nothing;
end;
$function$;

-- 4. Every account already in the Demo (a "Reset data" keeps the evaluators)
create or replace function private.demo_seed_governance_members(p_organization_id uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  r record;
begin
  for r in
    select om.user_id from public.organization_members om
    where om.organization_id = p_organization_id and om.status = 'active' and om.user_id is not null
    order by om.created_at, om.user_id
  loop
    perform private.demo_seed_governance_member(p_organization_id, r.user_id);
  end loop;
end;
$function$;

create or replace function private.demo_seed_governance(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
begin
  if not exists (select 1 from public.organizations o where o.id = p_organization_id and o.is_demo) then
    raise exception 'Only Demo organizations can be filled with Demo data' using errcode = '42501';
  end if;
  perform private.demo_seed_governance_committees(p_organization_id, p_actor);
  perform private.demo_seed_governance_documents(p_organization_id, p_actor);
  perform private.demo_seed_governance_announcements(p_organization_id, p_actor);
  perform private.demo_seed_governance_members(p_organization_id);
end;
$function$;

revoke all on function private.demo_seed_governance_topic(text, text, text, boolean, text, text, date, text) from public, anon, authenticated;
revoke all on function private.demo_seed_governance_committees(uuid, uuid) from public, anon, authenticated;
revoke all on function private.demo_seed_governance_documents(uuid, uuid) from public, anon, authenticated;
revoke all on function private.demo_seed_governance_announcements(uuid, uuid) from public, anon, authenticated;
revoke all on function private.demo_seed_governance_member(uuid, uuid) from public, anon, authenticated;
revoke all on function private.demo_seed_governance_members(uuid) from public, anon, authenticated;
revoke all on function private.demo_seed_governance(uuid, uuid) from public, anon, authenticated;


-- Month to date: patient days of the current month up to today, at each
-- department's rate of last month, so the default indicator period has a
-- denominator.
create or replace function private.demo_seed_current_month(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_start date := date_trunc('month', current_date)::date;
  v_last date := (date_trunc('month', current_date) - interval '1 month')::date;
begin
  insert into public.patient_day_periods(organization_id, department_id, period_start, period_end, patient_days, source, review_status, notes, created_by, updated_by)
  select p_organization_id, prev.department_id, v_start, current_date,
    greatest(1, round(prev.patient_days::numeric / extract(day from (v_start - 1))::int * (current_date - v_start + 1))::int),
    'manual', 'reviewable', 'Demo · μέχρι σήμερα', p_actor, p_actor
  from public.patient_day_periods prev
  where prev.organization_id = p_organization_id and prev.period_start = v_last
    and not exists (select 1 from public.patient_day_periods x where x.organization_id = p_organization_id and x.department_id = prev.department_id and x.period_start = v_start);
end;
$function$;
revoke all on function private.demo_seed_current_month(uuid, uuid) from public, anon, authenticated;

-- Orchestrator: the existing pack, then the complete data.
create or replace function private.demo_seed_data(p_organization_id uuid, p_actor uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
begin
  if p_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations o where o.id = v_org and o.is_demo) then
    raise exception 'Only Demo organizations can be filled with Demo data' using errcode = '42501';
  end if;
  perform set_config('limoxis.test_reset', 'on', true);
  perform private.demo_seed_departments_patients(v_org, p_actor);
  perform private.demo_seed_surveillance(v_org, p_actor);
  perform private.demo_seed_laboratory(v_org, p_actor);
  perform private.demo_seed_microbiology(v_org, p_actor);
  perform private.demo_seed_susceptibility(v_org, p_actor);
  perform private.demo_seed_hand_hygiene_employees(v_org, p_actor);
  perform private.demo_seed_patient_days(v_org, p_actor);
  perform private.demo_seed_incidents(v_org, p_actor);
  perform private.demo_seed_capa(v_org, p_actor);
  perform private.demo_seed_documents(v_org, p_actor);
  perform private.demo_seed_committees(v_org, p_actor);
  perform private.demo_seed_controls(v_org, p_actor);
  perform private.demo_seed_training(v_org, p_actor);
  perform private.demo_seed_pharmacy(v_org, p_actor);
  perform private.demo_seed_occupational_health(v_org, p_actor);
  perform private.demo_seed_prevention(v_org, p_actor);
  -- Full, coherent data in every screen (20261018120000).
  perform private.demo_seed_clinical(v_org, p_actor);
  perform private.demo_seed_current_month(v_org, p_actor);
  perform private.demo_seed_quality(v_org, p_actor);
  perform private.demo_seed_people_clinical_scales(v_org, p_actor);
  perform private.demo_seed_people_training(v_org, p_actor);
  perform private.demo_seed_people_employees(v_org, p_actor);
  perform private.demo_seed_people_occupational_health(v_org, p_actor);
  perform private.demo_seed_governance(v_org, p_actor);
  return jsonb_build_object(
    'ok', true,
    'departments', (select count(*) from public.departments x where x.organization_id = v_org),
    'patients', (select count(*) from public.patients x where x.organization_id = v_org),
    'surveillanceCases', (select count(*) from public.surveillance_cases x where x.organization_id = v_org),
    'laboratorySamples', (select count(*) from public.laboratory_samples x where x.organization_id = v_org),
    'microbiologyResults', (select count(*) from public.microbiology_results x where x.organization_id = v_org),
    'handHygieneSessions', (select count(*) from public.hand_hygiene_sessions x where x.organization_id = v_org),
    'employees', (select count(*) from public.employees x where x.organization_id = v_org),
    'incidents', (select count(*) from public.quality_incidents x where x.organization_id = v_org),
    'capa', (select count(*) from public.quality_capa_actions x where x.organization_id = v_org),
    'documents', (select count(*) from public.controlled_documents x where x.organization_id = v_org),
    'committees', (select count(*) from public.committees x where x.organization_id = v_org),
    'controls', (select count(*) from public.control_definitions x where x.organization_id = v_org),
    'controlExecutions', (select count(*) from public.control_executions x where x.organization_id = v_org),
    'trainingPrograms', (select count(*) from public.training_records x where x.organization_id = v_org and x.record_type = 'program'),
    'trainingAssignments', (select count(*) from public.training_records x where x.organization_id = v_org and x.record_type = 'assignment'),
    'antibioticDispensing', (select count(*) from public.antibiotic_dispensing_periods x where x.organization_id = v_org),
    'vaccinations', (select count(*) from public.employee_vaccinations x where x.organization_id = v_org),
    'occupationalVisits', (select count(*) from public.occupational_health_visits x where x.organization_id = v_org),
    'exposures', (select count(*) from public.occupational_exposure_incidents x where x.organization_id = v_org),
    'wasteRecords', (select count(*) from public.waste_measurements x where x.organization_id = v_org),
    'antisepticRecords', (select count(*) from public.antiseptic_consumption_periods x where x.organization_id = v_org),
    'bundleAudits', (select count(*) from public.prevention_bundle_assessments x where x.organization_id = v_org)
  );
end;
$function$;


-- A new evaluator (created after the data) gets the personal governance items
-- (committee membership, minutes approval, document distributions).
create or replace function public.platform_demo_seed_member(p_organization_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or not exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_platform_owner, false)) then
    raise exception 'Platform Owner access required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations o where o.id = p_organization_id and o.is_demo) then
    raise exception 'Only Demo organizations' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organization_members m where m.organization_id = p_organization_id and m.user_id = p_user_id) then
    raise exception 'Not a member of this Demo' using errcode = '22023';
  end if;
  perform set_config('limoxis.test_reset', 'on', true);
  perform private.demo_seed_governance_member(p_organization_id, p_user_id);
end;
$function$;
revoke all on function public.platform_demo_seed_member(uuid, uuid) from public, anon;
grant execute on function public.platform_demo_seed_member(uuid, uuid) to authenticated;
