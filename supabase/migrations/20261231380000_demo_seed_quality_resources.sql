-- Quality › Πόροι in every Demo organization: suppliers in categories with the departments
-- that use them, certificates valid / expiring within 30 days / expired, evaluations on the
-- four Demo templates over two years with a score per criterion, nonconformities, renewal
-- requests (one proposed, one answered by the supplier, one closed) and medical equipment
-- with its maintenance, calibration and safety checks (some overdue, one out of service).
-- The same content as the browser demo (src/features/quality/resources/resourceDemoData.js),
-- with dates from today. Names, tax ids and phones are made up; every e-mail is @example.com.
-- Automatic renewal sending stays off, so nothing here queues an e-mail.

-- A department of the Demo by its name (null when the Demo has no such department).
create or replace function private.demo_quality_resources_department(p_organization_id uuid, p_name text)
returns uuid language sql stable security definer set search_path = ''
as $function$
  select d.id from public.departments d where d.organization_id = p_organization_id and d.name = p_name order by d.created_at limit 1;
$function$;
revoke all on function private.demo_quality_resources_department(uuid, text) from public, anon, authenticated;

create or replace function private.demo_seed_quality_resources(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := current_date;
  v_ev record;
  v_tpl public.quality_supplier_eval_templates;
  v_eval uuid;
  v_total numeric;
  v_request uuid;
  v_cert public.quality_supplier_certifications;
begin
  if not exists (select 1 from public.organizations o where o.id = v_org and o.is_demo) then
    raise exception 'Only Demo organizations get the Demo resources' using errcode = '42501';
  end if;
  -- Runs after private.demo_wipe_data: a Demo that already has suppliers or equipment is left as it is.
  if exists (select 1 from public.quality_suppliers x where x.organization_id = v_org)
     or exists (select 1 from public.quality_equipment x where x.organization_id = v_org) then
    return;
  end if;

  -- The four evaluation templates of the Demo (20261122100100); a template already there by name is kept.
  with presets(name, categories, criteria) as (
    values
      ('Προμηθευτής Προϊόντων', array['products','medical_devices','consumables','pharmaceuticals'],
        '[["Ποιότητα προϊόντων",0.2],["Συνέπεια στους χρόνους παράδοσης",0.2],["Συμμόρφωση με τις προδιαγραφές της παραγγελίας",0.2],["Πιστοποιητικά και τεκμηρίωση (CE, ISO, δηλώσεις συμμόρφωσης)",0.15],["Εξυπηρέτηση και διαχείριση παραπόνων",0.15],["Τιμή και όροι πληρωμής",0.1]]'::jsonb),
      ('Προμηθευτής Υπηρεσιών/Υπεργολάβος', array['services','maintenance','cleaning','laundry','waste','it','certification_body'],
        '[["Ποιότητα παρεχόμενων υπηρεσιών",0.2],["Τήρηση χρονοδιαγράμματος και ανταπόκριση",0.2],["Επάρκεια και εκπαίδευση προσωπικού",0.2],["Συμμόρφωση με νομοθεσία, ασφάλεια και τεκμηρίωση",0.15],["Επικοινωνία και αναφορές",0.15],["Κόστος",0.1]]'::jsonb),
      ('Προμηθευτής Κουζίνας', array['kitchen'],
        '[["Ποιότητα προσφερόμενων προϊόντων/υπηρεσιών",0.12],["Ασφάλεια τροφίμων (HACCP / ISO 22000, άδειες)",0.16],["Θερμοκρασία και συνθήκες μεταφοράς",0.14],["Υγιεινή οχήματος και προσωπικού παράδοσης",0.12],["Επισήμανση, ιχνηλασιμότητα και ημερομηνίες λήξης",0.12],["Συνέπεια στους χρόνους παράδοσης",0.12],["Πληρότητα παραγγελίας",0.12],["Τιμή",0.1]]'::jsonb),
      ('Προμηθευτής Εργαστηρίου', array['laboratory'],
        '[["Ποιότητα προϊόντων (αντιδραστήρια, αναλώσιμα)",0.2],["Πιστοποίηση: CE-IVD / ISO 13485, ISO 15189 όπου απαιτείται",0.15],["Ποιοτικός έλεγχος παρτίδας (πιστοποιητικά ανάλυσης, εξωτερικός έλεγχος)",0.15],["Ψυχρή αλυσίδα κατά τη μεταφορά και αποθήκευση",0.15],["Τεχνική και επιστημονική υποστήριξη αναλυτών",0.15],["Συνέπεια στους χρόνους παράδοσης",0.1],["Τιμή και όροι",0.1]]'::jsonb)
  ),
  created as (
    insert into public.quality_supplier_eval_templates (organization_id, name, description, categories, pass_threshold, conditional_threshold, frequency_months, score_scale, source, created_by)
    select v_org, p.name, 'Πρότυπο της Demo· επεξεργάσιμο.', p.categories, 70, 50, 12, 5, 'seed', p_actor
    from presets p
    on conflict (organization_id, name) do nothing
    returning id, name
  )
  insert into public.quality_supplier_eval_template_criteria (organization_id, template_id, position, label, weight, created_by)
  select v_org, c.id, (e.ordinality - 1)::smallint, e.value->>0, (e.value->>1)::numeric, p_actor
  from created c
  join presets p on p.name = c.name
  cross join lateral jsonb_array_elements(p.criteria) with ordinality e;

  -- Automatic renewal requests stay off in a Demo (no e-mails).
  insert into public.quality_supplier_renewal_settings (organization_id, auto_enabled, remind_after_days, max_reminders, updated_by)
  values (v_org, false, 7, 2, p_actor)
  on conflict (organization_id) do update set auto_enabled = false, last_run_at = null, last_result = '{}'::jsonb, updated_at = now();

  -- Suppliers: (code, name, legal name, category, criticality, status, tax id, contact, phone, e-mail, city, products, contract in days, notes, departments)
  insert into public.quality_suppliers (organization_id, code, name, legal_name, category, criticality, status, tax_id, contact_name, phone, email,
    address, city, country, products, contract_ends_on, notes, department_ids, created_by)
  select v_org, s.code, s.name, s.legal, s.category, s.crit, s.status, s.tax, s.contact, s.phone, s.email,
    s.city, s.city, 'Ελλάδα', s.products, d0 + s.contract, s.notes,
    coalesce(array(select x from unnest(s.deps) n cross join lateral private.demo_quality_resources_department(v_org, n) x where x is not null), '{}'::uuid[]), p_actor
  from (values
    ('SUP-001', 'Ιατροτεχνική Θεσσαλίας Α.Ε.', 'Ιατροτεχνική Θεσσαλίας Ανώνυμη Εταιρεία', 'medical_devices', 'high', 'active', '099999001', 'Τμήμα εξυπηρέτησης', '2410 000001', 'service@example.com', 'Λάρισα',
      'Απινιδωτές, monitors, αντλίες έγχυσης· τεχνική υποστήριξη', 240, null, array['Χειρουργική Κλινική', 'Μονάδα Εντατικής Θεραπείας']),
    ('SUP-002', 'Υγειονομικά Αναλώσιμα Κεντρικής Ελλάδας', 'Υγειονομικά Αναλώσιμα Κεντρικής Ελλάδας Α.Ε.', 'consumables', 'high', 'active', '099999002', 'Πωλήσεις', '2421 000002', 'orders@example.com', 'Βόλος',
      'Γάντια, μάσκες, σύριγγες, καθετήρες', 45, 'Καθυστερήσεις στις παραδόσεις του χειμώνα.', array['Χειρουργική Κλινική', 'Μονάδα Εντατικής Θεραπείας', 'Παθολογική Κλινική']),
    ('SUP-003', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, 'maintenance', 'high', 'active', '099999003', 'Τεχνικός υπεύθυνος', '2410 000003', 'tech@example.com', 'Λάρισα',
      'Προληπτική συντήρηση, διακριβώσεις, ηλεκτρολογικοί έλεγχοι ασφάλειας', 150, null, array[]::text[]),
    ('SUP-004', 'Εργαστηριακά Αντιδραστήρια Α.Ε.', null, 'laboratory', 'medium', 'active', '099999004', null, null, 'lab-orders@example.com', 'Αθήνα',
      'Αντιδραστήρια μικροβιολογικού, καλλιεργητικά υλικά', null, null, array[]::text[]),
    ('SUP-005', 'Καθαριότητα & Υγιεινή Ι.Κ.Ε.', null, 'cleaning', 'medium', 'active', '099999005', null, '2410 000005', null, 'Λάρισα',
      'Συνεργείο καθαριότητας, απολυμαντικά επιφανειών', -10, 'Η σύμβαση έληξε· σε εξέλιξη νέος διαγωνισμός.', array[]::text[]),
    ('SUP-006', 'Διαχείριση Αποβλήτων Υγειονομικών Μονάδων', null, 'waste', 'high', 'active', '099999006', 'Γραφείο κίνησης', '2310 000006', 'waste@example.com', 'Θεσσαλονίκη',
      'Συλλογή και μεταφορά ΕΑΑΜ', 600, null, array[]::text[]),
    ('SUP-007', 'Γαλακτοκομικά Κάμπου Α.Ε.', null, 'kitchen', 'high', 'active', '099999007', 'Πωλήσεις', '2410 000007', 'orders-food@example.com', 'Λάρισα',
      'Γάλα, γιαούρτι, τυριά· καθημερινή διανομή με ψυγείο', 200, null, array[]::text[]),
    ('SUP-008', 'Οπωροπωλείο Θεσσαλίας Ο.Ε.', null, 'kitchen', 'medium', 'active', '099999008', null, '2410 000008', null, 'Λάρισα',
      'Φρούτα και λαχανικά', null, null, array[]::text[]),
    ('SUP-009', 'Κρεατεμπορική Θεσσαλίας Α.Ε.', null, 'kitchen', 'high', 'active', '099999009', 'Πωλήσεις', '2410 000009', 'meat-orders@example.com', 'Λάρισα',
      'Κρέας και πουλερικά νωπά και κατεψυγμένα', 300, null, array[]::text[]),
    ('SUP-010', 'Φαρμακαποθήκη Πηνειός Α.Ε.', null, 'pharmaceuticals', 'high', 'active', '099999010', 'Εξυπηρέτηση πελατών', '2410 000010', 'pharma@example.com', 'Λάρισα',
      'Φάρμακα, αντισηπτικά, εμβόλια', 420, null, array['Παθολογική Κλινική', 'Χειρουργική Κλινική', 'Καρδιολογική Κλινική', 'Ορθοπαιδική Κλινική', 'Νεφρολογική Κλινική', 'Παιδιατρική Κλινική', 'Μονάδα Εντατικής Θεραπείας', 'Μονάδα Εντατικής Νοσηλείας Νεογνών']),
    ('SUP-011', 'Ιματισμός Νοσοκομείων Ο.Ε.', null, 'laundry', 'medium', 'active', '099999011', null, '2410 000011', 'laundry@example.com', 'Τρίκαλα',
      'Πλύσιμο και απολύμανση ιματισμού, χειρουργικά σετ υφασμάτων', 110, null, array[]::text[]),
    ('SUP-012', 'Νεογνολογικά Συστήματα Α.Ε.', null, 'medical_devices', 'high', 'active', '099999012', 'Τεχνική υποστήριξη', '2310 000012', 'neo-support@example.com', 'Θεσσαλονίκη',
      'Θερμοκοιτίδες, φωτοθεραπεία, monitors νεογνών', 500, null, array['Μονάδα Εντατικής Νοσηλείας Νεογνών', 'Παιδιατρική Κλινική']),
    ('SUP-013', 'Πληροφορική Υγείας Ι.Κ.Ε.', null, 'it', 'medium', 'active', '099999013', 'Helpdesk', '2410 000013', 'helpdesk@example.com', 'Λάρισα',
      'Υποστήριξη πληροφοριακού συστήματος νοσοκομείου', 75, null, array[]::text[]),
    ('SUP-014', 'Καρδιολογικά Αναλώσιμα Ε.Π.Ε.', null, 'consumables', 'medium', 'active', '099999014', null, '2310 000014', 'cardio@example.com', 'Θεσσαλονίκη',
      'Ηλεκτρόδια ΗΚΓ, καθετήρες, αναλώσιμα αιμοδυναμικού', 180, null, array['Καρδιολογική Κλινική']),
    ('SUP-015', 'Ορθοπαιδικά Εμφυτεύματα Α.Ε.', null, 'medical_devices', 'high', 'active', '099999015', 'Πωλήσεις', '2100 000015', 'ortho@example.com', 'Αθήνα',
      'Εμφυτεύματα, εργαλειοθήκες σε δανεισμό', 30, null, array['Ορθοπαιδική Κλινική', 'Χειρουργική Κλινική']),
    ('SUP-016', 'Νεφρολογικά Συστήματα Α.Ε.', null, 'medical_devices', 'high', 'active', '099999016', 'Τεχνική υποστήριξη', '2100 000016', 'dialysis@example.com', 'Αθήνα',
      'Μηχανήματα αιμοκάθαρσης, φίλτρα, γραμμές', 360, null, array['Νεφρολογική Κλινική']),
    ('SUP-017', 'Γραφική Ύλη Θεσσαλίας', null, 'products', 'low', 'inactive', '099999017', null, null, null, 'Λάρισα',
      'Έντυπα και γραφική ύλη', -200, 'Δεν συνεργαζόμαστε πλέον.', array[]::text[])
  ) s(code, name, legal, category, crit, status, tax, contact, phone, email, city, products, contract, notes, deps);

  -- Contacts.
  insert into public.quality_supplier_contacts (organization_id, supplier_id, position, full_name, job_title, phone, email, created_by)
  select v_org, s.id, c.pos, c.full_name, c.job, c.phone, c.email, p_actor
  from (values
    ('SUP-001', 0, 'Νίκος Αθανασίου', 'Τεχνικός εφαρμογών', '2410 000021', 'n.athanasiou@example.com'),
    ('SUP-002', 0, 'Σοφία Καραγιάννη', 'Υπεύθυνη πωλήσεων', '2421 000022', 'sales@example.com'),
    ('SUP-003', 0, 'Τεχνικός υπεύθυνος', 'Βάρδια βλαβών', '2410 000013', 'service@example.com'),
    ('SUP-007', 0, 'Υπεύθυνος διανομής', 'Διανομή Λάρισας', '2410 000017', 'orders-food@example.com'),
    ('SUP-010', 0, 'Δημήτρης Λαμπρόπουλος', 'Υπεύθυνος ποιότητας (GDP)', '2410 000020', 'quality-pharma@example.com'),
    ('SUP-010', 1, 'Γραφείο παραγγελιών', null, '2410 000030', 'pharma@example.com'),
    ('SUP-016', 0, 'Ελένη Μαυρίδου', 'Βιοϊατρική μηχανικός', '2100 000026', 'e.mavridou@example.com')
  ) c(code, pos, full_name, job, phone, email)
  join public.quality_suppliers s on s.organization_id = v_org and s.code = c.code;

  -- Certificates and documents: (code, type, kind, number, issuer, expires in days — null when it does not expire)
  insert into public.quality_supplier_certifications (organization_id, supplier_id, certificate_type, document_kind, certificate_number, issuer, expires_on, created_by, updated_by)
  select v_org, s.id, c.type, c.kind, c.number, c.issuer, d0 + c.days, p_actor, p_actor
  from (values
    ('SUP-001', 'ISO 13485', 'certificate', 'MD-4471', 'Φορέας πιστοποίησης', 420),
    ('SUP-001', 'ISO 9001', 'certificate', 'QM-1180', 'Φορέας πιστοποίησης', 18),
    ('SUP-001', 'CE', 'certificate', 'CE-0123-771', 'Κοινοποιημένος οργανισμός', 600),
    ('SUP-002', 'ISO 9001', 'certificate', 'QM-2290', 'Φορέας πιστοποίησης', -20),
    ('SUP-002', 'ISO 14001', 'certificate', 'EM-2291', 'Φορέας πιστοποίησης', -45),
    ('SUP-002', 'ISO 45001', 'certificate', 'OH-2292', 'Φορέας πιστοποίησης', -8),
    ('SUP-002', 'CE', 'declaration', null, null, null),
    ('SUP-003', 'ISO 9001', 'certificate', 'QM-3301', 'Φορέας πιστοποίησης', 510),
    ('SUP-003', 'ISO 13485', 'certificate', 'MD-3302', 'Φορέας πιστοποίησης', -3),
    ('SUP-003', 'Σύμβαση συντήρησης', 'contract', 'ΣΥΜ-2025-14', null, 150),
    ('SUP-004', 'ISO 13485', 'certificate', 'MD-8812', 'Φορέας πιστοποίησης', 300),
    ('SUP-004', 'CE-IVD', 'certificate', 'IVD-2201', 'Κοινοποιημένος οργανισμός', 500),
    ('SUP-005', 'Άδεια λειτουργίας', 'licence', 'ΑΛ-5521', 'Περιφέρεια Θεσσαλίας', 12),
    ('SUP-006', 'ISO 14001', 'certificate', 'EM-5550', 'Φορέας πιστοποίησης', 700),
    ('SUP-006', 'Άδεια συλλογής και μεταφοράς ΕΑΑΜ', 'licence', 'ΑΔ-ΕΑΑΜ-118', 'Περιφέρεια Κεντρικής Μακεδονίας', 28),
    ('SUP-007', 'ISO 22000 / HACCP', 'certificate', 'FS-7781', 'Φορέας πιστοποίησης', 25),
    ('SUP-007', 'Βεβαίωση καταχώρισης ΕΦΕΤ', 'licence', 'EFET-4410', 'ΕΦΕΤ', -12),
    ('SUP-009', 'ISO 22000 / HACCP', 'certificate', 'FS-9902', 'Φορέας πιστοποίησης', 260),
    ('SUP-009', 'Βεβαίωση καταχώρισης ΕΦΕΤ', 'licence', 'EFET-4512', 'ΕΦΕΤ', 90),
    ('SUP-009', 'Πιστοποιητικό απολύμανσης οχημάτων', 'other', 'ΑΠ-0931', 'Συνεργείο απολυμάνσεων', -5),
    ('SUP-010', 'Άδεια χονδρικής πώλησης φαρμάκων', 'licence', 'ΕΟΦ-ΧΠ-310', 'ΕΟΦ', 380),
    ('SUP-010', 'ISO 9001', 'certificate', 'QM-1010', 'Φορέας πιστοποίησης', 9),
    ('SUP-010', 'GDP', 'certificate', 'GDP-2210', 'ΕΟΦ', 200),
    ('SUP-011', 'ISO 9001', 'certificate', 'QM-1111', 'Φορέας πιστοποίησης', 150),
    ('SUP-011', 'EN 14065 (RABC)', 'certificate', 'RABC-0411', 'Φορέας πιστοποίησης', 27),
    ('SUP-012', 'ISO 13485', 'certificate', 'MD-1212', 'Φορέας πιστοποίησης', 640),
    ('SUP-012', 'CE', 'certificate', 'CE-0123-1212', 'Κοινοποιημένος οργανισμός', 640),
    ('SUP-013', 'ISO 27001', 'certificate', 'IS-1313', 'Φορέας πιστοποίησης', -30),
    ('SUP-014', 'ISO 13485', 'certificate', 'MD-1414', 'Φορέας πιστοποίησης', 220),
    ('SUP-014', 'Δήλωση συμμόρφωσης', 'declaration', 'ΔΣ-1414', null, null),
    ('SUP-015', 'ISO 13485', 'certificate', 'MD-1515', 'Φορέας πιστοποίησης', 14),
    ('SUP-015', 'CE', 'certificate', 'CE-0123-1515', 'Κοινοποιημένος οργανισμός', 480),
    ('SUP-016', 'ISO 13485', 'certificate', 'MD-1616', 'Φορέας πιστοποίησης', 330),
    ('SUP-017', 'ISO 9001', 'certificate', 'QM-1717', 'Φορέας πιστοποίησης', -400)
  ) c(code, type, kind, number, issuer, days)
  join public.quality_suppliers s on s.organization_id = v_org and s.code = c.code;

  -- Evaluations on the templates, a score (1–5) per criterion in order: (code, template, days ago, evaluator, notes, scores)
  for v_ev in
    select s.id as supplier_id, e.tpl, e.days, e.evaluator, e.notes, e.scores
    from (values
      ('SUP-001', 'Προμηθευτής Προϊόντων', -665, 'Υπεύθυνος Ποιότητας', null, array[4,4,4,4,4,3]),
      ('SUP-001', 'Προμηθευτής Προϊόντων', -300, 'Υπεύθυνος Ποιότητας', null, array[5,4,5,4,5,3]),
      ('SUP-002', 'Προμηθευτής Προϊόντων', -720, 'Υπεύθυνος Ποιότητας', null, array[4,3,4,4,3,4]),
      ('SUP-002', 'Προμηθευτής Προϊόντων', -390, 'Υπεύθυνος Ποιότητας', 'Καθυστερήσεις στις παραδόσεις του χειμώνα.', array[4,2,4,3,3,4]),
      ('SUP-003', 'Προμηθευτής Υπηρεσιών/Υπεργολάβος', -440, 'Υπεύθυνος Ποιότητας', null, array[4,4,4,4,4,4]),
      ('SUP-003', 'Προμηθευτής Υπηρεσιών/Υπεργολάβος', -90, 'Υπεύθυνος Ποιότητας', null, array[4,4,4,5,4,4]),
      ('SUP-004', 'Προμηθευτής Εργαστηρίου', -560, 'Υπεύθυνος Εργαστηρίου', null, array[4,4,4,3,4,4,3]),
      ('SUP-004', 'Προμηθευτής Εργαστηρίου', -200, 'Υπεύθυνος Εργαστηρίου', 'Παράδοση με θερμοκρασία εκτός ορίων· αλλαγή συσκευασίας χωρίς ενημέρωση.', array[3,4,3,2,4,3,3]),
      ('SUP-006', 'Προμηθευτής Υπηρεσιών/Υπεργολάβος', -500, 'Υπεύθυνος Ποιότητας', null, array[3,3,3,3,3,3]),
      ('SUP-006', 'Προμηθευτής Υπηρεσιών/Υπεργολάβος', -150, 'Υπεύθυνος Ποιότητας', 'Παραλείψεις στα συνοδευτικά έντυπα.', array[3,2,3,3,2,3]),
      ('SUP-007', 'Προμηθευτής Κουζίνας', -700, 'Υπεύθυνη κουζίνας', null, array[4,4,4,4,4,4,4,4]),
      ('SUP-007', 'Προμηθευτής Κουζίνας', -350, 'Υπεύθυνη κουζίνας', null, array[5,4,4,4,4,5,4,3]),
      ('SUP-008', 'Προμηθευτής Κουζίνας', -40, 'Υπεύθυνη κουζίνας', 'Λαχανικά χωρίς επισήμανση προέλευσης σε δύο παραδόσεις.', array[3,3,2,3,3,4,3,4]),
      ('SUP-009', 'Προμηθευτής Κουζίνας', -380, 'Υπεύθυνη κουζίνας', null, array[4,5,4,4,4,4,4,3]),
      ('SUP-009', 'Προμηθευτής Κουζίνας', -20, 'Υπεύθυνη κουζίνας', null, array[5,5,4,4,5,4,5,3]),
      ('SUP-010', 'Προμηθευτής Προϊόντων', -600, 'Υπεύθυνος Φαρμακείου', null, array[5,5,5,5,4,3]),
      ('SUP-010', 'Προμηθευτής Προϊόντων', -250, 'Υπεύθυνος Φαρμακείου', null, array[5,5,5,5,5,3]),
      ('SUP-011', 'Προμηθευτής Υπηρεσιών/Υπεργολάβος', -330, 'Υπεύθυνος Ποιότητας', null, array[4,3,4,4,4,4]),
      ('SUP-012', 'Προμηθευτής Προϊόντων', -180, 'Υπεύθυνος Ποιότητας', null, array[5,4,5,5,5,3]),
      ('SUP-013', 'Προμηθευτής Υπηρεσιών/Υπεργολάβος', -420, 'Υπεύθυνος Πληροφορικής', 'Αργή ανταπόκριση σε δύο βλάβες.', array[4,3,3,4,3,3]),
      ('SUP-014', 'Προμηθευτής Προϊόντων', -60, 'Υπεύθυνος Ποιότητας', null, array[4,4,4,4,4,4]),
      ('SUP-015', 'Προμηθευτής Προϊόντων', -540, 'Υπεύθυνος Ποιότητας', null, array[5,4,5,5,4,3]),
      ('SUP-015', 'Προμηθευτής Προϊόντων', -200, 'Υπεύθυνος Ποιότητας', null, array[4,4,5,5,4,3]),
      ('SUP-016', 'Προμηθευτής Προϊόντων', -110, 'Υπεύθυνος Ποιότητας', null, array[5,5,5,4,5,3]),
      ('SUP-017', 'Προμηθευτής Προϊόντων', -690, 'Υπεύθυνος Ποιότητας', null, array[3,3,3,2,3,4])
    ) e(code, tpl, days, evaluator, notes, scores)
    join public.quality_suppliers s on s.organization_id = v_org and s.code = e.code
  loop
    v_tpl := (select t from public.quality_supplier_eval_templates t where t.organization_id = v_org and t.name = v_ev.tpl);
    if v_tpl.id is null then continue; end if;
    -- The weighted score as the app computes it (supplierTemplates.js, weightedScore).
    v_total := (select round(sum(v_ev.scores[c.position + 1]::numeric / v_tpl.score_scale * c.weight) / sum(c.weight) * 100, 1)
                from public.quality_supplier_eval_template_criteria c
                where c.template_id = v_tpl.id and c.organization_id = v_org and v_ev.scores[c.position + 1] is not null);
    v_eval := gen_random_uuid();
    insert into public.quality_supplier_evaluations (id, organization_id, supplier_id, evaluated_on, evaluator, notes, template_id, template_name, template_version,
      pass_threshold, conditional_threshold, score_scale, total_score, result, criteria_scores, period_year, source, created_by, updated_by)
    values (v_eval, v_org, v_ev.supplier_id, d0 + v_ev.days, v_ev.evaluator, v_ev.notes, v_tpl.id, v_tpl.name, v_tpl.version,
      v_tpl.pass_threshold, v_tpl.conditional_threshold, v_tpl.score_scale, v_total,
      case when v_total >= v_tpl.pass_threshold then 'approved' when v_total >= v_tpl.conditional_threshold then 'conditional' else 'rejected' end,
      'complete', extract(year from d0 + v_ev.days)::smallint, 'app', p_actor, p_actor);
    insert into public.quality_supplier_evaluation_scores (organization_id, evaluation_id, criterion_id, criterion_label, position, weight, score_scale, score, created_by, updated_by)
    select v_org, v_eval, c.id, c.label, c.position, c.weight, v_tpl.score_scale, v_ev.scores[c.position + 1]::smallint, p_actor, p_actor
    from public.quality_supplier_eval_template_criteria c
    where c.template_id = v_tpl.id and c.organization_id = v_org and v_ev.scores[c.position + 1] is not null;
  end loop;

  -- The approval of each supplier is the result of its latest evaluation.
  update public.quality_suppliers s set approval_status = e.result
  from (select distinct on (x.supplier_id) x.supplier_id, x.result from public.quality_supplier_evaluations x
        where x.organization_id = v_org order by x.supplier_id, x.evaluated_on desc) e
  where s.organization_id = v_org and s.id = e.supplier_id;

  -- Nonconformities: (code, days ago, description, severity, status, closed days ago)
  insert into public.quality_supplier_nonconformities (organization_id, supplier_id, occurred_on, description, severity, status, closed_on, created_by, updated_by)
  select v_org, s.id, d0 + n.days, n.description, n.severity, n.status, d0 + n.closed, p_actor, p_actor
  from (values
    ('SUP-002', -60, 'Παρτίδα γαντιών νιτριλίου με σχισίματα κατά τη χρήση (ΜΕΘ).', 'major', 'open', null::integer),
    ('SUP-002', -150, 'Παράδοση 9 ημέρες εκτός χρόνου.', 'minor', 'closed', -120),
    ('SUP-004', -30, 'Παράδοση με θερμοκρασία μεταφοράς εκτός ορίων.', 'minor', 'open', null),
    ('SUP-006', -95, 'Ελλιπή συνοδευτικά έντυπα σε παραλαβή ΕΑΑΜ.', 'major', 'closed', -70),
    ('SUP-008', -25, 'Λαχανικά χωρίς επισήμανση προέλευσης.', 'minor', 'open', null)
  ) n(code, days, description, severity, status, closed)
  join public.quality_suppliers s on s.organization_id = v_org and s.code = n.code;

  -- Renewal requests (no link is issued and no e-mail is queued here).
  -- 1. Proposed: the expired ISO 9001 and ISO 14001 of SUP-002, waiting for approval to be sent.
  v_request := gen_random_uuid();
  insert into public.quality_supplier_certificate_requests (id, organization_id, supplier_id, recipient_email, status, requested_by, requested_at, created_at, updated_at)
  select v_request, v_org, s.id, 'orders@example.com', 'proposed', p_actor, now() - interval '1 day', now() - interval '1 day', now() - interval '1 day'
  from public.quality_suppliers s where s.organization_id = v_org and s.code = 'SUP-002';
  insert into public.quality_supplier_certificate_request_items (organization_id, request_id, supplier_id, certification_id, status, certificate_snapshot, created_at, updated_at)
  select v_org, v_request, c.supplier_id, c.id, 'pending',
    jsonb_build_object('certificate_type', c.certificate_type, 'title', c.title, 'document_kind', c.document_kind,
      'certificate_number', c.certificate_number, 'issuer', c.issuer, 'expires_on', c.expires_on, 'attachment_id', c.attachment_id),
    now() - interval '1 day', now() - interval '1 day'
  from public.quality_supplier_certifications c
  join public.quality_suppliers s on s.id = c.supplier_id and s.code = 'SUP-002'
  where c.organization_id = v_org and c.certificate_number in ('QM-2290', 'EM-2291');

  -- 2. Sent six days ago; the supplier has answered with the new ΕΦΕΤ certificate, waiting for review.
  v_cert := (select c from public.quality_supplier_certifications c where c.organization_id = v_org and c.certificate_number = 'EFET-4410');
  if v_cert.id is not null then
    v_request := gen_random_uuid();
    insert into public.quality_supplier_certificate_requests (id, organization_id, supplier_id, recipient_email, status, requested_by, requested_at,
      approved_by, approved_at, token_expires_at, sent_at, first_sent_at, send_count, send_history, created_at, updated_at)
    values (v_request, v_org, v_cert.supplier_id, 'orders-food@example.com', 'sent', p_actor, now() - interval '7 days',
      p_actor, now() - interval '6 days', now() + interval '8 days', now() - interval '6 days', now() - interval '6 days', 1,
      jsonb_build_array(jsonb_build_object('kind', 'send', 'at', now() - interval '6 days', 'by', p_actor, 'expiresAt', now() + interval '8 days')),
      now() - interval '7 days', now() - interval '2 days');
    insert into public.quality_supplier_certificate_request_items (organization_id, request_id, supplier_id, certification_id, status, certificate_snapshot,
      submitted_at, certificate_type, certificate_number, issuer, issued_on, expires_on, note, owner_notified_at, created_at, updated_at)
    values (v_org, v_request, v_cert.supplier_id, v_cert.id, 'submitted',
      jsonb_build_object('certificate_type', v_cert.certificate_type, 'title', v_cert.title, 'document_kind', v_cert.document_kind,
        'certificate_number', v_cert.certificate_number, 'issuer', v_cert.issuer, 'expires_on', v_cert.expires_on, 'attachment_id', v_cert.attachment_id),
      now() - interval '2 days', v_cert.certificate_type, 'EFET-5120', 'ΕΦΕΤ', d0 - 20, d0 + 345, 'Η νέα βεβαίωση εκδόθηκε μετά την αυτοψία.', now() - interval '2 days',
      now() - interval '7 days', now() - interval '2 days');
  end if;

  -- 3. Closed: the ISO 14001 of SUP-006 was renewed by the supplier and accepted.
  v_cert := (select c from public.quality_supplier_certifications c where c.organization_id = v_org and c.certificate_number = 'EM-5550');
  if v_cert.id is not null then
    v_request := gen_random_uuid();
    insert into public.quality_supplier_certificate_requests (id, organization_id, supplier_id, recipient_email, status, requested_by, requested_at,
      approved_by, approved_at, token_expires_at, sent_at, first_sent_at, send_count, send_history, created_at, updated_at)
    values (v_request, v_org, v_cert.supplier_id, 'waste@example.com', 'closed', p_actor, now() - interval '36 days',
      p_actor, now() - interval '35 days', now() - interval '21 days', now() - interval '35 days', now() - interval '35 days', 1,
      jsonb_build_array(jsonb_build_object('kind', 'send', 'at', now() - interval '35 days', 'by', p_actor, 'expiresAt', now() - interval '21 days')),
      now() - interval '36 days', now() - interval '28 days');
    insert into public.quality_supplier_certificate_request_items (organization_id, request_id, supplier_id, certification_id, status, certificate_snapshot,
      submitted_at, certificate_type, certificate_number, issuer, issued_on, expires_on, reviewed_by, reviewed_at, review_comment, previous_values,
      owner_notified_at, created_at, updated_at)
    select v_org, v_request, v_cert.supplier_id, v_cert.id, 'accepted', old.value,
      now() - interval '30 days', v_cert.certificate_type, v_cert.certificate_number, v_cert.issuer, d0 - 32, v_cert.expires_on,
      p_actor, now() - interval '28 days', 'Ελέγχθηκε· ενημερώθηκε το μητρώο.', old.value,
      now() - interval '30 days', now() - interval '36 days', now() - interval '28 days'
    from (select jsonb_build_object('certificate_type', v_cert.certificate_type, 'title', v_cert.title, 'document_kind', v_cert.document_kind,
            'certificate_number', 'EM-4410', 'issuer', v_cert.issuer, 'expires_on', d0 - 15, 'attachment_id', null) as value) old;
  end if;

  -- Equipment: (code, name, type, department, location, manufacturer, model, serial, inventory, supplier, criticality, status,
  --             installed days ago, warranty in days, maintenance / calibration / safety months, notes)
  insert into public.quality_equipment (organization_id, code, name, equipment_type, department_id, location, manufacturer, model, serial_number, inventory_number,
    supplier_id, criticality, status, installed_on, warranty_ends_on, maintenance_months, calibration_months, safety_months, notes, created_by)
  select v_org, e.code, e.name, e.type, private.demo_quality_resources_department(v_org, e.dept), e.location, e.maker, e.model, e.serial, e.inventory,
    (select s.id from public.quality_suppliers s where s.organization_id = v_org and s.code = e.supplier), e.crit, e.status,
    d0 + e.installed, d0 + e.warranty, e.maint, e.cal, e.safety, e.notes, p_actor
  from (values
    ('EQ-0001', 'Απινιδωτής', 'Απινιδωτής', 'Μονάδα Εντατικής Θεραπείας', 'Σταθμός νοσηλευτών', 'Κατασκευαστής Α', 'D-300', 'DF30-11872', 'ΑΠ-1021', 'SUP-001', 'high', 'in_service', -1400, null::integer, 6, null::integer, 12, null),
    ('EQ-0002', 'Απινιδωτής', 'Απινιδωτής', 'Χειρουργική Κλινική', 'Αίθουσα ανάνηψης', 'Κατασκευαστής Α', 'D-300', 'DF30-11990', 'ΑΠ-1022', 'SUP-001', 'high', 'in_service', -1400, null, 6, null, 12, null),
    ('EQ-0003', 'Ψυγείο φαρμάκων', 'Ψυγείο φαρμάκων', 'Παθολογική Κλινική', 'Φαρμακείο τμήματος', 'Κατασκευαστής Β', 'MR-140', 'MR140-5521', 'ΑΠ-2210', 'SUP-003', 'high', 'in_service', -1200, null, 12, 12, null, null),
    ('EQ-0004', 'Ψυγείο εμβολίων', 'Ψυγείο εμβολίων', 'Παιδιατρική Κλινική', 'Ιατρείο', 'Κατασκευαστής Β', 'VR-90', 'VR90-0042', 'ΑΠ-2211', 'SUP-003', 'high', 'in_service', -900, null, 12, 12, null, null),
    ('EQ-0005', 'Κλίβανος αποστείρωσης ατμού', 'Κλίβανος αποστείρωσης', null, 'Κεντρική Αποστείρωση', 'Κατασκευαστής Γ', 'ST-600', 'ST6-2019-07', 'ΑΠ-0100', 'SUP-003', 'high', 'in_service', -2000, null, 3, 12, 12, null),
    ('EQ-0006', 'Πλυντήριο-απολυμαντής ενδοσκοπίων', 'Πλυντήριο-απολυμαντής ενδοσκοπίων', 'Χειρουργική Κλινική', 'Ενδοσκοπικό', 'Κατασκευαστής Δ', 'EW-2', 'EW2-7781', 'ΑΠ-0310', 'SUP-003', 'high', 'in_service', -1100, null, 6, 12, 12, null),
    ('EQ-0007', 'Αναρροφητήρας', 'Αναρροφητήρας', 'Χειρουργική Κλινική', 'Θάλαμος 4', 'Κατασκευαστής Ε', 'SU-10', 'SU10-334', 'ΑΠ-0411', 'SUP-001', 'medium', 'in_service', -1400, null, 12, null, 12, null),
    ('EQ-0008', 'Θερμοκοιτίδα', 'Θερμοκοιτίδα', 'Μονάδα Εντατικής Νοσηλείας Νεογνών', 'Θέση 2', 'Κατασκευαστής Ζ', 'IN-5', 'IN5-0912', 'ΑΠ-0520', 'SUP-012', 'high', 'in_service', -165, 200, 6, 12, 12, null),
    ('EQ-0009', 'Θάλαμος βιολογικής ασφάλειας', 'Θάλαμος βιολογικής ασφάλειας', null, 'Μικροβιολογικό εργαστήριο', 'Κατασκευαστής Η', 'BSC-II', 'BSC2-118', 'ΑΠ-0601', 'SUP-003', 'high', 'in_service', -1600, null, 12, 12, 12, null),
    ('EQ-0010', 'Παρασκευαστής πάγου', 'Παρασκευαστής πάγου', 'Καρδιολογική Κλινική', 'Office', null, null, null, null, null, 'low', 'in_service', -1000, null, 6, null, null, null),
    ('EQ-0011', 'Τροχήλατο ανάνηψης', 'Τροχήλατο ανάνηψης', 'Ορθοπαιδική Κλινική', 'Διάδρομος', null, null, null, 'ΑΠ-0711', null, 'high', 'in_service', -1500, null, 1, null, null, 'Μηνιαίος έλεγχος περιεχομένου και λήξεων.'),
    ('EQ-0012', 'Αναρροφητήρας', 'Αναρροφητήρας', 'Μονάδα Εντατικής Θεραπείας', null, 'Κατασκευαστής Ε', 'SU-8', 'SU8-101', 'ΑΠ-0402', 'SUP-001', 'medium', 'retired', -3000, null, 12, null, 12, 'Αντικαταστάθηκε από το EQ-0007.'),
    ('EQ-0013', 'Μηχάνημα αιμοκάθαρσης', 'Μηχάνημα αιμοκάθαρσης', 'Νεφρολογική Κλινική', 'Θέση 1', 'Κατασκευαστής Θ', 'HD-5008', 'HD5-2201', 'ΑΠ-0801', 'SUP-016', 'high', 'in_service', -800, 100, 6, 12, 12, null),
    ('EQ-0014', 'Μηχάνημα αιμοκάθαρσης', 'Μηχάνημα αιμοκάθαρσης', 'Νεφρολογική Κλινική', 'Θέση 2', 'Κατασκευαστής Θ', 'HD-5008', 'HD5-2202', 'ΑΠ-0802', 'SUP-016', 'high', 'in_service', -800, 100, 6, 12, 12, null),
    ('EQ-0015', 'Αναπνευστήρας', 'Αναπνευστήρας', 'Μονάδα Εντατικής Θεραπείας', 'Κλίνη 1', 'Κατασκευαστής Ι', 'V-800', 'V800-3301', 'ΑΠ-0901', 'SUP-001', 'high', 'in_service', -700, null, 6, 12, 12, null),
    ('EQ-0016', 'Αναπνευστήρας', 'Αναπνευστήρας', 'Μονάδα Εντατικής Θεραπείας', 'Κλίνη 4', 'Κατασκευαστής Ι', 'V-800', 'V800-3302', 'ΑΠ-0902', 'SUP-001', 'high', 'in_service', -700, null, 6, 12, 12, null),
    ('EQ-0017', 'Ηλεκτροκαρδιογράφος', 'Ηλεκτροκαρδιογράφος', 'Καρδιολογική Κλινική', 'Εξεταστήριο', 'Κατασκευαστής Κ', 'ECG-12', 'ECG12-778', 'ΑΠ-1001', 'SUP-014', 'medium', 'in_service', -1300, null, 12, null, 12, null),
    ('EQ-0018', 'Αντλία έγχυσης', 'Αντλία έγχυσης', 'Παθολογική Κλινική', 'Θάλαμος 2', 'Κατασκευαστής Λ', 'IP-7', 'IP7-5530', 'ΑΠ-1101', 'SUP-001', 'medium', 'in_service', -600, null, 12, 12, null, null),
    ('EQ-0019', 'Ψυγείο μητρικού γάλακτος', 'Ψυγείο', 'Μονάδα Εντατικής Νοσηλείας Νεογνών', 'Γαλακτοκομείο', 'Κατασκευαστής Β', 'MR-60', 'MR60-0088', 'ΑΠ-2212', 'SUP-003', 'high', 'in_service', -500, null, 12, 12, null, null),
    ('EQ-0020', 'Καταγραφικό θερμοκρασίας', 'Καταγραφικό θερμοκρασίας', 'Παιδιατρική Κλινική', 'Ψυγείο εμβολίων', 'Κατασκευαστής Μ', 'TL-1', 'TL1-4412', null, 'SUP-003', 'medium', 'in_service', -900, null, null, 12, null, null),
    ('EQ-0021', 'Ηλεκτρική κλίνη', 'Κλίνη νοσηλείας', 'Ορθοπαιδική Κλινική', 'Θάλαμος 6', 'Κατασκευαστής Ν', 'BED-3', 'BED3-1290', 'ΑΠ-1201', null, 'low', 'in_service', -1100, null, 12, null, 24, null)
  ) e(code, name, type, dept, location, maker, model, serial, inventory, supplier, crit, status, installed, warranty, maint, cal, safety, notes);

  -- Events: (equipment, kind, days ago, result, performed by, description, certificate)
  insert into public.quality_equipment_events (organization_id, equipment_id, kind, happened_on, result, performed_by, description, certificate, recorded_by, recorded_at)
  select v_org, q.id, v.kind, d0 + v.days, v.result, v.who, v.description, v.cert, p_actor, (d0 + v.days)::timestamp + interval '10 hours'
  from (values
    ('EQ-0001', 'maintenance', -150, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0001', 'safety', -150, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0002', 'maintenance', -200, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0002', 'safety', -200, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0003', 'maintenance', -340, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0003', 'calibration', -340, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, 'ΠΔ-2291'),
    ('EQ-0004', 'maintenance', -100, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0004', 'calibration', -100, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, 'ΠΔ-2302'),
    ('EQ-0005', 'maintenance', -70, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0005', 'calibration', -250, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, 'ΠΔ-2250'),
    ('EQ-0005', 'safety', -250, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0005', 'failure', -12, 'out_of_service', 'Προσωπικό Κεντρικής Αποστείρωσης', 'Ο κύκλος διακόπτεται με σφάλμα πίεσης· οι δείκτες Bowie-Dick απέτυχαν.', null),
    ('EQ-0006', 'maintenance', -160, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0006', 'calibration', -330, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, 'ΠΔ-2260'),
    ('EQ-0006', 'safety', -330, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0007', 'maintenance', -380, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0007', 'safety', -380, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0007', 'failure', -40, 'out_of_service', 'Προσωπικό τμήματος', 'Δεν δημιουργεί αναρρόφηση.', null),
    ('EQ-0007', 'repair', -35, 'returned', 'Βιοϊατρική Συντήρηση Ο.Ε.', 'Αντικατάσταση φίλτρου και σωλήνωσης.', null),
    ('EQ-0009', 'maintenance', -20, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0009', 'calibration', -20, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, 'ΠΔ-2410'),
    ('EQ-0009', 'safety', -20, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0010', 'maintenance', -175, 'pass', 'Τεχνική υπηρεσία', null, null),
    ('EQ-0011', 'maintenance', -20, 'pass', 'Προϊσταμένη τμήματος', 'Μηνιαίος έλεγχος περιεχομένου και λήξεων.', null),
    ('EQ-0011', 'maintenance', -50, 'pass', 'Προϊσταμένη τμήματος', 'Μηνιαίος έλεγχος περιεχομένου και λήξεων.', null),
    ('EQ-0012', 'maintenance', -500, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0013', 'maintenance', -90, 'pass', 'Νεφρολογικά Συστήματα Α.Ε.', null, null),
    ('EQ-0013', 'calibration', -300, 'pass', 'Νεφρολογικά Συστήματα Α.Ε.', null, 'ΠΔ-2480'),
    ('EQ-0013', 'safety', -300, 'pass', 'Νεφρολογικά Συστήματα Α.Ε.', null, null),
    ('EQ-0014', 'maintenance', -210, 'pass', 'Νεφρολογικά Συστήματα Α.Ε.', null, null),
    ('EQ-0014', 'calibration', -380, 'pass', 'Νεφρολογικά Συστήματα Α.Ε.', null, 'ΠΔ-2190'),
    ('EQ-0014', 'safety', -300, 'pass', 'Νεφρολογικά Συστήματα Α.Ε.', null, null),
    ('EQ-0015', 'maintenance', -60, 'pass', 'Ιατροτεχνική Θεσσαλίας Α.Ε.', null, null),
    ('EQ-0015', 'calibration', -60, 'pass', 'Ιατροτεχνική Θεσσαλίας Α.Ε.', null, 'ΠΔ-2501'),
    ('EQ-0015', 'safety', -60, 'pass', 'Ιατροτεχνική Θεσσαλίας Α.Ε.', null, null),
    ('EQ-0016', 'maintenance', -120, 'pass', 'Ιατροτεχνική Θεσσαλίας Α.Ε.', null, null),
    ('EQ-0016', 'calibration', -120, 'pass', 'Ιατροτεχνική Θεσσαλίας Α.Ε.', null, 'ΠΔ-2502'),
    ('EQ-0016', 'safety', -120, 'fail', 'Ιατροτεχνική Θεσσαλίας Α.Ε.', 'Ρεύμα διαρροής πάνω από το όριο.', null),
    ('EQ-0016', 'repair', -115, 'returned', 'Ιατροτεχνική Θεσσαλίας Α.Ε.', 'Αντικατάσταση τροφοδοτικού.', null),
    ('EQ-0016', 'safety', -114, 'pass', 'Ιατροτεχνική Θεσσαλίας Α.Ε.', 'Επανέλεγχος μετά την επισκευή.', null),
    ('EQ-0017', 'maintenance', -400, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0017', 'safety', -400, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0018', 'maintenance', -250, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0018', 'calibration', -250, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, 'ΠΔ-2330'),
    ('EQ-0019', 'maintenance', -30, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0019', 'calibration', -30, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, 'ΠΔ-2520'),
    ('EQ-0020', 'calibration', -355, 'pass', 'Εργαστήριο διακριβώσεων', null, 'ΠΔ-2105'),
    ('EQ-0021', 'maintenance', -100, 'pass', 'Τεχνική υπηρεσία', null, null)
  ) v(code, kind, days, result, who, description, cert)
  join public.quality_equipment q on q.organization_id = v_org and q.code = v.code;
end;
$function$;
revoke all on function private.demo_seed_quality_resources(uuid, uuid) from public, anon, authenticated;
