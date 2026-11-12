-- Quality governance in every Demo organization: department meetings with their groups,
-- topics, decisions, corrective actions, trainings and attendance; the management review
-- (one approved last year, one being written now); the quality objectives with their monthly
-- values (some on target, some not); the departments' self-assessments on the ward checklist;
-- the satisfaction survey's answers (so the satisfaction indicators have values) and the
-- kitchen's recall drills. Dates are relative to today; names are made up and come from the
-- Demo's own employees. private.demo_seed_quality_governance fills one Demo organization.

-- A repeatable number in [0, 1) from a text: the same Demo every time.
create or replace function private.demo_unit_random(p_key text)
returns double precision language sql immutable set search_path = ''
as $function$
  select (('x' || substr(md5(p_key), 1, 8))::bit(32)::bigint)::double precision / 4294967296.0
$function$;
revoke all on function private.demo_unit_random(text) from public, anon, authenticated;

-- Department meetings: one group per department that meets, its meetings since January of
-- last year (each: two topics, a decision, sometimes a corrective action or a training, and
-- the attendance), the latest one of Surgery still a draft, Orthopaedics overdue, and an
-- extraordinary ICU meeting about a CPE cluster.
create or replace function private.demo_seed_quality_meetings(v_org uuid)
returns void language plpgsql set search_path = ''
as $function$
declare
  d0 date := current_date;
  v_start date := make_date(extract(year from current_date)::integer - 1, 1, 1);
  -- (department code, short name, frequency in days, months between meetings, day of month, days before today the meetings stop)
  v_groups text[] := array[
    array['ΜΕΘ', 'ΜΕΘ', '30', '1', '18', '3'],
    array['ΠΑΘ', 'Παθολογικής', '30', '1', '22', '3'],
    array['ΧΕΙΡ', 'Χειρουργικής', '30', '1', '8', '3'],
    array['ΜΕΝΝ', 'ΜΕΝΝ', '60', '2', '12', '3'],
    array['ΚΑΡΔ', 'Καρδιολογικής', '90', '3', '25', '3'],
    array['ΟΡΘ', 'Ορθοπαιδικής', '90', '3', '14', '130']];
  -- (topic, discussion, conclusion, decision)
  v_topics text[] := array[
    array['Δείκτες του μήνα', 'Οι δείκτες του τμήματος είναι εντός στόχου, εκτός από τη συμμόρφωση στην υγιεινή χεριών.', 'Στοχευμένες παρατηρήσεις υγιεινής χεριών τις επόμενες δύο εβδομάδες.', 'Στοχευμένες παρατηρήσεις υγιεινής χεριών σε όλες τις βάρδιες'],
    array['Συμβάντα και διορθωτικές ενέργειες', 'Συζητήθηκαν τα συμβάντα του μήνα και η πορεία των ανοιχτών διορθωτικών ενεργειών.', 'Κλείνουν όσες ολοκληρώθηκαν· οι υπόλοιπες συνεχίζονται.', 'Ενημέρωση των υπευθύνων για τις ανοιχτές διορθωτικές ενέργειες'],
    array['Λοιμώξεις και απομονώσεις', 'Δύο ασθενείς σε απομόνωση επαφής· τηρήθηκαν τα μέτρα, με μία παράλειψη στη σήμανση.', 'Υπενθύμιση της σήμανσης απομόνωσης σε κάθε βάρδια.', 'Έλεγχος της σήμανσης απομόνωσης στην πρωινή αναφορά'],
    array['Εκπαίδευση προσωπικού', 'Δύο νέοι συνάδελφοι χρειάζονται εισαγωγική εκπαίδευση.', 'Πρόγραμμα εκπαίδευσης για τους νέους συναδέλφους.', 'Εισαγωγική εκπαίδευση των νέων συναδέλφων'],
    array['Εξοπλισμός και υλικά', 'Καθυστέρηση στην προμήθεια επιθεμάτων και ένας ογκομετρικός αντλιοδότης εκτός λειτουργίας.', 'Αίτημα προς το Γραφείο Προμηθειών και τη Βιοϊατρική Τεχνολογία.', 'Αίτημα προμήθειας επιθεμάτων και επισκευής του αντλιοδότη'],
    array['Ικανοποίηση ασθενών', 'Τα σχόλια του μήνα αφορούν κυρίως τον θόρυβο τη νύχτα και τη θερμοκρασία του φαγητού.', 'Ησυχία στον διάδρομο μετά τις 23:00.', 'Μέτρα για τον θόρυβο τη νύχτα'],
    array['Πτώσεις και έλκη πίεσης', 'Μία πτώση χωρίς κάκωση· τα έλκη πίεσης μειώθηκαν.', 'Αξιολόγηση κινδύνου πτώσης σε κάθε εισαγωγή.', 'Έλεγχος της αξιολόγησης κινδύνου πτώσης στους φακέλους'],
    array['Φάρμακα υψηλού κινδύνου', 'Ο διπλός έλεγχος τηρείται στις περισσότερες χορηγήσεις· δύο παραλείψεις τη νύχτα.', 'Υπενθύμιση του διπλού ελέγχου στις βάρδιες.', 'Αυτοέλεγχος του διπλού ελέγχου στη νυχτερινή βάρδια']];
  v_programs text[] := array['TRN-DEMO-001', 'TRN-DEMO-003', 'TRN-DEMO-012', 'TRN-DEMO-016', 'TRN-DEMO-011'];
  g integer; i integer; v_dep uuid; v_dep_name text; v_group uuid; v_manager text; v_step integer; v_day integer;
  v_date date; v_next date; v_until date; v_last boolean; v_year integer; v_n integer; v_code text; v_meeting uuid;
  t1 integer; t2 integer; v_t1 uuid; v_t2 uuid; v_status text; v_program uuid; v_key text; v_capa uuid; v_prev_code text;
begin
  for g in 1..array_length(v_groups, 1) loop
    select d.id, d.name into v_dep, v_dep_name from public.departments d where d.organization_id = v_org and d.code = v_groups[g][1];
    if v_dep is null then continue; end if;
    select e.first_name || ' ' || e.last_name into v_manager from public.employees e
      where e.organization_id = v_org and e.department_id = v_dep and e.position_name like 'Προϊστάμεν%' order by e.employee_code limit 1;
    v_manager := coalesce(v_manager, 'Προϊστάμενος/η τμήματος');
    insert into public.quality_department_meeting_groups (organization_id, department_id, name, frequency_days, duration_hours, manager_label, active)
    values (v_org, v_dep, 'Συναντήσεις ' || v_groups[g][2], v_groups[g][3]::integer, case when g = 1 then 1.5 else 1 end, v_manager, true)
    returning id into v_group;
    v_step := v_groups[g][4]::integer; v_day := v_groups[g][5]::integer; v_until := d0 - v_groups[g][6]::integer;
    v_year := 0; v_n := 0; v_prev_code := null;
    for i in 0..40 loop
      v_key := v_org::text || '|meeting|' || g || '|' || i;
      v_date := (v_start + make_interval(months => i * v_step))::date + v_day - 1 + floor(private.demo_unit_random(v_key) * 5)::integer - 2;
      exit when v_date > v_until;
      v_next := (v_start + make_interval(months => (i + 1) * v_step))::date + v_day - 1 + floor(private.demo_unit_random(v_org::text || '|meeting|' || g || '|' || (i + 1)) * 5)::integer - 2;
      v_last := v_next > v_until;
      if extract(year from v_date)::integer <> v_year then v_year := extract(year from v_date)::integer; v_n := 0; end if;
      v_n := v_n + 1;
      v_code := 'DM-' || v_year || '-' || lpad(v_n::text, 2, '0');
      t1 := ((i * 3 + g * 2) % 8) + 1;
      t2 := ((i * 3 + g * 2 + 5) % 8) + 1;
      v_status := case when v_last and v_groups[g][1] = 'ΧΕΙΡ' then 'draft' else 'final' end;
      v_program := null;
      if i % 3 = 2 then
        select p.id into v_program from public.training_programs p where p.organization_id = v_org and p.program_key = v_programs[((i / 3 + g) % 5) + 1];
      end if;
      insert into public.quality_department_meetings (organization_id, department_id, group_id, code, title, kind, meeting_date, period_month, agenda, minutes,
        next_meeting_date, status, finalized_at, finalized_by_label, training_held, training_program_id)
      values (v_org, v_dep, v_group, v_code, 'Συνάντηση ' || v_groups[g][2], 'regular', v_date, (date_trunc('month', v_date) - interval '1 month')::date,
        v_topics[t1][1] || E'\n' || v_topics[t2][1], v_topics[t1][2], v_date + v_groups[g][3]::integer, v_status,
        case when v_status = 'final' then (v_date + 2 + time '13:00') at time zone 'Europe/Athens' end, case when v_status = 'final' then v_manager end,
        v_program is not null, v_program)
      returning id into v_meeting;
      insert into public.quality_department_meeting_topics (organization_id, meeting_id, position, subject, discussion, conclusion)
      values (v_org, v_meeting, 0, v_topics[t1][1], v_topics[t1][2], v_topics[t1][3]) returning id into v_t1;
      insert into public.quality_department_meeting_topics (organization_id, meeting_id, position, subject, discussion, conclusion)
      values (v_org, v_meeting, 1, v_topics[t2][1], v_topics[t2][2], v_topics[t2][3]) returning id into v_t2;
      -- A corrective action of the department behind some recent decisions.
      v_capa := null;
      if v_date > d0 - 200 and private.demo_unit_random(v_key || '|capa') < 0.4 then
        select c.id into v_capa from public.quality_capa_actions c where c.organization_id = v_org and c.department_id = v_dep order by c.code limit 1;
      end if;
      insert into public.quality_department_meeting_decisions (organization_id, meeting_id, position, topic_id, title, owner_label, due_date, status, capa_id)
      values (v_org, v_meeting, 0, v_t1, v_topics[t1][4], v_manager, v_date + case when v_groups[g][1] = 'ΠΑΘ' then 14 else 30 end,
        case when v_last then 'open' when private.demo_unit_random(v_key || '|d0') < 0.9 then 'done' else 'cancelled' end, v_capa);
      if private.demo_unit_random(v_key || '|d1') < 0.45 then
        insert into public.quality_department_meeting_decisions (organization_id, meeting_id, position, topic_id, title, owner_label, due_date, status)
        values (v_org, v_meeting, 1, v_t2, v_topics[t2][4], 'Υπεύθυνος Ποιότητας', v_date + 45,
          case when v_last then 'open' when private.demo_unit_random(v_key || '|d1s') < 0.85 then 'done' else 'cancelled' end);
      end if;
      if v_program is not null then
        insert into public.quality_department_meeting_trainings (organization_id, meeting_id, position, topic, audience, due_date, training_program_id)
        select v_org, v_meeting, 0, p.title, 'Προσωπικό ' || v_dep_name, v_date, p.id from public.training_programs p where p.id = v_program;
      end if;
      insert into public.quality_department_meeting_participants (organization_id, meeting_id, position, name, role, attended, employee_id)
      select v_org, v_meeting, (row_number() over (order by e.employee_code))::integer - 1, e.first_name || ' ' || e.last_name, e.position_name,
        private.demo_unit_random(v_key || '|p|' || e.id) < 0.9, e.id
      from public.employees e where e.organization_id = v_org and e.department_id = v_dep;
      insert into public.quality_department_meeting_participants (organization_id, meeting_id, position, name, role, attended)
      values (v_org, v_meeting, 10, 'Υπεύθυνος Ποιότητας', 'Ποιότητα', true);
      v_prev_code := v_code;
    end loop;

    -- An extraordinary ICU meeting about the CPE cluster: its decisions are open, one carried from the last regular meeting.
    if v_groups[g][1] = 'ΜΕΘ' and v_prev_code is not null then
      v_date := d0 - 9;
      if extract(year from v_date)::integer <> v_year then v_n := 0; end if;
      v_code := 'DM-' || extract(year from v_date)::integer || '-' || lpad((v_n + 1)::text, 2, '0');
      insert into public.quality_department_meetings (organization_id, department_id, group_id, code, title, kind, meeting_date, period_month, agenda, minutes,
        next_meeting_date, status, finalized_at, finalized_by_label)
      values (v_org, v_dep, v_group, v_code, 'Έκτακτη συνάντηση ΜΕΘ — συρροή CPE', 'extraordinary', v_date, (date_trunc('month', v_date) - interval '1 month')::date,
        E'Συρροή CPE στη ΜΕΘ\nΜέτρα ελέγχου', 'Τρεις ασθενείς με CPE μέσα σε δέκα ημέρες· η ομάδα πρόληψης λοιμώξεων παρουσίασε τα μέτρα.', v_date + 30, 'final',
        (v_date + 1 + time '12:00') at time zone 'Europe/Athens', v_manager)
      returning id into v_meeting;
      insert into public.quality_department_meeting_topics (organization_id, meeting_id, position, subject, discussion, conclusion)
      values (v_org, v_meeting, 0, 'Συρροή CPE στη ΜΕΘ', 'Τρεις ασθενείς με CPE μέσα σε δέκα ημέρες, όλοι στην ίδια πτέρυγα.', 'Κοόρτη των ασθενών με αφιερωμένο προσωπικό και εβδομαδιαίος έλεγχος όλων των ασθενών.')
      returning id into v_t1;
      insert into public.quality_department_meeting_topics (organization_id, meeting_id, position, subject, discussion, conclusion)
      values (v_org, v_meeting, 1, 'Καθαρισμός και απολύμανση εξοπλισμού', 'Ο υπερηχογράφος μετακινείται μεταξύ των θαλάμων χωρίς απολύμανση.', 'Απολύμανση μετά από κάθε χρήση, με καταγραφή.')
      returning id into v_t2;
      select c.id into v_capa from public.quality_capa_actions c where c.organization_id = v_org and c.code like 'CAPA-OUT-%' order by c.code limit 1;
      insert into public.quality_department_meeting_decisions (organization_id, meeting_id, position, topic_id, title, owner_label, due_date, status, capa_id, carried_from)
      values (v_org, v_meeting, 0, v_t1, 'Κοόρτη ασθενών με CPE και αφιερωμένο προσωπικό', v_manager, d0 + 5, 'open', v_capa, null),
        (v_org, v_meeting, 1, v_t2, 'Απολύμανση του υπερηχογράφου μετά από κάθε χρήση', 'Ομάδα Πρόληψης Λοιμώξεων', d0 - 2, 'open', null, null),
        (v_org, v_meeting, 2, null, (select d.title from public.quality_department_meeting_decisions d join public.quality_department_meetings m on m.id = d.meeting_id
            where m.organization_id = v_org and m.group_id = v_group and m.code = v_prev_code and d.position = 0), v_manager, d0 + 20, 'open', null, v_prev_code);
      insert into public.quality_department_meeting_participants (organization_id, meeting_id, position, name, role, attended, employee_id)
      select v_org, v_meeting, (row_number() over (order by e.employee_code))::integer - 1, e.first_name || ' ' || e.last_name, e.position_name, true, e.id
      from public.employees e where e.organization_id = v_org and e.department_id = v_dep;
      insert into public.quality_department_meeting_participants (organization_id, meeting_id, position, name, role, attended)
      values (v_org, v_meeting, 10, 'Ιατρός Λοιμώξεων', 'Επιτροπή Λοιμώξεων', true), (v_org, v_meeting, 11, 'Υπεύθυνος Ποιότητας', 'Ποιότητα', true);
    end if;
  end loop;
end;
$function$;
revoke all on function private.demo_seed_quality_meetings(uuid) from public, anon, authenticated;

-- The management review: last year's, approved and signed, and this year's, being written.
create or replace function private.demo_seed_quality_reviews(v_org uuid)
returns void language plpgsql set search_path = ''
as $function$
declare
  d0 date := current_date;
  v_year integer := extract(year from current_date)::integer;
  v_last date := make_date(extract(year from current_date)::integer - 1, 12, 12);
  v_keys text[] := array['previous_actions', 'context_changes', 'satisfaction', 'objectives', 'process_performance', 'nonconformities', 'monitoring', 'audits',
    'providers', 'risks', 'resources', 'climate', 'compliance', 'adverse_events', 'improvements', 'conclusions'];
  v_titles text[] := array['Ανασκόπηση Ενεργειών Προηγούμενων Συνεδριάσεων', 'Αλλαγές σε Εξωτερικά και Εσωτερικά Ζητήματα που Αφορούν το Σύστημα Διαχείρισης Ποιότητας',
    'Ικανοποίηση Ασθενών και Ανατροφοδότηση από τα Ενδιαφερόμενα Μέρη', 'Βαθμός Επίτευξης των Στόχων Ποιότητας', 'Επίδοση Διεργασιών και Συμμόρφωση των Παρεχόμενων Υπηρεσιών',
    'Μη Συμμορφώσεις και Διορθωτικές Ενέργειες', 'Αποτελέσματα Παρακολούθησης και Μέτρησης', 'Αποτελέσματα Εσωτερικών, Εξωτερικών και Κανονιστικών Επιθεωρήσεων',
    'Επίδοση Εξωτερικών Παρόχων', 'Αποτελεσματικότητα Ενεργειών Αντιμετώπισης Κινδύνων και Αξιοποίησης Ευκαιριών', 'Επάρκεια και Διαθεσιμότητα Απαιτούμενων Πόρων',
    'Κλιματική Αλλαγή – Υπολογισμός Ανθρακικού Αποτυπώματος', 'Συμμόρφωση με Νομοθετικές και Κανονιστικές Απαιτήσεις', 'Αναφορά και Διαχείριση Ανεπιθύμητων Συμβάντων',
    'Ευκαιρίες προς Βελτίωση', 'Γενικά Συμπεράσματα Ανασκόπησης Διοίκησης'];
  v_before text[] := array[
    'Από τις ενέργειες της προηγούμενης ανασκόπησης ολοκληρώθηκαν όλες εκτός από τη μετάβαση των ελέγχων των τμημάτων στην πλατφόρμα, που συνεχίζεται.',
    'Νέα εγκύκλιος για την επιτήρηση των πολυανθεκτικών μικροοργανισμών· αυξημένη πληρότητα της Παθολογικής το φθινόπωρο.',
    'Η συνολική ικανοποίηση ασθενών ήταν 86% (στόχος 85%)· η ικανοποίηση από τη διατροφή 76%, κάτω από τον στόχο του 80%.',
    'Οι περισσότεροι στόχοι του έτους επιτεύχθηκαν· υστέρησαν οι πτώσεις ασθενών στην Παθολογική, η εκτίμηση κινδύνου πτώσης στην Καρδιολογική και το κλείσιμο διορθωτικών ενεργειών εντός προθεσμίας.',
    'Οι διεργασίες των κλινικών τμημάτων λειτούργησαν σύμφωνα με το σχέδιο· οι έλεγχοι των τμημάτων τηρήθηκαν σε ποσοστό 92%.',
    'Οι μη συμμορφώσεις των επιθεωρήσεων αφορούσαν κυρίως την τεκμηρίωση· οι διορθωτικές ενέργειες έκλεισαν στο μεγαλύτερο μέρος τους.',
    'Οι δείκτες λοιμώξεων ήταν εντός των ορίων· η συμμόρφωση στην υγιεινή χεριών ξεπέρασε το 80%.',
    'Ολοκληρώθηκαν οι εσωτερικές επιθεωρήσεις του προγράμματος· η εξωτερική επιθεώρηση επιτήρησης έκλεισε χωρίς μείζονες μη συμμορφώσεις.',
    'Αξιολογήθηκαν οι κρίσιμοι προμηθευτές· ένας προμηθευτής τροφίμων τέθηκε σε επιτήρηση λόγω αποκλίσεων θερμοκρασίας κατά την παραλαβή.',
    'Το μητρώο κινδύνων επανεξετάστηκε· ο κίνδυνος πτώσεων στην Ορθοπαιδική μειώθηκε μετά τα μέτρα.',
    'Χρειάζεται ενίσχυση του νοσηλευτικού προσωπικού της ΜΕΘ και αντικατάσταση δύο ογκομετρικών αντλιοδοτών.',
    'Το ανθρακικό αποτύπωμα υπολογίστηκε για πρώτη φορά· προτεραιότητα η μείωση της κατανάλωσης ενέργειας στους ψύκτες.',
    'Δεν εντοπίστηκαν αποκλίσεις από τη νομοθεσία· ενημερώθηκε το μητρώο νομοθετικών απαιτήσεων.',
    'Τα περισσότερα ανεπιθύμητα συμβάντα ήταν πτώσεις και συμβάντα φαρμάκων· κανένα δεν προκάλεσε μόνιμη βλάβη.',
    'Ψηφιακή καταγραφή των ελέγχων των τμημάτων και ενιαίο πρόγραμμα εκπαίδευσης του νέου προσωπικού.',
    'Το Σύστημα Διαχείρισης Ποιότητας παραμένει κατάλληλο, επαρκές και αποτελεσματικό.'];
  -- This year's review: the first sections written, the rest still empty.
  v_now text[] := array[
    'Ολοκληρώθηκαν οι τρεις από τις τέσσερις ενέργειες της προηγούμενης ανασκόπησης· η ενίσχυση του προσωπικού της ΜΕΘ μεταφέρεται.',
    'Νέες απαιτήσεις για την αναφορά των λοιμώξεων· έναρξη λειτουργίας της ανακαινισμένης Χειρουργικής.',
    'Η ικανοποίηση ασθενών κινείται κοντά στον στόχο· η ικανοποίηση από τη διατροφή παραμένει χαμηλότερα.',
    'Οι στόχοι του έτους παρακολουθούνται μήνα προς μήνα· εκτός στόχου οι πτώσεις στην Παθολογική και το κλείσιμο διορθωτικών ενεργειών εντός προθεσμίας.',
    'Οι διεργασίες λειτουργούν σύμφωνα με το σχέδιο.',
    'Η συρροή CPE στη ΜΕΘ οδήγησε σε διορθωτικές ενέργειες που βρίσκονται σε εξέλιξη.',
    'Η συμμόρφωση στην υγιεινή χεριών και στις δέσμες μέτρων παρακολουθείται μηνιαία.',
    'Το πρόγραμμα εσωτερικών επιθεωρήσεων του έτους έχει ολοκληρωθεί κατά το μεγαλύτερο μέρος.',
    'Ο προμηθευτής τροφίμων που ήταν σε επιτήρηση βελτίωσε τις παραλαβές του.',
    '', '', '', '', '', '', ''];
  v_people text[] := array[array['Διοικητής', 'Διοίκηση'], array['Διευθυντής Ιατρικής Υπηρεσίας', 'Ιατρική Υπηρεσία'], array['Διευθύντρια Νοσηλευτικής Υπηρεσίας', 'Νοσηλευτική Υπηρεσία'],
    array['Υπεύθυνος Ποιότητας', 'Ποιότητα'], array['Πρόεδρος Επιτροπής Λοιμώξεων', 'Επιτροπή Λοιμώξεων']];
  v_review uuid; v_approved timestamptz := (v_last + 5 + time '12:00') at time zone 'Europe/Athens';
begin
  insert into public.quality_management_reviews (organization_id, code, title, review_date, period_from, period_to, frequency_days, next_review_date, status, summary, approved_at, approved_by_label)
  values (v_org, 'MR-' || (v_year - 1) || '-01', 'Ανασκόπηση Διοίκησης ' || (v_year - 1), v_last, make_date(v_year - 1, 1, 1), v_last, 365, v_last + 365, 'approved',
    'Το σύστημα λειτουργεί αποτελεσματικά· προτεραιότητες η πρόληψη πτώσεων και η ικανοποίηση από τη διατροφή.', v_approved, 'Διοικητής')
  returning id into v_review;
  insert into public.quality_management_review_sections (organization_id, review_id, key, position, title, body)
  select v_org, v_review, v_keys[s.k], s.k - 1, v_titles[s.k], v_before[s.k] from generate_series(1, 16) s(k);
  insert into public.quality_management_review_actions (organization_id, review_id, position, section_key, title, owner_label, due_date, status)
  values (v_org, v_review, 0, 'improvements', 'Μετάβαση των ελέγχων των τμημάτων στην πλατφόρμα', 'Ομάδα Ποιότητας', v_last + 60, 'done'),
    (v_org, v_review, 1, 'resources', 'Ενίσχυση του νοσηλευτικού προσωπικού της ΜΕΘ με δύο νοσηλευτές', 'Διεύθυνση Νοσηλευτικής Υπηρεσίας', v_last + 120, 'open'),
    (v_org, v_review, 2, 'satisfaction', 'Βελτίωση της θερμοκρασίας του φαγητού κατά το σερβίρισμα', 'Υπεύθυνη Κουζίνας', v_last + 90, 'done'),
    (v_org, v_review, 3, 'objectives', 'Πρόγραμμα πρόληψης πτώσεων στην Παθολογική', 'Προϊστάμενος Παθολογικής', v_last + 90, 'done');
  insert into public.quality_management_review_participants (organization_id, review_id, position, name, role, attended, signed_at)
  select v_org, v_review, s.k - 1, v_people[s.k][1], v_people[s.k][2], s.k <> 5, case when s.k <> 5 then v_approved end from generate_series(1, 5) s(k);

  insert into public.quality_management_reviews (organization_id, code, title, review_date, period_from, period_to, frequency_days, next_review_date, status)
  values (v_org, 'MR-' || v_year || '-01', 'Ανασκόπηση Διοίκησης ' || v_year, d0 - 4, v_last + 1, d0 - 4, 365, d0 - 4 + 365, 'draft')
  returning id into v_review;
  insert into public.quality_management_review_sections (organization_id, review_id, key, position, title, body)
  select v_org, v_review, v_keys[s.k], s.k - 1, v_titles[s.k], nullif(v_now[s.k], '') from generate_series(1, 16) s(k);
  insert into public.quality_management_review_actions (organization_id, review_id, position, section_key, title, owner_label, due_date, status)
  values (v_org, v_review, 0, 'resources', 'Ενίσχυση του νοσηλευτικού προσωπικού της ΜΕΘ με δύο νοσηλευτές', 'Διεύθυνση Νοσηλευτικής Υπηρεσίας', v_last + 120, 'open'),
    (v_org, v_review, 1, 'providers', 'Επαναξιολόγηση του προμηθευτή τροφίμων που ήταν σε επιτήρηση', 'Υπεύθυνος Ποιότητας', d0 + 45, 'open'),
    (v_org, v_review, 2, 'nonconformities', 'Κλείσιμο των διορθωτικών ενεργειών εντός προθεσμίας: εβδομαδιαία παρακολούθηση', 'Ομάδα Ποιότητας', d0 + 60, 'open');
  insert into public.quality_management_review_participants (organization_id, review_id, position, name, role, attended)
  select v_org, v_review, s.k - 1, v_people[s.k][1], v_people[s.k][2], true from generate_series(1, 5) s(k);
end;
$function$;
revoke all on function private.demo_seed_quality_reviews(uuid) from public, anon, authenticated;

-- The quality objectives of this year and last year: five on the platform's indicators (their
-- value comes from the hospital's data) and seven measured by a value per month, entered by
-- their owner; some on target, some not. Last year's are closed as achieved or not.
create or replace function private.demo_seed_quality_objectives(v_org uuid)
returns void language plpgsql set search_path = ''
as $function$
declare
  v_year integer := extract(year from current_date)::integer;
  v_months integer := extract(month from current_date)::integer - 1;
  r record; v_id uuid; v_past numeric[]; v_mean numeric; y integer;
begin
  for r in
    select * from (values
      (1, 'hospital', null, null, 'patient-satisfaction', 'Συνολική ικανοποίηση ασθενών ≥ 85%', 'Overall patient satisfaction ≥ 85%', 85::numeric, 'higher', '%', 'Υπεύθυνος Ποιότητας', null::numeric[], 0::numeric),
      (2, 'hospital', null, null, 'food-satisfaction', 'Ικανοποίηση από τη διατροφή ≥ 80%', 'Satisfaction with the food ≥ 80%', 80, 'higher', '%', 'Υπεύθυνη Κουζίνας', null, 0),
      (3, 'hospital', null, null, 'hh-compliance', 'Συμμόρφωση στην υγιεινή των χεριών ≥ 80%', 'Hand hygiene compliance ≥ 80%', 80, 'higher', '%', 'Νοσηλευτής/τρια Επιτήρησης Λοιμώξεων', null, 0),
      (4, 'hospital', null, null, 'bundle-compliance', 'Συμμόρφωση στις δέσμες μέτρων ≥ 95%', 'Bundle compliance ≥ 95%', 95, 'higher', '%', 'Επιτροπή Λοιμώξεων', null, 0),
      (5, 'hospital', null, null, 'training-completion', 'Ολοκλήρωση της υποχρεωτικής εκπαίδευσης ≥ 90%', 'Mandatory training completion ≥ 90%', 90, 'higher', '%', 'Υπεύθυνος Εκπαίδευσης', null, 0),
      (6, 'department', 'ΜΕΘ', null, null, 'Αφαίρεση περιττού κεντρικού φλεβικού καθετήρα εντός 24 ωρών ≥ 95%', 'Unneeded central line removed within 24 hours ≥ 95%', 95, 'higher', '%', 'Διευθυντής ΜΕΘ',
        array[96, 94, 97, 95, 93, 96, 97, 95, 96, 98, 97, 96]::numeric[], 0.5),
      (7, 'department', 'ΠΑΘ', null, null, 'Πτώσεις ασθενών ≤ 1,5 ανά 1.000 ημέρες νοσηλείας', 'Patient falls ≤ 1.5 per 1,000 patient days', 1.5, 'lower', 'ανά 1.000 ημέρες νοσηλείας', 'Προϊστάμενος Παθολογικής',
        array[1.8, 1.4, 2.1, 1.6, 1.9, 1.2, 1.7, 2.0, 1.5, 1.8, 1.6, 1.5]::numeric[], 0.3),
      (8, 'department', 'ΧΕΙΡ', null, null, 'Χρήση της λίστας ασφαλούς χειρουργείου ≥ 98%', 'Surgical safety checklist used ≥ 98%', 98, 'higher', '%', 'Διευθυντής Χειρουργικής',
        array[99, 98, 100, 99, 97, 99, 100, 98, 99, 100, 99, 100]::numeric[], 0.5),
      (9, 'department', 'ΚΑΡΔ', null, null, 'Εκτίμηση κινδύνου πτώσης κατά την εισαγωγή ≥ 95%', 'Fall risk assessed on admission ≥ 95%', 95, 'higher', '%', 'Προϊστάμενος Καρδιολογικής',
        array[88, 90, 91, 93, 92, 94, 95, 96, 95, 97, 96, 97]::numeric[], 4),
      (10, 'committee', null, 'COM-001', null, 'Κατανάλωση αλκοολούχου αντισηπτικού ≥ 20 L ανά 1.000 ημέρες νοσηλείας', 'Alcohol hand rub ≥ 20 L per 1,000 patient days', 20, 'higher', 'L/1.000 ημέρες νοσηλείας', 'Επιτροπή Λοιμώξεων',
        array[18.2, 19.5, 21.0, 20.4, 22.1, 19.8, 20.9, 21.5, 22.0, 21.2, 21.8, 22.4]::numeric[], 0.5),
      (11, 'committee', null, 'COM-002', null, 'Κλείσιμο διορθωτικών ενεργειών εντός προθεσμίας ≥ 85%', 'Corrective actions closed on time ≥ 85%', 85, 'higher', '%', 'Επιτροπή Ποιότητας και Ασφάλειας Ασθενών',
        array[78, 82, 80, 84, 79, 83, 86, 81, 85, 82, 84, 86]::numeric[], 3),
      (12, 'hospital', null, null, null, 'Αποτέλεσμα καλλιέργειας αίματος σε ≤ 72 ώρες', 'Blood culture result in ≤ 72 hours', 72, 'lower', 'ώρες', 'Υπεύθυνος Μικροβιολογικού Εργαστηρίου',
        array[70, 68, 74, 71, 66, 69, 73, 67, 65, 68, 66, 64]::numeric[], 1)
    ) as t(n, level, dep_code, com_code, platform_key, title, title_en, target, direction, unit, owner, vals, past_delta)
  loop
    for y in reverse v_year..v_year - 1 loop
      v_past := case when r.vals is null then null when y = v_year then r.vals[1:greatest(v_months, 0)]
        else array(select v + case when r.direction = 'lower' then r.past_delta else -r.past_delta end from unnest(r.vals) v) end;
      v_mean := (select avg(v) from unnest(v_past) v);
      insert into public.quality_objectives (organization_id, code, year, level, title, title_en, description, department_id, committee_id, platform_indicator_key,
        target, direction, unit, owner_label, due_date, status)
      values (v_org, 'QO-' || y || '-' || lpad(r.n::text, 2, '0'), y, r.level, r.title, r.title_en,
        case when r.platform_key is null then 'Μετριέται μήνα προς μήνα από τον υπεύθυνο του στόχου.' else 'Η τιμή υπολογίζεται από τα δεδομένα της πλατφόρμας.' end,
        (select d.id from public.departments d where d.organization_id = v_org and d.code = r.dep_code),
        (select c.id from public.committees c where c.organization_id = v_org and c.code = r.com_code),
        r.platform_key, r.target, r.direction, r.unit, r.owner, make_date(y, 12, 31),
        case when y = v_year or v_mean is null then 'active' when (r.direction = 'lower' and v_mean <= r.target) or (r.direction = 'higher' and v_mean >= r.target) then 'achieved' else 'not_achieved' end)
      returning id into v_id;
      if v_past is not null then
        insert into public.quality_objective_values (organization_id, objective_id, month, value)
        select v_org, v_id, make_date(y, m::integer, 1), v from unnest(v_past) with ordinality as u(v, m);
      end if;
    end loop;
  end loop;
end;
$function$;
revoke all on function private.demo_seed_quality_objectives(uuid) from public, anon, authenticated;

-- The departments' self-assessments on the ward checklist (the system questionnaire «ward»):
-- three rounds answered, submitted and closed, the scores improving from round to round, and
-- the current round under way (one submitted, one half answered, one not started, one draft).
create or replace function private.demo_seed_quality_self_assessments(v_org uuid, p_actor uuid)
returns void language plpgsql set search_path = ''
as $function$
declare
  d0 date := current_date;
  v_template uuid; v_standard text;
  v_deps text[] := array['ΜΕΘ', 'ΠΑΘ', 'ΧΕΙΡ', 'ΚΑΡΔ', 'ΟΡΘ', 'ΜΕΝΝ'];
  -- (round, days before today it was released, departments, answer quality)
  v_rounds text[] := array[array['r1', '600', '6', '0.78'], array['r2', '400', '4', '0.84'], array['r3', '240', '6', '0.88'], array['r4', '12', '4', '0.9']];
  v_partial text[] := array['Λείπει η υπογραφή σε δύο ημέρες.', 'Εφαρμόζεται, αλλά δεν καταγράφεται πάντα.', 'Μερική ενημέρωση του νέου προσωπικού.'];
  v_no text[] := array['Δεν βρέθηκε καταγραφή τον τελευταίο μήνα.', 'Το έντυπο δεν είναι διαθέσιμο στο τμήμα.'];
  k integer; j integer; v_released date; v_status text; v_share double precision; v_quality double precision; v_title text; v_key text;
  v_dep uuid; v_dep_name text; v_checklist jsonb; v_total integer; v_answered integer; v_score integer; v_submitted timestamptz;
begin
  select t.id, t.standard into v_template, v_standard from public.quality_audit_templates t where t.organization_id is null and t.template_key = 'ward' and t.active order by t.version desc limit 1;
  if v_template is null then return; end if;
  for k in 1..4 loop
    v_released := d0 - v_rounds[k][2]::integer;
    v_quality := v_rounds[k][4]::double precision;
    v_title := 'Αυτοαξιολόγηση ' || case when extract(month from v_released) <= 6 then 'Α΄' else 'Β΄' end || ' εξαμήνου ' || extract(year from v_released)::integer;
    for j in 1..v_rounds[k][3]::integer loop
      select d.id, d.name into v_dep, v_dep_name from public.departments d where d.organization_id = v_org and d.code = v_deps[j];
      if v_dep is null then continue; end if;
      v_status := case when k < 3 then 'closed' when k = 3 then case when j <= 4 then 'closed' else 'submitted' end else (array['submitted', 'released', 'released', 'draft'])[j] end;
      v_share := case when v_status = 'draft' then 0 when v_status = 'released' then case when j = 3 then 0 else 0.55 end else 1 end;
      v_key := v_org::text || '|self|' || k || '|' || j;
      with q as (
        select tq.*, row_number() over (order by tq.position) as rn,
          private.demo_unit_random(v_key || '|a|' || tq.id) as ra, private.demo_unit_random(v_key || '|b|' || tq.id) as rb, private.demo_unit_random(v_key || '|c|' || tq.id) as rc
        from public.quality_audit_template_questions tq where tq.template_id = v_template
      ), a as (
        select q.*, case when q.ra >= v_share then '' when q.rb < v_quality then 'yes' when q.rb < v_quality + (1 - v_quality) * 0.55 then 'partial' when q.rb < 0.97 then 'no' else 'na' end as answer
        from q
      )
      select jsonb_agg(jsonb_build_object('id', 'q-' || a.id, 'templateQuestionId', a.id, 'position', a.rn, 'chapterRef', a.chapter_ref, 'chapterTitle', coalesce(a.chapter_title, ''),
          'clauseRef', a.clause_ref, 'item', a.question, 'itemEn', a.question, 'guidance', coalesce(a.guidance, ''), 'evidenceRequired', coalesce(a.evidence, ''),
          'weight', case when a.weight > 0 then a.weight else 1 end, 'critical', a.critical, 'required', true, 'answer', a.answer,
          'note', case a.answer when 'partial' then v_partial[1 + floor(a.rc * 3)::integer] when 'no' then v_no[1 + floor(a.rc * 2)::integer] else '' end,
          'evidence', '', 'findingClass', '', 'adHoc', false) order by a.rn),
        count(*), count(*) filter (where a.answer <> ''),
        round(100 * sum(case a.answer when 'yes' then 1 when 'partial' then 0.5 else 0 end * case when a.weight > 0 then a.weight else 1 end)
          / nullif(sum(case when a.answer in ('yes', 'partial', 'no') then case when a.weight > 0 then a.weight else 1 end else 0 end), 0))
      into v_checklist, v_total, v_answered, v_score
      from a;
      v_submitted := case when v_status in ('submitted', 'closed') then (v_released + 12 + j * 3 + time '11:00') at time zone 'Europe/Athens' end;
      insert into public.quality_self_assessments (organization_id, template_id, standard, title, department_id, department_name, status, due_on, released_at, released_by,
        submitted_at, submitted_by, checklist, total_count, answered_count, score, created_by, updated_by, created_at)
      values (v_org, v_template, v_standard, v_title, v_dep, v_dep_name, v_status, v_released + case when k = 4 then 30 else 28 end,
        case when v_status <> 'draft' then (v_released + time '08:00') at time zone 'Europe/Athens' end, case when v_status <> 'draft' then p_actor end,
        v_submitted, case when v_submitted is not null then p_actor end, v_checklist, v_total, v_answered, case when v_answered > 0 then v_score end,
        p_actor, p_actor, (v_released - 3 + time '10:00') at time zone 'Europe/Athens');
    end loop;
  end loop;
end;
$function$;
revoke all on function private.demo_seed_quality_self_assessments(uuid, uuid) from public, anon, authenticated;

-- The answers of a satisfaction survey, from its own questions: p_count responses over the
-- last p_days days, most of them satisfied (4–5), the food a little less, a few unhappy ones.
create or replace function private.demo_seed_survey_answers(v_org uuid, p_survey uuid, p_count integer, p_days integer, p_departments uuid[])
returns void language plpgsql set search_path = ''
as $function$
declare
  v_questions jsonb; q jsonb; i integer; v_key text; r double precision; v_mood double precision; v_sat double precision; v_answers jsonb; v_value jsonb; v_options jsonb;
  v_comments text[] := array['Ευχαριστώ το νοσηλευτικό προσωπικό για τη φροντίδα.', 'Πολύ καλή εξυπηρέτηση από όλους.', 'Θόρυβος στον διάδρομο τη νύχτα.',
    'Το φαγητό ήταν συχνά κρύο.', 'Καθαρό δωμάτιο, ευγενικό προσωπικό.', 'Αργή διαδικασία στο εξιτήριο.'];
  v_missing text[] := array['Ασύρματο δίκτυο στα δωμάτια', 'Χώρος στάθμευσης για τους συνοδούς', 'Καφετέρια ανοιχτή τα απογεύματα'];
  v_day date; v_n integer := coalesce(array_length(p_departments, 1), 0);
begin
  select s.questions into v_questions from public.quality_surveys s where s.id = p_survey and s.organization_id = v_org;
  if v_questions is null then return; end if;
  for i in 1..p_count loop
    v_key := p_survey::text || '|response|' || i;
    v_mood := private.demo_unit_random(v_key || '|mood');
    v_day := current_date - 1 - floor(private.demo_unit_random(v_key || '|day') * greatest(p_days, 1))::integer;
    v_answers := '{}'::jsonb;
    for q in select value from jsonb_array_elements(v_questions) loop
      r := private.demo_unit_random(v_key || '|' || (q ->> 'id'));
      -- A question shown only after another's answer.
      if jsonb_typeof(q -> 'showWhen') = 'object' and (v_answers -> (q -> 'showWhen' ->> 'question')) is distinct from (q -> 'showWhen' -> 'value') then continue; end if;
      if coalesce((q ->> 'required')::boolean, false) = false and q ->> 'type' <> 'text' and private.demo_unit_random(v_key || '|skip|' || (q ->> 'id')) < 0.2 then continue; end if;
      v_value := null;
      if q ->> 'type' = 'rating' then
        v_sat := case when v_mood < 0.08 then 0.35 when q ->> 'section' = 'food' then 0.76 else 0.92 end;
        v_value := to_jsonb(case when r < v_sat * 0.55 then 5 when r < v_sat then 4 when r < v_sat + (1 - v_sat) * 0.6 then 3 when r < v_sat + (1 - v_sat) * 0.9 then 2 else 1 end);
      elsif q ->> 'type' = 'nps' then
        v_value := to_jsonb(case when v_mood < 0.08 then 2 + floor(r * 5)::integer else least(10, 6 + floor(r * 5)::integer) end);
      elsif q ->> 'type' = 'yesno' then
        v_value := to_jsonb(case when q ->> 'id' = 'technical' then r < 0.15 else r < case when v_mood < 0.08 then 0.5 else 0.93 end end);
      elsif q ->> 'type' in ('single', 'multiple') then
        v_options := q -> 'options';
        if jsonb_array_length(v_options) > 0 then
          v_value := v_options -> floor(r * jsonb_array_length(v_options))::integer -> 'value';
          if q ->> 'type' = 'multiple' then v_value := jsonb_build_array(v_value); end if;
        end if;
      elsif q ->> 'type' = 'text' and r < 0.18 then
        v_value := to_jsonb(case when q ->> 'id' = 'missing' then v_missing[1 + floor(private.demo_unit_random(v_key || '|t') * 3)::integer]
          else v_comments[1 + floor(private.demo_unit_random(v_key || '|t') * 6)::integer] end);
      end if;
      if v_value is not null then v_answers := v_answers || jsonb_build_object(q ->> 'id', v_value); end if;
    end loop;
    insert into public.quality_survey_responses (organization_id, survey_id, department_id, channel, answers, submitted_at, entered_by)
    values (v_org, p_survey, case when v_n > 0 then p_departments[1 + i % v_n] end,
      case when private.demo_unit_random(v_key || '|ch') < 0.5 then 'paper' when private.demo_unit_random(v_key || '|ch') < 0.8 then 'tablet' else 'link' end,
      v_answers, (v_day + time '09:00' + make_interval(mins => floor(private.demo_unit_random(v_key || '|t') * 540)::integer)) at time zone 'Europe/Athens', null);
  end loop;
end;
$function$;
revoke all on function private.demo_seed_survey_answers(uuid, uuid, integer, integer, uuid[]) from public, anon, authenticated;

-- The ward questionnaire (the «wards» template of src/features/quality/surveys/surveyModel.js)
-- when the Demo has none, with sixty answers over the last six months; any other patients'
-- survey of the Demo without answers gets twenty-five since it opened.
create or replace function private.demo_seed_quality_survey_responses(v_org uuid)
returns void language plpgsql set search_path = ''
as $function$
declare
  d0 date := current_date;
  v_name text; v_survey uuid; v_deps uuid[]; v_code text; r record;
  v_sections jsonb := '[
    {"key":"about","label":"Λίγα λόγια για εσάς","labelEn":"About you"},
    {"key":"choice","label":"Η επιλογή του νοσοκομείου","labelEn":"Choosing the hospital"},
    {"key":"reception","label":"Υποδοχή","labelEn":"Reception"},
    {"key":"floor","label":"Φροντίδα στον όροφο","labelEn":"Care on the floor"},
    {"key":"food","label":"Διατροφή","labelEn":"Food"},
    {"key":"room","label":"Δωμάτιο και επισκεπτήριο","labelEn":"Room and visits"},
    {"key":"services","label":"Υπηρεσίες","labelEn":"Services"},
    {"key":"overall","label":"Συνολικά","labelEn":"Overall"},
    {"key":"information","label":"Ενημέρωση","labelEn":"Information"},
    {"key":"comments","label":"Σχόλια","labelEn":"Comments"}]'::jsonb;
  v_questions jsonb := '[
    {"id":"nationality","section":"about","type":"single","label":"Υπηκοότητα","labelEn":"Nationality","required":false,"options":[{"value":"greek","label":"Ελληνική","labelEn":"Greek"},{"value":"other","label":"Άλλη","labelEn":"Other"}]},
    {"id":"sex","section":"about","type":"single","label":"Φύλο","labelEn":"Sex","required":false,"options":[{"value":"male","label":"Άνδρας","labelEn":"Man"},{"value":"female","label":"Γυναίκα","labelEn":"Woman"}]},
    {"id":"age","section":"about","type":"single","label":"Ηλικία","labelEn":"Age","required":false,"options":[{"value":"to25","label":"Έως 25","labelEn":"Up to 25"},{"value":"26_45","label":"26–45","labelEn":"26–45"},{"value":"46_65","label":"46–65","labelEn":"46–65"},{"value":"66plus","label":"66+","labelEn":"66+"}]},
    {"id":"occupation","section":"about","type":"single","label":"Επάγγελμα","labelEn":"Occupation","required":false,"options":[{"value":"public","label":"Δημόσιος υπάλληλος","labelEn":"Civil servant"},{"value":"private","label":"Ιδιωτικός υπάλληλος","labelEn":"Private employee"},{"value":"self","label":"Ελεύθερος επαγγελματίας","labelEn":"Self-employed"},{"value":"home","label":"Οικιακά","labelEn":"Homemaker"},{"value":"retired","label":"Συνταξιούχος","labelEn":"Retired"},{"value":"student","label":"Φοιτητής/τρια","labelEn":"Student"},{"value":"unemployed","label":"Άνεργος/η","labelEn":"Unemployed"},{"value":"other","label":"Άλλο","labelEn":"Other"}]},
    {"id":"reason","section":"choice","type":"single","label":"Ο λόγος που επιλέξατε το {hospital}","labelEn":"Why you chose {hospital}","required":false,"options":[{"value":"reputation","label":"Η φήμη του","labelEn":"Its reputation"},{"value":"others","label":"Σύσταση τρίτων","labelEn":"Recommended by others"},{"value":"doctor","label":"Σύσταση ιατρού","labelEn":"Recommended by a doctor"},{"value":"care","label":"Υψηλή φροντίδα νοσηλείας","labelEn":"High standard of care"}]},
    {"id":"heard","section":"choice","type":"single","label":"Πώς ενημερωθήκατε για το {hospital};","labelEn":"How did you hear about {hospital}?","required":false,"options":[{"value":"doctor","label":"Από τον ιατρό μου","labelEn":"From my doctor"},{"value":"friends","label":"Από φιλικό ή συγγενικό πρόσωπο","labelEn":"From a friend or relative"},{"value":"ads","label":"Από διαφήμιση, προωθητικές ενέργειες, ΜΜΕ","labelEn":"From advertising or the media"},{"value":"insurer","label":"Από την ασφαλιστική μου","labelEn":"From my insurer"}]},
    {"id":"admission_process","section":"reception","type":"rating","label":"Η διαδικασία εισαγωγής στο τμήμα Υποδοχής","labelEn":"The admission process at Reception","required":true,"options":[],"scale":"rating"},
    {"id":"reception_staff","section":"reception","type":"rating","label":"Η συμπεριφορά του προσωπικού της Υποδοχής","labelEn":"The behaviour of the Reception staff","required":true,"options":[],"scale":"rating"},
    {"id":"nursing","section":"floor","type":"rating","label":"Οι υπηρεσίες του νοσηλευτικού προσωπικού στον όροφο, συνολικά","labelEn":"The nursing staff’s services on the floor, overall","required":true,"options":[],"scale":"rating"},
    {"id":"doctors","section":"floor","type":"rating","label":"Οι επισκέψεις των ιατρών και η πληροφόρηση που σας παρείχαν","labelEn":"The doctors’ visits and the information they gave","required":true,"options":[],"scale":"rating"},
    {"id":"physiotherapy","section":"floor","type":"rating","label":"Η ομάδα των Φυσικοθεραπευτών (αν σας παρασχέθηκε φυσικοθεραπεία)","labelEn":"The physiotherapy team (if you had physiotherapy)","required":false,"options":[],"scale":"rating"},
    {"id":"food_quality","section":"food","type":"rating","label":"Η ποιότητα του φαγητού (αν δεν ακολουθήσατε ειδική δίαιτα)","labelEn":"The quality of the food (if you were not on a special diet)","required":false,"options":[],"scale":"rating"},
    {"id":"food_service","section":"food","type":"rating","label":"Η εξυπηρέτηση των τραπεζοκόμων","labelEn":"The service of the catering staff","required":false,"options":[],"scale":"rating"},
    {"id":"cleanliness","section":"room","type":"rating","label":"Η καθαριότητα του δωματίου","labelEn":"The cleanliness of the room","required":true,"options":[],"scale":"rating"},
    {"id":"visitors","section":"room","type":"rating","label":"Το επισκεπτήριο: ο αριθμός επισκεπτών στο δωμάτιο","labelEn":"Visiting: the number of visitors in the room","required":true,"options":[],"scale":"rating"},
    {"id":"visiting_hours","section":"room","type":"rating","label":"Το επισκεπτήριο: η τήρηση του ωραρίου","labelEn":"Visiting: keeping to the visiting hours","required":true,"options":[],"scale":"rating"},
    {"id":"technical","section":"room","type":"yesno","label":"Αντιμετωπίσατε τεχνικά προβλήματα (κλιματισμός, φώτα κ.λπ.) κατά την παραμονή σας;","labelEn":"Did you have technical problems (air conditioning, lights, etc.) during your stay?","required":true,"options":[]},
    {"id":"technical_fix","section":"room","type":"rating","label":"Εάν ναι, η επίλυσή τους ήταν:","labelEn":"If so, they were solved:","required":false,"options":[],"scale":"speed","showWhen":{"question":"technical","value":true}},
    {"id":"accounting","section":"services","type":"rating","label":"Η εξυπηρέτηση από το Λογιστήριο Ασθενών","labelEn":"The service of the Patient Accounts office","required":true,"options":[],"scale":"rating"},
    {"id":"overall","section":"overall","type":"rating","label":"Συνολικά, η διαμονή σας στο {hospital} ήταν:","labelEn":"Overall, your stay at {hospital} was:","required":true,"options":[],"scale":"rating"},
    {"id":"previous","section":"overall","type":"single","label":"Σε σχέση με προηγούμενη νοσηλεία είστε:","labelEn":"Compared with a previous stay you are:","required":false,"options":[{"value":"more","label":"Περισσότερο ικανοποιημένοι","labelEn":"More satisfied"},{"value":"same","label":"Το ίδιο ικανοποιημένοι","labelEn":"As satisfied"},{"value":"less","label":"Λιγότερο ικανοποιημένοι","labelEn":"Less satisfied"},{"value":"first","label":"Νοσηλεύομαι πρώτη φορά","labelEn":"This is my first stay"}]},
    {"id":"info_staff","section":"information","type":"rating","label":"Η ενημέρωση για τις διαδικασίες της Κλινικής από το προσωπικό","labelEn":"Information on the clinic’s procedures from the staff","required":true,"options":[],"scale":"rating"},
    {"id":"info_leaflets","section":"information","type":"rating","label":"Η ενημέρωση από τα ενημερωτικά έντυπα","labelEn":"Information from the leaflets","required":false,"options":[],"scale":"rating"},
    {"id":"info_website","section":"information","type":"rating","label":"Η ενημέρωση από τον ιστότοπο","labelEn":"Information from the website","required":false,"options":[],"scale":"rating"},
    {"id":"recommend_yes","section":"overall","type":"yesno","label":"Θα συστήνατε το {hospital};","labelEn":"Would you recommend {hospital}?","required":true,"options":[]},
    {"id":"choose_again","section":"overall","type":"yesno","label":"Θα επιλέγατε ξανά το {hospital} στο μέλλον;","labelEn":"Would you choose {hospital} again?","required":true,"options":[]},
    {"id":"missing","section":"comments","type":"text","label":"Ελλείψεις υπηρεσιών που εντοπίσατε","labelEn":"Services you found missing","required":false,"options":[]},
    {"id":"comments","section":"comments","type":"text","label":"Σχόλια","labelEn":"Comments","required":false,"options":[]}]'::jsonb;
begin
  select o.name into v_name from public.organizations o where o.id = v_org;
  select array_agg(d.id order by d.code) into v_deps from public.departments d where d.organization_id = v_org and d.code in ('ΠΑΘ', 'ΧΕΙΡ', 'ΚΑΡΔ', 'ΟΡΘ', 'ΝΕΦ');
  select s.id into v_survey from public.quality_surveys s where s.organization_id = v_org and s.template_key = 'wards' order by s.created_at limit 1;
  if v_survey is null then
    v_code := 'SRV-' || extract(year from d0 - 180)::integer || '-' || lpad((coalesce((select max(substring(s.code from '^SRV-' || extract(year from d0 - 180)::integer || '-([0-9]+)$')::integer)
      from public.quality_surveys s where s.organization_id = v_org), 0) + 1)::text, 2, '0');
    insert into public.quality_surveys (organization_id, code, title, title_en, description, description_en, audience, template_key, department_ids, sections, questions,
      status, opens_on, satisfied_target)
    values (v_org, v_code, 'Ερωτηματολόγιο Νοσηλευτικού ορόφου', 'Ward questionnaire', 'Η γνώμη σας μάς βοηθά να βελτιώνουμε τις υπηρεσίες μας. Λίγα λεπτά, ανώνυμα.',
      'Your opinion helps us improve our services. A few minutes, anonymous.', 'patients', 'wards', coalesce(v_deps, '{}'), v_sections,
      replace(v_questions::text, '{hospital}', trim(both '"' from to_jsonb(coalesce(v_name, 'νοσοκομείο'))::text))::jsonb, 'open', d0 - 180, 80)
    returning id into v_survey;
  end if;
  perform private.demo_seed_survey_answers(v_org, v_survey, 60, 175, coalesce((select s.department_ids from public.quality_surveys s where s.id = v_survey and cardinality(s.department_ids) > 0), v_deps));
  -- The survey opens with its first answer.
  update public.quality_surveys s set opens_on = (select min(x.submitted_at at time zone 'Europe/Athens')::date from public.quality_survey_responses x where x.survey_id = s.id)
  where s.id = v_survey;
  for r in
    select s.id, s.opens_on, s.department_ids from public.quality_surveys s
    where s.organization_id = v_org and s.id <> v_survey and s.audience = 'patients' and s.status <> 'draft'
      and not exists (select 1 from public.quality_survey_responses x where x.survey_id = s.id)
  loop
    perform private.demo_seed_survey_answers(v_org, r.id, 25, greatest(coalesce(d0 - r.opens_on, 90), 7), case when cardinality(r.department_ids) > 0 then r.department_ids else v_deps end);
  end loop;
end;
$function$;
revoke all on function private.demo_seed_quality_survey_responses(uuid) from public, anon, authenticated;

-- The kitchen's recall drills: an older failed one (a dish, traced in 290′ against the
-- 4-hour target) and one this week (a supplier's chicken lot, traced in 95′, balance found).
-- The recent drill keeps only the counted stock, so its screen traces the Demo kitchen's batch.
create or replace function private.demo_seed_kitchen_recall_drills(v_org uuid)
returns void language plpgsql set search_path = ''
as $function$
declare
  d0 date := current_date;
  v_manager text := 'Ελένη Γεωργίου';
  v_item record; v_used numeric := 0; v_written numeric := 0; v_stock numeric; v_days integer := 0; v_meals integer := 0; v_portions integer := 0;
begin
  insert into public.kitchen_recall_drills (organization_id, code, drill_date, started_at, finished_at, scenario, trigger_text, dish_name, target_minutes, elapsed_minutes,
    received_quantity, used_quantity, stock_quantity, written_off_quantity, quantity_unit, accounted_percent, batches_count, affected_days, affected_meals, affected_portions,
    traced_within_target, trace_snapshot, notified, actions, result, lessons, conducted_by_name, status)
  values (v_org, 'ANK-0001', d0 - 220, (d0 - 220 + time '09:00') at time zone 'Europe/Athens', (d0 - 220 + time '13:50') at time zone 'Europe/Athens', 'dish',
    'Κρούσμα γαστρεντερίτιδας σε δύο ασθενείς μετά το βραδινό· έλεγχος του ρυζόγαλου.', 'Ρυζόγαλο', 240, 290,
    0, 0, 0, 0, null, null, 0, 0, 0, 0, false,
    jsonb_build_object('batches', '[]'::jsonb, 'uses', '[]'::jsonb, 'writeoffs', '[]'::jsonb, 'backward', '[]'::jsonb, 'untraced', 0, 'unit', '', 'received', 0, 'used', 0, 'inStock', 0,
      'writtenOff', 0, 'accounted', 0, 'percent', null, 'balanced', false, 'affectedDays', 0, 'affectedMeals', 0, 'affectedPortions', 0, 'stockCounts', '{}'::jsonb),
    'Υπεύθυνος Ποιότητας, Επιτροπή Λοιμώξεων, προμηθευτής γάλακτος.', 'Αναζητήθηκαν οι παρτίδες γάλακτος· δεν βρέθηκαν οι μερίδες της πολτώδους δίαιτας στο πλάνο.', 'fail',
    'Το πλάνο γευμάτων να γράφει πάντα τις μερίδες ανά δίαιτα· οι καταναλώσεις να καταχωρίζονται με την παρτίδα την ίδια ώρα.', v_manager, 'completed');

  select i.id, i.product_id, i.product_name, i.quantity, i.unit into v_item
  from public.kitchen_receipt_items i where i.organization_id = v_org and i.batch_code = 'L2410-118' order by i.created_at limit 1;
  if v_item.id is not null then
    select coalesce(sum(u.quantity), 0), count(distinct u.production_id) into v_used, v_days from public.kitchen_material_usage u where u.organization_id = v_org and u.receipt_item_id = v_item.id;
    select coalesce(sum(w.quantity), 0) into v_written from public.kitchen_stock_writeoffs w where w.organization_id = v_org and w.receipt_item_id = v_item.id;
    select count(distinct m.id), coalesce(sum(m.portions), 0) into v_meals, v_portions
    from public.kitchen_material_usage u join public.kitchen_production_meals m on m.production_id = u.production_id and m.organization_id = u.organization_id
    where u.organization_id = v_org and u.receipt_item_id = v_item.id and u.dish_name is not null
      and (lower(m.dish) like '%' || lower(u.dish_name) || '%' or lower(u.dish_name) like '%' || lower(m.dish) || '%');
  end if;
  v_stock := greatest(coalesce(v_item.quantity, 20) - v_used - v_written, 0);
  insert into public.kitchen_recall_drills (organization_id, code, drill_date, started_at, finished_at, scenario, trigger_text, receipt_item_id, product_id, product_name, target_minutes,
    elapsed_minutes, received_quantity, used_quantity, stock_quantity, written_off_quantity, quantity_unit, accounted_percent, batches_count, affected_days, affected_meals, affected_portions,
    traced_within_target, trace_snapshot, notified, actions, result, lessons, conducted_by_name, status)
  values (v_org, 'ANK-0002', d0 - 2, (d0 - 2 + time '10:00') at time zone 'Europe/Athens', (d0 - 2 + time '11:35') at time zone 'Europe/Athens', 'supplier_lot',
    'Ειδοποίηση προμηθευτή για μολυσμένη παρτίδα (Salmonella) στο στήθος κοτόπουλο L2410-118.', v_item.id, v_item.product_id, coalesce(v_item.product_name, 'Στήθος κοτόπουλο φιλέτο'), 240,
    95, coalesce(v_item.quantity, 20), v_used, v_stock, v_written, case when v_item.unit in ('kg', 'pcs', 'l') then v_item.unit else 'kg' end,
    case when coalesce(v_item.quantity, 20) > 0 then round((v_used + v_stock + v_written) * 100 / coalesce(v_item.quantity, 20), 1) end,
    case when v_item.id is null then 0 else 1 end, v_days, v_meals, v_portions, true,
    jsonb_build_object('stockCounts', case when v_item.id is null then '{}'::jsonb else jsonb_build_object(v_item.id::text, v_stock::text) end),
    'Υπεύθυνος Ποιότητας, Διοίκηση, Ομάδα Πρόληψης Λοιμώξεων, προμηθευτής (Κρεατεμπορική Θεσσαλίας).',
    'Το υπόλοιπο απομονώθηκε στον θάλαμο ψύξης με σήμανση «ΔΕΣΜΕΥΜΕΝΟ»· βρέθηκαν οι ημέρες και τα γεύματα που σερβιρίστηκε.', 'pass',
    'Η ιχνηλάτηση ολοκληρώθηκε εντός στόχου· να προστεθεί στη διαδικασία το τηλέφωνο του προμηθευτή εκτός ωραρίου.', v_manager, 'completed');
end;
$function$;
revoke all on function private.demo_seed_kitchen_recall_drills(uuid) from public, anon, authenticated;

-- The whole of it for one Demo organization, once: after a reset (private.demo_wipe_data) or on a Demo that has none of it yet.
create or replace function private.demo_seed_quality_governance(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
begin
  if p_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations o where o.id = v_org and o.is_demo) then
    raise exception 'Only Demo organizations get the Demo quality governance' using errcode = '42501';
  end if;
  -- A Demo reset empties these tables first (private.demo_wipe_data); a Demo that already has them is left as it is.
  if exists (select 1 from public.quality_department_meetings x where x.organization_id = v_org)
    or exists (select 1 from public.quality_objectives x where x.organization_id = v_org)
    or exists (select 1 from public.quality_management_reviews x where x.organization_id = v_org) then
    return;
  end if;
  perform private.demo_seed_quality_meetings(v_org);
  perform private.demo_seed_quality_reviews(v_org);
  perform private.demo_seed_quality_objectives(v_org);
  perform private.demo_seed_quality_self_assessments(v_org, p_actor);
  perform private.demo_seed_quality_survey_responses(v_org);
  perform private.demo_seed_kitchen_recall_drills(v_org);
end;
$function$;
revoke all on function private.demo_seed_quality_governance(uuid, uuid) from public, anon, authenticated;
