-- Limoxis Observer — Demo organizations come with data, and their evaluators
-- with a real role.
--
-- Before: a new Demo was an empty organization (system libraries only) and its
-- evaluator had the role "demo", which grants nothing in role_capabilities, so
-- even data written there stayed invisible to them.
--
-- After:
--   * Demo evaluators are Hospital Admins of their (isolated) Demo organization;
--   * platform_reset_demo_organization(org) clears a Demo organization's data
--     and writes the Demo data pack again with dates relative to today. The
--     Edge Function create-demo-access calls it for every new Demo, and the
--     Demo record's "Reset data" action calls it on demand;
--   * it refuses any organization that is not a Demo.
--
-- Values are assigned with := and new ids come from gen_random_uuid() on
-- purpose: the Supabase SQL editor misreads the other way of storing a query
-- result as creating a table and rewrites the script.

-- 1. Real role for existing Demo evaluators ----------------------------------
update public.organization_members om
   set role = 'hospital_admin'
  from public.organizations o
 where o.id = om.organization_id
   and o.is_demo
   and om.role = 'demo';

-- 2. Clear a Demo organization's data ------------------------------------------
-- Keeps the organization, its members, the evaluators' employee records, the
-- libraries and settings, and the Demo entitlement itself.
create or replace function private.demo_wipe_data(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_table regclass;
  v_pass integer;
  v_last_error text;
  v_errors jsonb := '{}'::jsonb;
  v_keep text[] := array[
    'organization_members','custom_roles','master_library_items','indicator_definitions',
    'prevention_bundle_templates','clinical_scale_org_settings','external_reference_versions',
    'environmental_standards','lira_knowledge_sources','lira_ai_provider_settings',
    'platform_demo_entitlements','account_invitations','platform_runtime_events','who_ddd_reference','employees'
  ];
begin
  if not exists (select 1 from public.organizations o where o.id = p_organization_id and o.is_demo) then
    raise exception 'Only Demo organizations can be reset' using errcode = '42501';
  end if;

  perform set_config('limoxis.test_reset', 'on', true);

  if to_regclass('public.lira_outbreak_case_reviews') is not null then
    for v_pass in 1..50 loop
      delete from public.lira_outbreak_case_reviews r
       where r.organization_id = p_organization_id
         and not exists (select 1 from public.lira_outbreak_case_reviews s where s.supersedes_review_id = r.id);
      exit when not found;
    end loop;
  end if;

  for v_pass in 1..25 loop
    v_errors := '{}'::jsonb;
    for v_table in
      select t from private.organization_data_tables() t
      join pg_catalog.pg_class c on c.oid = t
      where c.relname <> all(v_keep)
    loop
      begin
        execute format('delete from %s where organization_id = $1', v_table) using p_organization_id;
      exception when others then
        get stacked diagnostics v_last_error = message_text;
        v_errors := v_errors || jsonb_build_object(v_table::text, v_last_error);
      end;
    end loop;
    begin
      -- Employees the Demo data created; the evaluators' own records stay.
      delete from public.employees e where e.organization_id = p_organization_id and e.user_id is null;
    exception when others then
      get stacked diagnostics v_last_error = message_text;
      v_errors := v_errors || jsonb_build_object('employees', v_last_error);
    end;
    exit when v_errors = '{}'::jsonb;
  end loop;

  if v_errors <> '{}'::jsonb then
    raise exception 'Demo data could not be cleared: %', v_errors::text using errcode = '55000';
  end if;
end;
$function$;

revoke all on function private.demo_wipe_data(uuid) from public, anon, authenticated;

-- 3. The Demo data pack ------------------------------------------------------
-- Synthetic people only (e-mail addresses end in .invalid). Dates are relative
-- to today so the Demo always looks current.
create or replace function private.demo_seed_data(p_organization_id uuid, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := current_date;
  v_now timestamptz := now();
  v_depts uuid[];
  fm text[] := array['Γιώργος','Νίκος','Δημήτρης','Κώστας','Γιάννης','Παναγιώτης','Βασίλης','Χρήστος','Αντώνης','Σπύρος','Μιχάλης','Θανάσης'];
  ff text[] := array['Μαρία','Ελένη','Κατερίνα','Βασιλική','Σοφία','Αγγελική','Δήμητρα','Ευαγγελία','Ιωάννα','Χριστίνα','Γεωργία','Αναστασία'];
  lm text[] := array['Παπαδόπουλος','Γεωργίου','Νικολάου','Οικονόμου','Αντωνίου','Δημητρίου','Ιωάννου','Κωνσταντίνου','Παπαδάκης','Βασιλείου','Μαυρίδης','Σταθόπουλος'];
  lf text[] := array['Παπαδοπούλου','Γεωργίου','Νικολάου','Οικονόμου','Αντωνίου','Δημητρίου','Ιωάννου','Κωνσταντίνου','Παπαδάκη','Βασιλείου','Μαυρίδου','Σταθοπούλου'];
  orgs text[] := array['Escherichia coli','Klebsiella pneumoniae','Staphylococcus aureus','Pseudomonas aeruginosa','Acinetobacter baumannii','Enterococcus faecium'];
begin
  if p_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations o where o.id = v_org and o.is_demo) then
    raise exception 'Only Demo organizations can be filled with Demo data' using errcode = '42501';
  end if;
  perform set_config('limoxis.test_reset', 'on', true);

  -- Departments
  insert into public.departments(organization_id, code, name, department_type, is_active)
  select v_org, d.code, d.name, d.kind, true
  from (values ('ΜΕΘ','Μονάδα Εντατικής Θεραπείας','icu'),('ΠΑΘ','Παθολογική Κλινική','general'),
               ('ΧΕΙΡ','Χειρουργική Κλινική','general'),('ΚΑΡΔ','Καρδιολογική Κλινική','general'),
               ('ΟΡΘ','Ορθοπαιδική Κλινική','general'),('ΝΕΦ','Νεφρολογική Κλινική','general'),
               ('ΠΑΙΔ','Παιδιατρική Κλινική','general'),('ΜΕΝΝ','Μονάδα Εντατικής Νοσηλείας Νεογνών','nicu')) d(code,name,kind)
  on conflict (organization_id, name) do nothing;
  v_depts := array(
    select dep.id from (values ('ΜΕΘ',1),('ΠΑΘ',2),('ΧΕΙΡ',3),('ΚΑΡΔ',4),('ΟΡΘ',5),('ΝΕΦ',6),('ΠΑΙΔ',7),('ΜΕΝΝ',8)) o(code,ord)
    join public.departments dep on dep.organization_id = v_org and dep.code = o.code order by o.ord);

  -- Patients (the admission is created by the patients trigger)
  insert into public.patients(organization_id, patient_code, first_name, last_name, father_name, sex, date_of_birth,
    hospital_record_number, department_id, admission_date, discharge_date, status, created_by)
  select v_org, 'P-' || to_char(d0,'YY') || lpad(g::text, 4, '0'),
    case when g % 2 = 0 then ff[1 + g % 12] else fm[1 + g % 12] end,
    case when g % 2 = 0 then lf[1 + (g * 5) % 12] else lm[1 + (g * 5) % 12] end,
    fm[1 + (g * 7) % 12],
    case when g % 2 = 0 then 'female' else 'male' end,
    d0 - ((28 + (g * 37) % 58) * 365 + g * 11),
    'ΑΜ-' || (240000 + g * 137),
    v_depts[1 + g % 6], s.adm,
    case when g % 4 = 0 then least(d0 - 1, s.adm + 3 + g % 9) end,
    case when g % 4 = 0 then 'discharged' else 'active' end,
    p_actor
  from (select g, d0 - (2 + (g * 7) % 55) as adm from generate_series(1, 48) g) s;

  -- Surveillance cases with their start event
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
  insert into public.surveillance_events(organization_id, surveillance_case_id, event_type, event_status, occurred_at, payload, created_by, completed_by, completed_at)
  select v_org, c.id, 'surveillance_start', 'completed', c.started_at,
    jsonb_build_object(
      'reviewDue', to_char((c.started_at + ((x.rn % 6) - 2) * interval '1 day')::date, 'YYYY-MM-DD'),
      'room', 'Θάλαμος ' || (100 + x.rn * 3),
      'reason', (array['Πυρετός και θετική αιμοκαλλιέργεια','Ουρολοίμωξη σε ασθενή με καθετήρα','Υποψία πνευμονίας σχετιζόμενης με αναπνευστήρα','Φλεγμονή χειρουργικού τραύματος','Αποικισμός με πολυανθεκτικό μικροοργανισμό'])[1 + x.rn % 5],
      'suspectedSource', (array['bloodstream','urinary','respiratory','surgicalSite','other'])[1 + x.rn % 5],
      'detail', 'Demo'),
    p_actor, p_actor, c.started_at
  from (select c.*, row_number() over (order by c.started_at, c.id) rn from c) x
  join c on c.id = x.id;

  -- HAI classification for the active cases
  insert into public.hai_classifications(organization_id, surveillance_case_id, patient_id, case_status, hai_type, definition_set, definition_version, criteria_met, rationale, classified_at, classified_by)
  select v_org, sc.id, sc.patient_id,
    case when k.rn <= 4 then 'confirmed' when k.rn <= 6 then 'probable' else 'suspected' end,
    case e.payload->>'suspectedSource' when 'bloodstream' then 'CLABSI' when 'urinary' then 'CAUTI' when 'respiratory' then 'VAP' when 'surgicalSite' then 'SSI' else 'CLABSI' end,
    'ECDC', 'HAI-Net 2023', k.rn <= 6, 'Κριτήρια ECDC — Demo', sc.started_at + interval '1 day', p_actor
  from (select sc.id, row_number() over (order by sc.started_at, sc.id) rn from public.surveillance_cases sc where sc.organization_id = v_org and sc.status = 'active') k
  join public.surveillance_cases sc on sc.id = k.id
  join public.surveillance_events e on e.surveillance_case_id = sc.id and e.event_type = 'surveillance_start'
  where k.rn <= 8;

  -- Laboratory samples: two per surveillance case, screening samples, new requests
  insert into public.laboratory_samples(organization_id, patient_id, surveillance_case_id, department_id, sample_code, sample_type, source_site,
    requested_at, requested_by, collected_at, received_at, status, priority, subject_type, created_by, created_at)
  select v_org, s.patient_id, s.case_id, s.department_id,
    'LAB-' || to_char(coalesce(s.collected, v_now), 'YYMMDD') || '-' || lpad(s.n::text, 3, '0'),
    s.stype, s.site, coalesce(s.collected, v_now) - interval '40 minutes', p_actor,
    s.collected, s.collected + interval '25 minutes', s.status, s.priority, 'patient', p_actor,
    coalesce(s.collected, v_now - interval '20 minutes')
  from (
    select k.rn * 2 - 1 + j as n, k.patient_id, k.id as case_id, k.department_id,
      case when j = 0 then 'bloodCulture' else (array['urineCulture','respiratorySample','woundCulture'])[1 + k.rn % 3] end as stype,
      case when j = 0 then (array['Κεντρική γραμμή','Περιφερική αιμοληψία'])[1 + k.rn % 2] else (array['Μέσο ρεύμα ούρων','Τραχειοβρογχικές εκκρίσεις','Επίχρισμα τραύματος'])[1 + k.rn % 3] end as site,
      least(k.started_at + (j * 20 + 2) * interval '1 hour', v_now - interval '5 hours') as collected,
      case when j = 1 and k.rn >= 13 then 'processing' else 'completed' end as status,
      case when j = 0 and k.rn <= 9 then 'critical' else 'routine' end as priority
    from (select sc.*, row_number() over (order by sc.started_at, sc.id) rn from public.surveillance_cases sc where sc.organization_id = v_org) k
    cross join generate_series(0, 1) j
    union all
    select 30 + g, pt.id, null, pt.department_id,
      (array['bloodCulture','urineCulture'])[1 + g % 2], (array['Περιφερική αιμοληψία','Μέσο ρεύμα ούρων'])[1 + g % 2],
      least(pt.admission_date + time '08:00' + interval '1 day', v_now - interval '6 hours'), 'completed', 'routine'
    from (select pt.*, row_number() over (order by pt.patient_code desc) g from public.patients pt where pt.organization_id = v_org) pt
    where pt.g <= 12
    union all
    select 50 + g, pt.id, null, pt.department_id, 'urineCulture', 'Μέσο ρεύμα ούρων', null, 'requested', 'routine'
    from (select pt.*, row_number() over (order by pt.patient_code) g from public.patients pt where pt.organization_id = v_org and pt.status = 'active') pt
    where pt.g between 20 and 22
  ) s;

  -- Microbiology results for the completed samples (validated)
  insert into public.microbiology_results(organization_id, sample_id, result_status, organism, resistance_class, susceptibility_summary,
    is_critical, critical_communicated_at, critical_communicated_to, resulted_at, validated_by, validated_at, created_by, method,
    preliminary, validation_status, interpretation_standard, interpretation_version)
  select v_org, r.id,
    case when r.pos then 'positive' else 'negative' end,
    case when r.pos then orgs[1 + r.rn % 6] end,
    case when r.pos and r.rn = 3 then 'XDR' when r.pos and r.rn in (1, 5, 7) then 'MDR' end,
    case when r.pos and r.rn = 3 then 'Ανθεκτικό σε καρβαπενέμες και αμινογλυκοσίδες' when r.pos and r.rn in (1, 5, 7) then 'Πολυανθεκτικό (MDR)' when r.pos then 'Ευαίσθητο' end,
    r.pos and r.blood, case when r.pos and r.blood and r.rn <> 9 then r.resulted + interval '20 minutes' end,
    case when r.pos and r.blood and r.rn <> 9 then 'Θεράπων ιατρός' end,
    r.resulted, p_actor, r.resulted, p_actor, 'culture', false, 'validated', 'EUCAST', '15.0'
  from (
    select ls.id, ls.collected_at, ls.sample_type = 'bloodCulture' as blood,
      least(ls.collected_at + interval '46 hours', v_now - interval '2 hours') as resulted,
      n.n, case when n.n <= 28 then (n.n + 1) / 2 else n.n end as rn,
      case when n.n <= 28 then (n.n % 2 = 1 and (n.n + 1) / 2 <= 9) or (n.n % 2 = 0 and (n.n / 2) in (2, 4, 6)) else n.n in (33, 38) end as pos
    from public.laboratory_samples ls
    cross join lateral (select right(ls.sample_code, 3)::int as n) n
    where ls.organization_id = v_org and ls.status = 'completed'
  ) r;

  -- Susceptibility for positive results
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

  -- Contact precautions for the active cases with a resistant isolate
  insert into public.isolation_episodes(organization_id, patient_id, surveillance_case_id, department_id, precautions, room, reason, started_at, review_due_at, status, created_by)
  select distinct on (sc.id) v_org, sc.patient_id, sc.id, sc.department_id, '["contact"]'::jsonb,
    'Θάλαμος απομόνωσης ' || (1 + abs(hashtext(sc.id::text)) % 6),
    'Απομόνωση επαφής — ' || mr.organism || ' ' || mr.resistance_class,
    mr.resulted_at, mr.resulted_at + interval '72 hours', 'active', p_actor
  from public.microbiology_results mr
  join public.laboratory_samples ls on ls.id = mr.sample_id
  join public.surveillance_cases sc on sc.id = ls.surveillance_case_id and sc.status = 'active'
  where mr.organization_id = v_org and mr.resistance_class is not null
  order by sc.id, mr.resulted_at;

  -- Hand hygiene: WHO observation sessions over the last three months
  insert into public.hand_hygiene_sessions(organization_id, department_id, observation_date, professional_category, observations, compliant_observations,
    observer_id, observer_name, source_standard, source_version, status, start_time, end_time, created_by, updated_by)
  select v_org, v_depts[1 + g % 6], d0 - (g * 5) / 2,
    case when g % 3 = 0 then 'Ιατρός' else 'Νοσηλευτής / Νοσηλεύτρια' end,
    6, (select count(*) from generate_series(1, 6) k where ((g * 7 + k * 3) % 10) < 7 + (case when g % 6 = 0 then 2 else 0 end))::int,
    p_actor, 'Ομάδα Ελέγχου Λοιμώξεων', 'WHO', '2009', 'completed', time '10:00', time '10:30', p_actor, p_actor
  from generate_series(1, 36) g;

  insert into public.hand_hygiene_observations(session_id, organization_id, professional_category, professionals_count, who_moment, who_moments, action, gloves, sort_order)
  select hs.id, v_org, hs.professional_category, 1, 'moment' || (1 + (hs.g + k) % 5), array['moment' || (1 + (hs.g + k) % 5)],
    case when ((hs.g * 7 + k * 3) % 10) < 7 + (case when hs.g % 6 = 0 then 2 else 0 end) then (case when k % 3 = 0 then 'HW' else 'HR' end) else 'MISSED' end,
    k % 4 = 0, k
  from (select s.*, row_number() over (order by s.observation_date desc, s.id) g from public.hand_hygiene_sessions s where s.organization_id = v_org) hs
  cross join generate_series(1, 6) k;

  -- Employees
  insert into public.employees(organization_id, employee_code, first_name, last_name, first_name_en, last_name_en, department_id, department_name,
    profession_name, position_name, employment_status, hire_date, email, created_by, updated_by)
  select v_org, 'EMP-' || lpad(g::text, 3, '0'),
    case when g % 2 = 0 then ff[1 + (g * 3) % 12] else fm[1 + (g * 3) % 12] end,
    case when g % 2 = 0 then lf[1 + (g * 7) % 12] else lm[1 + (g * 7) % 12] end,
    null, null, dep.id, dep.name,
    (array['Νοσηλευτής / Νοσηλεύτρια','Ιατρός','Βοηθός Νοσηλευτή','Νοσηλευτής / Νοσηλεύτρια','Τεχνολόγος Εργαστηρίου','Ιατρός'])[1 + g % 6],
    (array['Νοσηλευτής Τμήματος','Επιμελητής Β΄','Βοηθός Νοσηλευτή','Προϊστάμενος Τμήματος','Τεχνολόγος','Διευθυντής Τμήματος'])[1 + g % 6],
    case when g in (7, 19) then 'leave' else 'active' end,
    d0 - (200 + g * 97), 'emp' || lpad(g::text, 3, '0') || '@demo.invalid', p_actor, p_actor
  from generate_series(1, 24) g
  join public.departments dep on dep.id = v_depts[1 + g % 8];

  -- Patient days per department and month (last six full months)
  insert into public.patient_day_periods(organization_id, department_id, period_start, period_end, patient_days, source, review_status, notes, created_by, updated_by)
  select v_org, v_depts[dn], m.ms::date, (m.ms + interval '1 month - 1 day')::date,
    ((array[12, 30, 28, 24, 20, 18])[dn] * extract(day from (m.ms + interval '1 month - 1 day'))::int * (80 + (dn * 7 + mi * 3) % 15) / 100),
    'manual', 'approved', 'Demo', p_actor, p_actor
  from generate_series(1, 6) dn
  cross join lateral (select mi, (date_trunc('month', d0) - mi * interval '1 month') as ms from generate_series(1, 6) mi) m;

  -- Quality: incidents and corrective / preventive actions
  insert into public.quality_incidents(organization_id, code, title, department_id, occurred_at, severity, status, description, category, impact,
    incident_class, reached_patient, harm_occurred, immediate_actions, owner_label, owner_labels, reported_by_label)
  select v_org, 'INC-' || to_char(d0 - i.ago, 'YYMMDD') || '-' || lpad((90000 + i.n)::text, 6, '0'), i.title, v_depts[i.dep],
    (d0 - i.ago) + time '11:15', i.sev, i.st, i.descr, i.cat, i.imp, i.cls, i.cls <> 'nearMiss', i.cls = 'harmful',
    'Άμεση ενημέρωση υπευθύνου και καταγραφή', 'Υπεύθυνη Ποιότητας', array['Υπεύθυνη Ποιότητας'], 'Νοσηλευτική Υπηρεσία'
  from (values
    (1, 3, 1, 'Πτώση ασθενούς από κλίνη', 'high', 'under_review', 'Ηλικιωμένος ασθενής βρέθηκε στο δάπεδο κατά τη νυχτερινή βάρδια.', 'clinical', 'moderate', 'harmful'),
    (2, 6, 2, 'Λάθος χορήγηση δόσης αντιβιοτικού', 'high', 'reported', 'Χορηγήθηκε διπλή δόση βανκομυκίνης· εντοπίστηκε έγκαιρα.', 'medication', 'minor', 'noHarm'),
    (3, 9, 3, 'Διακοπή ψυχρής αλυσίδας εμβολίων', 'medium', 'closed', 'Το ψυγείο εμβολίων ξεπέρασε τους 8°C για 2 ώρες.', 'equipment', 'none', 'nearMiss'),
    (4, 13, 1, 'Τραυματισμός από αιχμηρό', 'medium', 'under_review', 'Νυγμός νοσηλεύτριας κατά την απόρριψη βελόνας.', 'staff', 'minor', 'harmful'),
    (5, 18, 4, 'Ελλιπής σήμανση απομόνωσης', 'low', 'closed', 'Λείπει η σήμανση προφυλάξεων επαφής σε θάλαμο ασθενούς με CPE.', 'process', 'none', 'nearMiss'),
    (6, 24, 5, 'Παράπονο συνοδού για καθαριότητα', 'low', 'reported', 'Παράπονο για την καθαριότητα κοινόχρηστου WC.', 'complaint', 'none', 'nearMiss'),
    (7, 31, 6, 'Βλάβη αντλίας έγχυσης', 'medium', 'closed', 'Η αντλία σταμάτησε χωρίς ειδοποίηση συναγερμού.', 'equipment', 'minor', 'noHarm'),
    (8, 40, 2, 'Καθυστέρηση αποστολής αιμοκαλλιέργειας', 'medium', 'closed', 'Το δείγμα έφτασε στο εργαστήριο μετά από 4 ώρες.', 'process', 'minor', 'noHarm'),
    (9, 52, 1, 'Αποσύνδεση κεντρικού φλεβικού καθετήρα', 'critical', 'under_review', 'Τυχαία αποσύνδεση ΚΦΚ κατά τη μετακίνηση ασθενούς.', 'clinical', 'moderate', 'harmful'),
    (10, 63, 3, 'Ανεπαρκής διαθεσιμότητα αντισηπτικού', 'low', 'closed', 'Άδειοι διανομείς αντισηπτικού στον διάδρομο.', 'facility', 'none', 'nearMiss')
  ) i(n, ago, dep, title, sev, st, descr, cat, imp, cls);

  insert into public.quality_capa_actions(organization_id, code, title, department_id, source_type, source_id, action_type, priority, status, description,
    due_date, effectiveness_due, effectiveness_status, owner_label, owner_labels)
  select v_org, 'CAPA-' || to_char(d0 - c.ago, 'YYMMDD') || '-' || lpad((90000 + c.n)::text, 6, '0'), c.title, v_depts[c.dep], 'incident',
    (select qi.code from public.quality_incidents qi where qi.organization_id = v_org and right(qi.code, 2) = lpad(c.inc::text, 2, '0') limit 1),
    c.kind, c.pri, c.st, c.descr, d0 + c.due, d0 + c.due + 30, 'pending', 'Υπεύθυνη Ποιότητας', array['Υπεύθυνη Ποιότητας']
  from (values
    (1, 2, 1, 1, 'Εκτίμηση κινδύνου πτώσης σε κάθε εισαγωγή', 'preventive', 'high', 'in_progress', 'Εφαρμογή κλίμακας Morse και πλαϊνών κιγκλιδωμάτων.', 10),
    (2, 5, 2, 2, 'Διπλός έλεγχος χορήγησης αντιβιοτικών υψηλού κινδύνου', 'corrective', 'high', 'open', 'Διπλή υπογραφή για βανκομυκίνη και αμινογλυκοσίδες.', -3),
    (3, 8, 3, 3, 'Συναγερμός θερμοκρασίας στο ψυγείο εμβολίων', 'corrective', 'medium', 'closed', 'Τοποθέτηση καταγραφικού με ειδοποίηση SMS.', -20),
    (4, 12, 1, 4, 'Εκπαίδευση στην ασφαλή απόρριψη αιχμηρών', 'preventive', 'medium', 'verification', 'Υποχρεωτική εκπαίδευση για το νοσηλευτικό προσωπικό.', 5),
    (5, 17, 4, 5, 'Τυποποιημένη σήμανση απομόνωσης', 'corrective', 'low', 'closed', 'Νέες κάρτες προφυλάξεων σε όλα τα τμήματα.', -12),
    (6, 50, 1, 9, 'Πρωτόκολλο στερέωσης ΚΦΚ κατά τη μετακίνηση', 'corrective', 'critical', 'in_progress', 'Έλεγχος στερέωσης πριν από κάθε μετακίνηση.', -2)
  ) c(n, ago, dep, inc, title, kind, pri, st, descr, due);

  -- Controlled documents
  insert into public.controlled_documents(organization_id, code, title, document_type, department_id, audience, status, version, description,
    effective_date, review_date, published_at, published_by, approved_at, approved_by, created_by)
  select v_org, 'DOC-' || lpad(d.n::text, 3, '0'), d.title, d.kind, null, 'organization', d.st, d.ver, d.descr,
    case when d.st = 'published' then d0 - d.ago end, case when d.st = 'published' then d0 - d.ago + 365 end,
    case when d.st = 'published' then (d0 - d.ago) + time '09:00' end, case when d.st = 'published' then p_actor end,
    case when d.st = 'published' then (d0 - d.ago) + time '08:00' end, case when d.st = 'published' then p_actor end, p_actor
  from (values
    (1, 'Πολιτική Ελέγχου Λοιμώξεων', 'policy', 'published', '3.0', 'Πλαίσιο πρόληψης και ελέγχου λοιμώξεων του νοσοκομείου.', 120),
    (2, 'Πρωτόκολλο υγιεινής χεριών (WHO)', 'protocol', 'published', '2.1', 'Οι 5 στιγμές υγιεινής χεριών και η τεχνική.', 90),
    (3, 'Πρωτόκολλο απομόνωσης ασθενών με πολυανθεκτικά', 'protocol', 'published', '1.4', 'Προφυλάξεις επαφής, σταγονιδίων και αερογενούς μετάδοσης.', 75),
    (4, 'Οδηγία τοποθέτησης και φροντίδας ΚΦΚ', 'instruction', 'published', '1.2', 'Δέσμη μέτρων πρόληψης CLABSI.', 60),
    (5, 'Οδηγία πρόληψης ουρολοιμώξεων από καθετήρα', 'instruction', 'published', '1.0', 'Δέσμη μέτρων πρόληψης CAUTI.', 45),
    (6, 'Πολιτική χρήσης αντιμικροβιακών', 'policy', 'published', '2.0', 'Αρχές επιτήρησης και ορθολογικής χρήσης αντιβιοτικών.', 30),
    (7, 'Πρωτόκολλο καθαρισμού και απολύμανσης χώρων', 'protocol', 'review', '1.1', 'Αναθεώρηση για τα νέα απολυμαντικά.', 0),
    (8, 'Οδηγία διαχείρισης έκθεσης σε αιματογενώς μεταδιδόμενα', 'instruction', 'draft', '0.9', 'Σχέδιο προς σχολιασμό.', 0)
  ) d(n, title, kind, st, ver, descr, ago);

  -- Committees and meetings
  insert into public.committees(organization_id, code, name, short_name, committee_type, status, mandate, meeting_frequency, term_start, term_end, created_by)
  values
    (v_org, 'COM-001', 'Επιτροπή Νοσοκομειακών Λοιμώξεων', 'ΕΝΛ', 'custom', 'active', 'Επιτήρηση, πρόληψη και έλεγχος των λοιμώξεων που συνδέονται με την υγειονομική περίθαλψη.', 'monthly', date_trunc('year', d0)::date, (date_trunc('year', d0) + interval '2 years - 1 day')::date, p_actor),
    (v_org, 'COM-002', 'Επιτροπή Ποιότητας και Ασφάλειας Ασθενών', 'ΕΠΑΑ', 'custom', 'active', 'Παρακολούθηση δεικτών ποιότητας, συμβάντων και διορθωτικών ενεργειών.', 'quarterly', date_trunc('year', d0)::date, (date_trunc('year', d0) + interval '2 years - 1 day')::date, p_actor);

  insert into public.committee_meetings(organization_id, committee_id, title, scheduled_at, status, meeting_type, location, minutes_number, quorum_met, agenda, minutes, finalized_at, finalized_by, created_by)
  select v_org, cm.id, m.title, (d0 + m.days) + time '12:00', m.st, 'regular', 'Αίθουσα συσκέψεων Διοίκησης',
    case when m.st = 'finalized' then m.num end, case when m.st = 'finalized' then true end,
    m.agenda::jsonb, case when m.st = 'finalized' then 'Εγκρίθηκαν τα πρακτικά και οι δείκτες του τριμήνου.' end,
    case when m.st = 'finalized' then (d0 + m.days + 2) + time '10:00' end, case when m.st = 'finalized' then p_actor end, p_actor
  from (values
    ('COM-001', 'Μηνιαία συνεδρίαση ΕΝΛ', -28, 'finalized', '1/' || to_char(d0, 'YYYY'), '["Δείκτες HAI του μήνα","Πολυανθεκτικά στη ΜΕΘ","Συμμόρφωση υγιεινής χεριών"]'),
    ('COM-001', 'Μηνιαία συνεδρίαση ΕΝΛ', 5, 'planned', null, '["Ανασκόπηση CLABSI","Πρωτόκολλο απομόνωσης — αναθεώρηση"]'),
    ('COM-002', 'Τριμηνιαία συνεδρίαση ποιότητας', 14, 'planned', null, '["Συμβάντα τριμήνου","Πορεία CAPA"]')
  ) m(code, title, days, st, num, agenda)
  join public.committees cm on cm.organization_id = v_org and cm.code = m.code;

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
    'committees', (select count(*) from public.committees x where x.organization_id = v_org)
  );
end;
$function$;

revoke all on function private.demo_seed_data(uuid, uuid) from public, anon, authenticated;

-- 4. Reset a Demo organization (Platform Owner) -------------------------------
create or replace function public.platform_reset_demo_organization(p_organization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_platform_owner, false)
  ) then
    raise exception 'Platform Owner access required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations o where o.id = p_organization_id and o.is_demo) then
    raise exception 'Only Demo organizations can be reset' using errcode = '42501';
  end if;

  perform private.demo_wipe_data(p_organization_id);
  return private.demo_seed_data(p_organization_id, auth.uid());
end;
$function$;

revoke all on function public.platform_reset_demo_organization(uuid) from public, anon;
grant execute on function public.platform_reset_demo_organization(uuid) to authenticated, service_role;
