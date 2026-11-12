-- Συνεντεύξεις σε κάθε Demo νοσοκομείο: οι ίδιες αιτήσεις με το demo του browser
-- (src/features/interviews/interviewsDemoData.js) με ημερομηνίες από σήμερα — μία σε κάθε
-- βήμα (νέα, από tablet με υπογραφή, έλεγχος, προγραμματισμένες συνεντεύξεις τις επόμενες
-- δύο εβδομάδες, αξιολογημένες με βαθμολογίες, πρόταση, προσλήψεις, απορρίψεις, αποχώρηση),
-- γλώσσες και προηγούμενοι εργοδότες, οι διευθύνσεις με τις κατηγορίες και τα τμήματά τους
-- και η ρύθμιση του tablet. Τα ονόματα είναι επινοημένα, τα email example.org.
-- demo_seed_data την καλεί μετά τους εργαζομένους (οι προσλήψεις δείχνουν σε εργαζόμενο του Demo).

-- The professional category of an employee's profession (for the hires).
create or replace function private.demo_seed_interviews_category(p_profession text)
returns text language sql immutable set search_path = ''
as $function$
  select case when p_profession is null or p_profession like 'Νοσηλ%' or p_profession like 'Μαί%' then 'nursing'
    when p_profession like 'Ιατρ%' then 'medical'
    when p_profession like '%Τεχνολόγ%' or p_profession like '%Φυσικοθεραπ%' then 'paramedical'
    when p_profession like '%Διοικητ%' then 'administrative' else 'other' end;
$function$;
revoke all on function private.demo_seed_interviews_category(text) from public, anon, authenticated;

-- One application with its first interview (when p_int_status is given). Returns the application id.
create or replace function private.demo_seed_interviews_candidate(
  p_org uuid, p_actor uuid, p_code text, p_applied date, p_name text, p_gender text, p_position text, p_category text,
  p_status text, p_fields jsonb, p_int_at timestamptz, p_int_status text, p_panel jsonb, p_scores jsonb, p_outcome text, p_int_fields jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $function$
declare
  v_id uuid;
  v_rating numeric;
begin
  insert into public.hr_candidates (organization_id, code, full_name, gender, birth_date, nationality, citizenship, area, phone_mobile, email,
    requested_position, professional_category, employment_type, military_service, practice_licence, smoker, marital_status, children,
    education_level, education, it_skills, why_us, applied_on, consent_given, consent_at, consent_text, status, decision, decision_on,
    decision_by_name, decision_notes, employee_id, source, notes, created_by, updated_by, created_at, updated_at)
  values (p_org, p_code, p_name, p_gender, (p_fields ->> 'birth')::date, 'Ελληνική', 'Ελληνική', p_fields ->> 'area', p_fields ->> 'phone', p_fields ->> 'email',
    p_position, p_category, coalesce(p_fields ->> 'employment', 'full_time'), p_fields ->> 'military', (p_fields ->> 'licence')::boolean, false, p_fields ->> 'marital', (p_fields ->> 'children')::integer,
    p_fields ->> 'level', coalesce(p_fields -> 'education', '[]'::jsonb), p_fields ->> 'it', p_fields ->> 'why', p_applied, true,
    (p_applied + time '10:00') at time zone 'Europe/Athens', 'Έντυπο συναίνεσης GDPR', p_status, p_fields ->> 'decision', (p_fields ->> 'decisionOn')::date,
    p_fields ->> 'decisionBy', p_fields ->> 'decisionNotes', (p_fields ->> 'employee')::uuid, 'demo', p_fields ->> 'notes', p_actor, p_actor,
    (p_applied + time '10:00') at time zone 'Europe/Athens', (p_applied + time '10:00') at time zone 'Europe/Athens')
  returning id into v_id;
  if p_int_status is not null then
    select round(avg(value::numeric), 1) into v_rating from jsonb_each_text(coalesce(p_scores, '{}'::jsonb));
    insert into public.hr_interviews (organization_id, candidate_id, scheduled_at, location, status, interviewers, scores, overall_rating, outcome,
      recommendation, strengths, weaknesses, salary_expectation, offered_salary, benefits, available_from, evaluated_at, evaluated_by_name, notes, source, created_by, updated_by)
    values (p_org, v_id, p_int_at, coalesce(p_int_fields ->> 'location', 'Γραφείο Προσωπικού'), p_int_status, coalesce(p_panel, '[]'::jsonb), coalesce(p_scores, '{}'::jsonb), v_rating, p_outcome,
      p_int_fields ->> 'recommendation', p_int_fields ->> 'strengths', p_int_fields ->> 'weaknesses', (p_int_fields ->> 'expects')::numeric, (p_int_fields ->> 'offered')::numeric,
      p_int_fields ->> 'benefits', (p_int_fields ->> 'available')::date, case when p_int_status = 'completed' then p_int_at + interval '1 hour' end,
      case when p_int_status = 'completed' then 'Ελένη Γεωργίου' end, p_int_fields ->> 'notes', 'demo', p_actor, p_actor);
  end if;
  return v_id;
end;
$function$;
revoke all on function private.demo_seed_interviews_candidate(uuid, uuid, text, date, text, text, text, text, text, jsonb, timestamptz, text, jsonb, jsonb, text, jsonb) from public, anon, authenticated;

-- The divisions of the hospital with their professional categories, departments and directors, and the tablet setting.
create or replace function private.demo_seed_interviews_divisions(p_organization_id uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  v_nursing uuid;
  v_medical uuid;
  v_operations uuid;
begin
  insert into public.hr_divisions (organization_id, name) values (v_org, 'Νοσηλευτική Υπηρεσία') returning id into v_nursing;
  insert into public.hr_divisions (organization_id, name) values (v_org, 'Ιατρική Υπηρεσία') returning id into v_medical;
  insert into public.hr_divisions (organization_id, name) values (v_org, 'Διεύθυνση Λειτουργιών') returning id into v_operations;
  insert into public.hr_division_categories (organization_id, division_id, professional_category)
  values (v_org, v_nursing, 'nursing'), (v_org, v_medical, 'medical'), (v_org, v_medical, 'paramedical'),
    (v_org, v_operations, 'administrative'), (v_org, v_operations, 'technical'), (v_org, v_operations, 'support');
  -- Nursing covers every ward and the medical service the clinics; operations has no ward of its own.
  insert into public.hr_division_departments (organization_id, division_id, department_id)
  select v_org, v_nursing, d.id from public.departments d where d.organization_id = v_org;
  insert into public.hr_division_departments (organization_id, division_id, department_id)
  select v_org, v_medical, d.id from public.departments d where d.organization_id = v_org and d.name like '%Κλινική%';
  -- The Demo's active «Division Director» users, if any, direct the nursing service.
  insert into public.hr_division_members (organization_id, division_id, user_id)
  select v_org, v_nursing, om.user_id from public.organization_members om
  where om.organization_id = v_org and om.status = 'active' and om.role::text = 'division_director'
  on conflict (division_id, user_id) do nothing;
  insert into public.hr_interview_settings (organization_id, tablet_attachments) values (v_org, false)
  on conflict (organization_id) do nothing;
end;
$function$;
revoke all on function private.demo_seed_interviews_divisions(uuid) from public, anon, authenticated;

create or replace function private.demo_seed_interviews(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := current_date;
  v_hr jsonb := jsonb_build_object('employeeId', '', 'name', 'Ελένη Γεωργίου', 'role', 'hr');
  v_nurse jsonb := jsonb_build_object('employeeId', '', 'name', 'Μαρία Παπαδοπούλου', 'role', 'evaluator');
  v_director jsonb := jsonb_build_object('employeeId', '', 'name', 'Νίκος Αλεξίου', 'role', 'evaluator');
  v_chef jsonb := jsonb_build_object('employeeId', '', 'name', 'Γιώργος Νικολάου', 'role', 'evaluator');
  v_hired uuid[];
  v_names text[];
  v_titles text[];
  v_id uuid;
  v_actor uuid := p_actor;
begin
  if not exists (select 1 from public.organizations o where o.id = v_org and o.is_demo) then
    raise exception 'Only Demo organizations get the Demo interviews' using errcode = '42501';
  end if;
  -- Already filled (the reset empties the Demo first): nothing to add.
  if exists (select 1 from public.hr_candidates c where c.organization_id = v_org) then return; end if;
  if v_actor is not null and not exists (select 1 from auth.users u where u.id = v_actor) then v_actor := null; end if;

  perform private.demo_seed_interviews_divisions(v_org);

  -- Two hires are employees of the Demo (the newest without a login), nurses first.
  select array_agg(x.id order by x.rk), array_agg(x.name order by x.rk), array_agg(x.title order by x.rk)
    into v_hired, v_names, v_titles
  from (select e.id, btrim(coalesce(e.last_name, '') || ' ' || coalesce(e.first_name, '')) as name, coalesce(e.profession_name, 'Νοσηλευτής / Νοσηλεύτρια') as title,
      row_number() over (order by (coalesce(e.profession_name, '') like 'Νοσηλ%') desc, e.hire_date desc nulls last, e.id) as rk
    from public.employees e where e.organization_id = v_org and e.user_id is null) x
  where x.rk <= 2;

  -- 1. Νέα αίτηση από tablet, με τις συναινέσεις και την υπογραφή.
  v_id := private.demo_seed_interviews_candidate(v_org, v_actor, 'ΥΠ-0001', d0 - 2, 'Κωνσταντίνου Δήμητρα', 'female', 'ΤΕ Νοσηλευτική', 'nursing', 'new',
    jsonb_build_object('birth', '1996-04-12', 'area', 'Λάρισα', 'phone', '6900000101', 'email', 'd.konstantinou@example.org', 'licence', true, 'marital', 'single', 'level', 'ΤΕΙ',
      'education', jsonb_build_array(jsonb_build_object('level', 'ΤΕΙ', 'school', 'Νοσηλευτική ΤΕΙ Λάρισας', 'year', '2019', 'completed', true)),
      'it', 'Office, ηλεκτρονικός φάκελος ασθενούς', 'why', 'Κοντά στο σπίτι και καλή φήμη της κλινικής.'), null, null, null, null, null, null);
  update public.hr_candidates set source = 'tablet', consent_text = 'Υπογράφηκε στο tablet, έκδοση 2026-10', consent_future = true, consent_references = false,
    declaration_truth = true, consent_version = '2026-10', signed_at = (d0 - 2 + time '10:00') at time zone 'Europe/Athens',
    consent_texts = '{"language":"el","gdpr":"Συναινώ στην επεξεργασία των προσωπικών μου δεδομένων που περιέχει αυτή η αίτηση από το Νοσοκομείο, ως υπεύθυνο επεξεργασίας, αποκλειστικά για την αξιολόγηση της υποψηφιότητάς μου και τη διαδικασία επιλογής προσωπικού (Κανονισμός (ΕΕ) 2016/679 και ν. 4624/2019). Τα στοιχεία τα βλέπουν μόνο το Γραφείο Προσωπικού και όσοι συμμετέχουν στη συνέντευξη, δεν διαβιβάζονται σε τρίτους και διατηρούνται έως 24 μήνες από την υποβολή, εκτός αν προσληφθώ. Έχω δικαίωμα πρόσβασης, διόρθωσης, διαγραφής, περιορισμού και φορητότητας, μπορώ να ανακαλέσω τη συναίνεσή μου οποτεδήποτε με αίτημα στο Γραφείο Προσωπικού ή στον Υπεύθυνο Προστασίας Δεδομένων και να υποβάλω καταγγελία στην Αρχή Προστασίας Δεδομένων Προσωπικού Χαρακτήρα.","future":"Συναινώ να εξεταστεί η αίτησή μου και για άλλες θέσεις που θα προκύψουν στο Νοσοκομείο μέσα στους επόμενους 24 μήνες.","references":"Συναινώ το Γραφείο Προσωπικού να επικοινωνήσει με τους προηγούμενους εργοδότες που δηλώνω, για συστάσεις σχετικά με την εργασία μου.","truth":"Δηλώνω υπεύθυνα ότι τα στοιχεία της αίτησης είναι αληθή και πλήρη. Γνωρίζω ότι ανακριβή στοιχεία μπορεί να οδηγήσουν σε απόρριψη της αίτησης ή σε λύση της συνεργασίας."}'::jsonb
  where id = v_id;
  insert into public.hr_candidate_signatures (candidate_id, organization_id, image, signed_at)
  values (v_id, v_org, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAWgAAAB4BAMAAAAtanXJAAAAGFBMVEUAAAAPIjMAAAAAAAAAAAAAAAAAAAAAAABcgH40AAAACHRSTlMA/wAAAAAAACXRGJEAAANwSURBVHja7VptkqwwCITUHIDc/5DhBrwf6oyOGvmI6+4rumpr/0xMp0MDiQIkEolEIpFIJBKJRCKRSCQSiUQi8fNAz6AKIPwg6eLj7Fvsg6QnvvTHlAZo/KjUDtIEDQT+VnggCADwk/FRnOPkyfjwkGZ4GC97SE/xzO7wQIpm+eIVWrxBjRTO8sXuw2CQUDzLF4cFIx0AIIBEs3xxCbUhbx0vLEGpS2As+YRmgKDUxTwph4KaQPy7NEJpn1ocT/XF7UNt0qu1fvcAgYTpIk1Wqev8twznAVW1uHbX23xjNLZcpNHKnwDaVAU/NoSoFSNGVAQmAjRoy2JxvVD6MdK0UYhRZ1yew5pWAvNDSivkmownE+u66e4uF4x1VGvKRgvIW+56ljoV2TWkNJonXk7CB0sm9y4Wq/f2zbFqZ9qKunbPeEx40BdpJtT+vlm7ABx53PoSnniue4dHKI49fER44I7E1GNiPY4UjGR5ui3lCUCFSmcUQ3WPtaTPc+MJiaVuND7QhgLZE/XFRaw7NufhdnTwwwCvnee7RiS2idPqnBlkN5ZsRqvrHIOjyvjxg1pra1O6m4AK+7KpJN3rgUhshcfkQ/xeBw9RGq/tbms3NwIRQFt33nJfl/clNbpLCwI0WHfebCDdSfk0+rpUdlcLwKprsyul6/swrQhRtpYW2t7hTDdmdBmJpT/xytKkkY4Mred2Lnn/Q0DqL7h0/YYf6mhvJlnv7U/oMUCli7Glm7hmS0MlIFUCs90RvHdmFXpTsyjWmKa9pQGrKheYL45wH0kCl++DX32fyFKptR0bakvR1yCGznHhWulPysdlxY3hntdD7OthX6rWQJqWBRlLS22OClB67rCrK0fXdv3jGkC1HhZKzx0S2HDdYAZ0XEW+lO4wt1U6H8pUBDisNC/l33PCW+IDlURYly8uSU/NGnrzhe1zENcbmOPwIHYKfXlg2x98HDOUc3f4hGbHqWWE0pM7nLNOwUW3fqpQTtXyzspAd38L8hrmju2Nz63fC92gSfX6KxYe8S7o2Q+zEom/hhuyx9HLo/abSdfBXcb9pOs5uVn9QV9d49CY6JOqowTHS/EU6mgYj+SN7h338rheIdLF41AdqgfTeCN1yS/NpZI2pjuvwL3eqoE0g5Fp2hD3jpAgkUgkEolEIpFI/Nf4B4XVBbMvFWi4AAAAAElFTkSuQmCC', (d0 - 2 + time '10:00') at time zone 'Europe/Athens');
  insert into public.hr_candidate_languages (organization_id, candidate_id, position, language, reading, writing, speaking, certificate, certificate_name)
  values (v_org, v_id, 0, 'en', 'good', 'good', 'fair', true, 'B2');

  -- 2. Νέα αίτηση από το Γραφείο Προσωπικού.
  v_id := private.demo_seed_interviews_candidate(v_org, v_actor, 'ΥΠ-0002', d0 - 1, 'Οικονόμου Βασίλης', 'male', 'Τεχνικός Βιοϊατρικής Τεχνολογίας', 'technical', 'new',
    jsonb_build_object('birth', '1992-07-21', 'area', 'Λάρισα', 'phone', '6900000108', 'email', 'v.oikonomou@example.org', 'military', 'done', 'marital', 'married', 'children', 1, 'level', 'ΤΕΙ',
      'education', jsonb_build_array(jsonb_build_object('level', 'ΤΕΙ', 'school', 'Ιατρικά Όργανα (παράδειγμα)', 'year', '2015', 'completed', true)), 'it', 'AutoCAD, Office'), null, null, null, null, null, null);
  insert into public.hr_candidate_employers (organization_id, candidate_id, position, employer, from_on, to_on, job_title, salary, leaving_reason)
  values (v_org, v_id, 0, 'Εταιρεία ιατρικού εξοπλισμού (παράδειγμα)', date '2016-03-01', d0 - 60, 'Τεχνικός service', 1100, 'Αναζήτηση μόνιμης θέσης');

  -- 3. Σε έλεγχο.
  v_id := private.demo_seed_interviews_candidate(v_org, v_actor, 'ΥΠ-0003', d0 - 6, 'Ιωάννου Πέτρος', 'male', 'Τραυματιοφορέας', 'support', 'screening',
    jsonb_build_object('birth', '1990-09-03', 'area', 'Τρίκαλα', 'phone', '6900000102', 'email', 'p.ioannou@example.org', 'military', 'done', 'marital', 'married', 'children', 2, 'level', 'Λύκειο'), null, null, null, null, null, null);
  insert into public.hr_candidate_employers (organization_id, candidate_id, position, employer, from_on, to_on, job_title, salary, leaving_reason)
  values (v_org, v_id, 0, 'Ιδιωτική κλινική (παράδειγμα)', date '2016-02-01', date '2024-12-31', 'Τραυματιοφορέας', 900, 'Μετακόμιση');

  -- 4–6. Προγραμματισμένες συνεντεύξεις τις επόμενες δύο εβδομάδες.
  v_id := private.demo_seed_interviews_candidate(v_org, v_actor, 'ΥΠ-0004', d0 - 9, 'Μιχαηλίδου Άννα', 'female', 'ΤΕ Νοσηλευτική', 'nursing', 'interview_scheduled',
    jsonb_build_object('birth', '1993-01-25', 'area', 'Λάρισα', 'phone', '6900000103', 'email', 'a.michailidou@example.org', 'licence', true, 'level', 'ΑΕΙ',
      'education', jsonb_build_array(jsonb_build_object('level', 'ΑΕΙ', 'school', 'Νοσηλευτική Πανεπιστημίου Θεσσαλίας', 'year', '2016', 'completed', true),
        jsonb_build_object('level', 'Μεταπτυχιακό', 'school', 'ΜΕΘ — Πανεπιστήμιο Θεσσαλίας', 'year', '2021', 'completed', true))),
    (d0 + 2 + time '11:00') at time zone 'Europe/Athens', 'scheduled', jsonb_build_array(v_nurse, v_hr), null, null, null);
  insert into public.hr_candidate_languages (organization_id, candidate_id, position, language, reading, writing, speaking, certificate, certificate_name)
  values (v_org, v_id, 0, 'en', 'fluent', 'fluent', 'good', true, 'C1'), (v_org, v_id, 1, 'de', 'basic', 'basic', 'basic', false, null);
  insert into public.hr_candidate_employers (organization_id, candidate_id, position, employer, from_on, to_on, job_title, salary, leaving_reason)
  values (v_org, v_id, 0, 'Γενικό Νοσοκομείο (παράδειγμα)', date '2017-03-01', date '2025-06-30', 'Νοσηλεύτρια ΜΕΘ', 1150, 'Λήξη σύμβασης');

  v_id := private.demo_seed_interviews_candidate(v_org, v_actor, 'ΥΠ-0005', d0 - 7, 'Χριστοφόρου Λευτέρης', 'male', 'Τεχνολόγος Εργαστηρίων', 'paramedical', 'interview_scheduled',
    jsonb_build_object('birth', '1994-05-30', 'area', 'Καρδίτσα', 'phone', '6900000109', 'email', 'l.christoforou@example.org', 'military', 'done', 'licence', true, 'level', 'ΤΕΙ',
      'education', jsonb_build_array(jsonb_build_object('level', 'ΤΕΙ', 'school', 'Ιατρικά Εργαστήρια ΤΕΙ Αθήνας', 'year', '2017', 'completed', true))),
    (d0 + 5 + time '10:00') at time zone 'Europe/Athens', 'scheduled', jsonb_build_array(v_director, v_hr), null, null, jsonb_build_object('location', 'Μικροβιολογικό Εργαστήριο'));
  insert into public.hr_candidate_languages (organization_id, candidate_id, position, language, reading, writing, speaking, certificate, certificate_name)
  values (v_org, v_id, 0, 'en', 'good', 'good', 'good', true, 'B2');

  v_id := private.demo_seed_interviews_candidate(v_org, v_actor, 'ΥΠ-0006', d0 - 12, 'Αλεξανδροπούλου Ζωή', 'female', 'Διοικητική υπάλληλος', 'administrative', 'interview_scheduled',
    jsonb_build_object('birth', '1997-10-11', 'area', 'Λάρισα', 'phone', '6900000110', 'email', 'z.alexandropoulou@example.org', 'level', 'ΑΕΙ', 'it', 'Office, ERP, μισθοδοσία',
      'education', jsonb_build_array(jsonb_build_object('level', 'ΑΕΙ', 'school', 'Λογιστική και Χρηματοοικονομική (παράδειγμα)', 'year', '2020', 'completed', true))),
    (d0 - 3 + time '12:00') at time zone 'Europe/Athens', 'cancelled', jsonb_build_array(v_hr), null, null, jsonb_build_object('notes', 'Ακυρώθηκε από την υποψήφια· ορίστηκε νέα ημερομηνία.'));
  insert into public.hr_interviews (organization_id, candidate_id, scheduled_at, location, status, interviewers, source, created_by, updated_by)
  values (v_org, v_id, (d0 + 9 + time '12:00') at time zone 'Europe/Athens', 'Γραφείο Προσωπικού', 'scheduled', jsonb_build_array(v_hr), 'demo', v_actor, v_actor);

  -- 7–8. Αξιολογημένες: επιφύλαξη, και πρόταση με δεύτερη συνέντευξη με τη Διεύθυνση.
  perform private.demo_seed_interviews_candidate(v_org, v_actor, 'ΥΠ-0007', d0 - 14, 'Σταματίου Γεώργιος', 'male', 'Μάγειρας', 'support', 'interviewed',
    jsonb_build_object('birth', '1988-06-17', 'area', 'Λάρισα', 'phone', '6900000104', 'email', 'g.stamatiou@example.org', 'military', 'done', 'level', 'ΙΕΚ Μαγειρικής', 'decision', 'reserve',
      'decisionOn', d0 - 4, 'decisionBy', 'Ελένη Γεωργίου', 'decisionNotes', 'Σε λίστα αναμονής για την επόμενη θέση στην κουζίνα.'),
    (d0 - 5 + time '10:00') at time zone 'Europe/Athens', 'completed', jsonb_build_array(v_chef, v_hr),
    '{"presentation": 4, "knowledge": 4, "experience": 5, "motivation": 3, "teamwork": 4, "availability": 3}'::jsonb, 'reserve',
    jsonb_build_object('recommendation', 'Πολύ καλός επαγγελματίας· διαθέσιμος μόνο πρωινές βάρδιες.', 'strengths', 'Εμπειρία σε μεγάλη κουζίνα, HACCP.', 'weaknesses', 'Περιορισμένη διαθεσιμότητα.', 'expects', 1200));

  v_id := private.demo_seed_interviews_candidate(v_org, v_actor, 'ΥΠ-0008', d0 - 16, 'Τσιρίγου Μαριλένα', 'female', 'Ειδικευόμενη Ιατρός Παθολογίας', 'medical', 'interviewed',
    jsonb_build_object('birth', '1995-03-08', 'area', 'Λάρισα', 'phone', '6900000111', 'email', 'm.tsirigou@example.org', 'licence', true, 'level', 'ΑΕΙ',
      'education', jsonb_build_array(jsonb_build_object('level', 'ΑΕΙ', 'school', 'Ιατρική Σχολή (παράδειγμα)', 'year', '2021', 'completed', true))),
    (d0 - 4 + time '13:00') at time zone 'Europe/Athens', 'completed', jsonb_build_array(v_director, v_hr),
    '{"presentation": 5, "knowledge": 4, "experience": 3, "motivation": 5, "teamwork": 4, "availability": 5}'::jsonb, 'recommend',
    jsonb_build_object('location', 'Γραφείο Ιατρικής Υπηρεσίας', 'recommendation', 'Προτείνεται· δεύτερη συνέντευξη με τον Διευθυντή της Παθολογικής.', 'strengths', 'Κίνητρο, επικοινωνία.', 'weaknesses', 'Λίγη κλινική εμπειρία.'));
  insert into public.hr_interviews (organization_id, candidate_id, scheduled_at, location, status, interviewers, source, created_by, updated_by)
  values (v_org, v_id, (d0 + 12 + time '09:30') at time zone 'Europe/Athens', 'Παθολογική Κλινική', 'scheduled', jsonb_build_array(v_director, v_nurse), 'demo', v_actor, v_actor);
  insert into public.hr_candidate_languages (organization_id, candidate_id, position, language, reading, writing, speaking, certificate, certificate_name)
  values (v_org, v_id, 0, 'en', 'fluent', 'fluent', 'fluent', true, 'Proficiency'), (v_org, v_id, 1, 'fr', 'fair', 'basic', 'basic', false, null);

  -- 9. Πρόταση πρόσληψης (εκκρεμεί η δημιουργία εργαζομένου).
  v_id := private.demo_seed_interviews_candidate(v_org, v_actor, 'ΥΠ-0009', d0 - 21, 'Αθανασίου Ελένη', 'female', 'ΤΕ Νοσηλευτική', 'nursing', 'offer',
    jsonb_build_object('birth', '1995-11-08', 'area', 'Λάρισα', 'phone', '6900000105', 'email', 'e.athanasiou@example.org', 'licence', true, 'level', 'ΑΕΙ', 'decision', 'hire',
      'decisionOn', d0 - 3, 'decisionBy', 'Νίκος Αλεξίου', 'decisionNotes', 'Έναρξη την 1η του επόμενου μήνα.',
      'education', jsonb_build_array(jsonb_build_object('level', 'ΑΕΙ', 'school', 'Νοσηλευτική ΕΚΠΑ', 'year', '2018', 'completed', true))),
    (d0 - 10 + time '12:00') at time zone 'Europe/Athens', 'completed', jsonb_build_array(v_nurse, v_director, v_hr),
    '{"presentation": 5, "knowledge": 4, "experience": 4, "motivation": 5, "teamwork": 5, "availability": 4}'::jsonb, 'recommend',
    jsonb_build_object('recommendation', 'Πρόταση συνεργασίας για τη Χειρουργική Κλινική.', 'strengths', 'Επικοινωνία, εμπειρία σε ΜΕΘ.', 'expects', 1250, 'offered', 1200,
      'benefits', 'Κουπόνια σίτισης', 'available', d0 + 12));
  insert into public.hr_candidate_languages (organization_id, candidate_id, position, language, reading, writing, speaking, certificate, certificate_name)
  values (v_org, v_id, 0, 'en', 'fluent', 'good', 'fluent', true, 'Proficiency');

  -- 10–11. Προσλήφθηκαν: συνδέονται με εργαζόμενο του Demo (χωρίς εργαζόμενο μένουν «Πρόταση πρόσληψης»).
  perform private.demo_seed_interviews_candidate(v_org, v_actor, 'ΥΠ-0010', d0 - 75, coalesce(nullif(v_names[1], ''), 'Ρήγα Αικατερίνη'), null, coalesce(v_titles[1], 'ΤΕ Νοσηλευτική'), private.demo_seed_interviews_category(v_titles[1]),
    case when v_hired[1] is null then 'offer' else 'hired' end,
    jsonb_build_object('area', 'Λάρισα', 'email', 'candidate10@example.org', 'licence', true, 'level', 'ΑΕΙ', 'decision', 'hire', 'decisionOn', d0 - 60, 'decisionBy', 'Νίκος Αλεξίου',
      'decisionNotes', 'Ανέλαβε υπηρεσία.', 'employee', v_hired[1]),
    (d0 - 66 + time '11:00') at time zone 'Europe/Athens', 'completed', jsonb_build_array(v_nurse, v_hr),
    '{"presentation": 5, "knowledge": 4, "experience": 4, "motivation": 5, "teamwork": 5, "availability": 4}'::jsonb, 'recommend',
    jsonb_build_object('recommendation', 'Προτείνεται ανεπιφύλακτα.', 'expects', 1150, 'offered', 1150, 'available', d0 - 45));
  perform private.demo_seed_interviews_candidate(v_org, v_actor, 'ΥΠ-0011', d0 - 120, coalesce(nullif(v_names[2], ''), 'Καλογεράκης Μανώλης'), null, coalesce(v_titles[2], 'Τραυματιοφορέας'), private.demo_seed_interviews_category(v_titles[2]),
    case when v_hired[2] is null then 'offer' else 'hired' end,
    jsonb_build_object('area', 'Τρίκαλα', 'email', 'candidate11@example.org', 'level', 'ΑΕΙ', 'decision', 'hire', 'decisionOn', d0 - 105, 'decisionBy', 'Νίκος Αλεξίου',
      'decisionNotes', 'Ανέλαβε υπηρεσία.', 'employee', v_hired[2]),
    (d0 - 112 + time '10:00') at time zone 'Europe/Athens', 'completed', jsonb_build_array(v_nurse, v_hr),
    '{"presentation": 4, "knowledge": 4, "experience": 4, "motivation": 4, "teamwork": 4, "availability": 5}'::jsonb, 'recommend',
    jsonb_build_object('recommendation', 'Καλή εμπειρία, άμεσα διαθέσιμος/η.', 'expects', 1100, 'offered', 1100, 'available', d0 - 90));

  -- 12–13. Απορρίφθηκαν.
  perform private.demo_seed_interviews_candidate(v_org, v_actor, 'ΥΠ-0012', d0 - 40, 'Παππά Χριστίνα', 'female', 'Διοικητική υπάλληλος', 'administrative', 'rejected',
    jsonb_build_object('birth', '1999-02-14', 'area', 'Λάρισα', 'phone', '6900000106', 'email', 'c.pappa@example.org', 'level', 'Λύκειο', 'decision', 'reject', 'decisionOn', d0 - 30,
      'decisionBy', 'Ελένη Γεωργίου', 'decisionNotes', 'Δεν καλύπτει την απαιτούμενη εμπειρία στη λογιστική.'),
    (d0 - 33 + time '09:30') at time zone 'Europe/Athens', 'completed', jsonb_build_array(v_hr),
    '{"presentation": 3, "knowledge": 2, "experience": 2, "motivation": 3, "teamwork": 3, "availability": 4}'::jsonb, 'not_recommend',
    jsonb_build_object('weaknesses', 'Χωρίς εμπειρία σε μισθοδοσία και λογιστική.'));
  perform private.demo_seed_interviews_candidate(v_org, v_actor, 'ΥΠ-0013', d0 - 55, 'Κυριακίδης Παύλος', 'male', 'Μάγειρας', 'support', 'rejected',
    jsonb_build_object('birth', '1985-12-02', 'area', 'Βόλος', 'phone', '6900000112', 'email', 'p.kyriakidis@example.org', 'military', 'done', 'level', 'Λύκειο', 'decision', 'reject',
      'decisionOn', d0 - 41, 'decisionBy', 'Νίκος Αλεξίου', 'decisionNotes', 'Δεν διαθέτει πιστοποίηση HACCP.'),
    (d0 - 47 + time '11:00') at time zone 'Europe/Athens', 'completed', jsonb_build_array(v_chef, v_hr),
    '{"presentation": 3, "knowledge": 2, "experience": 3, "motivation": 2, "teamwork": 3, "availability": 4}'::jsonb, 'not_recommend', '{}'::jsonb);

  -- 14. Αποχώρησε πριν τη συνέντευξη.
  perform private.demo_seed_interviews_candidate(v_org, v_actor, 'ΥΠ-0014', d0 - 25, 'Δημητρίου Σοφία', 'female', 'Μαία', 'nursing', 'withdrawn',
    jsonb_build_object('area', 'Βόλος', 'phone', '6900000107', 'email', 's.dimitriou@example.org', 'licence', true, 'level', 'ΑΕΙ', 'decisionNotes', 'Αποδέχθηκε θέση σε άλλο νοσοκομείο.'),
    (d0 - 18 + time '10:30') at time zone 'Europe/Athens', 'cancelled', jsonb_build_array(v_nurse, v_hr), null, null, jsonb_build_object('notes', 'Ακυρώθηκε: η υποψήφια απέσυρε την αίτηση.'));

  -- The HR office's opinion on the evaluated applications (written as the Demo's creator).
  if v_actor is not null then
    insert into public.hr_interview_opinions (organization_id, candidate_id, author_id, role_kind, stance, comment, submitted_at)
    select v_org, c.id, v_actor, 'hr_office', x.stance, x.comment, (d0 - x.ago + time '15:00') at time zone 'Europe/Athens'
    from (values ('ΥΠ-0007', 'reserve', 'Καλός υποψήφιος· να κρατηθεί για την επόμενη θέση.', 4),
      ('ΥΠ-0008', 'propose', 'Προτείνεται, εφόσον συμφωνήσει η Παθολογική.', 3),
      ('ΥΠ-0009', 'approve', 'Συμφωνώ με την πρόσληψη.', 3),
      ('ΥΠ-0012', 'reject', 'Δεν ταιριάζει στη θέση.', 31)) as x(code, stance, comment, ago)
    join public.hr_candidates c on c.organization_id = v_org and c.code = x.code
    on conflict (candidate_id, author_id) do nothing;
  end if;
end;
$function$;
revoke all on function private.demo_seed_interviews(uuid, uuid) from public, anon, authenticated;
