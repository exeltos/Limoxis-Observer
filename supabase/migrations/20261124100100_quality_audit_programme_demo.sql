-- The audit programme in every Demo organization, the same story as the browser
-- demo (src/features/quality/audits/auditDemoData.js): audits on the six
-- standards across the wards this year, done, under way and planned, with their
-- teams, opening and closing meetings, answers from the platform questionnaires,
-- the findings the answers became (classified) and a CAPA for the major one.
-- Dates are relative to the day the seed runs. A new Demo organization gets it
-- with the rest of the quality pack (private.demo_seed_quality). Idempotent: an
-- organization that already has seeded programme audits is left as it is.

create or replace function private.demo_seed_quality_audit_programme(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := current_date;
  a jsonb;
  o jsonb;
  m jsonb;
  v_audit uuid;
  v_code text;
  v_template uuid;
  v_dep uuid;
  v_planned date;
  v_done date;
  v_item uuid;
  v_finding uuid;
  v_fcode text;
  v_capa uuid;
  v_ccode text;
  v_n int := 0;
  v_spec constant jsonb := $json$[
    {"n":1,"key":"iso9001","dep":"ΜΕΘ","title":"Εσωτερική επιθεώρηση ISO 9001 — ΜΕΘ","type":"internal","pd":-341,"cd":-341,"status":"completed","risk":"high",
     "team":[["Νικολάου Δήμητρα","ΠΑΙΔ","lead",false,""]],"opening":"Διευθυντής ΜΕΘ, Προϊσταμένη ΜΕΘ, Νικολάου Δήμητρα","closing":"Διευθυντής ΜΕΘ, Προϊσταμένη ΜΕΘ","rep":"Παπαδοπούλου Μαρία",
     "conclusion":"Το σύστημα εφαρμόζεται αποτελεσματικά· μία παρατήρηση.",
     "overrides":[{"ref":"7.1.5","nth":1,"answer":"partial","cls":"observation","note":"Δύο θερμόμετρα ψυγείων χωρίς ετικέτα διακρίβωσης","evidence":"Ψυγεία φαρμάκων 1 και 3"}]},
    {"n":2,"key":"iso9001","dep":"ΠΑΘ","title":"Εσωτερική επιθεώρηση ISO 9001 — Παθολογική","type":"internal","pd":-215,"cd":-215,"status":"completed","risk":"medium",
     "team":[["Νικολάου Δήμητρα","ΠΑΙΔ","lead",false,""],["Σταθόπουλος Κώστας","ΝΕΦ","member",false,""]],"opening":"Κωνσταντίνου Κώστας, Προϊσταμένη Παθολογικής, Νικολάου Δήμητρα, Σταθόπουλος Κώστας","closing":"Κωνσταντίνου Κώστας, Προϊσταμένη Παθολογικής","rep":"Κωνσταντίνου Κώστας",
     "conclusion":"Ικανοποιητική εφαρμογή· μία έλασσον μη συμμόρφωση στον έλεγχο εγγράφων.",
     "overrides":[{"ref":"7.5.3","nth":1,"answer":"no","cls":"minor","note":"Στον σταθμό βρέθηκαν δύο εκδόσεις του εντύπου νοσηλευτικής λογοδοσίας (2023 και 2025)","evidence":"Φάκελος εντύπων σταθμού",
       "finding":{"n":1,"sev":"medium","status":"closed","owner":"Προϊσταμένη Παθολογικής","due":60,"verified":true}},
      {"ref":"9.1.2","nth":1,"answer":"partial","cls":"observation","note":"Οι έρευνες ικανοποίησης συλλέγονται αλλά δεν συζητούνται στις συναντήσεις του τμήματος","evidence":"Πρακτικά συναντήσεων τριμήνου",
       "finding":{"n":2,"sev":"low","status":"open","owner":"Κωνσταντίνου Κώστας","due":90}}]},
    {"n":3,"key":"iso15224","dep":"ΧΕΙΡ","title":"Επιθεώρηση ISO 15224 — Χειρουργική","type":"internal","pd":-151,"cd":-151,"status":"completed","risk":"high",
     "team":[["Νικολάου Δήμητρα","ΠΑΙΔ","lead",false,""],["Λαμπρόπουλος Παύλος","","member",true,"Σύμβουλος ποιότητας"]],"opening":"Ιωάννου Δήμητρα, Διευθυντής Χειρουργικής, Νικολάου Δήμητρα, Λαμπρόπουλος Παύλος","closing":"Ιωάννου Δήμητρα, Διευθυντής Χειρουργικής","rep":"Ιωάννου Δήμητρα",
     "conclusion":"Καλή κλινική διακυβέρνηση· χρειάζεται βελτίωση στη συνέχεια της φροντίδας κατά την έξοδο.",
     "overrides":[{"ref":"ΧΠ-3","nth":2,"answer":"partial","cls":"minor","note":"Σε 3 από 10 εξόδους δεν έγινε συμφιλίωση φαρμάκων","evidence":"Φάκελοι εξόδου του μήνα",
       "finding":{"n":3,"sev":"medium","status":"in_progress","owner":"Ιωάννου Δήμητρα","due":60}},
      {"ref":"8.5.1","nth":2,"answer":"partial","cls":"opportunity","note":"Η παράδοση βάρδιας γίνεται προφορικά χωρίς δομημένο εργαλείο","evidence":"Παρατήρηση πρωινής παράδοσης",
       "finding":{"n":4,"sev":"low","status":"open","owner":"Ιωάννου Δήμητρα","due":90}}]},
    {"n":4,"key":"temos","dep":null,"title":"Επιθεώρηση TEMOS — Γραφείο διεθνών ασθενών","type":"internal","pd":-103,"cd":-103,"status":"completed","risk":"low",
     "team":[["Νικολάου Δήμητρα","ΠΑΙΔ","lead",false,""]],"opening":"Υπεύθυνη Γραφείου Διεθνών Ασθενών, Νικολάου Δήμητρα","closing":"Υπεύθυνη Γραφείου Διεθνών Ασθενών, Ιατρικός Διευθυντής","rep":"Υπεύθυνη Γραφείου Διεθνών Ασθενών",
     "conclusion":"Η υπηρεσία λειτουργεί οργανωμένα· η μετάφραση των εγγράφων εξόδου θέλει επέκταση.",
     "overrides":[{"ref":"T2.3","nth":1,"answer":"partial","cls":"minor","note":"Το σημείωμα εξόδου δίνεται μόνο στα ελληνικά και αγγλικά","evidence":"Δείγμα 5 φακέλων διεθνών ασθενών",
       "finding":{"n":5,"sev":"medium","status":"open","owner":"Υπεύθυνη Γραφείου Διεθνών Ασθενών","due":60}}]},
    {"n":5,"key":"jci","dep":"ΜΕΘ","title":"Επιθεώρηση JCI — ΜΕΘ (IPSG, COP, MMU, PCI)","type":"internal","pd":-25,"cd":-25,"status":"completed","risk":"high","scope":["IPSG","COP","MMU","PCI"],
     "team":[["Νικολάου Δήμητρα","ΠΑΙΔ","lead",false,""],["Σταθόπουλος Κώστας","ΝΕΦ","member",false,""],["Σταυρίδης Λάμπρος","","expert",true,"JCI consultant"]],"opening":"Διευθυντής ΜΕΘ, Παπαδοπούλου Μαρία, Φαρμακοποιός, Νικολάου Δήμητρα, Σταθόπουλος Κώστας, Σταυρίδης Λάμπρος","closing":"Διευθυντής ΜΕΘ, Παπαδοπούλου Μαρία, Ιατρικός Διευθυντής","rep":"Παπαδοπούλου Μαρία",
     "conclusion":"Ένα μείζον εύρημα στη φύλαξη πυκνών ηλεκτρολυτών· απαιτείται άμεση διορθωτική ενέργεια και επαναληπτική επιθεώρηση.",
     "overrides":[{"ref":"IPSG.3","nth":2,"answer":"no","cls":"major","note":"Πυκνό KCl σε ανοιχτό ερμάριο του θαλάμου 2, χωρίς σήμανση υψηλού κινδύνου","evidence":"Ερμάριο φαρμάκων θαλάμου 2, φωτογραφία",
       "finding":{"n":6,"sev":"high","status":"in_progress","owner":"Παπαδοπούλου Μαρία","due":30,"capa":true}},
      {"ref":"IPSG.2","nth":1,"answer":"partial","cls":"minor","note":"Δύο τηλεφωνικές οδηγίες χωρίς τεκμηρίωση read-back","evidence":"Φύλλα οδηγιών της εβδομάδας",
       "finding":{"n":7,"sev":"medium","status":"open","owner":"Παπαδοπούλου Μαρία","due":60}},
      {"ref":"PCI.8","nth":1,"answer":"partial","cls":"observation","note":"Ελλιπής σήμανση απομόνωσης επαφής σε έναν θάλαμο","evidence":"Θάλαμος 5",
       "finding":{"n":8,"sev":"low","status":"open","owner":"Παπαδοπούλου Μαρία","due":90}},
      {"ref":"MMU.6","nth":1,"answer":"yes","cls":"opportunity","note":"Προτείνεται σάρωση barcode κατά τη χορήγηση","evidence":"Παρατήρηση χορήγησης",
       "finding":{"n":9,"sev":"low","status":"open","owner":"Φαρμακείο","due":90}}]},
    {"n":6,"key":"iso9001","dep":"ΝΕΦ","title":"Εσωτερική επιθεώρηση ISO 9001 — Νεφρολογική","type":"internal","pd":-4,"cd":null,"status":"in_progress","risk":"high","unanswered":30,
     "team":[["Νικολάου Δήμητρα","ΠΑΙΔ","lead",false,""],["Γεωργίου Σπύρος","ΚΑΡΔ","member",false,""]],"opening":"Διευθυντής Νεφρολογικής, Οικονόμου Κώστας, Νικολάου Δήμητρα, Γεωργίου Σπύρος","rep":"Οικονόμου Κώστας",
     "overrides":[{"ref":"7.1.5","nth":1,"answer":"partial","note":"Ο απινιδωτής του θαλάμου ανάνηψης έχει ληγμένη ετικέτα ελέγχου","evidence":"Θάλαμος ανάνηψης"}]},
    {"n":7,"key":"iso15189","dep":null,"title":"Επιθεώρηση ISO 15189 — Εργαστήριο","type":"internal","pd":17,"status":"planned","risk":"medium",
     "team":[["Νικολάου Δήμητρα","ΠΑΙΔ","lead",false,""],["Ανδρεάδου Κατερίνα","","member",true,"Βιοπαθολόγος, εξωτερική επιθεωρήτρια"]]},
    {"n":8,"key":"jci","dep":"ΚΑΡΔ","title":"Επιθεώρηση JCI — Καρδιολογική","type":"internal","pd":13,"month":true,"status":"planned","risk":"high","scope":["IPSG","ACC","PFE"],
     "team":[["Νικολάου Δήμητρα","ΠΑΙΔ","lead",false,""]]},
    {"n":9,"key":"haccp","dep":null,"title":"Επιθεώρηση HACCP — Κουζίνα","type":"internal","pd":32,"status":"planned","risk":"high",
     "team":[["Νικολάου Δήμητρα","ΠΑΙΔ","lead",false,""],["Τζαννέτου Ειρήνη","","member",true,"Τεχνολόγος τροφίμων"]]},
    {"n":10,"key":"iso15224","dep":"ΜΕΘ","title":"Επαναληπτική επιθεώρηση ISO 15224 — ΜΕΘ","type":"internal","pd":52,"status":"planned","risk":"high","follow":5,
     "team":[["Νικολάου Δήμητρα","ΠΑΙΔ","lead",false,""],["Παπαδάκη Μαρία","ΜΕΘ","member",false,""]]},
    {"n":11,"key":"iso9001","dep":null,"title":"Επιθεώρηση πιστοποίησης ISO 9001 (επιτήρηση)","type":"certification","pd":43,"month":true,"status":"planned","risk":"medium",
     "team":[["Φορέας πιστοποίησης — επικεφαλής επιθεωρητής","","lead",true,"Φορέας πιστοποίησης"]]}
  ]$json$::jsonb;
begin
  if exists (select 1 from public.quality_audits qa where qa.organization_id = v_org and qa.source = 'seed' and qa.standard is not null) then return; end if;

  for a in select value from jsonb_array_elements(v_spec) loop
    select t.id into v_template from public.quality_audit_templates t where t.is_system and t.template_key = a->>'key';
    if v_template is null then continue; end if;
    v_dep := (select dep.id from public.departments dep where dep.organization_id = v_org and dep.code = a->>'dep');
    v_planned := case when (a->>'month')::boolean then date_trunc('month', d0 + (a->>'pd')::int)::date else d0 + (a->>'pd')::int end;
    v_done := case when a->>'cd' is not null then d0 + (a->>'cd')::int end;
    v_code := 'AUD-' || to_char(v_planned, 'YYMMDD') || '-' || lpad((91000 + (a->>'n')::int)::text, 6, '0');

    insert into public.quality_audits (organization_id, code, title, audit_type, audit_kind, department_id, scope, planned_date, completed_date, status,
      lead_auditor_label, owner_label, owner_labels, template_id, template_title, template_version, standard, clauses_scope, planned_month_only,
      risk_level, frequency_months, opening_meeting_on, opening_attendees, closing_meeting_on, closing_attendees, auditee_representative, conclusion,
      follow_up_of, checklist_source, source, history, created_at, updated_at)
    select v_org, v_code, a->>'title', case when a->>'type' = 'internal' then 'internal' else 'external' end, a->>'type', v_dep, t.scope, v_planned, v_done, a->>'status',
      a->'team'->0->>0, a->'team'->0->>0, array[a->'team'->0->>0], t.id, t.title, t.version, t.standard,
      coalesce(array(select jsonb_array_elements_text(a->'scope')), '{}'), coalesce((a->>'month')::boolean, false),
      a->>'risk', case a->>'risk' when 'high' then 6 when 'low' then 24 else 12 end,
      case when a->>'opening' is not null then coalesce(v_done, d0 + (a->>'pd')::int) end, a->>'opening',
      v_done, a->>'closing', a->>'rep', a->>'conclusion',
      (select qa.id from public.quality_audits qa where qa.organization_id = v_org and qa.code like 'AUD-%-' || lpad((91000 + (a->>'follow')::int)::text, 6, '0') limit 1),
      'template:' || t.id, 'seed',
      jsonb_build_array(jsonb_build_object('id', 'AUD-demo-p' || (a->>'n'), 'at', least(v_planned, d0) - 14 + time '09:00', 'action', 'recordCreated', 'actorId', p_actor::text, 'actor', 'Υπεύθυνη Ποιότητας', 'actorEmail', '', 'reason', null, 'detail', null))
        || case when v_done is not null then jsonb_build_array(jsonb_build_object('id', 'AUD-demo-p' || (a->>'n') || '-2', 'at', v_done + time '15:00', 'action', 'auditCompleted', 'actorId', p_actor::text, 'actor', a->'team'->0->>0, 'actorEmail', '', 'reason', null, 'detail', null)) else '[]'::jsonb end,
      least(v_planned, d0) - 14 + time '09:00', now()
    from public.quality_audit_templates t where t.id = v_template
    on conflict (organization_id, code) do nothing
    returning id into v_audit;
    if v_audit is null then continue; end if;

    -- The team: an employee of the demo by name and department, or an external auditor.
    v_n := 0;
    for m in select value from jsonb_array_elements(a->'team') loop
      v_n := v_n + 1;
      insert into public.quality_audit_team_members (organization_id, audit_id, position, role, employee_id, full_name, is_external, affiliation)
      values (v_org, v_audit, v_n, m->>2,
        case when not (m->>3)::boolean then (select e.id from public.employees e join public.departments dep on dep.id = e.department_id
          where e.organization_id = v_org and dep.code = m->>1 and e.last_name || ' ' || e.first_name = m->>0 limit 1) end,
        m->>0, (m->>3)::boolean, nullif(m->>4, ''));
    end loop;

    -- The answers: the questionnaire's questions for a ward (or all, for the whole
    -- organization) and the chapters in scope; «Συμμορφώνεται» except the story's.
    if a->>'status' <> 'planned' then
      insert into public.quality_audit_checklist_items (organization_id, audit_id, position, item, required, result, answer, note, template_question_id,
        chapter_ref, chapter_title, clause_ref, guidance, evidence_required, evidence, weight, critical, finding_class, ad_hoc)
      select v_org, v_audit, x.pos, x.question, true, x.result, nullif(x.result, 'partial'), x.note, x.id, x.chapter_ref, x.chapter_title, x.clause_ref,
        x.guidance, x.evidence, x.seen, x.weight, x.critical, x.cls, false
      from (
        select q.*,
          case when ov.value is not null then ov.value->>'answer'
               when q.pos > q.total - coalesce((a->>'unanswered')::int, 0) then null
               when q.pos % 15 = 14 then 'na' else 'yes' end result,
          ov.value->>'note' note, ov.value->>'evidence' seen, ov.value->>'cls' cls
        from (
          select tq.*, row_number() over (order by tq.position)::int pos, count(*) over ()::int total,
            row_number() over (partition by tq.clause_ref order by tq.position)::int nth
          from public.quality_audit_template_questions tq
          where tq.template_id = v_template
            and (a->>'dep' is null or tq.areas = '{}' or 'clinical' = any (tq.areas))
            and (jsonb_array_length(coalesce(a->'scope', '[]')) = 0 or tq.chapter_ref in (select jsonb_array_elements_text(a->'scope')))
        ) q
        left join lateral (select e.value from jsonb_array_elements(a->'overrides') e where e.value->>'ref' = q.clause_ref and (e.value->>'nth')::int = q.nth) ov on true
      ) x;
    end if;

    -- The findings the classified answers became, and the CAPA of the major one.
    for o in select value from jsonb_array_elements(coalesce(a->'overrides', '[]')) where value ? 'finding' loop
      select ci.id into v_item from public.quality_audit_checklist_items ci
      where ci.audit_id = v_audit and ci.clause_ref = o->>'ref' order by ci.position offset (o->>'nth')::int - 1 limit 1;
      v_fcode := 'FND-' || to_char(v_done, 'YYMMDD') || '-' || lpad((91000 + (o->'finding'->>'n')::int)::text, 6, '0');
      insert into public.quality_findings (organization_id, code, title, department_id, identified_at, severity, status, description, source_type, source_id,
        owner_label, owner_labels, finding_class, audit_item_id, clause_ref, standard, due_date, verification_status, verified_on, verified_by_label, verification_note,
        follow_up_audit_id, history, created_at, updated_at)
      values (v_org, v_fcode,
        (case a->>'key' when 'iso9001' then 'ISO 9001' when 'iso15224' then 'ISO 15224' when 'haccp' then 'HACCP' when 'iso15189' then 'ISO 15189' when 'temos' then 'TEMOS' else 'JCI' end) || ' ' || (o->>'ref') || ' · ' || (o->>'note'),
        v_dep, v_done + time '15:30', o->'finding'->>'sev', o->'finding'->>'status',
        'Επιθεώρηση ' || v_code || ', ' || (o->>'ref') || ': ' || (o->>'note') || E'.\nΤεκμήρια: ' || (o->>'evidence'), 'audit', v_code,
        o->'finding'->>'owner', array[o->'finding'->>'owner'], o->>'cls', v_item, o->>'ref', a->>'key', v_done + (o->'finding'->>'due')::int,
        case when (o->'finding'->>'verified')::boolean then 'effective' else 'pending' end,
        case when (o->'finding'->>'verified')::boolean then v_done + 80 end,
        case when (o->'finding'->>'verified')::boolean then a->'team'->0->>0 end,
        case when (o->'finding'->>'verified')::boolean then 'Σε δειγματοληψία 10 εντύπων όλα στην τρέχουσα έκδοση.' end,
        null,
        jsonb_build_array(jsonb_build_object('id', 'FND-demo-p' || (o->'finding'->>'n'), 'at', v_done + time '15:30', 'action', 'findingCreated', 'actorId', p_actor::text, 'actor', a->'team'->0->>0, 'actorEmail', '', 'reason', null, 'detail', null)),
        v_done + time '15:30', now())
      on conflict (organization_id, code) do nothing
      returning id into v_finding;
      if v_finding is null then continue; end if;
      update public.quality_audit_checklist_items set finding_id = v_finding where id = v_item;
      insert into public.quality_record_links (organization_id, source_type, source_id, target_type, target_id, relationship, created_by, created_at)
      values (v_org, 'audit', v_code, 'finding', v_fcode, 'raised_finding', p_actor, v_done + time '15:30');

      if (o->'finding'->>'capa')::boolean then
        v_ccode := 'CAPA-' || to_char(v_done + 1, 'YYMMDD') || '-' || lpad((91000 + (o->'finding'->>'n')::int)::text, 6, '0');
        insert into public.quality_capa_actions (organization_id, code, title, department_id, source_type, source_id, action_type, priority, status, description,
          due_date, effectiveness_due, effectiveness_status, owner_label, owner_labels, history, created_at, updated_at)
        values (v_org, v_ccode, 'Απομάκρυνση πυκνών ηλεκτρολυτών από τα ερμάρια της ΜΕΘ', v_dep, 'finding', v_fcode, 'corrective', 'high', 'in_progress',
          'Τα πυκνά διαλύματα KCl φυλάσσονται μόνο στο φαρμακείο και σε κλειδωμένο ερμάριο της ΜΕΘ με σήμανση υψηλού κινδύνου· διπλός έλεγχος στη χορήγηση.',
          v_done + 30, v_done + 60, 'pending', o->'finding'->>'owner', array[o->'finding'->>'owner', 'Φαρμακείο'],
          jsonb_build_array(jsonb_build_object('id', 'CAPA-demo-p6', 'at', v_done + 1 + time '10:00', 'action', 'capaAssigned', 'actorId', p_actor::text, 'actor', 'Υπεύθυνη Ποιότητας', 'actorEmail', '', 'reason', null, 'detail', null)),
          v_done + 1 + time '10:00', now())
        on conflict (organization_id, code) do nothing
        returning id into v_capa;
        if v_capa is not null then
          insert into public.quality_capa_sub_actions (organization_id, capa_id, position, title, owner_label, due_date, done, done_at, done_by_label) values
            (v_org, v_capa, 1, 'Απομάκρυνση KCl από τα ερμάρια θαλάμων', o->'finding'->>'owner', v_done + 2, true, v_done + 1 + time '18:00', o->'finding'->>'owner'),
            (v_org, v_capa, 2, 'Κλειδωμένο ερμάριο με σήμανση υψηλού κινδύνου', 'Φαρμακείο', v_done + 16, true, v_done + 14 + time '12:00', 'Φαρμακείο'),
            (v_org, v_capa, 3, 'Εκπαίδευση βαρδιών στον διπλό έλεγχο', o->'finding'->>'owner', v_done + 30, false, null, null);
          insert into public.quality_record_links (organization_id, source_type, source_id, target_type, target_id, relationship, created_by, created_at)
          values (v_org, 'finding', v_fcode, 'capa', v_ccode, 'addressed_by', p_actor, v_done + 1 + time '10:00');
        end if;
      end if;
    end loop;
  end loop;

  -- The major finding is followed up by the planned ISO 15224 audit of the ICU.
  update public.quality_findings f set follow_up_audit_id = qa.id
  from public.quality_audits qa
  where f.organization_id = v_org and f.code like 'FND-%-091006' and qa.organization_id = v_org and qa.code like 'AUD-%-091010' and f.follow_up_audit_id is null;
end;
$function$;
revoke all on function private.demo_seed_quality_audit_programme(uuid, uuid) from public, anon, authenticated;

-- The quality pack seeds the programme too.
create or replace function private.demo_seed_quality(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
begin
  perform private.demo_seed_quality_audits(p_organization_id, p_actor);
  perform private.demo_seed_quality_enrich(p_organization_id, p_actor);
  perform private.demo_seed_quality_surveys(p_organization_id, p_actor);
  perform private.demo_seed_quality_indicators(p_organization_id, p_actor);
  perform private.demo_seed_quality_risks(p_organization_id, p_actor);
  perform private.demo_seed_quality_audit_programme(p_organization_id, p_actor);
end;
$function$;
revoke all on function private.demo_seed_quality(uuid, uuid) from public, anon, authenticated;

-- The Demo organizations there are today.
do $$
declare r record;
begin
  for r in select o.id, (select om.user_id from public.organization_members om where om.organization_id = o.id order by om.created_at limit 1) actor
           from public.organizations o where o.is_demo loop
    perform private.demo_seed_quality_audit_programme(r.id, r.actor);
  end loop;
end
$$;
