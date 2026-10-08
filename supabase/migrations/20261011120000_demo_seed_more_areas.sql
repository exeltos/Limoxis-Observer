-- Demo data pack, second part: controls, training, pharmacy and occupational
-- health. Same rules as 20261010120000_demo_seed_data.sql: each area is its own
-- private SECURITY DEFINER function, departments are found again by code, there
-- is no SELECT/EXECUTE/RETURNING ... INTO (the SQL editor rewrites those), and
-- private.demo_seed_data calls every area and reports the counts.

-- 1. Controls: six recurring checks, their department assignments and history --
create or replace function private.demo_seed_controls(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  v_now timestamptz := now();
  v_depts uuid[] := array(
    select dep.id from (values ('ΜΕΘ',1),('ΠΑΘ',2),('ΧΕΙΡ',3),('ΚΑΡΔ',4),('ΟΡΘ',5),('ΝΕΦ',6),('ΠΑΙΔ',7),('ΜΕΝΝ',8)) o(code,ord)
    join public.departments dep on dep.organization_id = p_organization_id and dep.code = o.code order by o.ord);
begin
  insert into public.control_definitions(organization_id, code, title, category, description, response_config, frequency_config, status, created_by, updated_by, created_at)
  select v_org, c.code, c.title, c.category, c.descr,
    c.cfg || jsonb_build_object('__meta', jsonb_build_object('titleEn', c.title_en, 'ownerLabel', c.owner_label, 'createdByScope', 'infection_control',
      'createdForDepartment', null, 'createdByName', 'Ομάδα Ελέγχου Λοιμώξεων', 'updatedByName', '')),
    jsonb_build_object('kind', c.kind, 'timesPerDay', 1, 'times', jsonb_build_array(c.at_time), 'interval', 1),
    'active', p_actor, p_actor, v_now - interval '100 days'
  from (values
    ('CTRL-0001', 'Θερμοκρασία ψυγείου φαρμάκων', 'Θερμοκρασίες', 'Καταγραφή θερμοκρασίας ψυγείου φαρμάκων και εμβολίων στην αρχή της πρωινής βάρδιας.',
      '{"mode":"numeric","label":"Θερμοκρασία","unit":"°C","min":2,"max":8,"criticality":"high","requiresEvidence":false}'::jsonb, 'Medication fridge temperature', 'Υπεύθυνος βάρδιας', 'daily', '09:00'),
    ('CTRL-0002', 'Απολύμανση επιφανειών υψηλής επαφής', 'Καθαριότητα / Απολύμανση', 'Οπτικός έλεγχος καθαριότητας και απολύμανσης επιφανειών υψηλής επαφής.',
      '{"mode":"choice","label":"Κατάσταση","options":["Συμμορφώνεται","Μερική συμμόρφωση","Μη συμμόρφωση"],"reportOn":["Μερική συμμόρφωση","Μη συμμόρφωση"],"criticality":"medium"}'::jsonb, 'High-touch surface disinfection', 'Προϊστάμενος τμήματος', 'weekly', '10:00'),
    ('CTRL-0003', 'Λήξεις φαρμάκων και υλικών', 'Φάρμακα / Υλικά', 'Έλεγχος ημερομηνιών λήξης φαρμάκων, ορών και αποστειρωμένων υλικών.',
      '{"mode":"choice","label":"Εύρημα","options":["Χωρίς εύρημα","Κοντόληκτο","Ληγμένο"],"reportOn":["Κοντόληκτο","Ληγμένο"],"criticality":"medium"}'::jsonb, 'Medication and supply expiry', 'Προϊστάμενος τμήματος', 'monthly', '10:00'),
    ('CTRL-0004', 'Αντισηπτικά χεριών στο σημείο φροντίδας', 'Άλλο', 'Διαθεσιμότητα και λειτουργία δοχείων αλκοολούχου αντισηπτικού σε κάθε κλίνη.',
      '{"mode":"choice","label":"Διαθεσιμότητα","options":["Πλήρης","Ελλείψεις"],"reportOn":["Ελλείψεις"],"criticality":"medium"}'::jsonb, 'Point-of-care hand rub availability', 'Σύνδεσμος νοσηλευτής', 'weekly', '11:00'),
    ('CTRL-0005', 'Καλλιέργεια νερού για Legionella', 'Καλλιέργειες', 'Δειγματοληψία νερού από βρύσες και ντους για Legionella spp.',
      '{"mode":"text","label":"Αποτέλεσμα (CFU/L)","criticality":"high"}'::jsonb, 'Water culture for Legionella', 'Τεχνική υπηρεσία', 'monthly', '08:00'),
    ('CTRL-0006', 'Τροχήλατο ανάνηψης', 'Εξοπλισμός', 'Πληρότητα και λειτουργικότητα τροχήλατου ανάνηψης και απινιδωτή.',
      '{"mode":"choice","label":"Κατάσταση","options":["Πλήρες","Ελλείψεις"],"reportOn":["Ελλείψεις"],"criticality":"high"}'::jsonb, 'Crash cart check', 'Προϊστάμενος τμήματος', 'weekly', '08:30')
  ) c(code, title, category, descr, cfg, title_en, owner_label, kind, at_time);

  insert into public.control_assignments(control_id, organization_id, department_id, status)
  select cd.id, v_org, v_depts[d], 'scheduled'
  from public.control_definitions cd
  join (values ('CTRL-0001', array[1,2,3,7]), ('CTRL-0002', array[1,2,3,4,5,6]), ('CTRL-0003', array[1,2,4,6]),
               ('CTRL-0004', array[1,2,3,5,7,8]), ('CTRL-0005', array[1,6]), ('CTRL-0006', array[1,4])) a(code, dept_idx) on a.code = cd.code
  cross join lateral unnest(a.dept_idx) d
  where cd.organization_id = v_org and v_depts[d] is not null;

  -- History: one execution per period, with gaps and findings; two assignments
  -- (surgery disinfection, orthopaedics hand rub) skip the last period so they show as overdue.
  insert into public.control_executions(assignment_id, control_id, organization_id, department_id, status, value_text, response_data, has_finding, performed_at, performed_by, created_at)
  select x.assignment_id, x.control_id, v_org, x.department_id, 'completed', x.value_text,
    jsonb_build_object('structuredData', null, 'evidence', '[]'::jsonb, 'actorName', 'Ομάδα Ελέγχου Λοιμώξεων', 'actorEmail', ''),
    x.finding, x.performed_at, p_actor, x.performed_at
  from (
    select ca.id assignment_id, ca.control_id, ca.department_id,
      date_trunc('day', v_now) + (cd.frequency_config->'times'->>0)::time - (k - 1) * s.step - s.phase performed_at,
      case cd.response_config->>'mode'
        when 'numeric' then case when (k * 13 + s.a) % 17 = 0 then '8.9' else to_char(3.2 + ((k * 7 + s.a) % 40) / 10.0, 'FM0.0') end
        when 'text' then case when (k + s.a) % 4 = 0 then '1.200' else '< 50' end
        else case when (k * 5 + s.a) % 9 = 0 then cd.response_config->'options'->>1 else cd.response_config->'options'->>0 end
      end value_text,
      case cd.response_config->>'mode'
        when 'numeric' then (k * 13 + s.a) % 17 = 0
        when 'text' then (k + s.a) % 4 = 0
        else (k * 5 + s.a) % 9 = 0
      end finding
    from public.control_assignments ca
    join public.control_definitions cd on cd.id = ca.control_id
    join public.departments dep on dep.id = ca.department_id
    cross join lateral (select case cd.frequency_config->>'kind' when 'daily' then interval '1 day' when 'weekly' then interval '7 days' else interval '1 month' end step,
                               case cd.frequency_config->>'kind' when 'daily' then 45 when 'weekly' then 13 else 4 end n,
                               abs(hashtext(ca.id::text)) % 100 a,
                               case when cd.frequency_config->>'kind' = 'daily' then interval '0 days' else make_interval(days => abs(hashtext(ca.id::text)) % 6) end phase) s
    cross join lateral generate_series(case when (cd.code, dep.code) in (('CTRL-0002', 'ΧΕΙΡ'), ('CTRL-0004', 'ΟΡΘ')) then 2 else 1 end, s.n) k
    where ca.organization_id = v_org and (k < 4 or (k * 11 + s.a) % 13 <> 0)
  ) x
  where x.performed_at <= v_now;

  update public.control_assignments ca
  set last_completed_at = l.last_at,
      next_due_at = l.last_at + case cd.frequency_config->>'kind' when 'daily' then interval '1 day' when 'weekly' then interval '7 days' else interval '1 month' end
  from public.control_definitions cd,
       (select ce.assignment_id, max(ce.performed_at) last_at from public.control_executions ce
        where ce.organization_id = v_org group by ce.assignment_id) l
  where ca.organization_id = v_org and cd.id = ca.control_id and l.assignment_id = ca.id;
end;
$function$;

-- 2. Training: programs, requirements, assignments and certificates --------------
create or replace function private.demo_seed_training(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := current_date;
begin
  insert into public.training_records(organization_id, record_key, record_type, payload, created_by, updated_by)
  select v_org, p.id, 'program', jsonb_build_object('id', p.id, 'title', p.title, 'category', p.category, 'method', p.method, 'status', p.status,
    'owner', 'Ομάδα Ελέγχου Λοιμώξεων', 'trainer', p.trainer, 'audience', p.audience, 'startDate', (d0 + p.start_offset)::text,
    'dueDate', (d0 + p.start_offset + 60)::text, 'validMonths', p.valid_months, 'requiresAssessment', true, 'passScore', 80,
    'description', p.descr, 'materials', '[]'::jsonb, 'assessmentQuestions', '[]'::jsonb, 'feedbackResponses', '[]'::jsonb), p_actor, p_actor
  from (values
    ('TRN-DEMO-001', 'Υγιεινή των χεριών – 5 στιγμές ΠΟΥ', 'ipc', 'in_person', 'active', 'Νοσηλεύτρια Επιτήρησης Λοιμώξεων', 'Όλο το κλινικό προσωπικό', -120, 12, 'Πρακτική εκπαίδευση στις 5 στιγμές και στην τεχνική αντισηψίας χεριών.'),
    ('TRN-DEMO-002', 'Ατομικός προστατευτικός εξοπλισμός (ΑΠΕ)', 'ipc', 'on_the_job', 'active', 'Νοσηλεύτρια Επιτήρησης Λοιμώξεων', 'Νοσηλευτικό προσωπικό', -90, 24, 'Ένδυση και αφαίρεση ΑΠΕ, προφυλάξεις επαφής, σταγονιδίων και αερογενούς μετάδοσης.'),
    ('TRN-DEMO-003', 'Bundle πρόληψης CLABSI', 'clinical', 'hybrid', 'active', 'Διευθυντής ΜΕΘ', 'Προσωπικό ΜΕΘ και χειρουργείων', -60, 24, 'Τοποθέτηση και φροντίδα κεντρικών φλεβικών καθετήρων σύμφωνα με το bundle.'),
    ('TRN-DEMO-004', 'Διαχείριση νοσοκομειακών αποβλήτων', 'mandatory', 'online', 'active', 'Υπεύθυνος Περιβαλλοντικής Υγιεινής', 'Όλο το προσωπικό', -150, 36, 'Διαλογή, συσκευασία και μεταφορά ΕΑΑ/ΜΑ.'),
    ('TRN-DEMO-005', 'Ασφαλής χρήση αιχμηρών και PEP', 'occupational_health', 'in_person', 'planned', 'Ιατρός Εργασίας', 'Νοσηλευτικό και ιατρικό προσωπικό', 21, 24, 'Πρόληψη τρυπημάτων από βελόνες και διαδικασία μετά από έκθεση.')
  ) p(id, title, category, method, status, trainer, audience, start_offset, valid_months, descr);

  insert into public.training_records(organization_id, record_key, record_type, payload, created_by, updated_by)
  select v_org, r.id, 'requirement', jsonb_build_object('id', r.id, 'title', r.title, 'programIds', r.programs, 'professions', r.professions,
    'positions', '[]'::jsonb, 'departments', '[]'::jsonb, 'renewalMonths', r.renewal, 'active', true), p_actor, p_actor
  from (values
    ('REQ-DEMO-001', 'Ετήσια εκπαίδευση υγιεινής χεριών', '["TRN-DEMO-001"]'::jsonb, '[]'::jsonb, 12),
    ('REQ-DEMO-002', 'ΑΠΕ για νοσηλευτικό προσωπικό', '["TRN-DEMO-002"]'::jsonb, '["Νοσηλευτής / Νοσηλεύτρια"]'::jsonb, 24)
  ) r(id, title, programs, professions, renewal);

  -- Assignments (the identity trigger links each one to its employee)
  insert into public.training_records(organization_id, record_key, record_type, payload, created_by, updated_by)
  select v_org, 'TRA-DEMO-' || p || '-' || lpad(g::text, 3, '0'), 'assignment',
    jsonb_build_object('id', 'TRA-DEMO-' || p || '-' || lpad(g::text, 3, '0'), 'programId', 'TRN-DEMO-00' || p,
      'employeeId', e.employee_code, 'employeeName', e.last_name || ' ' || e.first_name, 'department', e.department_name, 'email', e.email,
      'assignedDate', (d0 - (150 - p * 30))::text, 'dueDate', (d0 - (120 - p * 30) + g)::text, 'status', st.status,
      'attendanceResponse', case when st.status = 'assigned' then '' else 'accepted' end,
      'attendance', case when st.status = 'completed' then 'present' else '' end,
      'invitationSentAt', (d0 - (150 - p * 30))::text,
      'completionConfirmedAt', case when st.status = 'completed' then (d0 - (145 - p * 30) + g % 9)::text end,
      'score', case when st.status = 'completed' then st.score end,
      'competent', case when st.status = 'completed' then st.score >= 80 end,
      'completedDate', case when st.status = 'completed' then (d0 - (145 - p * 30) + g % 9)::text end,
      'certificateId', case when st.status = 'completed' and st.score >= 80 then 'CRT-DEMO-' || p || '-' || lpad(g::text, 3, '0') end),
    p_actor, p_actor
  from generate_series(1, 4) p
  cross join generate_series(1, 24) g
  join public.employees e on e.organization_id = v_org and e.employee_code = 'EMP-' || lpad(g::text, 3, '0')
  -- Older programs are mostly done; the most recent one is still in progress.
  cross join lateral (select case when p = 4 then (array['assigned', 'in_progress', 'completed'])[1 + g % 3]
                                  when (g + p * 3) % 9 = 0 then 'in_progress' else 'completed' end status,
                             70 + (g * 7 + p * 3) % 31 score) st
  where (g + p) % 4 <> 0;

  insert into public.training_records(organization_id, record_key, record_type, payload, created_by, updated_by)
  select v_org, a.payload->>'certificateId', 'certificate',
    jsonb_build_object('id', a.payload->>'certificateId', 'assignmentId', a.record_key, 'employeeId', a.payload->>'employeeId',
      'title', pr.payload->>'title', 'issuedDate', a.payload->>'completedDate',
      'validUntil', ((a.payload->>'completedDate')::date + make_interval(months => (pr.payload->>'validMonths')::int))::date::text,
      'issuer', 'Επιτροπή Νοσοκομειακών Λοιμώξεων'), p_actor, p_actor
  from public.training_records a
  join public.training_records pr on pr.organization_id = v_org and pr.record_key = a.payload->>'programId'
  where a.organization_id = v_org and a.record_type = 'assignment' and a.payload->>'certificateId' is not null;
end;
$function$;

-- 3. Pharmacy: WHO DDD values and six months of antibiotic dispensing -----------
create or replace function private.demo_seed_pharmacy(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := current_date;
begin
  -- The organization's DDD table is kept across resets, so only missing codes are added.
  insert into public.who_ddd_reference(organization_id, antibiotic_code, ddd_grams, route, source_version, notes, created_by)
  select v_org, r.code, r.ddd, r.route, 'WHO ATC/DDD 2025', r.note, p_actor
  from (values ('ABX-AMX', 3.0, 'P', null), ('ABX-AMC', 3.0, 'P', null), ('ABX-CRO', 2.0, 'P', null), ('ABX-PTZ', 14.0, 'P', null),
               ('ABX-MEM', 3.0, 'P', null), ('ABX-VAN', 2.0, 'P', null), ('ABX-LNZ', 1.2, 'P', null), ('ABX-COL', 0.72, 'P', '9 MU colistimethate'),
               ('ABX-AMK', 1.0, 'P', null), ('ABX-CZA', 6.0, 'P', null), ('ABX-OXA', 2.0, 'P', null)) r(code, ddd, route, note)
  where not exists (select 1 from public.who_ddd_reference w where w.organization_id = v_org and w.antibiotic_code = r.code);

  insert into public.antibiotic_dispensing_periods(organization_id, department_id, period_start, period_end, antibiotic_item_id, quantity_grams,
    source, source_reference, responsible_name, created_by, updated_by)
  select v_org, dep.id, ms.m_start, (ms.m_start + interval '1 month - 1 day')::date, mli.id,
    round((u.base * case when dep.code = 'ΜΕΘ' then u.icu else u.ward end * (0.8 + ((m * 7 + length(dep.code) * 3 + length(u.code)) % 9) / 20.0))::numeric, 1),
    'pharmacy_export', 'DEMO-' || to_char(ms.m_start, 'YYYYMM'), 'Φαρμακείο Νοσοκομείου', p_actor, p_actor
  from generate_series(1, 6) m
  cross join lateral (select (date_trunc('month', d0) - make_interval(months => m))::date m_start) ms
  join public.departments dep on dep.organization_id = v_org and dep.code in ('ΜΕΘ','ΠΑΘ','ΧΕΙΡ','ΚΑΡΔ','ΟΡΘ','ΝΕΦ')
  -- Grams per department and month; about 75 DDD per 100 patient-days in total.
  cross join (values ('ABX-AMC', 300.0, 0.4, 1.0), ('ABX-CRO', 200.0, 0.6, 1.0), ('ABX-PTZ', 900.0, 1.6, 0.6), ('ABX-MEM', 225.0, 2.2, 0.35),
                     ('ABX-VAN', 100.0, 2.0, 0.4), ('ABX-LNZ', 40.0, 2.0, 0.2), ('ABX-COL', 20.0, 3.0, 0.1), ('ABX-AMK', 30.0, 1.5, 0.3),
                     ('ABX-CZA', 90.0, 1.5, 0.05), ('ABX-OXA', 150.0, 0.5, 0.6)) u(code, base, icu, ward)
  join public.master_library_items mli on mli.organization_id = v_org and mli.library_key = 'antibiotics' and mli.code = u.code;
end;
$function$;

-- 4. Occupational health: vaccinations, visits and exposure incidents -----------
create or replace function private.demo_seed_occupational_health(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := current_date;
begin
  insert into public.employee_vaccinations(organization_id, employee_id, vaccine_item_id, vaccine_label_snapshot, dose, vaccination_date, valid_until, status, clinical_notes, created_by, updated_by)
  select v_org, e.id, mli.id, v.label, v.dose, v.vdate, v.valid, v.status, v.notes, p_actor, p_actor
  from public.employees e
  cross join lateral (select substring(e.employee_code from 5)::int g) n
  cross join lateral (values
    ('VAC-INFLUENZA', 'Γρίπη εποχική', 'Εποχική δόση',
      case when n.g % 5 = 3 then d0 - 380 else d0 - n.g * 2 end,
      case when n.g % 5 = 3 then d0 - 15 when n.g % 5 = 0 then null else d0 - n.g * 2 + 365 end,
      case when n.g % 5 = 0 then 'declined' when n.g % 5 = 3 then 'overdue' else 'complete' end,
      case when n.g % 5 = 0 then 'Άρνηση εμβολιασμού – ενημερώθηκε για τους κινδύνους.' end),
    ('VAC-HBV', 'Ηπατίτιδα Β', 'Πλήρης σειρά (3 δόσεις)', d0 - 900 - n.g * 20, null::date,
      case when n.g % 11 = 0 then 'renew_soon' else 'complete' end, case when n.g % 11 = 0 then 'Anti-HBs < 10 mIU/mL – προγραμματισμός αναμνηστικής δόσης.' end),
    ('VAC-MMR', 'Ιλαρά-παρωτίτιδα-ερυθρά (MMR)', '2 δόσεις', d0 - 2000 - n.g * 30, null::date, 'complete', null),
    ('', 'Τέτανος-διφθερίτιδα-κοκκύτης (Tdap)', 'Αναμνηστική', d0 - 3000 + n.g * 50, d0 - 3000 + n.g * 50 + 3650,
      case when d0 - 3000 + n.g * 50 + 3650 < d0 + 180 then 'renew_soon' else 'complete' end, null)
  ) v(code, label, dose, vdate, valid, status, notes)
  left join public.master_library_items mli on mli.organization_id = v_org and mli.library_key = 'vaccines' and mli.code = v.code
  where e.organization_id = v_org and e.employee_code like 'EMP-%' and (v.code <> 'VAC-MMR' or n.g % 3 <> 0) and (v.code <> '' or n.g % 2 = 0);

  insert into public.occupational_health_visits(organization_id, employee_id, visit_date, visit_type, status, fitness_status, follow_up_date, clinical_notes, created_by, updated_by)
  select v_org, e.id, d0 - (n.g * 11) % 300 - 5, case when n.g % 7 = 0 then 'preEmployment' else 'periodic' end, 'completed',
    case when n.g % 9 = 0 then 'fit_with_restrictions' else 'fit' end,
    case when n.g % 9 = 0 then d0 + 30 end,
    case when n.g % 9 = 0 then 'Περιορισμός άρσης βάρους > 15 kg για 3 μήνες.' else 'Κατάλληλος/η για την εργασία.' end, p_actor, p_actor
  from public.employees e cross join lateral (select substring(e.employee_code from 5)::int g) n
  where e.organization_id = v_org and e.employee_code like 'EMP-%'
  union all
  select v_org, e.id, d0 + 3 + n.g, case when n.g % 2 = 0 then 'vaccinationReview' else 'followUp' end, 'scheduled', 'pending', null, null, p_actor, p_actor
  from public.employees e cross join lateral (select substring(e.employee_code from 5)::int g) n
  where e.organization_id = v_org and e.employee_code in ('EMP-003','EMP-008','EMP-013','EMP-018','EMP-022');

  insert into public.occupational_exposure_incidents(organization_id, employee_id, incident_date, exposure_type, device_or_source, body_site, source_patient_status,
    reported_at, pep_administered, pep_details, follow_up_status, follow_up_due_at, notes, status, created_by, updated_by)
  select v_org, e.id, d0 - x.days_ago, x.kind, x.device, x.site, x.source_status, (d0 - x.days_ago)::timestamptz + interval '14 hours',
    x.pep, x.pep_details, x.follow_up, d0 - x.days_ago + 90, x.notes, x.status, p_actor, p_actor
  from (values
    ('EMP-004', 160, 'needlestick', 'Βελόνα φλεβοκέντησης', 'Δάκτυλο αριστερού χεριού', 'negative', false, null, 'closed', 'Ολοκληρώθηκε ο ορολογικός έλεγχος 3 μηνών.', 'closed'),
    ('EMP-010', 75, 'mucocutaneous', 'Πιτσίλισμα αίματος', 'Επιπεφυκότας', 'hcv_positive', false, null, 'scheduled', 'Επανέλεγχος HCV RNA στις 12 εβδομάδες.', 'open'),
    ('EMP-015', 28, 'sharps_object', 'Νυστέρι', 'Παλάμη δεξιού χεριού', 'unknown', true, 'Αναμνηστική δόση HBV και HBIG.', 'pending', 'Αναμονή αποτελεσμάτων πηγής.', 'open'),
    ('EMP-021', 9, 'needlestick', 'Βελόνα ινσουλίνης', 'Αντίχειρας', 'hbv_positive', true, 'HBIG εντός 24 ωρών.', 'pending', null, 'open')
  ) x(code, days_ago, kind, device, site, source_status, pep, pep_details, follow_up, notes, status)
  join public.employees e on e.organization_id = v_org and e.employee_code = x.code;
end;
$function$;

revoke all on function private.demo_seed_controls(uuid, uuid) from public, anon, authenticated;
revoke all on function private.demo_seed_training(uuid, uuid) from public, anon, authenticated;
revoke all on function private.demo_seed_pharmacy(uuid, uuid) from public, anon, authenticated;
revoke all on function private.demo_seed_occupational_health(uuid, uuid) from public, anon, authenticated;

-- 5. Orchestrator: the first pack plus the four new areas ------------------------
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
    'exposures', (select count(*) from public.occupational_exposure_incidents x where x.organization_id = v_org)
  );
end;
$function$;

revoke all on function private.demo_seed_data(uuid, uuid) from public, anon, authenticated;
