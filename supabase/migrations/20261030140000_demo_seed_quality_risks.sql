-- Risk assessment in the evaluators' Demo organizations: the same generic
-- register as the application's sample Demo (riskDemoData.js), assessed in
-- three consecutive years (archived, approved, under review) with its approval
-- trail, three opportunities and the indicators each risk is measured with.
-- Nothing of any hospital's own register is used.
-- Same rules as the other demo_seed_* functions: no SELECT/EXECUTE/RETURNING
-- ... INTO, no DELETE/DROP, everything schema-qualified, dates relative to
-- current_date. Skipped when the organization already has an assessment.

-- One entry of an assessment's history, as the application writes it.
create or replace function private.demo_risk_event(p_action text, p_actor text, p_on date)
returns jsonb language plpgsql immutable set search_path = ''
as $function$
begin
  return jsonb_build_object('id', md5(p_action || p_on::text), 'action', p_action, 'actor', p_actor, 'at', to_char(p_on, 'YYYY-MM-DD') || 'T09:00:00.000Z');
end;
$function$;
revoke all on function private.demo_risk_event(text, text, date) from public, anon, authenticated;

create or replace function private.demo_seed_quality_risks(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_older uuid := gen_random_uuid();
  v_previous uuid := gen_random_uuid();
  v_current uuid := gen_random_uuid();
  v_current_on date := current_date - 7;
  -- One calendar year apart, so each assessment has its own year (and code).
  v_previous_on date := (current_date - 7 - interval '1 year')::date;
  v_older_on date := (current_date - 7 - interval '2 years')::date;
begin
  if exists (select 1 from public.quality_risk_assessments a where a.organization_id = p_organization_id) then
    return;
  end if;

  insert into public.quality_risk_assessments
    (id, organization_id, code, title, period_label, period_kind, assessed_on, next_review_on, assessor_label, form_code, scope_note, status, approved_by_label, approved_on, source_assessment_id, history, created_by)
  values
    (v_older, p_organization_id, 'RSA-DEMO-' || extract(year from v_older_on)::int, 'Εκτίμηση επικινδυνότητας ' || extract(year from v_older_on)::int, extract(year from v_older_on)::int::text, 'annual', v_older_on, v_older_on + 365, 'Διεύθυνση Ποιότητας', 'ΠΟΙ-ΕΚ-01', 'Κλινικοί και μη κλινικοί κίνδυνοι όλων των τμημάτων του νοσοκομείου.', 'archived', 'Επιτροπή Ποιότητας', v_older_on + 14, null, jsonb_build_array(private.demo_risk_event('riskAssessmentCreated', 'Υπεύθυνος Ποιότητας', v_older_on + 0), private.demo_risk_event('riskAssessmentSubmitted', 'Υπεύθυνος Ποιότητας', v_older_on + 3), private.demo_risk_event('riskAssessmentApproved', 'Πρόεδρος Επιτροπής Ποιότητας', v_older_on + 14), private.demo_risk_event('riskAssessmentArchived', 'Υπεύθυνος Ποιότητας', v_older_on + 380)), p_actor),
    (v_previous, p_organization_id, 'RSA-DEMO-' || extract(year from v_previous_on)::int, 'Εκτίμηση επικινδυνότητας ' || extract(year from v_previous_on)::int, extract(year from v_previous_on)::int::text, 'annual', v_previous_on, v_previous_on + 365, 'Διεύθυνση Ποιότητας', 'ΠΟΙ-ΕΚ-01', 'Κλινικοί και μη κλινικοί κίνδυνοι όλων των τμημάτων του νοσοκομείου.', 'approved', 'Επιτροπή Ποιότητας', v_previous_on + 14, v_older, jsonb_build_array(private.demo_risk_event('riskAssessmentCreated', 'Υπεύθυνος Ποιότητας', v_previous_on + 0), private.demo_risk_event('riskAssessmentSubmitted', 'Υπεύθυνος Ποιότητας', v_previous_on + 3), private.demo_risk_event('riskAssessmentApproved', 'Πρόεδρος Επιτροπής Ποιότητας', v_previous_on + 14)), p_actor),
    (v_current, p_organization_id, 'RSA-DEMO-' || extract(year from v_current_on)::int, 'Εκτίμηση επικινδυνότητας ' || extract(year from v_current_on)::int, extract(year from v_current_on)::int::text, 'annual', v_current_on, v_current_on + 365, 'Διεύθυνση Ποιότητας', 'ΠΟΙ-ΕΚ-01', 'Κλινικοί και μη κλινικοί κίνδυνοι όλων των τμημάτων του νοσοκομείου.', 'under_review', null, null, v_previous, jsonb_build_array(private.demo_risk_event('riskAssessmentCreated', 'Υπεύθυνος Ποιότητας', v_current_on + 0), private.demo_risk_event('riskAssessmentSubmitted', 'Υπεύθυνος Ποιότητας', v_current_on + 3)), p_actor);

  -- The same risks in the three years: the residual risk falls year by year;
  -- the current assessment also has a target.
  insert into public.quality_risks
    (organization_id, assessment_id, lineage_key, position, section, process, scope, hazard, jci_chapter, inherent_l, inherent_c, existing_controls, residual_l, residual_c, consequence_rationale, additional_measures, owner_label, due_date, review_frequency, target_l, target_c, prioritized, indicator_keys)
  select p_organization_id, y.assessment_id, r.key, r.pos, r.section, r.process, r.scope, r.hazard, r.jci, r.il, r.ic,
    'Τήρηση διαδικασιών και πρωτοκόλλων, εκπαίδευση προσωπικού, παρακολούθηση συμβάντων',
    case y.stage when 0 then r.ol when 1 then r.pl else r.cl end,
    case y.stage when 0 then r.oc when 1 then r.pc else r.cc end,
    case when (case y.stage when 0 then r.oc when 1 then r.pc else r.cc end) <> r.ic then 'Τα υφιστάμενα μέτρα περιορίζουν τη σοβαρότητα του συμβάντος.' end,
    r.measures, r.owner,
    case when r.measures is not null then y.assessed_on + case y.stage when 2 then 127 else 192 end end,
    'Μηνιαίος έλεγχος',
    case when y.stage = 2 then r.tl end, case when y.stage = 2 then r.tc end,
    y.stage = 2 and r.key = 'R001',
    r.indicator_keys::text[]
  from (values
      ('R001', 0, 'clinical', 'ΑΣΦΑΛΕΙΑ ΑΣΘΕΝΩΝ', 'ΜΕΘ ενηλίκων', 'Ενδονοσοκομειακή λοίμωξη / έξαρση λόγω μη τήρησης των πρωτοκόλλων πρόληψης λοιμώξεων', 'IPSG.5', 4, 5, 4, 5, 4, 5, 3, 5, 2, 5, 'Εβδομαδιαίοι έλεγχοι συμμόρφωσης στα bundles, επανεκπαίδευση προσωπικού', 'Προϊστάμενος Λοιμώξεων', '{hai-prevalence-pps,who-hh}'),
      ('R002', 1, 'clinical', 'ΑΣΦΑΛΕΙΑ ΑΣΘΕΝΩΝ', 'Όλα τα νοσηλευτικά τμήματα', 'Διασπορά πολυανθεκτικού μικροοργανισμού λόγω καθυστέρησης στην απομόνωση', 'PCI', 4, 4, 4, 4, 3, 4, 2, 4, 2, 3, 'Αυτόματη ειδοποίηση απομόνωσης από το εργαστήριο', 'Επιτροπή Λοιμώξεων', '{mdr-introduction-index,mdro-bsi-per-1000}'),
      ('R003', 2, 'clinical', 'ΝΟΣΗΛΕΥΤΙΚΗ ΠΡΑΞΗ', 'ΜΕΘ, Χειρουργικά τμήματα', 'Λοίμωξη αίματος από κεντρικό φλεβικό καθετήρα (CLABSI)', 'PCI', 4, 4, 4, 4, 3, 4, 3, 4, 2, 4, 'Bundle εισαγωγής και συντήρησης, καθημερινή αξιολόγηση αναγκαιότητας', 'Διευθυντής ΜΕΘ', '{clabsi-rate,hai-prevalence-pps}'),
      ('R004', 3, 'clinical', 'ΤΑΥΤΟΠΟΙΗΣΗ ΑΣΘΕΝΩΝ', 'Χειρουργείο', 'Ανεπιθύμητο συμβάν λόγω μη ορθής ταυτοποίησης ασθενή', 'IPSG.1', 4, 5, 3, 5, 2, 5, 2, 5, 1, 5, 'Λίστα ελέγχου χειρουργικής ασφάλειας σε κάθε επέμβαση', 'Προϊστάμενος Χειρουργείου', '{open-high-incidents}'),
      ('R005', 4, 'clinical', 'ΑΣΦΑΛΕΙΑ ΑΣΘΕΝΩΝ', 'Όλα τα νοσηλευτικά τμήματα', 'Πτώση ασθενή με τραυματισμό', 'IPSG.6', 3, 3, 3, 3, 3, 3, 2, 3, 2, 2, 'Αξιολόγηση κινδύνου πτώσης κατά την εισαγωγή, σήμανση κλίνης', 'Νοσηλευτική Διεύθυνση', '{open-high-incidents}'),
      ('R006', 5, 'clinical', 'ΔΙΑΧΕΙΡΙΣΗ ΦΑΡΜΑΚΩΝ', 'Όλα τα νοσηλευτικά τμήματα', 'Ανεπιθύμητη ενέργεια από λάθος φαρμακευτικής αγωγής (δόση, οδός, φάρμακο)', 'MMU', 4, 4, 4, 4, 3, 4, 2, 4, 2, 3, 'Διπλός έλεγχος φαρμάκων υψηλού κινδύνου', 'Φαρμακείο', '{open-high-incidents}'),
      ('R007', 6, 'clinical', 'ΑΣΦΑΛΕΙΑ ΑΣΘΕΝΩΝ', 'Όλα τα νοσηλευτικά τμήματα', 'Έλκη πίεσης σε ασθενείς υψηλού κινδύνου', 'COP', 3, 3, 3, 3, 2, 3, 2, 3, 1, 3, null, null, '{open-high-incidents}'),
      ('R008', 7, 'clinical', 'ΕΣΩΤΕΡΙΚΗ ΕΠΙΚΟΙΝΩΝΙΑ', 'Εργαστήρια, κλινικές', 'Μη έγκαιρη ενημέρωση για κρίσιμα αποτελέσματα', 'IPSG.2', 3, 4, 3, 4, 3, 4, 2, 4, 1, 4, 'Καταγραφή κλειστού κύκλου επικοινωνίας κρίσιμων αποτελεσμάτων', 'Διευθυντής Εργαστηρίου', '{open-high-incidents}'),
      ('R009', 8, 'clinical', 'ΑΣΦΑΛΕΙΑ ΑΣΘΕΝΩΝ', 'Χειρουργεία', 'Λοίμωξη χειρουργικού πεδίου', 'IPSG.5', 3, 4, 3, 4, 2, 4, 3, 4, 2, 4, 'Έλεγχος χρόνου προφυλακτικής αντιβίωσης σε κάθε επέμβαση', 'Επιτροπή Λοιμώξεων', '{hai-prevalence-pps,who-hh}'),
      ('R010', 9, 'general', 'ΑΣΦΑΛΕΙΑ ΕΓΚΑΤΑΣΤΑΣΕΩΝ', 'Όλα τα τμήματα', 'Πυρκαγιά σε χώρους με ασθενείς και προσωπικό', 'FMS', 2, 5, 2, 5, 1, 5, 1, 5, 1, 5, null, null, '{open-high-incidents}'),
      ('R011', 10, 'general', 'ΑΣΦΑΛΕΙΑ ΕΡΓΑΖΟΜΕΝΩΝ', 'Όλα τα τμήματα', 'Τραυματισμός από αιχμηρό αντικείμενο', 'SQE', 3, 3, 3, 3, 3, 3, 2, 3, 1, 3, 'Ασφαλή αιχμηρά (safety devices) σε όλα τα τμήματα', 'Ιατρός Εργασίας', '{open-high-incidents}'),
      ('R012', 11, 'general', 'ΔΙΑΧΕΙΡΙΣΗ ΕΞΟΠΛΙΣΜΟΥ', 'Εργαστήρια', 'Μη δυνατότητα διεξαγωγής εξέτασης λόγω βλάβης εξοπλισμού', 'AOP', 3, 3, 3, 3, 2, 3, 2, 3, 2, 2, null, null, '{open-high-incidents}'),
      ('R013', 12, 'general', 'ΑΣΦΑΛΕΙΑ ΙΑΤΡΙΚΟΥ ΦΑΚΕΛΟΥ', 'Ιατρικό αρχείο', 'Διαρροή προσωπικών δεδομένων ασθενή', 'MOI', 2, 5, 2, 5, 2, 5, 2, 4, 1, 4, 'Έλεγχος δικαιωμάτων πρόσβασης ανά εξάμηνο', 'Υπεύθυνος Προστασίας Δεδομένων', '{open-high-incidents}'),
      ('R014', 13, 'clinical', 'ΑΣΦΑΛΕΙΑ ΑΣΘΕΝΩΝ', 'ΤΕΠ', 'Καθυστέρηση στην αναγνώριση σήψης', 'COP', 4, 5, 4, 5, 3, 5, 3, 4, 2, 4, 'Εργαλείο NEWS2 και πρωτόκολλο σήψης μέσα σε 1 ώρα', 'Διευθυντής ΤΕΠ', '{open-high-incidents}')
    ) as r(key, pos, section, process, scope, hazard, jci, il, ic, ol, oc, pl, pc, cl, cc, tl, tc, measures, owner, indicator_keys)
  cross join (values (0, v_older, v_older_on), (1, v_previous, v_previous_on), (2, v_current, v_current_on)) as y(stage, assessment_id, assessed_on);

  -- Opportunities, with how effective their action plan has been each year.
  insert into public.quality_risk_opportunities
    (organization_id, assessment_id, position, activity, opportunity, rating, action_plan, timeframe, owner_label, effectiveness_status, effectiveness)
  select p_organization_id, y.assessment_id, o.pos, o.activity, o.opportunity, o.rating, o.action_plan, o.timeframe, o.owner,
    case y.stage when 0 then o.s0 when 1 then o.s1 else o.s2 end,
    case y.stage when 0 then o.n0 when 1 then o.n1 else o.n2 end
  from (values
      (0, 'Πιστοποίηση κατά ISO 9001 / ISO 15224', 'Συμμόρφωση με τη νομοθεσία και φήμη του οργανισμού', 'Υψηλή απόδοση', 'Ετήσια επιθεώρηση επιτήρησης από τον φορέα πιστοποίησης
Εσωτερικές επιθεωρήσεις ανά εξάμηνο', 'Ετησίως', 'Διεύθυνση Ποιότητας', 'partial', 'Δύο ελάσσονες μη συμμορφώσεις, κλειστές.', 'effective', null, 'effective', 'Χωρίς μη συμμορφώσεις στην τελευταία επιθεώρηση.'),
      (1, 'Ηλεκτρονική καταγραφή ελέγχων και δεικτών', 'Άμεση εικόνα συμμόρφωσης ανά τμήμα και λιγότερος χρόνος καταγραφής', 'Υψηλή απόδοση', 'Εφαρμογή σε όλα τα νοσηλευτικά τμήματα
Εκπαίδευση των υπευθύνων τμημάτων
Μηνιαία αναφορά στην Επιτροπή Ποιότητας', 'Έως το τέλος του έτους', 'Διεύθυνση Νοσηλευτικής Υπηρεσίας', null, null, 'pending', 'Πιλοτική εφαρμογή σε 2 τμήματα.', 'partial', 'Εφαρμόζεται σε 6 από 10 τμήματα.'),
      (2, 'Ανατροφοδότηση από ασθενείς και συνοδούς', 'Βελτίωση της εμπειρίας του ασθενή και εντοπισμός προβλημάτων νωρίς', 'Χαμηλή απόδοση', 'Σύντομο ερωτηματολόγιο κατά την έξοδο
Τριμηνιαία ανάλυση των σχολίων', 'Ανά τρίμηνο', 'Γραφείο Προστασίας Δικαιωμάτων Ληπτών Υπηρεσιών Υγείας', null, null, null, null, 'pending', 'Αξιολόγηση στο τέλος του έτους.')
    ) as o(pos, activity, opportunity, rating, action_plan, timeframe, owner, s0, n0, s1, n1, s2, n2)
  cross join (values (0, v_older), (1, v_previous), (2, v_current)) as y(stage, assessment_id);
end;
$function$;
revoke all on function private.demo_seed_quality_risks(uuid, uuid) from public, anon, authenticated;

-- The quality pack now also seeds the risk assessment.
create or replace function private.demo_seed_quality(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
begin
  perform private.demo_seed_quality_audits(p_organization_id, p_actor);
  perform private.demo_seed_quality_enrich(p_organization_id, p_actor);
  perform private.demo_seed_quality_surveys(p_organization_id, p_actor);
  perform private.demo_seed_quality_indicators(p_organization_id, p_actor);
  perform private.demo_seed_quality_risks(p_organization_id, p_actor);
end;
$function$;
revoke all on function private.demo_seed_quality(uuid, uuid) from public, anon, authenticated;
