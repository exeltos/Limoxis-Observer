-- Demo evaluation, step 2:
--   1. Prevention data (waste, antiseptics, care bundles) in the Demo data pack.
--   2. The Platform Owner's Demo is a real Demo organization with the same data pack.
--   3. Access is enforced in the database: a paused organization, or a Demo that
--      expired or was paused, puts its members on hold (status 'disabled',
--      access_hold set) and lifts the hold when it reopens.
-- As in the earlier Demo migrations there is no SELECT/EXECUTE/RETURNING ... INTO.

-- 1. Prevention: waste, antiseptic consumption and care bundle audits ---------
create or replace function private.demo_seed_prevention(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := current_date;
begin
  -- Monthly waste per department, with that month's patient-days
  insert into public.waste_measurements(organization_id, department_id, record_date, period_start, period_end, waste_type_id, weight_kg, containers,
    document_number, collection_company, status, patient_days, patient_days_source, responsible_name, created_by, updated_by)
  select v_org, dep.id, ms.m_end, ms.m_start, ms.m_end, mli.id,
    round((w.per_pd * coalesce(pd.patient_days, 400) * (0.85 + ((m * 5 + length(dep.code) * 3) % 7) / 20.0))::numeric, 1),
    greatest(1, round(w.per_pd * coalesce(pd.patient_days, 400) / 12)::int),
    'ΤΠ-' || to_char(ms.m_start, 'YYMM') || '-' || lpad((length(dep.code) * 10 + length(w.code))::text, 3, '0'), 'EcoBio Α.Ε.', 'completed',
    pd.patient_days, case when pd.patient_days is null then null else 'library' end, 'Γραφείο Περιβαλλοντικής Υγιεινής', p_actor, p_actor
  from generate_series(1, 6) m
  cross join lateral (select (date_trunc('month', d0) - make_interval(months => m))::date m_start) s0
  cross join lateral (select s0.m_start, (s0.m_start + interval '1 month - 1 day')::date m_end) ms
  join public.departments dep on dep.organization_id = v_org
  cross join (values ('WASTE-INFECTIOUS', 0.32), ('WASTE-SHARP', 0.03), ('WASTE-PHARM', 0.01), ('WASTE-CHEM', 0.004)) w(code, per_pd)
  join public.master_library_items mli on mli.organization_id = v_org and mli.library_key = 'wasteTypes' and mli.code = w.code
  left join public.patient_day_periods pd on pd.organization_id = v_org and pd.department_id = dep.id and pd.period_start = ms.m_start
  where w.code <> 'WASTE-CHEM' or dep.code in ('ΜΕΘ', 'ΝΕΦ');

  -- Alcohol hand rub (all departments) and chlorhexidine (ICU), in litres
  insert into public.antiseptic_consumption_periods(organization_id, department_id, period_start, period_end, antiseptic_item_id, litres, source,
    source_reference, patient_days, patient_days_source, responsible_name, created_by, updated_by)
  select v_org, dep.id, ms.m_start, (ms.m_start + interval '1 month - 1 day')::date, mli.id,
    round((coalesce(pd.patient_days, 400) * a.ml_per_pd * case when dep.code = 'ΜΕΘ' then a.icu else 1 end
      * (0.85 + ((m * 7 + length(dep.code)) % 7) / 20.0) / 1000)::numeric, 1),
    'pharmacy_issue', 'ΔΤ-' || to_char(ms.m_start, 'YYMM'), pd.patient_days, case when pd.patient_days is null then null else 'library' end,
    'Φαρμακείο Νοσοκομείου', p_actor, p_actor
  from generate_series(1, 6) m
  cross join lateral (select (date_trunc('month', d0) - make_interval(months => m))::date m_start) ms
  join public.departments dep on dep.organization_id = v_org
  cross join (values ('ANT-ABHR', 22.0, 3.0), ('ANT-CHG', 4.0, 1.0)) a(code, ml_per_pd, icu)
  join public.master_library_items mli on mli.organization_id = v_org and mli.library_key = 'antiseptics' and mli.code = a.code
  left join public.patient_day_periods pd on pd.organization_id = v_org and pd.department_id = dep.id and pd.period_start = ms.m_start
  where a.code = 'ANT-ABHR' or dep.code = 'ΜΕΘ';

  -- Care bundle audits: three per department and month for the last three
  -- months; about one element in ten is missed.
  insert into public.prevention_bundle_assessments(organization_id, department_id, bundle_key, assessment_date, period_label, score, criteria, evidence, status, created_by, updated_by)
  select v_org, x.dep_id, x.bundle_key, x.adate, x.adate::text,
    case when x.applicable = 0 then null else round(100.0 * (x.applicable - x.missed) / x.applicable) end,
    jsonb_build_object('answers', x.answers, 'answerNotes', '{}'::jsonb, 'shift', (array['morning', 'afternoon', 'night'])[1 + x.n % 3],
      'context', x.context, 'patientId', '', 'patientRef', '', 'deviceId', '', 'deviceRef', '', 'generalNotes', '', 'followUps', '{}'::jsonb,
      'owner', 'Νοσηλεύτρια Επιτήρησης Λοιμώξεων'),
    x.findings, 'completed', p_actor, p_actor
  from (
    select dep.id dep_id, t.bundle_key, b.context, d0 - (n * 9 + length(dep.code)) % 88 - 1 adate, n,
      (select jsonb_object_agg(e->>'id', case when (n * 7 + i * 3 + length(t.bundle_key)) % 10 = 0 then 'no' else 'yes' end)
         from jsonb_array_elements(t.elements) with ordinality el(e, i)) answers,
      (select count(*) from jsonb_array_elements(t.elements)) applicable,
      (select count(*) from jsonb_array_elements(t.elements) with ordinality el(e, i) where (n * 7 + i * 3 + length(t.bundle_key)) % 10 = 0) missed,
      coalesce((select jsonb_agg(jsonb_build_object('id', e->>'id', 'label', e->>'labelEl', 'note', ''))
         from jsonb_array_elements(t.elements) with ordinality el(e, i) where (n * 7 + i * 3 + length(t.bundle_key)) % 10 = 0), '[]'::jsonb) findings
    from (values ('CLABSI', 'ΜΕΘ', 'Κεντρικός φλεβικός καθετήρας'), ('VAP', 'ΜΕΘ', 'Μηχανικός αερισμός'), ('CAUTI', 'ΜΕΘ', 'Ουροκαθετήρας'),
                 ('CAUTI', 'ΠΑΘ', 'Ουροκαθετήρας'), ('PIV', 'ΠΑΘ', 'Περιφερικός φλεβικός καθετήρας'), ('PIV', 'ΚΑΡΔ', 'Περιφερικός φλεβικός καθετήρας'),
                 ('SSI', 'ΧΕΙΡ', 'Χειρουργικό πεδίο'), ('SSI', 'ΟΡΘ', 'Χειρουργικό πεδίο'), ('HD', 'ΝΕΦ', 'Αγγειακή προσπέλαση αιμοκάθαρσης')) b(bundle_key, dep_code, context)
    join public.prevention_bundle_templates t on t.organization_id is null and t.status = 'published' and t.bundle_key = b.bundle_key
    join public.departments dep on dep.organization_id = v_org and dep.code = b.dep_code
    cross join generate_series(1, 9) n
  ) x;
end;
$function$;

revoke all on function private.demo_seed_prevention(uuid, uuid) from public, anon, authenticated;
-- 2. Orchestrator: every area, prevention included ----------------------------
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

revoke all on function private.demo_seed_data(uuid, uuid) from public, anon, authenticated;


-- 3. The Platform Owner's Demo -----------------------------------------------
-- One Demo organization (code DEMO-OWNER) filled with the same data pack as the
-- evaluators' Demos; created and filled the first time the Owner opens it.
create or replace function public.platform_open_owner_demo()
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_org uuid := (select o.id from public.organizations o where o.code = 'DEMO-OWNER' and o.is_demo limit 1);
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_platform_owner, false)
  ) then
    raise exception 'Platform Owner access required' using errcode = '42501';
  end if;
  if v_org is null then
    v_org := gen_random_uuid();
    insert into public.organizations(id, name, code, type, status, country, is_demo)
    values (v_org, 'Γενικό Νοσοκομείο Demo', 'DEMO-OWNER', 'hospital', 'active', 'Ελλάδα', true);
  end if;
  if not exists (select 1 from public.patients p where p.organization_id = v_org) then
    perform private.demo_wipe_data(v_org);
    perform private.demo_seed_data(v_org, auth.uid());
  end if;
  return v_org;
end;
$function$;

revoke all on function public.platform_open_owner_demo() from public, anon;
grant execute on function public.platform_open_owner_demo() to authenticated, service_role;

-- 4. Access enforcement --------------------------------------------------------
-- A paused organization, or a Demo whose entitlement expired or was paused,
-- puts its members on hold: status 'disabled' with access_hold set. Every RLS
-- helper already requires status = 'active', so the hold closes access in the
-- database. When access reopens only the held memberships are re-enabled.
alter table public.organization_members add column if not exists access_hold text;
comment on column public.organization_members.access_hold is
  'Set while the organization is paused or its Demo expired/paused; the membership is re-enabled when access reopens.';

-- Open when the organization is active and, for a Demo with an entitlement,
-- that entitlement is active and today is within its dates.
create or replace function private.org_access_open(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.organizations o
    where o.id = p_organization_id and o.status = 'active'
      and (not o.is_demo or not exists (
        select 1 from public.platform_demo_entitlements e
        where e.organization_id = o.id
          and not (e.status = 'active' and current_date between e.valid_from and e.valid_until)))
  );
$function$;

create or replace function private.apply_org_access(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if private.org_access_open(p_organization_id) then
    update public.organization_members om set status = 'active', access_hold = null
    where om.organization_id = p_organization_id and om.access_hold is not null;
  else
    update public.organization_members om set status = 'disabled', access_hold = 'access_closed'
    where om.organization_id = p_organization_id and om.status = 'active' and om.access_hold is null
      and not exists (select 1 from public.profiles p where p.id = om.user_id and coalesce(p.is_platform_owner, false));
  end if;
end;
$function$;

-- Hourly: a Demo reaches its end (or start) date without any row changing.
create or replace function private.apply_all_org_access()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_org uuid;
  v_count integer := 0;
begin
  for v_org in
    select o.id from public.organizations o
    where o.is_demo or o.status <> 'active'
       or exists (select 1 from public.organization_members om where om.organization_id = o.id and om.access_hold is not null)
  loop
    perform private.apply_org_access(v_org);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;

create or replace function private.demo_entitlement_access_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.apply_org_access(new.organization_id);
  return null;
end;
$function$;

create or replace function private.organization_status_access_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.apply_org_access(new.id);
  return null;
end;
$function$;

create or replace trigger trg_demo_entitlement_access
  after insert or update of status, valid_from, valid_until on public.platform_demo_entitlements
  for each row execute function private.demo_entitlement_access_changed();

create or replace trigger trg_organization_status_access
  after update of status on public.organizations
  for each row when (old.status is distinct from new.status)
  execute function private.organization_status_access_changed();

revoke all on function private.org_access_open(uuid) from public, anon, authenticated;
revoke all on function private.apply_org_access(uuid) from public, anon, authenticated;
revoke all on function private.apply_all_org_access() from public, anon, authenticated;
revoke all on function private.demo_entitlement_access_changed() from public, anon, authenticated;
revoke all on function private.organization_status_access_changed() from public, anon, authenticated;

-- What a signed-in evaluator may know about their own Demos: name, dates, state
-- and whether it is open. Read by the Demo bar and the "Demo ended" screen.
create or replace function public.current_demo_access()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'organizationId', o.id,
    'organizationName', o.name,
    'label', e.label,
    'validFrom', e.valid_from,
    'validUntil', e.valid_until,
    'status', coalesce(e.status, 'active'),
    'organizationStatus', o.status,
    'daysLeft', case when e.valid_until is null then null else e.valid_until - current_date end,
    'open', private.org_access_open(o.id)
  ) order by o.name), '[]'::jsonb)
  from public.organization_members om
  join public.organizations o on o.id = om.organization_id and o.is_demo
  left join public.platform_demo_entitlements e on e.organization_id = o.id
  where om.user_id = auth.uid() and (om.status = 'active' or om.access_hold is not null);
$function$;

revoke all on function public.current_demo_access() from public, anon;
grant execute on function public.current_demo_access() to authenticated;

-- Hourly job (pg_cron), when the extension is available.
do $cron$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(j.jobid) from cron.job j where j.jobname = 'limoxis-org-access';
    perform cron.schedule('limoxis-org-access', '7 * * * *', 'select private.apply_all_org_access()');
  end if;
end
$cron$;

select private.apply_all_org_access();
