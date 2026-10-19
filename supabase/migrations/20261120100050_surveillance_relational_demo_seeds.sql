-- Infection surveillance demo seeds: the same demo records as before, written
-- into the columns and rows of 20261120100000_surveillance_relational.sql
-- instead of surveillance_events.payload, clinical_assessments.signs_symptoms /
-- risk_factors, isolation_episodes.precautions and
-- amr_classifications.calculation_snapshot. Lists the seeds describe inline go
-- through the private.*_add_* / *_apply_* helpers of that migration.

create or replace function private.demo_seed_surveillance(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
 v_org uuid := p_organization_id;
 d0 date := current_date;
 v_now timestamptz := now();
 v_depts uuid[] := array(
  select dep.id from (values ('ΜΕΘ',1),('ΠΑΘ',2),('ΧΕΙΡ',3),('ΚΑΡΔ',4),('ΟΡΘ',5),('ΝΕΦ',6),('ΠΑΙΔ',7),('ΜΕΝΝ',8)) o(code,ord)
  join public.departments dep on dep.organization_id = p_organization_id and dep.code = o.code order by o.ord);
begin
 with p as (
  select pt.id, pt.department_id, pt.admission_date, row_number() over (order by pt.patient_code) rn
  from public.patients pt where pt.organization_id = v_org and pt.status = 'active'
  order by pt.patient_code limit 14
 ), c as (
  insert into public.surveillance_cases(organization_id, patient_id, department_id, status, started_at, closed_at, close_reason, created_by, closed_by, admission_id)
  select v_org, p.id, p.department_id,
   case when p.rn > 10 then 'closed' else 'active' end,
   least((p.admission_date + 1) + time '09:30', v_now - interval '3 hours'),
   case when p.rn > 10 then least((p.admission_date + 12) + time '12:00', v_now - interval '1 hour') end,
   case when p.rn > 10 then 'Ολοκλήρωση θεραπείας — κλινική ίαση' end,
   p_actor, case when p.rn > 10 then p_actor end,
   (select a.id from public.patient_admissions a where a.patient_id = p.id order by a.admission_date desc limit 1)
  from p
  returning id, patient_id, started_at
 )
 insert into public.surveillance_events(organization_id, surveillance_case_id, event_type, event_status, occurred_at, detail, created_by, completed_by, completed_at)
 select v_org, c.id, 'surveillance_start', 'completed', c.started_at, 'Demo', p_actor, p_actor, c.started_at
 from c;
 -- What each start recorded (the n-th case by start time, as the events above).
 update public.surveillance_cases sc set
  review_due_on = (x.started_at + ((x.rn % 6) - 2) * interval '1 day')::date,
  room = 'Θάλαμος ' || (100 + x.rn * 3),
  reason = (array['Πυρετός και θετική αιμοκαλλιέργεια','Ουρολοίμωξη σε ασθενή με καθετήρα','Υποψία πνευμονίας σχετιζόμενης με αναπνευστήρα','Φλεγμονή χειρουργικού τραύματος','Αποικισμός με πολυανθεκτικό μικροοργανισμό'])[1 + x.rn % 5],
  suspected_source = (array['bloodstream','urinary','respiratory','surgicalSite','other'])[1 + x.rn % 5]
 from (select c.id, c.started_at, row_number() over (order by c.started_at, c.id) rn
       from public.surveillance_cases c
       where c.organization_id = v_org and c.reason is null
         and exists (select 1 from public.surveillance_events e where e.surveillance_case_id = c.id and e.event_type = 'surveillance_start' and e.detail = 'Demo')) x
 where sc.id = x.id;
 insert into public.hai_classifications(organization_id, surveillance_case_id, patient_id, case_status, hai_type, definition_set, definition_version, criteria_met, rationale, classified_at, classified_by)
 select v_org, sc.id, sc.patient_id,
  case when k.rn <= 4 then 'confirmed' when k.rn <= 6 then 'probable' else 'suspected' end,
  case sc.suspected_source when 'bloodstream' then 'CLABSI' when 'urinary' then 'CAUTI' when 'respiratory' then 'VAP' when 'surgicalSite' then 'SSI' else 'CLABSI' end,
  'ECDC', 'HAI-Net 2023', k.rn <= 6, 'Κριτήρια ECDC — Demo', sc.started_at + interval '1 day', p_actor
 from (select sc.id, row_number() over (order by sc.started_at, sc.id) rn from public.surveillance_cases sc where sc.organization_id = v_org and sc.status = 'active') k
 join public.surveillance_cases sc on sc.id = k.id
 join public.surveillance_events e on e.surveillance_case_id = sc.id and e.event_type = 'surveillance_start'
 where k.rn <= 8;
end;
$function$;

create or replace function private.demo_seed_susceptibility(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
 v_org uuid := p_organization_id;
 d0 date := current_date;
 v_now timestamptz := now();
 v_depts uuid[] := array(
  select dep.id from (values ('ΜΕΘ',1),('ΠΑΘ',2),('ΧΕΙΡ',3),('ΚΑΡΔ',4),('ΟΡΘ',5),('ΝΕΦ',6),('ΠΑΙΔ',7),('ΜΕΝΝ',8)) o(code,ord)
  join public.departments dep on dep.organization_id = p_organization_id and dep.code = o.code order by o.ord);
begin
 insert into public.antimicrobial_susceptibility_results(organization_id, microbiology_result_id, antimicrobial_code, antimicrobial_name, method,
  mic_value, mic_operator, sir_category, breakpoint_standard, breakpoint_version, created_by, organism_name, organism)
 select v_org, mr.id, a.code, a.name, 'MIC', a.mic, '=',
  case when mr.resistance_class = 'XDR' and a.code <> 'ABX-COL' then 'R'
    when mr.resistance_class = 'MDR' and a.code in ('ABX-MEM','ABX-CRO','ABX-CIP','ABX-OXA','ABX-AMP') then 'R'
    else 'S' end,
  'EUCAST', '15.0', p_actor, mr.organism, mr.organism
 from public.microbiology_results mr
 join (values
  ('gn','ABX-MEM','Meropenem',0.25),('gn','ABX-CRO','Ceftriaxone',1),('gn','ABX-CIP','Ciprofloxacin',0.5),('gn','ABX-AMK','Amikacin',4),('gn','ABX-COL','Colistin',0.5),
  ('gp','ABX-OXA','Oxacillin',0.5),('gp','ABX-VAN','Vancomycin',1),('gp','ABX-LZD','Linezolid',2),('gp','ABX-AMP','Ampicillin',2)
 ) a(grp, code, name, mic) on a.grp = case when mr.organism in ('Staphylococcus aureus','Enterococcus faecium') then 'gp' else 'gn' end
 where mr.organization_id = v_org and mr.result_status = 'positive';
 insert into public.amr_classifications(organization_id, microbiology_result_id, classification, definition_source, definition_version, status, rationale, classified_by, classified_at, organism)
 select v_org, mr.id, mr.resistance_class, 'Magiorakos et al. (ECDC/CDC)', '2012', 'confirmed', 'Αυτόματη ταξινόμηση από το αντιβιόγραμμα', p_actor, mr.resulted_at, mr.organism
 from public.microbiology_results mr
 where mr.organization_id = v_org and mr.resistance_class is not null;
 insert into public.isolation_episodes(organization_id, patient_id, surveillance_case_id, department_id, room, reason, started_at, review_due_at, status, created_by)
 select distinct on (sc.id) v_org, sc.patient_id, sc.id, sc.department_id,
  'Θάλαμος απομόνωσης ' || (1 + abs(hashtext(sc.id::text)) % 6),
  'Απομόνωση επαφής — ' || mr.organism || ' ' || mr.resistance_class,
  mr.resulted_at, mr.resulted_at + interval '72 hours', 'active', p_actor
 from public.microbiology_results mr
 join public.laboratory_samples ls on ls.id = mr.sample_id
 join public.surveillance_cases sc on sc.id = ls.surveillance_case_id and sc.status = 'active'
 where mr.organization_id = v_org and mr.resistance_class is not null
 order by sc.id, mr.resulted_at;
 insert into public.isolation_episode_precautions(organization_id, isolation_episode_id, position, precaution, created_by, updated_by)
 select v_org, i.id, 1, 'contact', p_actor, p_actor
 from public.isolation_episodes i
 where i.organization_id = v_org and i.reason like 'Απομόνωση επαφής — %'
   and not exists (select 1 from public.isolation_episode_precautions x where x.isolation_episode_id = i.id);
end;
$function$;

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
  v_assessment uuid;
  v_isolation uuid;
begin
  -- Start events: the application writes detail 'created' and an English reason
  update public.surveillance_cases sc
     set reason_en = coalesce(sc.reason_en, case sc.reason
             when 'Πυρετός και θετική αιμοκαλλιέργεια' then 'Fever and positive blood culture'
             when 'Ουρολοίμωξη σε ασθενή με καθετήρα' then 'Urinary tract infection in a catheterised patient'
             when 'Υποψία πνευμονίας σχετιζόμενης με αναπνευστήρα' then 'Suspected ventilator-associated pneumonia'
             when 'Φλεγμονή χειρουργικού τραύματος' then 'Surgical wound inflammation'
             when 'Αποικισμός με πολυανθεκτικό μικροοργανισμό' then 'Colonisation with a multidrug-resistant organism'
             else sc.reason end),
         updated_at = now()
   where sc.organization_id = v_org
     and exists (select 1 from public.surveillance_events e where e.surveillance_case_id = sc.id and e.event_type = 'surveillance_start' and e.detail = 'Demo');
  update public.surveillance_events e
     set detail = 'created', updated_at = now()
   where e.organization_id = v_org and e.event_type = 'surveillance_start' and coalesce(e.detail, '') = 'Demo';

  for r in
    select sc.id, sc.patient_id, sc.department_id, dep.code as dep_code, sc.status, sc.started_at as s, sc.closed_at as e, sc.close_reason,
      p.date_of_birth as dob, p.status as p_status,
      coalesce(pa.admission_date, p.admission_date, sc.started_at::date) as adm,
      coalesce(sc.suspected_source, 'other') as src, coalesce(sc.reason, '') as reason,
      h.hai_type, h.case_status as hai_status,
      m.id as mr_id, m.sample_id, m.organism, m.resistance_class, m.resulted_at
    from public.surveillance_cases sc
    join public.patients p on p.id = sc.patient_id
    left join public.departments dep on dep.id = sc.department_id
    left join public.patient_admissions pa on pa.id = sc.admission_id
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
      summary, assessed_at, created_by, updated_by)
    values (v_org, r.id, r.patient_id, r.department_id, 'initial', 'under_investigation',
      'Αρχική αξιολόγηση: ' || coalesce(nullif(r.reason, ''), 'κλινική υποψία λοίμωξης') || '. Λήψη καλλιεργειών πριν από την έναρξη εμπειρικής αγωγής.',
      r.s + interval '1 hour', p_actor, p_actor)
    returning id into v_assessment;
    perform private.clinical_assessment_add_lists(v_assessment, v_signs, v_risks);

    if r.s + interval '2 days' < v_end then
      v_assessment := null;
      insert into public.clinical_assessments(organization_id, surveillance_case_id, patient_id, department_id, assessment_type, classification,
        summary, assessed_at, created_by, updated_by)
      select v_org, r.id, r.patient_id, r.department_id, x.atype, x.cls, x.summary,
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
      where r.organism is not null or r.hai_type is not null or r.status = 'closed'
      returning id into v_assessment;
      if v_assessment is not null then perform private.clinical_assessment_add_lists(v_assessment, v_signs, v_risks); end if;
    end if;

    -- 3. Isolation: resistant isolates of closed cases were isolated until the end
    if r.status = 'closed' and r.resistance_class is not null and r.resulted_at is not null
       and not exists (select 1 from public.isolation_episodes i where i.surveillance_case_id = r.id) then
      insert into public.isolation_episodes(organization_id, patient_id, surveillance_case_id, department_id, room, reason,
        started_at, review_due_at, ended_at, end_reason, status, created_by, updated_by, ended_by)
      values (v_org, r.patient_id, r.id, r.department_id, 'Θάλαμος απομόνωσης ' || (1 + abs(hashtext(r.id::text)) % 6),
        'Απομόνωση επαφής — ' || r.organism || ' ' || r.resistance_class, r.resulted_at, r.resulted_at + interval '72 hours',
        r.e, 'Λήξη επιτήρησης — κλινική ίαση και αρνητικές καλλιέργειες επιτήρησης', 'ended', p_actor, p_actor, p_actor)
      returning id into v_isolation;
      perform private.isolation_episode_add_precautions(v_isolation, '["contact"]'::jsonb);
    end if;
    v_isolated := exists (select 1 from public.isolation_episodes i where i.surveillance_case_id = r.id);
    if not v_isolated then
      insert into public.surveillance_events(organization_id, surveillance_case_id, event_type, event_status, occurred_at, detail, created_by, completed_by, completed_at)
      values (v_org, r.id, 'isolation_not_required', 'completed', r.s + interval '6 hours', 'no', p_actor, p_actor, r.s + interval '6 hours');
      perform private.surveillance_case_apply_isolation_not_required(r.id, r.s + interval '6 hours', p_actor);
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
  v_x record;
  v_assessment uuid;
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

  insert into public.surveillance_events(organization_id, surveillance_case_id, event_type, event_status, occurred_at, detail, created_by, completed_by, completed_at)
  select v_org, x.id, 'surveillance_start', 'completed', x.s, 'created', p_actor, p_actor, x.s
  from (values
    (v_c42, (d0 - 9) + time '11:00', d0 - 1, 'ΜΕΘ — Κλίνη 8', 'Υποψία πνευμονίας σχετιζόμενης με αναπνευστήρα', 'Suspected ventilator-associated pneumonia', 'respiratory'),
    (v_c30, (d0 - 5) + time '12:00', d0 + 2, 'ΜΕΘ — Κλίνη 9', 'Αποικισμός με πολυανθεκτικό μικροοργανισμό', 'Colonisation with a multidrug-resistant organism', 'other'),
    (v_c49, (d0 - 5) + time '07:00', d0, 'ΜΕΘ — Κλίνη 10', 'Πυρετός και θετική αιμοκαλλιέργεια', 'Fever and positive blood culture', 'bloodstream')
  ) x(id, s, due, room, reason, reason_en, src);
  update public.surveillance_cases sc set review_due_on = x.due, room = x.room, reason = x.reason, reason_en = x.reason_en, suspected_source = x.src
  from (values
    (v_c42, d0 - 1, 'ΜΕΘ — Κλίνη 8', 'Υποψία πνευμονίας σχετιζόμενης με αναπνευστήρα', 'Suspected ventilator-associated pneumonia', 'respiratory'),
    (v_c30, d0 + 2, 'ΜΕΘ — Κλίνη 9', 'Αποικισμός με πολυανθεκτικό μικροοργανισμό', 'Colonisation with a multidrug-resistant organism', 'other'),
    (v_c49, d0, 'ΜΕΘ — Κλίνη 10', 'Πυρετός και θετική αιμοκαλλιέργεια', 'Fever and positive blood culture', 'bloodstream')
  ) x(id, due, room, reason, reason_en, src)
  where sc.id = x.id;

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

  insert into public.amr_classifications(organization_id, microbiology_result_id, classification, definition_source, definition_version, mechanism, categories_tested,
    status, rationale, classified_by, classified_at, organism)
  select v_org, mr.id, 'MDR', 'Magiorakos et al. (ECDC/CDC)', '2012', 'KPC', 6,
    'confirmed', 'Μη ευαισθησία σε ≥ 3 κατηγορίες αντιμικροβιακών (καρβαπενέμες, κεφαλοσπορίνες, πιπερακιλλίνη/ταζομπακτάμη, κινολόνες) — CPE / KPC.',
    p_actor, mr.resulted_at + interval '30 minutes', mr.organism
  from public.microbiology_results mr
  join public.laboratory_samples ls on ls.id = mr.sample_id and ls.department_id = v_icu and ls.collected_at >= (d0 - 12)::timestamptz
  where mr.organization_id = v_org and mr.organism = 'Klebsiella pneumoniae'
    and not exists (select 1 from public.amr_classifications x where x.microbiology_result_id = mr.id);
  insert into public.amr_classification_categories(organization_id, amr_classification_id, susceptible, position, category, created_by, updated_by)
  select v_org, a.id, c.susceptible, c.position, c.category, p_actor, p_actor
  from public.amr_classifications a
  join public.microbiology_results mr on mr.id = a.microbiology_result_id
  join public.laboratory_samples ls on ls.id = mr.sample_id and ls.department_id = v_icu and ls.collected_at >= (d0 - 12)::timestamptz
  cross join (values (false, 1, 'carbapenems'), (false, 2, 'extendedSpectrumCephalosporins'), (false, 3, 'antipseudomonalPenicillinsBetaLactamaseInhibitors'),
    (false, 4, 'fluoroquinolones'), (true, 1, 'aminoglycosides'), (true, 2, 'polymyxins')) c(susceptible, position, category)
  where a.organization_id = v_org and a.mechanism = 'KPC' and mr.organism = 'Klebsiella pneumoniae'
    and not exists (select 1 from public.amr_classification_categories x where x.amr_classification_id = a.id);

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
  insert into public.isolation_episodes(organization_id, patient_id, surveillance_case_id, department_id, room, reason, started_at, review_due_at, status, created_by, updated_by)
  select v_org, x.pid, x.cid, v_icu, x.room, 'Προφυλάξεις επαφής — Klebsiella pneumoniae KPC (CPE)', x.st, x.due, 'active', p_actor, p_actor
  from (values
    (v_p42, v_c42, 'Θάλαμος απομόνωσης 1 (κλίνη 8)', (d0 - 7) + time '10:30', (d0 - 1) + time '10:00'),
    (v_p30, v_c30, 'Κοόρτη CPE — κλίνη 9', (d0 - 5) + time '10:30', (d0 + 2) + time '10:00'),
    (v_p49, v_c49, 'Κοόρτη CPE — κλίνη 10', (d0 - 4) + time '14:30', (d0 + 1) + time '10:00'),
    (v_p06, v_c06, 'Κοόρτη CPE — κλίνη 7', (d0 - 1) + time '10:30', (d0 + 2) + time '10:00')
  ) x(pid, cid, room, st, due)
  where x.cid is not null;
  insert into public.isolation_episode_precautions(organization_id, isolation_episode_id, position, precaution, created_by, updated_by)
  select v_org, i.id, 1, 'contact', p_actor, p_actor
  from public.isolation_episodes i
  where i.organization_id = v_org and i.surveillance_case_id in (v_c42, v_c30, v_c49, v_c06)
    and not exists (select 1 from public.isolation_episode_precautions x where x.isolation_episode_id = i.id);

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
  for v_x in
    select x.* from (values
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
    where x.cid is not null
  loop
    insert into public.clinical_assessments(organization_id, surveillance_case_id, patient_id, department_id, assessment_type, classification,
      summary, assessed_at, created_by, updated_by)
    values (v_org, v_x.cid, v_x.pid, v_icu, v_x.atype, v_x.cls, v_x.summary, v_x.at, p_actor, p_actor)
    returning id into v_assessment;
    perform private.clinical_assessment_add_lists(v_assessment, v_x.signs, v_x.risks);
  end loop;

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

    insert into public.surveillance_events(organization_id, surveillance_case_id, event_type, event_status, occurred_at, detail, created_by, completed_by, completed_at)
    values (v_org, v_case, 'surveillance_start', 'completed', (d0 - 6) + time '10:00', 'created', p_actor, p_actor, (d0 - 6) + time '10:00');
    perform private.surveillance_case_apply_start(v_case,
      jsonb_build_object('reviewDue', to_char(d0 + 1, 'YYYY-MM-DD'), 'room', 'Θερμοκοιτίδα 4',
        'reason', 'Θερμοκρασιακή αστάθεια, επεισόδια άπνοιας και θετική αιμοκαλλιέργεια σε νεογνό με PICC',
        'reasonEn', 'Temperature instability, apnoea episodes and a positive blood culture in a neonate with a PICC',
        'suspectedSource', 'bloodstream'));

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
