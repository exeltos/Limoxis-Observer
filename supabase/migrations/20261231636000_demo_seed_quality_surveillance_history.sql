-- Demo «μία πηγή» (ιδιοκτήτης, 24/11/2026, επιλογή Β): το πραγματικό Demo είχε 10 συμβάντα ποιότητας και 18 επεισόδια
-- επιτήρησης, ενώ η προεπισκόπηση της βοήθειας δείχνει 90 και 54. Δύο νέες συναρτήσεις: συμβάντα των τελευταίων
-- 12 μηνών και κλειστά επεισόδια επιτήρησης στις (πρόσφατες) νοσηλείες των ασθενών του Demo. Καλούνται από τις υπάρχουσες (demo_seed_quality, demo_seed_clinical), ώστε να ξαναμπαίνουν
-- σε κάθε «Επαναφορά δεδομένων». Μόνο προσθήκες· ξανατρέχουν χωρίς διπλά (κωδικός συμβάντος, ασθενής χωρίς επεισόδιο).

-- 30 συμβάντα σε 12 μήνες: πτώσεις, φάρμακα, εξοπλισμός, διαδικασίες, προσωπικό, παράπονα, εγκαταστάσεις.
create or replace function private.demo_seed_incidents_history(p_organization_id uuid, p_actor uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  d0 date := current_date;
  v_depts uuid[] := array(
    select dep.id from (values ('ΜΕΘ',1),('ΠΑΘ',2),('ΧΕΙΡ',3),('ΚΑΡΔ',4),('ΟΡΘ',5),('ΝΕΦ',6),('ΠΑΙΔ',7),('ΜΕΝΝ',8)) o(code, ord)
    join public.departments dep on dep.organization_id = p_organization_id and dep.code = o.code order by o.ord);
begin
  if coalesce(array_length(v_depts, 1), 0) = 0 then return; end if;
  insert into public.quality_incidents(organization_id, code, title, department_id, occurred_at, severity, status, description, category, impact,
    incident_class, reached_patient, harm_occurred, immediate_actions, owner_label, owner_labels, reported_by_label, report_kind)
  select p_organization_id, 'INC-' || to_char(d0 - t.ago, 'YYMMDD') || '-' || lpad((91000 + t.n)::text, 6, '0'), t.title,
    v_depts[1 + (t.n % array_length(v_depts, 1))], (d0 - t.ago) + time '10:40', t.sev,
    case when t.ago > 45 then 'closed' when t.n % 3 = 0 then 'under_review' else 'reported' end,
    t.descr, t.cat, t.imp, t.cls, t.cls <> 'nearMiss', t.cls = 'harmful',
    'Άμεση ενημέρωση υπευθύνου και καταγραφή', 'Υπεύθυνη Ποιότητας', array['Υπεύθυνη Ποιότητας'], 'Νοσηλευτική Υπηρεσία',
    -- The kind of report from the category, as the app reads it (qualityVocabulary CATEGORY_KIND), Codex #701.
    case when t.cat = 'complaint' then 'complaint' when t.cat in ('clinical', 'medication') then 'clinical' else 'nonClinical' end
  from (values
    (1, 70, 'Πτώση ασθενούς στο μπάνιο', 'medium', 'Ασθενής γλίστρησε στο μπάνιο του θαλάμου.', 'clinical', 'minor', 'harmful'),
    (2, 78, 'Παράλειψη δόσης ινσουλίνης', 'high', 'Δεν χορηγήθηκε η βραδινή δόση ινσουλίνης.', 'medication', 'minor', 'noHarm'),
    (3, 85, 'Βλάβη απινιδωτή στο τροχήλατο', 'high', 'Ο απινιδωτής δεν πέρασε τον πρωινό έλεγχο.', 'equipment', 'none', 'nearMiss'),
    (4, 92, 'Λάθος ταυτοποίηση δείγματος', 'medium', 'Ετικέτα δείγματος με λάθος ονοματεπώνυμο.', 'process', 'none', 'nearMiss'),
    (5, 99, 'Νυγμός κατά την αιμοληψία', 'medium', 'Τραυματισμός νοσηλευτή με βελόνα αιμοληψίας.', 'staff', 'minor', 'harmful'),
    (6, 106, 'Παράπονο για καθυστέρηση ενημέρωσης', 'low', 'Συνοδός παραπονέθηκε για καθυστέρηση ενημέρωσης από ιατρό.', 'complaint', 'none', 'nearMiss'),
    (7, 113, 'Διαρροή νερού στον διάδρομο', 'low', 'Διαρροή από το ταβάνι κοντά στους θαλάμους.', 'facility', 'none', 'nearMiss'),
    (8, 120, 'Πτώση ασθενούς κατά τη μεταφορά', 'high', 'Ασθενής έπεσε από φορείο κατά τη μεταφορά στον αξονικό.', 'clinical', 'moderate', 'harmful'),
    (9, 127, 'Λάθος οδός χορήγησης', 'high', 'Ενδοφλέβιο φάρμακο ετοιμάστηκε για ενδομυϊκή χορήγηση· εντοπίστηκε πριν τη χορήγηση.', 'medication', 'none', 'nearMiss'),
    (10, 134, 'Εκτός ορίων θερμοκρασία ψυγείου φαρμάκων', 'medium', 'Το ψυγείο φαρμάκων έδειξε 10°C στον πρωινό έλεγχο.', 'equipment', 'none', 'nearMiss'),
    (11, 141, 'Καθυστέρηση χορήγησης αντιβιοτικού σε σήψη', 'critical', 'Το αντιβιοτικό χορηγήθηκε 3 ώρες μετά την αναγνώριση της σήψης.', 'clinical', 'moderate', 'harmful'),
    (12, 148, 'Ελλιπής ενημέρωση φακέλου', 'low', 'Λείπει η καταγραφή ζωτικών σημείων μίας βάρδιας.', 'process', 'none', 'noHarm'),
    (13, 155, 'Επιθετική συμπεριφορά συνοδού', 'medium', 'Λεκτική επίθεση συνοδού σε νοσηλεύτρια.', 'staff', 'none', 'noHarm'),
    (14, 162, 'Παράπονο για φαγητό', 'low', 'Παράπονο για κρύο φαγητό στο μεσημεριανό.', 'complaint', 'none', 'nearMiss'),
    (15, 169, 'Βλάβη ανελκυστήρα ασθενών', 'medium', 'Ο ανελκυστήρας ασθενών εκτός λειτουργίας για 6 ώρες.', 'facility', 'none', 'noHarm'),
    (16, 176, 'Κατακλίσεις 2ου βαθμού', 'medium', 'Νέα κατάκλιση σε ασθενή με Braden 11.', 'clinical', 'minor', 'harmful'),
    (17, 183, 'Αλλεργική αντίδραση σε αντιβιοτικό', 'high', 'Εξάνθημα μετά από χορήγηση αμοξυκιλλίνης σε ασθενή χωρίς καταγεγραμμένη αλλεργία.', 'medication', 'minor', 'harmful'),
    (18, 190, 'Αποσύνδεση αναπνευστήρα', 'critical', 'Αποσύνδεση κυκλώματος αναπνευστήρα κατά την αλλαγή θέσης.', 'equipment', 'minor', 'harmful'),
    (19, 197, 'Λάθος σήμανση απομόνωσης', 'low', 'Σήμανση σταγονιδίων αντί επαφής σε ασθενή με CPE.', 'process', 'none', 'nearMiss'),
    (20, 204, 'Έκθεση σε βιολογικό υγρό', 'medium', 'Πιτσίλισμα στο πρόσωπο κατά την αναρρόφηση.', 'staff', 'minor', 'harmful'),
    (21, 218, 'Παράπονο για θόρυβο τη νύχτα', 'low', 'Ασθενείς παραπονέθηκαν για θόρυβο στον διάδρομο.', 'complaint', 'none', 'nearMiss'),
    (22, 232, 'Ελλιπής φωτισμός κλιμακοστασίου', 'low', 'Καμένοι λαμπτήρες στο κλιμακοστάσιο έκτακτης ανάγκης.', 'facility', 'none', 'nearMiss'),
    (23, 246, 'Εκτροπή καθετήρα ούρων', 'medium', 'Ο ουροκαθετήρας αφαιρέθηκε κατά λάθος από τον ασθενή.', 'clinical', 'minor', 'noHarm'),
    (24, 260, 'Διπλή συνταγογράφηση αντιπηκτικού', 'high', 'Συνταγογραφήθηκαν δύο αντιπηκτικά· εντοπίστηκε από το φαρμακείο.', 'medication', 'none', 'nearMiss'),
    (25, 274, 'Βλάβη αντλίας σίτισης', 'low', 'Η αντλία εντερικής σίτισης σταματούσε απρόσμενα.', 'equipment', 'none', 'noHarm'),
    (26, 288, 'Καθυστέρηση αποτελέσματος καλλιέργειας', 'medium', 'Το αποτέλεσμα κοινοποιήθηκε στο τμήμα με 2 ημέρες καθυστέρηση.', 'process', 'minor', 'noHarm'),
    (27, 302, 'Ολίσθηση εργαζομένου', 'low', 'Εργαζόμενη γλίστρησε σε βρεγμένο δάπεδο.', 'staff', 'minor', 'harmful'),
    (28, 316, 'Παράπονο για αναμονή στα εξωτερικά', 'low', 'Αναμονή άνω των 2 ωρών για ραντεβού.', 'complaint', 'none', 'nearMiss'),
    (29, 330, 'Διακοπή ρεύματος στη ΜΕΘ', 'high', 'Διακοπή 20 δευτερολέπτων μέχρι την εκκίνηση της γεννήτριας.', 'facility', 'none', 'nearMiss'),
    (30, 344, 'Πτώση ασθενούς με παραλήρημα', 'high', 'Ασθενής με παραλήρημα σηκώθηκε χωρίς βοήθεια και έπεσε.', 'clinical', 'moderate', 'harmful')
  ) t(n, ago, title, sev, descr, cat, imp, cls)
  on conflict (organization_id, code) do nothing;
end
$fn$;

-- 22 κλειστά επεισόδια επιτήρησης σε ασθενείς χωρίς κανένα επεισόδιο: υποψία που αποκλείστηκε μετά την παρακολούθηση.
-- Στις ημερομηνίες νοσηλείας τους, άρα στους τελευταίους μήνες (οι νοσηλείες του Demo είναι πρόσφατες).
-- Χωρίς ταξινόμηση ΛΣΦΥ, ώστε να μην αλλάζουν οι δείκτες λοιμώξεων του Demo.
create or replace function private.demo_seed_surveillance_history(p_organization_id uuid, p_actor uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_now timestamptz := now();
begin
  with p as (
    select pt.id, pt.department_id, pt.admission_date, row_number() over (order by pt.patient_code) rn
    from public.patients pt
    where pt.organization_id = p_organization_id and pt.admission_date is not null
      and not exists (select 1 from public.surveillance_cases c where c.patient_id = pt.id)
    order by pt.patient_code limit 22
  ), c as (
    insert into public.surveillance_cases(organization_id, patient_id, department_id, status, started_at, closed_at, close_reason, created_by, closed_by,
      admission_id, room, reason, suspected_source)
    select p_organization_id, p.id, p.department_id, 'closed',
      least((p.admission_date + 2) + time '10:00', v_now - interval '4 days'),
      least((p.admission_date + 9) + time '12:00', v_now - interval '1 day'),
      'Αποκλείστηκε λοίμωξη — ολοκληρώθηκε η παρακολούθηση', p_actor, p_actor,
      (select a.id from public.patient_admissions a where a.patient_id = p.id order by a.admission_date desc limit 1),
      'Θάλαμος ' || (200 + p.rn * 2),
      (array['Πυρετός μετά από χειρουργείο','Θετική καλλιέργεια ούρων χωρίς συμπτώματα','Αυξημένοι δείκτες φλεγμονής','Ερυθρότητα στο σημείο φλεβοκαθετήρα','Επαφή με ασθενή με CPE'])[1 + p.rn % 5],
      (array['surgicalSite','urinary','other','bloodstream','other'])[1 + p.rn % 5]
    from p
    returning id, started_at
  )
  insert into public.surveillance_events(organization_id, surveillance_case_id, event_type, event_status, occurred_at, detail, created_by, completed_by, completed_at)
  select p_organization_id, c.id, 'surveillance_start', 'completed', c.started_at, 'Demo', p_actor, p_actor, c.started_at
  from c;
end
$fn$;

-- Οι δύο νέες μπαίνουν στις υπάρχουσες, ώστε να ξανατρέχουν σε κάθε «Επαναφορά δεδομένων».
create or replace function private.demo_seed_quality(p_organization_id uuid, p_actor uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $fn$
begin
  perform private.demo_seed_quality_audits(p_organization_id, p_actor);
  perform private.demo_seed_quality_enrich(p_organization_id, p_actor);
  perform private.demo_seed_quality_surveys(p_organization_id, p_actor);
  perform private.demo_seed_quality_indicators(p_organization_id, p_actor);
  perform private.demo_seed_quality_risks(p_organization_id, p_actor);
  perform private.demo_seed_quality_audit_programme(p_organization_id, p_actor);
  -- Συμβάντα 12 μηνών (24/11/2026).
  perform private.demo_seed_incidents_history(p_organization_id, p_actor);
end;
$fn$;

create or replace function private.demo_seed_clinical(p_organization_id uuid, p_actor uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $fn$
begin
  perform set_config('limoxis.test_reset', 'on', true);
  perform private.demo_seed_clinical_patients(p_organization_id, p_actor);
  perform private.demo_seed_clinical_lab_fixes(p_organization_id, p_actor);
  perform private.demo_seed_clinical_paediatric(p_organization_id, p_actor);
  perform private.demo_seed_clinical_case_depth(p_organization_id, p_actor);
  perform private.demo_seed_clinical_kpc_cluster(p_organization_id, p_actor);
  perform private.demo_seed_clinical_outbreak(p_organization_id, p_actor);
  perform private.demo_seed_clinical_employee_environment(p_organization_id, p_actor);
  -- Κλειστά επεισόδια που αποκλείστηκαν (24/11/2026).
  perform private.demo_seed_surveillance_history(p_organization_id, p_actor);
end;
$fn$;

revoke all on function private.demo_seed_incidents_history(uuid, uuid) from public, anon, authenticated;
revoke all on function private.demo_seed_surveillance_history(uuid, uuid) from public, anon, authenticated;
