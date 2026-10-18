-- Quality records: every value in a column of its own.
--
-- A. Incidents. quality_incidents gains event_type (what kind of adverse event
--    it is, as FileMaker's «Incident type»: death, injury / fall / exposure,
--    obstetric, blue code, return to theatre, readmission, haemorrhage, other).
--    It is not the category (the library: clinical, medication, fall…) nor the
--    WHO class (nearMiss / noHarm / harmful), which keep their meaning. The
--    details of an event type are 1:1 rows keyed by the incident:
--      quality_incident_falls        injury / fall / exposure: how the person fell,
--                                    the floor, bed rails, the doctor's examination,
--                                    the injury and who was injured;
--      quality_incident_sharps       a sharps injury: the tool, its state, where it
--                                    hit, first user, contact, exposed part, substance;
--      quality_incident_blue_codes   a blue code: interventions, outcome, where the
--                                    patient went, the doctor and nurse, gloves;
--      quality_incident_obstetric    an obstetric event's subcategory (the 17 FileMaker
--                                    values, case and accents merged into 15 + other).
-- B. CAPA. The steps (sub_actions jsonb) become quality_capa_sub_actions; the
--    root cause analysis (root_cause_analysis jsonb) becomes
--    quality_capa_root_cause_analyses (problem, root cause) with its 5 Whys
--    (quality_capa_root_cause_whys) and Ishikawa causes
--    (quality_capa_root_cause_factors). Progress notes are
--    quality_capa_progress. action_type also takes continuous_improvement,
--    innovation, risk_management and objective_achievement.
-- C. Audits: checklist jsonb becomes quality_audit_checklist_items (the «No»
--    answer's finding is a foreign key). Suppliers: certifications, evaluations
--    (with one score row per criterion: criterion, weight, score) and
--    nonconformities become tables.
--
-- The jsonb values are copied field by field and counted, row by row and value
-- by value; any difference raises and rolls the migration back. The jsonb
-- columns are dropped only after the copy. `history` stays: it is the append-only
-- change log of a record, not one of its fields.
--
-- Every new table: organization_id, a composite foreign key to its parent's
-- (id, organization_id) so a child is always in its parent's organization,
-- created/updated at/by kept by public.set_repository_audit_fields(), indexes
-- on the foreign keys, row-level security as its parent's (read: the Quality
-- readers or whoever reads the parent row; write: as the parent), no anon.

-- 0. Parent keys --------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['quality_incidents','quality_capa_actions','quality_audits','quality_findings'] loop
    if not exists (select 1 from pg_constraint where conname = t || '_id_organization_key') then
      execute format('alter table public.%I add constraint %I unique (id, organization_id)', t, t || '_id_organization_key');
    end if;
  end loop;
end
$$;

-- A. Incidents ---------------------------------------------------------------------

alter table public.quality_incidents add column if not exists event_type text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'quality_incidents_event_type_check') then
    alter table public.quality_incidents add constraint quality_incidents_event_type_check check (event_type is null or event_type in
      ('death','injury_fall_exposure','obstetric','blue_code','return_to_theatre','readmission','haemorrhage','other'));
  end if;
end
$$;
comment on column public.quality_incidents.event_type is 'Adverse event type: death, injury_fall_exposure, obstetric, blue_code, return_to_theatre, readmission, haemorrhage, other. Its details are in quality_incident_falls / _sharps / _blue_codes / _obstetric.';
create index if not exists quality_incidents_event_type_idx on public.quality_incidents (organization_id, event_type) where event_type is not null;

create table if not exists public.quality_incident_falls (
  incident_id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  fall_type text check (fall_type in ('fall','slip','faint','other')),
  floor_condition text check (floor_condition in ('dry','wet')),
  bed_rails text check (bed_rails in ('in_use','not_in_use','not_applicable')),
  location text,
  examined_by_doctor boolean,
  doctor_instructions text,
  injury_category text check (injury_category in ('injury','near_miss','hazard_exposure')),
  injury_subcategory text check (injury_subcategory in ('fall','sharp_object','blood_product_reaction','chemical_bio_radio_exposure','drug_allergy','procedure_injury','falling_object','other')),
  injured_person_type text check (injured_person_type in ('patient','employee','companion','visitor')),
  injured_employee_id uuid references public.employees(id) on delete set null,
  injury_description text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  foreign key (incident_id, organization_id) references public.quality_incidents(id, organization_id) on delete cascade,
  constraint quality_incident_falls_employee_is_employee check (injured_employee_id is null or injured_person_type = 'employee')
);
create index if not exists quality_incident_falls_org_idx on public.quality_incident_falls (organization_id);
create index if not exists quality_incident_falls_employee_idx on public.quality_incident_falls (injured_employee_id);
create index if not exists quality_incident_falls_parent_idx on public.quality_incident_falls (incident_id, organization_id);

create table if not exists public.quality_incident_sharps (
  incident_id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tool text check (tool in ('disposable_needle','needle','scalpel','suture_needle','butterfly','other')),
  tool_state text check (tool_state in ('used','clean')),
  body_site text check (body_site in ('hands','other')),
  body_site_other text,
  first_user text,
  contact_duration text,
  exposed_body_part text,
  substance text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  foreign key (incident_id, organization_id) references public.quality_incidents(id, organization_id) on delete cascade,
  constraint quality_incident_sharps_other_site check (body_site_other is null or body_site = 'other')
);
create index if not exists quality_incident_sharps_org_idx on public.quality_incident_sharps (organization_id);
create index if not exists quality_incident_sharps_parent_idx on public.quality_incident_sharps (incident_id, organization_id);

-- Arrays of a closed list are the repository's style (owner_labels text[]).
create table if not exists public.quality_incident_blue_codes (
  incident_id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  interventions text[] not null default '{}'
    check (interventions <@ array['cpr','intubation','central_line','oxygen','peripheral_line','other']::text[]),
  outcome text check (outcome in ('successful','unsuccessful')),
  patient_status text,
  transfer_to text check (transfer_to in ('icu','ward','ed','theatre','mortuary','discharged','other')),
  doctor_label text,
  nurse_label text,
  staff_involved text,
  gloves boolean,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  foreign key (incident_id, organization_id) references public.quality_incidents(id, organization_id) on delete cascade
);
create index if not exists quality_incident_blue_codes_org_idx on public.quality_incident_blue_codes (organization_id);
create index if not exists quality_incident_blue_codes_parent_idx on public.quality_incident_blue_codes (incident_id, organization_id);

-- FileMaker «μαιευτικό συμβάν υποκατηγορία» (17 values): «Αιμορραγία» and
-- «Μαιευτική Αιμορραγία» are one (obstetric_haemorrhage), «Αιμάτωμα» and
-- «ΑΙΜΑΤΩΜΑ» one (haematoma).
create table if not exists public.quality_incident_obstetric (
  incident_id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subcategory text not null check (subcategory in (
    'preeclampsia','obstetric_haemorrhage','placental_abruption','shoulder_dystocia','uterine_atony','fever',
    'abdominal_pain','uterine_rupture','dural_puncture','intrauterine_death','wound_repair','bowel_perforation',
    'haematoma','low_back_pain','meckel_diverticulum_rupture','other')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  foreign key (incident_id, organization_id) references public.quality_incidents(id, organization_id) on delete cascade
);
create index if not exists quality_incident_obstetric_org_idx on public.quality_incident_obstetric (organization_id);
create index if not exists quality_incident_obstetric_parent_idx on public.quality_incident_obstetric (incident_id, organization_id);

-- Read: Quality, or whoever reads the incident (its reporter, its owner, the
-- department manager): the parent's policy applies inside exists(). Write: whoever
-- may report adds the details with the report (an anonymous reporter cannot read
-- the incident back, so the insert checks the organization, as the report does;
-- the composite key keeps the row in the incident's organization); Quality
-- changes and removes them, as it changes the incident.
do $$
declare t text;
begin
  foreach t in array array['quality_incident_falls','quality_incident_sharps','quality_incident_blue_codes','quality_incident_obstetric'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format($p$create policy %I on public.%I for select to authenticated using (
      (select public.current_user_is_platform_owner())
      or organization_id = any ((select private.current_user_quality_read_orgs())::uuid[])
      or exists (select 1 from public.quality_incidents p where p.id = incident_id))$p$, t || '_read', t);
    execute format($p$create policy %I on public.%I for insert to authenticated with check (
      (select public.current_user_is_platform_owner())
      or organization_id = any ((select private.current_user_quality_manage_orgs())::uuid[])
      or organization_id = any ((select private.fast_orgs_role(array['hospital_admin','quality_manager','infection_control_lead','infection_control_member','department_manager','department_user','link_nurse','laboratory','pharmacy','hr_office','occupational_physician','doctor_reviewer','committee_secretariat','staff_user']::public.app_role[]))::uuid[])
      or organization_id = any ((select private.fast_orgs_capability('report_incident'))::uuid[]))$p$, t || '_insert', t);
    execute format($p$create policy %I on public.%I for update to authenticated
      using ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_quality_manage_orgs())::uuid[]))
      with check ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_quality_manage_orgs())::uuid[]))$p$, t || '_update', t);
    execute format($p$create policy %I on public.%I for delete to authenticated
      using ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_quality_manage_orgs())::uuid[]))$p$, t || '_delete', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end
$$;

-- B. CAPA --------------------------------------------------------------------------

alter table public.quality_capa_actions drop constraint if exists quality_capa_actions_action_type_check;
alter table public.quality_capa_actions add constraint quality_capa_actions_action_type_check check (action_type in
  ('corrective','preventive','continuous_improvement','innovation','risk_management','objective_achievement'));

create table if not exists public.quality_capa_sub_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  capa_id uuid not null,
  position integer not null check (position >= 1),
  title text not null check (length(btrim(title)) > 0),
  owner_label text,
  due_date date,
  done boolean not null default false,
  done_at timestamptz,
  done_by_label text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  foreign key (capa_id, organization_id) references public.quality_capa_actions(id, organization_id) on delete cascade,
  constraint quality_capa_sub_actions_done_at check (done or (done_at is null and done_by_label is null))
);
create index if not exists quality_capa_sub_actions_capa_idx on public.quality_capa_sub_actions (capa_id, organization_id, position);
create index if not exists quality_capa_sub_actions_org_idx on public.quality_capa_sub_actions (organization_id, due_date);

create table if not exists public.quality_capa_root_cause_analyses (
  capa_id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  problem_statement text,
  root_cause text,
  updated_by_label text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  unique (capa_id, organization_id),
  foreign key (capa_id, organization_id) references public.quality_capa_actions(id, organization_id) on delete cascade
);
create index if not exists quality_capa_root_cause_analyses_org_idx on public.quality_capa_root_cause_analyses (organization_id);

create table if not exists public.quality_capa_root_cause_whys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  capa_id uuid not null,
  position smallint not null check (position between 1 and 5),
  answer text not null check (length(btrim(answer)) > 0),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  unique (capa_id, position),
  foreign key (capa_id, organization_id) references public.quality_capa_root_cause_analyses(capa_id, organization_id) on delete cascade
);
create index if not exists quality_capa_root_cause_whys_parent_idx on public.quality_capa_root_cause_whys (capa_id, organization_id);
create index if not exists quality_capa_root_cause_whys_org_idx on public.quality_capa_root_cause_whys (organization_id);

create table if not exists public.quality_capa_root_cause_factors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  capa_id uuid not null,
  category text not null check (category in ('people','methods','equipment','materials','environment','communication')),
  position integer not null check (position >= 1),
  description text not null check (length(btrim(description)) > 0),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  unique (capa_id, category, position),
  foreign key (capa_id, organization_id) references public.quality_capa_root_cause_analyses(capa_id, organization_id) on delete cascade
);
create index if not exists quality_capa_root_cause_factors_parent_idx on public.quality_capa_root_cause_factors (capa_id, organization_id);
create index if not exists quality_capa_root_cause_factors_org_idx on public.quality_capa_root_cause_factors (organization_id);

create table if not exists public.quality_capa_progress (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  capa_id uuid not null,
  entry_date date not null default current_date,
  note text not null check (length(btrim(note)) > 0),
  author_label text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  foreign key (capa_id, organization_id) references public.quality_capa_actions(id, organization_id) on delete cascade
);
create index if not exists quality_capa_progress_capa_idx on public.quality_capa_progress (capa_id, organization_id, entry_date desc);
create index if not exists quality_capa_progress_org_idx on public.quality_capa_progress (organization_id);

-- C. Audits and suppliers -------------------------------------------------------------

create table if not exists public.quality_audit_checklist_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  audit_id uuid not null,
  position integer not null check (position >= 1),
  item text not null check (length(btrim(item)) > 0),
  item_en text,
  required boolean not null default true,
  answer text check (answer in ('yes','no','na')),
  note text,
  finding_id uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  foreign key (audit_id, organization_id) references public.quality_audits(id, organization_id) on delete cascade,
  foreign key (finding_id, organization_id) references public.quality_findings(id, organization_id) on delete set null (finding_id)
);
create index if not exists quality_audit_checklist_items_audit_idx on public.quality_audit_checklist_items (audit_id, organization_id, position);
create index if not exists quality_audit_checklist_items_finding_idx on public.quality_audit_checklist_items (finding_id, organization_id);
create index if not exists quality_audit_checklist_items_org_idx on public.quality_audit_checklist_items (organization_id);

create table if not exists public.quality_supplier_certifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_id uuid not null,
  certificate_type text not null check (length(btrim(certificate_type)) > 0),
  certificate_number text,
  issuer text,
  expires_on date,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  foreign key (supplier_id, organization_id) references public.quality_suppliers(id, organization_id) on delete cascade
);
create index if not exists quality_supplier_certifications_supplier_idx on public.quality_supplier_certifications (supplier_id, organization_id);
create index if not exists quality_supplier_certifications_org_idx on public.quality_supplier_certifications (organization_id, expires_on);

create table if not exists public.quality_supplier_evaluations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_id uuid not null,
  evaluated_on date not null,
  evaluator text,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (supplier_id, organization_id) references public.quality_suppliers(id, organization_id) on delete cascade
);
create index if not exists quality_supplier_evaluations_supplier_idx on public.quality_supplier_evaluations (supplier_id, organization_id, evaluated_on desc);
create index if not exists quality_supplier_evaluations_org_idx on public.quality_supplier_evaluations (organization_id);

create table if not exists public.quality_supplier_evaluation_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  evaluation_id uuid not null,
  criterion text not null check (criterion in ('quality','delivery','specs','documents','support','price')),
  weight numeric(5,2) not null default 1 check (weight > 0),
  score smallint not null check (score between 1 and 5),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  unique (evaluation_id, criterion),
  foreign key (evaluation_id, organization_id) references public.quality_supplier_evaluations(id, organization_id) on delete cascade
);
create index if not exists quality_supplier_evaluation_scores_parent_idx on public.quality_supplier_evaluation_scores (evaluation_id, organization_id);
create index if not exists quality_supplier_evaluation_scores_org_idx on public.quality_supplier_evaluation_scores (organization_id);

create table if not exists public.quality_supplier_nonconformities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_id uuid not null,
  occurred_on date not null,
  description text not null check (length(btrim(description)) > 0),
  severity text not null default 'minor' check (severity in ('minor','major')),
  status text not null default 'open' check (status in ('open','closed')),
  capa_code text,
  closed_on date,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  foreign key (supplier_id, organization_id) references public.quality_suppliers(id, organization_id) on delete cascade,
  constraint quality_supplier_nonconformities_closed_on check (closed_on is null or status = 'closed')
);
create index if not exists quality_supplier_nonconformities_supplier_idx on public.quality_supplier_nonconformities (supplier_id, organization_id, occurred_on desc);
create index if not exists quality_supplier_nonconformities_org_idx on public.quality_supplier_nonconformities (organization_id, status);

-- Read: Quality, or whoever reads the parent (a CAPA's owner, the department
-- manager of an audit or a CAPA: the parent's policy applies inside exists()).
-- Write: Quality, as on the parent. Suppliers are read by Quality only.
do $$
declare
  t text;
  parent text;
  parent_key text;
  read_parent text;
begin
  for t, parent, parent_key in select * from (values
      ('quality_capa_sub_actions','quality_capa_actions','capa_id'),
      ('quality_capa_root_cause_analyses','quality_capa_actions','capa_id'),
      ('quality_capa_root_cause_whys','quality_capa_actions','capa_id'),
      ('quality_capa_root_cause_factors','quality_capa_actions','capa_id'),
      ('quality_capa_progress','quality_capa_actions','capa_id'),
      ('quality_audit_checklist_items','quality_audits','audit_id'),
      ('quality_supplier_certifications',null,null),
      ('quality_supplier_evaluations',null,null),
      ('quality_supplier_evaluation_scores',null,null),
      ('quality_supplier_nonconformities',null,null)) v(t, parent, parent_key) loop
    read_parent := case when parent is null then '' else format(' or exists (select 1 from public.%I p where p.id = %I)', parent, parent_key) end;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format($p$create policy %I on public.%I for select to authenticated using (
      (select public.current_user_is_platform_owner())
      or organization_id = any ((select private.current_user_quality_read_orgs())::uuid[])%s)$p$, t || '_read', t, read_parent);
    execute format($p$create policy %I on public.%I for insert to authenticated
      with check ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_quality_manage_orgs())::uuid[]))$p$, t || '_insert', t);
    execute format($p$create policy %I on public.%I for update to authenticated
      using ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_quality_manage_orgs())::uuid[]))
      with check ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_quality_manage_orgs())::uuid[]))$p$, t || '_update', t);
    execute format($p$create policy %I on public.%I for delete to authenticated
      using ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_quality_manage_orgs())::uuid[]))$p$, t || '_delete', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end
$$;

-- The steps and the analysis of a CAPA from their earlier jsonb shape
-- (steps: [{id,title,owner,dueDate,done,doneAt,doneBy}]; analysis: {problem,
-- whys:[text×5], causes:{people,methods,equipment,materials,environment,
-- communication:[text]}, rootCause, updatedAt, updatedBy}). Used once by the copy
-- below and by the demo seed, which writes its CAPAs in that shape. It replaces
-- what the CAPA had. An empty title, why or cause is not stored; an analysis
-- with nothing written is not stored.
create or replace function private.quality_capa_import_json(p_capa uuid, p_steps jsonb, p_analysis jsonb)
returns void language plpgsql set search_path = ''
as $function$
declare
  v_org uuid;
  v_created timestamptz;
  v_has_content boolean;
begin
  select c.organization_id, c.created_at into v_org, v_created from public.quality_capa_actions c where c.id = p_capa;
  if v_org is null then return; end if;

  delete from public.quality_capa_sub_actions s where s.capa_id = p_capa;
  insert into public.quality_capa_sub_actions(organization_id, capa_id, position, title, owner_label, due_date, done, done_at, done_by_label, created_at, updated_at)
  select v_org, p_capa, s.n::integer, btrim(s.e->>'title'), nullif(btrim(coalesce(s.e->>'owner', '')), ''),
    nullif(s.e->>'dueDate', '')::date, coalesce((s.e->>'done')::boolean, false),
    case when coalesce((s.e->>'done')::boolean, false) then nullif(s.e->>'doneAt', '')::timestamptz end,
    case when coalesce((s.e->>'done')::boolean, false) then nullif(btrim(coalesce(s.e->>'doneBy', '')), '') end,
    v_created, coalesce(case when coalesce((s.e->>'done')::boolean, false) then nullif(s.e->>'doneAt', '')::timestamptz end, v_created)
  from jsonb_array_elements(case when jsonb_typeof(p_steps) = 'array' then p_steps else '[]'::jsonb end) with ordinality s(e, n)
  where jsonb_typeof(s.e) = 'object' and btrim(coalesce(s.e->>'title', '')) <> '';

  delete from public.quality_capa_root_cause_analyses a where a.capa_id = p_capa;
  if jsonb_typeof(p_analysis) is distinct from 'object' then return; end if;
  v_has_content := btrim(coalesce(p_analysis->>'problem', '')) <> '' or btrim(coalesce(p_analysis->>'rootCause', '')) <> ''
    or exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(p_analysis->'whys') = 'array' then p_analysis->'whys' else '[]'::jsonb end) w(t) where btrim(w.t) <> '')
    or exists (select 1 from jsonb_each(case when jsonb_typeof(p_analysis->'causes') = 'object' then p_analysis->'causes' else '{}'::jsonb end) k(category, list),
                 jsonb_array_elements_text(case when jsonb_typeof(k.list) = 'array' then k.list else '[]'::jsonb end) f(t) where btrim(f.t) <> '');
  if not v_has_content then return; end if;

  insert into public.quality_capa_root_cause_analyses(capa_id, organization_id, problem_statement, root_cause, updated_by_label, created_at, updated_at)
  values (p_capa, v_org, nullif(btrim(coalesce(p_analysis->>'problem', '')), ''), nullif(btrim(coalesce(p_analysis->>'rootCause', '')), ''),
    nullif(btrim(coalesce(p_analysis->>'updatedBy', '')), ''),
    coalesce(nullif(p_analysis->>'updatedAt', '')::timestamptz, now()), coalesce(nullif(p_analysis->>'updatedAt', '')::timestamptz, now()));

  insert into public.quality_capa_root_cause_whys(organization_id, capa_id, position, answer)
  select v_org, p_capa, w.n::smallint, btrim(w.t)
  from jsonb_array_elements_text(case when jsonb_typeof(p_analysis->'whys') = 'array' then p_analysis->'whys' else '[]'::jsonb end) with ordinality w(t, n)
  where btrim(w.t) <> '';

  insert into public.quality_capa_root_cause_factors(organization_id, capa_id, category, position, description)
  select v_org, p_capa, k.category, f.n::integer, btrim(f.t)
  from jsonb_each(case when jsonb_typeof(p_analysis->'causes') = 'object' then p_analysis->'causes' else '{}'::jsonb end) k(category, list),
       jsonb_array_elements_text(case when jsonb_typeof(k.list) = 'array' then k.list else '[]'::jsonb end) with ordinality f(t, n)
  where btrim(f.t) <> '';
end;
$function$;
revoke all on function private.quality_capa_import_json(uuid, jsonb, jsonb) from public, anon, authenticated;

-- Copy and verify -----------------------------------------------------------------------

do $copy$
declare
  v_expected bigint;
  v_actual bigint;
begin
  -- CAPA steps and analyses.
  perform private.quality_capa_import_json(c.id, c.sub_actions, c.root_cause_analysis)
  from public.quality_capa_actions c
  where jsonb_typeof(c.sub_actions) = 'array' and jsonb_array_length(c.sub_actions) > 0 or c.root_cause_analysis is not null;

  select count(*) into v_expected from public.quality_capa_actions c, jsonb_array_elements(c.sub_actions) e;
  select count(*) into v_actual from public.quality_capa_actions c
    join lateral (select e, n from jsonb_array_elements(c.sub_actions) with ordinality x(e, n)) s on true
    join public.quality_capa_sub_actions r on r.capa_id = c.id
     and r.position = s.n
     and r.title = btrim(s.e->>'title')
     and r.owner_label is not distinct from nullif(btrim(coalesce(s.e->>'owner', '')), '')
     and r.due_date is not distinct from nullif(s.e->>'dueDate', '')::date
     and r.done = coalesce((s.e->>'done')::boolean, false)
     and r.done_at is not distinct from nullif(s.e->>'doneAt', '')::timestamptz
     and r.done_by_label is not distinct from nullif(btrim(coalesce(s.e->>'doneBy', '')), '');
  if v_actual <> v_expected or v_expected <> (select count(*) from public.quality_capa_sub_actions) then
    raise exception 'CAPA steps: % in jsonb, % copied field by field, % rows', v_expected, v_actual, (select count(*) from public.quality_capa_sub_actions);
  end if;

  select count(*) into v_expected from public.quality_capa_actions c where jsonb_typeof(c.root_cause_analysis) = 'object';
  select count(*) into v_actual from public.quality_capa_actions c join public.quality_capa_root_cause_analyses a on a.capa_id = c.id
    where a.problem_statement is not distinct from nullif(btrim(coalesce(c.root_cause_analysis->>'problem', '')), '')
      and a.root_cause is not distinct from nullif(btrim(coalesce(c.root_cause_analysis->>'rootCause', '')), '')
      and a.updated_by_label is not distinct from nullif(btrim(coalesce(c.root_cause_analysis->>'updatedBy', '')), '')
      and a.updated_at = (c.root_cause_analysis->>'updatedAt')::timestamptz;
  if v_actual <> v_expected or v_expected <> (select count(*) from public.quality_capa_root_cause_analyses) then
    raise exception 'CAPA analyses: % in jsonb, % copied field by field', v_expected, v_actual;
  end if;

  select count(*) into v_expected from public.quality_capa_actions c, jsonb_array_elements_text(c.root_cause_analysis->'whys') with ordinality w(t, n) where btrim(w.t) <> '';
  select count(*) into v_actual from public.quality_capa_actions c, jsonb_array_elements_text(c.root_cause_analysis->'whys') with ordinality w(t, n)
    join public.quality_capa_root_cause_whys r on r.position = w.n and r.answer = btrim(w.t)
    where r.capa_id = c.id and btrim(w.t) <> '';
  if v_actual <> v_expected or v_expected <> (select count(*) from public.quality_capa_root_cause_whys) then
    raise exception 'CAPA 5 Whys: % in jsonb, % copied', v_expected, v_actual;
  end if;

  select count(*) into v_expected from public.quality_capa_actions c, jsonb_each(c.root_cause_analysis->'causes') k(category, list), jsonb_array_elements_text(k.list) f(t)
    where jsonb_typeof(c.root_cause_analysis->'causes') = 'object' and btrim(f.t) <> '';
  select count(*) into v_actual from public.quality_capa_actions c, jsonb_each(c.root_cause_analysis->'causes') k(category, list), jsonb_array_elements_text(k.list) f(t)
    where jsonb_typeof(c.root_cause_analysis->'causes') = 'object' and btrim(f.t) <> ''
      and exists (select 1 from public.quality_capa_root_cause_factors r where r.capa_id = c.id and r.category = k.category and r.description = btrim(f.t));
  if v_actual <> v_expected or v_expected <> (select count(*) from public.quality_capa_root_cause_factors) then
    raise exception 'CAPA Ishikawa causes: % in jsonb, % copied', v_expected, v_actual;
  end if;

  -- Audit checklists. A «No» answer's finding was kept by its code.
  if exists (select 1 from public.quality_audits a, jsonb_array_elements(a.checklist) e
             where nullif(e->>'findingId', '') is not null
               and not exists (select 1 from public.quality_findings f where f.organization_id = a.organization_id and f.code = e->>'findingId')) then
    raise exception 'Audit checklists: a finding code does not exist';
  end if;
  insert into public.quality_audit_checklist_items(organization_id, audit_id, position, item, item_en, required, answer, note, finding_id, created_at, updated_at)
  select a.organization_id, a.id, e.n::integer, btrim(e.v->>'item'),
    nullif(nullif(btrim(coalesce(e.v->>'itemEn', '')), ''), btrim(e.v->>'item')), coalesce((e.v->>'required')::boolean, true), nullif(e.v->>'answer', ''),
    nullif(btrim(coalesce(e.v->>'note', '')), ''),
    (select f.id from public.quality_findings f where f.organization_id = a.organization_id and f.code = nullif(e.v->>'findingId', '')),
    a.created_at, a.updated_at
  from public.quality_audits a, jsonb_array_elements(a.checklist) with ordinality e(v, n)
  where btrim(coalesce(e.v->>'item', '')) <> '';
  select count(*) into v_expected from public.quality_audits a, jsonb_array_elements(a.checklist) e;
  select count(*) into v_actual from public.quality_audits a, jsonb_array_elements(a.checklist) e(v)
    where exists (select 1 from public.quality_audit_checklist_items r where r.audit_id = a.id and r.item = btrim(e.v->>'item')
      and r.item_en is not distinct from nullif(nullif(btrim(coalesce(e.v->>'itemEn', '')), ''), btrim(e.v->>'item'))
      and r.required = coalesce((e.v->>'required')::boolean, true)
      and r.answer is not distinct from nullif(e.v->>'answer', '')
      and r.note is not distinct from nullif(btrim(coalesce(e.v->>'note', '')), '')
      and (r.finding_id is null) = (nullif(e.v->>'findingId', '') is null));
  if v_actual <> v_expected or v_expected <> (select count(*) from public.quality_audit_checklist_items) then
    raise exception 'Audit checklists: % items in jsonb, % copied field by field', v_expected, v_actual;
  end if;

  -- Supplier certifications.
  insert into public.quality_supplier_certifications(organization_id, supplier_id, certificate_type, certificate_number, issuer, expires_on, created_at, updated_at)
  select s.organization_id, s.id, btrim(e->>'type'), nullif(btrim(coalesce(e->>'number', '')), ''), nullif(btrim(coalesce(e->>'issuer', '')), ''),
    nullif(e->>'expiresOn', '')::date, s.created_at, s.updated_at
  from public.quality_suppliers s, jsonb_array_elements(s.certifications) e
  where btrim(coalesce(e->>'type', '')) <> '';
  select count(*) into v_expected from public.quality_suppliers s, jsonb_array_elements(s.certifications) e;
  select count(*) into v_actual from public.quality_suppliers s, jsonb_array_elements(s.certifications) e
    where exists (select 1 from public.quality_supplier_certifications r where r.supplier_id = s.id and r.certificate_type = btrim(e->>'type')
      and r.certificate_number is not distinct from nullif(btrim(coalesce(e->>'number', '')), '')
      and r.issuer is not distinct from nullif(btrim(coalesce(e->>'issuer', '')), '')
      and r.expires_on is not distinct from nullif(e->>'expiresOn', '')::date);
  if v_actual <> v_expected or v_expected <> (select count(*) from public.quality_supplier_certifications) then
    raise exception 'Supplier certifications: % in jsonb, % copied field by field', v_expected, v_actual;
  end if;

  -- Supplier evaluations and their scores (a blank criterion was not scored).
  create temporary table quality_supplier_evaluation_copy on commit drop as
    select gen_random_uuid() as new_id, s.id as supplier_id, s.organization_id, s.created_at, s.updated_at, e
    from public.quality_suppliers s, jsonb_array_elements(s.evaluations) e;
  insert into public.quality_supplier_evaluations(id, organization_id, supplier_id, evaluated_on, evaluator, notes, created_at, updated_at)
  select c.new_id, c.organization_id, c.supplier_id, (c.e->>'evaluatedOn')::date, nullif(btrim(coalesce(c.e->>'evaluator', '')), ''),
    nullif(btrim(coalesce(c.e->>'notes', '')), ''), c.created_at, c.updated_at
  from quality_supplier_evaluation_copy c;
  insert into public.quality_supplier_evaluation_scores(organization_id, evaluation_id, criterion, weight, score, created_at, updated_at)
  select c.organization_id, c.new_id, k.criterion, 1, k.value::smallint, c.created_at, c.updated_at
  from quality_supplier_evaluation_copy c, jsonb_each_text(case when jsonb_typeof(c.e->'scores') = 'object' then c.e->'scores' else '{}'::jsonb end) k(criterion, value)
  where btrim(coalesce(k.value, '')) <> '';
  select count(*) into v_expected from public.quality_suppliers s, jsonb_array_elements(s.evaluations) e;
  select count(*) into v_actual from quality_supplier_evaluation_copy c join public.quality_supplier_evaluations r on r.id = c.new_id
    and r.evaluated_on = (c.e->>'evaluatedOn')::date and r.evaluator is not distinct from nullif(btrim(coalesce(c.e->>'evaluator', '')), '')
    and r.notes is not distinct from nullif(btrim(coalesce(c.e->>'notes', '')), '');
  if v_actual <> v_expected or v_expected <> (select count(*) from public.quality_supplier_evaluations) then
    raise exception 'Supplier evaluations: % in jsonb, % copied field by field', v_expected, v_actual;
  end if;
  select count(*) into v_expected from quality_supplier_evaluation_copy c, jsonb_each_text(case when jsonb_typeof(c.e->'scores') = 'object' then c.e->'scores' else '{}'::jsonb end) k(criterion, value)
    where btrim(coalesce(k.value, '')) <> '';
  select count(*) into v_actual from quality_supplier_evaluation_copy c, jsonb_each_text(case when jsonb_typeof(c.e->'scores') = 'object' then c.e->'scores' else '{}'::jsonb end) k(criterion, value)
    join public.quality_supplier_evaluation_scores r on r.criterion = k.criterion and r.score = k.value::smallint
    where r.evaluation_id = c.new_id and btrim(coalesce(k.value, '')) <> '';
  if v_actual <> v_expected or v_expected <> (select count(*) from public.quality_supplier_evaluation_scores) then
    raise exception 'Supplier evaluation scores: % in jsonb, % copied', v_expected, v_actual;
  end if;

  -- Supplier nonconformities.
  insert into public.quality_supplier_nonconformities(organization_id, supplier_id, occurred_on, description, severity, status, capa_code, closed_on, created_at, updated_at)
  select s.organization_id, s.id, (e->>'date')::date, btrim(e->>'description'), coalesce(nullif(e->>'severity', ''), 'minor'), coalesce(nullif(e->>'status', ''), 'open'),
    nullif(btrim(coalesce(e->>'capaCode', '')), ''), case when e->>'status' = 'closed' then nullif(e->>'closedOn', '')::date end, s.created_at, s.updated_at
  from public.quality_suppliers s, jsonb_array_elements(s.nonconformities) e;
  select count(*) into v_expected from public.quality_suppliers s, jsonb_array_elements(s.nonconformities) e;
  select count(*) into v_actual from public.quality_suppliers s, jsonb_array_elements(s.nonconformities) e
    where exists (select 1 from public.quality_supplier_nonconformities r where r.supplier_id = s.id and r.occurred_on = (e->>'date')::date
      and r.description = btrim(e->>'description') and r.severity = coalesce(nullif(e->>'severity', ''), 'minor')
      and r.status = coalesce(nullif(e->>'status', ''), 'open') and r.capa_code is not distinct from nullif(btrim(coalesce(e->>'capaCode', '')), '')
      and r.closed_on is not distinct from case when e->>'status' = 'closed' then nullif(e->>'closedOn', '')::date end);
  if v_actual <> v_expected or v_expected <> (select count(*) from public.quality_supplier_nonconformities) then
    raise exception 'Supplier nonconformities: % in jsonb, % copied field by field', v_expected, v_actual;
  end if;
end
$copy$;

-- The jsonb columns go only now, after the copy.
alter table public.quality_capa_actions drop column if exists sub_actions;
alter table public.quality_capa_actions drop column if exists root_cause_analysis;
alter table public.quality_audits drop constraint if exists quality_audits_checklist_is_array;
alter table public.quality_audits drop column if exists checklist;
alter table public.quality_suppliers drop column if exists certifications;
alter table public.quality_suppliers drop column if exists evaluations;
alter table public.quality_suppliers drop column if exists nonconformities;

-- Audit fields from now on (after the copy, which kept the original times).
do $$
declare t text;
begin
  foreach t in array array['quality_incident_falls','quality_incident_sharps','quality_incident_blue_codes','quality_incident_obstetric',
    'quality_capa_sub_actions','quality_capa_root_cause_analyses','quality_capa_root_cause_whys','quality_capa_root_cause_factors','quality_capa_progress',
    'quality_audit_checklist_items','quality_supplier_certifications','quality_supplier_evaluations','quality_supplier_evaluation_scores','quality_supplier_nonconformities'] loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || t || '_audit_fields', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.set_repository_audit_fields()', 'trg_' || t || '_audit_fields', t);
  end loop;
end
$$;

comment on table public.quality_incident_falls is 'Injury / fall / exposure details of an incident (1:1).';
comment on table public.quality_incident_sharps is 'Sharps injury details of an incident (1:1).';
comment on table public.quality_incident_blue_codes is 'Blue code (cardiac arrest call) details of an incident (1:1).';
comment on table public.quality_incident_obstetric is 'Obstetric event subcategory of an incident (1:1).';
comment on table public.quality_capa_sub_actions is 'The steps of a CAPA, each with its owner, due date and completion.';
comment on table public.quality_capa_root_cause_analyses is 'Root cause analysis of a CAPA (1:1): the problem and the root cause; its 5 Whys and Ishikawa causes are child rows.';
comment on table public.quality_capa_root_cause_whys is 'The answers of a CAPA''s 5 Whys, by position (1–5).';
comment on table public.quality_capa_root_cause_factors is 'The Ishikawa causes of a CAPA, by category and position.';
comment on table public.quality_capa_progress is 'Progress notes of a CAPA, by date.';
comment on table public.quality_audit_checklist_items is 'The checklist of an audit: one row per item with its answer, note and the finding a «No» became.';
comment on column public.quality_audit_checklist_items.item_en is 'The item in English, when it differs from item.';
comment on table public.quality_supplier_certifications is 'A supplier''s certificates with their expiry.';
comment on table public.quality_supplier_evaluations is 'A supplier''s yearly evaluations; the scores are quality_supplier_evaluation_scores.';
comment on table public.quality_supplier_evaluation_scores is 'One score (1–5) and weight per criterion of a supplier evaluation.';
comment on table public.quality_supplier_nonconformities is 'A supplier''s nonconformities, open or closed.';

-- Demo seed ---------------------------------------------------------------------------
-- The demo seed writes its CAPAs' steps and analyses into the new tables
-- (20261018120000, the same CAPAs without the jsonb columns), and gives the
-- seeded fall and needlestick their event type and details.

create or replace function private.demo_seed_quality_audits(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := current_date;
  v_now timestamptz := now();
  v_bundle uuid;
  r record;
  v_capa uuid;
begin
  -- Audits ---------------------------------------------------------------------
  insert into public.quality_audits(organization_id, code, title, audit_type, department_id, scope, planned_date, completed_date, status,
    lead_auditor_label, owner_label, owner_labels, history, created_at, updated_at)
  select v_org, 'AUD-' || to_char(d0 + a.pd, 'YYMMDD') || '-' || lpad((90000 + a.n)::text, 6, '0'), a.title, a.kind,
    (select dep.id from public.departments dep where dep.organization_id = v_org and dep.code = a.dep),
    a.scope, d0 + a.pd, case when a.cd is not null then d0 + a.cd end, a.st, a.lead, a.lead, array[a.lead],
    jsonb_build_array(jsonb_build_object('id', 'AUD-demo-' || a.n || '-1', 'at', (d0 + least(a.pd, 0) - 14) + time '09:00', 'action', 'recordCreated',
        'actorId', p_actor::text, 'actor', 'Υπεύθυνη Ποιότητας', 'actorEmail', '', 'reason', null, 'detail', null))
      || case when a.cd is not null then jsonb_build_array(jsonb_build_object('id', 'AUD-demo-' || a.n || '-2', 'at', (d0 + a.cd) + time '14:30', 'action', 'auditCompleted',
        'actorId', p_actor::text, 'actor', a.lead, 'actorEmail', '', 'reason', null, 'detail', null)) else '[]'::jsonb end,
    (d0 + least(a.pd, 0) - 14) + time '09:00', v_now
  from (values
    (1, -75, -74, 'ΠΑΘ', 'Επιθεώρηση υγιεινής χεριών — WHO 5 Moments', 'internal', 'completed', 'Παπαδοπούλου Μαρία',
        'Άμεση παρατήρηση 24 ευκαιριών ανά βάρδια (WHO Hand Hygiene Observation Tool), διαθεσιμότητα αλκοολούχου διαλύματος στο σημείο φροντίδας.'),
    (2, -48, -47, 'ΧΕΙΡ', 'Επιθεώρηση αποστείρωσης χειρουργικών εργαλείων (ΚΑΠ)', 'internal', 'completed', 'Υπεύθυνη Ποιότητας',
        'Ιχνηλασιμότητα σετ εργαλείων, καταγραφή φυσικών / χημικών / βιολογικών δεικτών κλιβάνου, συνθήκες αποθήκευσης αποστειρωμένων.'),
    (3, -20, -19, 'ΜΕΘ', 'Επιθεώρηση δεσμών μέτρων ΜΕΘ (CLABSI / VAP)', 'internal', 'completed', 'Παπαδοπούλου Μαρία',
        'Τήρηση δεσμών εισαγωγής και συντήρησης ΚΦΚ και πρόληψης πνευμονίας από αναπνευστήρα σε όλους τους νοσηλευόμενους της ΜΕΘ.'),
    (4, -3, null, 'ΜΕΘ', 'Επιθεώρηση προφυλάξεων επαφής ΜΕΘ — συρροή KPC', 'internal', 'in_progress', 'Υπεύθυνη Ποιότητας',
        'Έκτακτη επιθεώρηση μετά τη συρροή Klebsiella pneumoniae KPC: σήμανση, ΜΑΠ στην είσοδο, αποκλειστικός εξοπλισμός, καθαρισμός περιβάλλοντος κλίνης.'),
    (5, 10, null, 'ΟΡΘ', 'Επιθεώρηση καθαριότητας θαλάμων με μέτρηση ATP', 'internal', 'planned', 'Οικονόμου Κώστας',
        'Μέτρηση ATP σε 10 επιφάνειες υψηλής επαφής ανά θάλαμο και έλεγχος τήρησης του προγράμματος καθαρισμού (μετά από παράπονο συνοδού).'),
    (6, 21, null, null, 'Εξωτερική επιθεώρηση ΕΟΔΥ — σχέδιο δράσης για τα ανθεκτικά παθογόνα', 'external', 'planned', 'Υπεύθυνη Ποιότητας',
        'Επίσκεψη κλιμακίου ΕΟΔΥ: επιτήρηση CPE, προφυλάξεις επαφής, κατανάλωση αντιβιοτικών, πληρότητα δηλώσεων υποχρεωτικά δηλούμενων νοσημάτων.')
  ) a(n, pd, cd, dep, title, kind, st, lead, scope)
  on conflict (organization_id, code) do nothing;

  -- Findings (from audits and from one incident) --------------------------------
  insert into public.quality_findings(organization_id, code, title, department_id, identified_at, severity, status, description,
    source_type, source_id, owner_label, owner_labels, history, created_at, updated_at)
  select v_org, 'FND-' || to_char(d0 - f.ago, 'YYMMDD') || '-' || lpad((90000 + f.n)::text, 6, '0'), f.title,
    (select dep.id from public.departments dep where dep.organization_id = v_org and dep.code = f.dep),
    (d0 - f.ago) + time '12:00', f.sev, f.st, f.descr, f.src,
    case f.src
      when 'audit' then (select qa.code from public.quality_audits qa where qa.organization_id = v_org and right(qa.code, 2) = lpad(f.ref::text, 2, '0') limit 1)
      when 'incident' then (select qi.code from public.quality_incidents qi where qi.organization_id = v_org and right(qi.code, 2) = lpad(f.ref::text, 2, '0') limit 1)
    end,
    f.owner, array[f.owner],
    jsonb_build_array(jsonb_build_object('id', 'FND-demo-' || f.n, 'at', (d0 - f.ago) + time '12:00', 'action', 'findingCreated',
      'actorId', p_actor::text, 'actor', 'Υπεύθυνη Ποιότητας', 'actorEmail', '', 'reason', null, 'detail', null)),
    (d0 - f.ago) + time '12:00', v_now
  from (values
    (1, 74, 'audit', 1, 'ΠΑΘ', 'Χαμηλή συμμόρφωση στη Στιγμή 2 (πριν από άσηπτο χειρισμό)', 'medium', 'closed', 'Οικονόμου Κώστας',
        'Συμμόρφωση 58% (14/24 ευκαιρίες) πριν από άσηπτους χειρισμούς, έναντι στόχου ≥ 80%. Η συνολική συμμόρφωση του τμήματος ήταν 71%.'),
    (2, 47, 'audit', 2, 'ΧΕΙΡ', 'Ελλιπής τεκμηρίωση βιολογικών δεικτών κλιβάνου', 'medium', 'in_progress', 'Ιωάννου Δήμητρα',
        'Σε 3 από 20 ελεγχθέντες κύκλους αποστείρωσης δεν είχε καταγραφεί το αποτέλεσμα του βιολογικού δείκτη πριν από την αποδέσμευση των εργαλείων.'),
    (3, 47, 'audit', 2, 'ΧΕΙΡ', 'Φθαρμένα περιτυλίγματα σετ εργαλείων στην αποθήκη', 'low', 'closed', 'Μαυρίδου Δήμητρα',
        'Δύο σετ με σκισμένο περιτύλιγμα απομακρύνθηκαν και επαναποστειρώθηκαν επί τόπου· δεν απαιτήθηκε διορθωτική ενέργεια.'),
    (4, 19, 'audit', 3, 'ΜΕΘ', 'Μη τεκμηριωμένη καθημερινή αξιολόγηση ανάγκης ΚΦΚ', 'high', 'in_progress', 'Παπαδοπούλου Μαρία',
        'Σε 5 από 11 ασθενείς με κεντρικό φλεβικό καθετήρα δεν υπήρχε καθημερινή τεκμηρίωση της ανάγκης διατήρησης· 2 γραμμές > 10 ημερών χωρίς αιτιολόγηση.'),
    (5, 19, 'audit', 3, 'ΜΕΘ', 'Ανύψωση κεφαλής κλίνης < 30° σε διασωληνωμένους ασθενείς', 'medium', 'open', 'Παπαδάκη Μαρία',
        '3 από 7 διασωληνωμένους ασθενείς βρέθηκαν με ανύψωση κεφαλής κάτω από 30° (στοιχείο της δέσμης πρόληψης VAP).'),
    (6, 2, 'audit', 4, 'ΜΕΘ', 'Κοινός εξοπλισμός μεταξύ ασθενών με KPC χωρίς απολύμανση', 'high', 'open', 'Παπαδοπούλου Μαρία',
        'Στηθοσκόπιο και περιχειρίδα πιεσόμετρου χρησιμοποιούνταν σε διαδοχικές κλίνες ασθενών της συρροής Klebsiella pneumoniae KPC χωρίς ενδιάμεση απολύμανση.'),
    (7, 2, 'audit', 4, 'ΜΕΘ', 'Ελλείψεις ποδιών μιας χρήσης στην είσοδο θαλάμων απομόνωσης', 'medium', 'in_progress', 'Παπαδάκη Μαρία',
        'Σε 2 από 4 θαλάμους απομόνωσης δεν υπήρχαν διαθέσιμες ποδιές στο τροχήλατο ΜΑΠ κατά τη νυχτερινή βάρδια.'),
    (8, 17, 'incident', 5, 'ΚΑΡΔ', 'Απουσία σήμανσης προφυλάξεων επαφής σε θάλαμο ασθενούς με CPE', 'low', 'closed', 'Βασιλείου Σπύρος',
        'Το εύρημα προέκυψε από τη διερεύνηση του συμβάντος ελλιπούς σήμανσης· αντιμετωπίστηκε με την τυποποίηση των καρτών προφυλάξεων σε όλα τα τμήματα.')
  ) f(n, ago, src, ref, dep, title, sev, st, owner, descr)
  on conflict (organization_id, code) do nothing;

  -- CAPAs raised by findings and by an ICU bundle deviation ---------------------------
  v_bundle := (select b.id from public.prevention_bundle_assessments b
               join public.departments dep on dep.id = b.department_id and dep.code = 'ΜΕΘ'
               where b.organization_id = v_org and b.status = 'completed' and b.assessment_date >= d0 - 30
                 and exists (select 1 from jsonb_each_text(case when jsonb_typeof(b.criteria->'answers') = 'object' then b.criteria->'answers' else '{}'::jsonb end) x where x.value = 'no')
               order by b.assessment_date desc limit 1);

  -- Each CAPA, then its steps and root cause analysis (quality_capa_import_json).
  for r in select * from (values
    (7, 72, 'finding', 1, 'ΠΑΘ', 'Στοχευμένη επανεκπαίδευση στις 5 Στιγμές WHO', 'corrective', 'medium', 'closed', -45, 'effective', 'Οικονόμου Κώστας',
      'Μικροεκπαιδεύσεις 15 λεπτών ανά βάρδια, βάσεις αλκοολούχου διαλύματος σε κάθε κλίνη και επαναληπτικές παρατηρήσεις. Τεκμήρια επαλήθευσης: επαναληπτική παρατήρηση με συμμόρφωση 84% στη Στιγμή 2.',
      jsonb_build_array(
        jsonb_build_object('id','sa-demo-7-1','title','Τοποθέτηση βάσεων αλκοολούχου διαλύματος σε όλες τις κλίνες','owner','Οικονόμου Κώστας','dueDate',to_char(d0-62,'YYYY-MM-DD'),'done',true,'doneAt',(d0-63)+time '10:00','doneBy','Οικονόμου Κώστας'),
        jsonb_build_object('id','sa-demo-7-2','title','Μικροεκπαίδευση 5 Στιγμών σε όλες τις βάρδιες','owner','Σταθόπουλος Κώστας','dueDate',to_char(d0-50,'YYYY-MM-DD'),'done',true,'doneAt',(d0-52)+time '13:00','doneBy','Σταθόπουλος Κώστας'),
        jsonb_build_object('id','sa-demo-7-3','title','Επαναληπτική παρατήρηση υγιεινής χεριών (στόχος ≥ 80%)','owner','Παπαδοπούλου Μαρία','dueDate',to_char(d0-25,'YYYY-MM-DD'),'done',true,'doneAt',(d0-24)+time '12:00','doneBy','Παπαδοπούλου Μαρία'))::text,
      jsonb_build_object('problem','Συμμόρφωση 58% στη Στιγμή 2 (πριν από άσηπτο χειρισμό) στην Παθολογική, έναντι στόχου ≥ 80%.',
        'whys',jsonb_build_array('Παραλείπεται η αντισηψία χεριών πριν από χειρισμούς σε περιφερικούς φλεβοκαθετήρες.','Το αλκοολούχο διάλυμα δεν βρίσκεται στο σημείο φροντίδας σε 6 από 30 κλίνες.','Οι βάσεις δεν αντικαταστάθηκαν μετά την αλλαγή προμηθευτή φιαλών.','Δεν υπάρχει υπεύθυνος για τον έλεγχο διαθεσιμότητας ανά βάρδια.',''),
        'causes',jsonb_build_object('people',jsonb_build_array('Νέο επικουρικό προσωπικό χωρίς εκπαίδευση στις 5 Στιγμές'),'methods',jsonb_build_array('Δεν υπάρχει λίστα ελέγχου διαθεσιμότητας αντισηπτικού'),'equipment',jsonb_build_array('Ασύμβατες βάσεις με τις νέες φιάλες'),'materials',jsonb_build_array(),'environment',jsonb_build_array('Υψηλή πληρότητα κλινών (> 95%)'),'communication',jsonb_build_array('Δεν ενημερώθηκε η ΕΝΛ για την αλλαγή προμηθευτή')),
        'rootCause','Η αλλαγή προμηθευτή αντισηπτικού έγινε χωρίς έλεγχο συμβατότητας των βάσεων, με αποτέλεσμα να λείπει το διάλυμα από το σημείο φροντίδας.',
        'updatedAt',(d0-66)+time '10:30','updatedBy','Παπαδοπούλου Μαρία')::text),
    (8, 45, 'finding', 2, 'ΧΕΙΡ', 'Υποχρεωτική καταγραφή βιολογικού δείκτη πριν από την αποδέσμευση', 'corrective', 'medium', 'in_progress', 7, 'pending', 'Ιωάννου Δήμητρα',
      'Κανένα σετ δεν αποδεσμεύεται χωρίς καταγεγραμμένο αρνητικό βιολογικό δείκτη· προσθήκη πεδίου στο έντυπο ιχνηλασιμότητας.',
      jsonb_build_array(
        jsonb_build_object('id','sa-demo-8-1','title','Αναθεώρηση εντύπου ιχνηλασιμότητας κύκλων κλιβάνου','owner','Ιωάννου Δήμητρα','dueDate',to_char(d0-30,'YYYY-MM-DD'),'done',true,'doneAt',(d0-31)+time '09:30','doneBy','Ιωάννου Δήμητρα'),
        jsonb_build_object('id','sa-demo-8-2','title','Εκπαίδευση προσωπικού ΚΑΠ στη νέα διαδικασία αποδέσμευσης','owner','Μαυρίδου Δήμητρα','dueDate',to_char(d0-14,'YYYY-MM-DD'),'done',true,'doneAt',(d0-15)+time '12:00','doneBy','Μαυρίδου Δήμητρα'),
        jsonb_build_object('id','sa-demo-8-3','title','Δειγματοληπτικός έλεγχος 20 κύκλων μετά την αλλαγή','owner','Υπεύθυνη Ποιότητας','dueDate',to_char(d0+7,'YYYY-MM-DD'),'done',false,'doneAt',null,'doneBy',''))::text,
      jsonb_build_object('problem','3 από 20 κύκλους αποστείρωσης αποδεσμεύτηκαν χωρίς καταγεγραμμένο αποτέλεσμα βιολογικού δείκτη.',
        'whys',jsonb_build_array('Τα εργαλεία αποδεσμεύτηκαν πριν από την ανάγνωση του δείκτη.','Υπήρχε πίεση χρόνου για επείγοντα χειρουργεία.','Δεν υπάρχει εφεδρικό σετ για τις συχνές επεμβάσεις.','','' ),
        'causes',jsonb_build_object('people',jsonb_build_array(),'methods',jsonb_build_array('Το έντυπο δεν έχει υποχρεωτικό πεδίο βιολογικού δείκτη'),'equipment',jsonb_build_array('Επωαστήρας ταχείας ανάγνωσης μόνο ένας'),'materials',jsonb_build_array('Ανεπαρκής αριθμός εφεδρικών σετ'),'environment',jsonb_build_array(),'communication',jsonb_build_array('Δεν προγραμματίζονται οι επείγουσες επεμβάσεις με την ΚΑΠ')),
        'rootCause','','updatedAt',(d0-40)+time '11:00','updatedBy','Ιωάννου Δήμητρα')::text),
    (9, 18, 'finding', 4, 'ΜΕΘ', 'Καθημερινή αξιολόγηση ανάγκης ΚΦΚ (daily line review)', 'preventive', 'high', 'in_progress', 12, 'pending', 'Παπαδοπούλου Μαρία',
      'Καθημερινή λίστα ελέγχου στην πρωινή επίσκεψη για κάθε ΚΦΚ: ένδειξη, ημέρες καθετήρα, κατάσταση επιδέσμου· άμεση αφαίρεση όταν δεν χρειάζεται.',
      jsonb_build_array(
        jsonb_build_object('id','sa-demo-9-1','title','Σύνταξη λίστας ελέγχου daily line review','owner','Παπαδοπούλου Μαρία','dueDate',to_char(d0-10,'YYYY-MM-DD'),'done',true,'doneAt',(d0-11)+time '14:00','doneBy','Παπαδοπούλου Μαρία'),
        jsonb_build_object('id','sa-demo-9-2','title','Ενσωμάτωση στην πρωινή ιατρική επίσκεψη','owner','Αντωνίου Μαρία','dueDate',to_char(d0-3,'YYYY-MM-DD'),'done',false,'doneAt',null,'doneBy',''),
        jsonb_build_object('id','sa-demo-9-3','title','Εβδομαδιαία αναφορά ημερών ΚΦΚ στην ΕΝΛ','owner','Παπαδάκη Μαρία','dueDate',to_char(d0+5,'YYYY-MM-DD'),'done',false,'doneAt',null,'doneBy',''),
        jsonb_build_object('id','sa-demo-9-4','title','Επαναληπτική επιθεώρηση δέσμης ΚΦΚ','owner','Υπεύθυνη Ποιότητας','dueDate',to_char(d0+12,'YYYY-MM-DD'),'done',false,'doneAt',null,'doneBy',''))::text,
      null::text),
    (10, 1, 'finding', 6, 'ΜΕΘ', 'Αποκλειστικός εξοπλισμός ανά ασθενή με CPE / KPC', 'corrective', 'critical', 'open', 5, 'pending', 'Παπαδοπούλου Μαρία',
      'Στο πλαίσιο της συρροής Klebsiella pneumoniae KPC στη ΜΕΘ: αποκλειστικό στηθοσκόπιο, περιχειρίδα και θερμόμετρο ανά κλίνη ασθενούς με CPE, απολύμανση κοινού εξοπλισμού μετά από κάθε χρήση.',
      jsonb_build_array(
        jsonb_build_object('id','sa-demo-10-1','title','Προμήθεια ατομικών στηθοσκοπίων και περιχειρίδων μιας χρήσης','owner','Υπεύθυνη Ποιότητας','dueDate',to_char(d0+2,'YYYY-MM-DD'),'done',false,'doneAt',null,'doneBy',''),
        jsonb_build_object('id','sa-demo-10-2','title','Ενημέρωση όλων των βαρδιών για τις προφυλάξεις επαφής στη συρροή','owner','Παπαδοπούλου Μαρία','dueDate',to_char(d0+1,'YYYY-MM-DD'),'done',false,'doneAt',null,'doneBy',''),
        jsonb_build_object('id','sa-demo-10-3','title','Καθημερινός έλεγχος τήρησης για 2 εβδομάδες','owner','Παπαδάκη Μαρία','dueDate',to_char(d0+14,'YYYY-MM-DD'),'done',false,'doneAt',null,'doneBy',''))::text,
      jsonb_build_object('problem','Διασπορά Klebsiella pneumoniae KPC μεταξύ ασθενών της ΜΕΘ· κοινός εξοπλισμός μεταξύ κλινών χωρίς απολύμανση.',
        'whys',jsonb_build_array('Ο εξοπλισμός μεταφέρεται από κλίνη σε κλίνη.','Δεν υπάρχει ατομικός εξοπλισμός για τους ασθενείς σε απομόνωση.','','',''),
        'causes',jsonb_build_object('people',jsonb_build_array('Υψηλός φόρτος εργασίας νυχτερινής βάρδιας'),'methods',jsonb_build_array('Το πρωτόκολλο απομόνωσης δεν ορίζει αποκλειστικό εξοπλισμό'),'equipment',jsonb_build_array('Ένα στηθοσκόπιο ανά θάλαμο 4 κλινών'),'materials',jsonb_build_array('Έλλειψη υφασμάτων απολύμανσης στο τροχήλατο'),'environment',jsonb_build_array(),'communication',jsonb_build_array()),
        'rootCause','','updatedAt',(d0-1)+time '16:00','updatedBy','Υπεύθυνη Ποιότητας')::text),
    (11, 6, 'bundle', null, 'ΜΕΘ', 'Διορθωτική ενέργεια: απόκλιση δέσμης μέτρων ΜΕΘ', 'corrective', 'high', 'in_progress', 9, 'pending', 'Παπαδάκη Μαρία',
      'Αξιολόγηση δέσμης μέτρων στη ΜΕΘ με κριτήρια που δεν τηρήθηκαν. Επανεκπαίδευση της βάρδιας και επαναληπτική αξιολόγηση.',
      jsonb_build_array(
        jsonb_build_object('id','sa-demo-11-1','title','Συζήτηση της απόκλισης στην αναφορά βάρδιας','owner','Παπαδάκη Μαρία','dueDate',to_char(d0-4,'YYYY-MM-DD'),'done',true,'doneAt',(d0-5)+time '08:00','doneBy','Παπαδάκη Μαρία'),
        jsonb_build_object('id','sa-demo-11-2','title','Επαναληπτική αξιολόγηση δέσμης σε 10 ασθενείς','owner','Παπαδοπούλου Μαρία','dueDate',to_char(d0+9,'YYYY-MM-DD'),'done',false,'doneAt',null,'doneBy',''))::text,
      null::text)
  ) c(n, ago, src, ref, dep, title, kind, pri, st, due, eff, owner, descr, steps, rca)
    where c.src <> 'bundle' or v_bundle is not null loop
  insert into public.quality_capa_actions(organization_id, code, title, department_id, source_type, source_id, action_type, priority, status, description,
    due_date, effectiveness_due, effectiveness_status, verified_by, verified_at, owner_label, owner_labels, history, created_at, updated_at)
  select v_org, 'CAPA-' || to_char(d0 - r.ago, 'YYMMDD') || '-' || lpad((90000 + r.n)::text, 6, '0'), r.title,
    (select dep.id from public.departments dep where dep.organization_id = v_org and dep.code = r.dep),
    r.src,
    case when r.src = 'finding' then (select qf.code from public.quality_findings qf where qf.organization_id = v_org and right(qf.code, 2) = lpad(r.ref::text, 2, '0') limit 1)
         else 'BND-' || v_bundle::text end,
    r.kind, r.pri, r.st, r.descr, d0 + r.due, d0 + r.due + 30,
    r.eff, case when r.eff = 'effective' then p_actor end, case when r.eff = 'effective' then (d0 + r.due + 25) + time '11:00' end,
    r.owner, array[r.owner, 'Υπεύθυνη Ποιότητας'],
    jsonb_build_array(jsonb_build_object('id', 'CAPA-demo-' || r.n, 'at', (d0 - r.ago) + time '10:00', 'action', 'capaAssigned',
      'actorId', p_actor::text, 'actor', 'Υπεύθυνη Ποιότητας', 'actorEmail', '', 'reason', null, 'detail', null)),
    (d0 - r.ago) + time '10:00', v_now
  on conflict (organization_id, code) do nothing
  returning id into v_capa;
  if v_capa is not null then
    perform private.quality_capa_import_json(v_capa, r.steps::jsonb, r.rca::jsonb);
  end if;
  end loop;

  -- Explicit links (audit → finding → CAPA, incident → finding / CAPA) ---------------
  if not exists (select 1 from public.quality_record_links l where l.organization_id = v_org) then
    insert into public.quality_record_links(organization_id, source_type, source_id, target_type, target_id, relationship, created_by, created_at)
    select v_org, 'audit', qf.source_id, 'finding', qf.code, 'raised_finding', p_actor, qf.identified_at
    from public.quality_findings qf where qf.organization_id = v_org and qf.source_type = 'audit' and qf.source_id is not null
    union all
    select v_org, 'incident', qf.source_id, 'finding', qf.code, 'raised_finding', p_actor, qf.identified_at
    from public.quality_findings qf where qf.organization_id = v_org and qf.source_type = 'incident' and qf.source_id is not null
    union all
    select v_org, qc.source_type, qc.source_id, 'capa', qc.code, 'addressed_by', p_actor, qc.created_at
    from public.quality_capa_actions qc where qc.organization_id = v_org and qc.source_type in ('finding', 'incident') and qc.source_id is not null;
  end if;
end;
$function$;

create or replace function private.demo_seed_quality_enrich(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := current_date;
  v_icu_case uuid;
  v_icu_case2 uuid;
  v_cpe_case uuid;
  v_med_case uuid;
  v_med_patient uuid;
  r record;
  v_capa uuid;
begin
  v_icu_case := (select sc.id from public.surveillance_cases sc join public.departments dep on dep.id = sc.department_id and dep.code = 'ΜΕΘ'
                 where sc.organization_id = v_org and sc.status = 'active' order by sc.started_at, sc.id limit 1);
  v_icu_case2 := (select sc.id from public.surveillance_cases sc join public.departments dep on dep.id = sc.department_id and dep.code = 'ΜΕΘ'
                  where sc.organization_id = v_org and sc.status = 'active' and sc.id is distinct from v_icu_case order by sc.started_at desc, sc.id limit 1);
  -- the cardiology case with the resistant Klebsiella isolate (CPE signage incident)
  v_cpe_case := (select ls.surveillance_case_id from public.laboratory_samples ls
                 join public.microbiology_results mr on mr.sample_id = ls.id and mr.result_status = 'positive' and mr.organism ilike 'klebsiella%' and mr.resistance_class is not null
                 join public.departments dep on dep.id = ls.department_id and dep.code = 'ΚΑΡΔ'
                 where ls.organization_id = v_org and ls.surveillance_case_id is not null order by ls.collected_at limit 1);
  v_med_case := (select sc.id from public.surveillance_cases sc join public.departments dep on dep.id = sc.department_id and dep.code = 'ΠΑΘ'
                 where sc.organization_id = v_org order by sc.started_at, sc.id limit 1);
  v_med_patient := (select p.id from public.patients p join public.departments dep on dep.id = p.department_id and dep.code = 'ΠΑΘ'
                    where p.organization_id = v_org and p.status = 'active' order by p.patient_code desc limit 1);

  -- Incidents: investigation, time, links ---------------------------------------
  update public.quality_incidents qi set
    event_time = i.t::time,
    immediate_actions = i.imm,
    root_cause = nullif(i.rc, ''),
    contributing_factors = nullif(i.cf, ''),
    owner_labels = array[i.owner, 'Υπεύθυνη Ποιότητας'],
    owner_label = i.owner,
    reported_by_label = i.rep,
    linked_surveillance_id = case i.link when 'icu' then v_icu_case when 'icu2' then v_icu_case2 when 'cpe' then v_cpe_case when 'med' then v_med_case end,
    linked_patient_id = case i.link
      when 'icu' then (select sc.patient_id from public.surveillance_cases sc where sc.id = v_icu_case)
      when 'icu2' then coalesce((select sc.patient_id from public.surveillance_cases sc where sc.id = v_icu_case2),
        (select p.id from public.patients p join public.departments dep on dep.id = p.department_id and dep.code = 'ΜΕΘ'
         where p.organization_id = v_org and p.status = 'active' and p.id is distinct from (select sc.patient_id from public.surveillance_cases sc where sc.id = v_icu_case)
         order by p.admission_date, p.patient_code limit 1))
      when 'cpe' then (select sc.patient_id from public.surveillance_cases sc where sc.id = v_cpe_case)
      when 'med' then (select sc.patient_id from public.surveillance_cases sc where sc.id = v_med_case)
      when 'medp' then v_med_patient end,
    history = jsonb_build_array(jsonb_build_object('id', 'INC-demo-' || i.n || '-1', 'at', qi.occurred_at + interval '40 minutes', 'action', 'incidentReported',
        'actorId', p_actor::text, 'actor', i.rep, 'actorEmail', '', 'reason', null, 'detail', null))
      || case when qi.status = 'closed' then jsonb_build_array(jsonb_build_object('id', 'INC-demo-' || i.n || '-2', 'at', qi.occurred_at + interval '9 days', 'action', 'incidentClosed',
        'actorId', p_actor::text, 'actor', 'Υπεύθυνη Ποιότητας', 'actorEmail', '', 'reason', null, 'detail', null)) else '[]'::jsonb end,
    updated_at = now()
  from (values
    (1, '03:40', 'Οικονόμου Κώστας', 'Παπαδάκη Μαρία', 'icu',
      'Κλινική εξέταση από εφημερεύοντα ιατρό, αξονική εγκεφάλου (χωρίς ευρήματα), ενημέρωση οικογένειας, ανύψωση πλαϊνών κιγκλιδωμάτων.',
      'Δεν είχε γίνει εκτίμηση κινδύνου πτώσης (κλίμακα Morse) κατά τη μεταφορά του ασθενούς από την Παθολογική.',
      'Νυχτερινή βάρδια με 1 νοσηλευτή ανά 4 ασθενείς· ηρεμιστικά τις προηγούμενες ώρες· συναγερμός κλίνης απενεργοποιημένος.'),
    (2, '21:10', 'Σταθόπουλος Κώστας', 'Οικονόμου Κώστας', 'medp',
      'Διακοπή της επόμενης δόσης, μέτρηση κατώτατων επιπέδων βανκομυκίνης και κρεατινίνης, ενημέρωση θεράποντος και φαρμακείου.',
      '', ''),
    (3, '06:30', 'Ιωάννου Δήμητρα', 'Μαυρίδου Δήμητρα', null,
      'Καραντίνα των εμβολίων, επικοινωνία με τον παρασκευαστή για τη σταθερότητα, μεταφορά σε εφεδρικό ψυγείο.',
      'Ο θερμοστάτης του ψυγείου απορρύθμισε μετά από διακοπή ρεύματος και δεν υπήρχε συναγερμός θερμοκρασίας.',
      'Ο έλεγχος θερμοκρασίας γινόταν χειροκίνητα μία φορά ανά βάρδια· το ψυγείο δεν ήταν συνδεδεμένο σε UPS.'),
    (4, '14:20', 'Παπαδοπούλου Μαρία', 'Αντωνίου Μαρία', null,
      'Πλύση με νερό και σαπούνι, δήλωση στην Ιατρική Εργασίας, έλεγχος ορολογίας πηγής και εργαζόμενης, προφύλαξη μετά από έκθεση εντός 2 ωρών.',
      'Επανατοποθέτηση καλύμματος σε χρησιμοποιημένη βελόνα (recapping) λόγω υπερπλήρους περιέκτη αιχμηρών.',
      'Περιέκτης αιχμηρών πάνω από τη γραμμή πλήρωσης· έλλειψη βελονών ασφαλείας στο τμήμα τη συγκεκριμένη εβδομάδα.'),
    (5, '10:05', 'Βασιλείου Σπύρος', 'Δημητρίου Σπύρος', 'cpe',
      'Άμεση τοποθέτηση κάρτας προφυλάξεων επαφής και ενημέρωση προσωπικού και επισκεπτών.',
      'Δεν υπήρχαν διαθέσιμες τυποποιημένες κάρτες προφυλάξεων στο τμήμα και η σήμανση γινόταν χειρόγραφα.',
      'Η εισαγωγή έγινε απόγευμα Παρασκευής· το αποτέλεσμα της καλλιέργειας κοινοποιήθηκε τηλεφωνικά χωρίς γραπτή ειδοποίηση.'),
    (6, '17:45', 'Οικονόμου Κώστας', 'Παπαδάκη Μαρία', null,
      'Έκτακτος καθαρισμός του χώρου και ενημέρωση της εταιρείας καθαριότητας.',
      '', ''),
    (7, '11:50', 'Οικονόμου Κώστας', 'Κωνσταντίνου Κώστας', null,
      'Αντικατάσταση της αντλίας, απομάκρυνση από τη χρήση και αποστολή στη Βιοϊατρική Τεχνολογία.',
      'Αποτυχία της μπαταρίας του συναγερμού λόγω καθυστερημένης προληπτικής συντήρησης.',
      'Το πρόγραμμα συντήρησης δεν περιλάμβανε τις αντλίες που μεταφέρθηκαν από άλλο τμήμα.'),
    (8, '08:15', 'Σταθόπουλος Κώστας', 'Οικονόμου Κώστας', 'med',
      'Επανάληψη αιμοκαλλιέργειας πριν από την έναρξη αντιβιοτικού και ενημέρωση του εργαστηρίου.',
      'Δεν υπήρχε προγραμματισμένη διακομιδή δειγμάτων στο εργαστήριο κατά την αλλαγή βάρδιας.',
      'Μη διαθεσιμότητα τραυματιοφορέα· δεν υπάρχει πνευματικό ταχυδρομείο στην πτέρυγα.'),
    (9, '15:30', 'Παπαδοπούλου Μαρία', 'Αντωνίου Μαρία', 'icu2',
      'Πίεση στο σημείο εισόδου, αφαίρεση του καθετήρα, τοποθέτηση νέου ΚΦΚ με πλήρη άσηπτη τεχνική, λήψη αιμοκαλλιεργειών.',
      'Ο ΚΦΚ δεν ήταν στερεωμένος με συσκευή στερέωσης χωρίς ράμματα και η γραμμή δεν ελέγχθηκε πριν από τη μετακίνηση για αξονική.',
      'Μετακίνηση με 2 άτομα αντί για 3· μεγάλο μήκος προεκτάσεων· απουσία λίστας ελέγχου ενδονοσοκομειακής μεταφοράς.'),
    (10, '12:40', 'Ιωάννου Δήμητρα', 'Ιωάννου Δήμητρα', null,
      'Άμεση αναπλήρωση των διανομέων από την αποθήκη του τμήματος.',
      'Δεν είχε οριστεί υπεύθυνος για τον καθημερινό έλεγχο των διανομέων στους διαδρόμους.',
      'Καθυστέρηση παραγγελίας από την αποθήκη· αυξημένη κατανάλωση λόγω επίσκεψης ελέγχου.')
  ) i(n, t, owner, rep, link, imm, rc, cf)
  where qi.organization_id = v_org and right(qi.code, 2) = lpad(i.n::text, 2, '0');

  -- Event type and details of the fall (incident 1) and the needlestick (incident 4).
  update public.quality_incidents qi set event_type = 'injury_fall_exposure'
  where qi.organization_id = v_org and right(qi.code, 2) in ('01', '04') and qi.event_type is null;
  insert into public.quality_incident_falls(incident_id, organization_id, fall_type, floor_condition, bed_rails, location, examined_by_doctor,
    doctor_instructions, injury_category, injury_subcategory, injured_person_type, injury_description)
  select qi.id, v_org, f.fall_type, f.floor_condition, f.bed_rails, f.location, f.examined, f.instructions, f.category, f.subcategory, f.person, f.description
  from (values
    ('01', 'fall', 'dry', 'not_in_use', 'Θάλαμος, δίπλα στην κλίνη', true, 'Αξονική εγκεφάλου, νευρολογική παρακολούθηση ανά 2 ώρες για 24 ώρες.', 'injury', 'fall', 'patient', 'Μώλωπας στο δεξί ισχίο, χωρίς κάταγμα.'),
    ('04', null, null, null, 'Θάλαμος 3, τροχήλατο νοσηλείας', true, 'Ορολογικός έλεγχος πηγής και εργαζόμενης, προφύλαξη μετά από έκθεση.', 'injury', 'sharp_object', 'employee', 'Νυγμός στον δείκτη του αριστερού χεριού.')
  ) f(n, fall_type, floor_condition, bed_rails, location, examined, instructions, category, subcategory, person, description)
  join public.quality_incidents qi on qi.organization_id = v_org and right(qi.code, 2) = f.n
  on conflict (incident_id) do nothing;
  insert into public.quality_incident_sharps(incident_id, organization_id, tool, tool_state, body_site, contact_duration, exposed_body_part, substance)
  select qi.id, v_org, 'needle', 'used', 'hands', 'Στιγμιαία', 'Δέρμα δακτύλου', 'Αίμα'
  from public.quality_incidents qi where qi.organization_id = v_org and right(qi.code, 2) = '04'
  on conflict (incident_id) do nothing;

  -- The 6 seeded CAPAs: steps, root cause analysis, effectiveness ------------------
  for r in select * from (values
    (1, 'Οικονόμου Κώστας', 'pending',
      'Εφαρμογή κλίμακας Morse σε κάθε εισαγωγή και μεταφορά, πλαϊνά κιγκλιδώματα και συναγερμός κλίνης για ασθενείς υψηλού κινδύνου.',
      jsonb_build_array(
        jsonb_build_object('id','sa-demo-c1-1','title','Ενσωμάτωση κλίμακας Morse στο έντυπο εισαγωγής','owner','Οικονόμου Κώστας','dueDate',to_char(d0-1,'YYYY-MM-DD'),'done',true,'doneAt',(d0-1)+time '12:00','doneBy','Οικονόμου Κώστας'),
        jsonb_build_object('id','sa-demo-c1-2','title','Έλεγχος λειτουργίας συναγερμών κλίνης στη ΜΕΘ','owner','Παπαδάκη Μαρία','dueDate',to_char(d0+2,'YYYY-MM-DD'),'done',true,'doneAt',(d0)+time '09:00','doneBy','Παπαδάκη Μαρία'),
        jsonb_build_object('id','sa-demo-c1-3','title','Εκπαίδευση νυχτερινής βάρδιας στην πρόληψη πτώσεων','owner','Παπαδοπούλου Μαρία','dueDate',to_char(d0+7,'YYYY-MM-DD'),'done',false,'doneAt',null,'doneBy',''),
        jsonb_build_object('id','sa-demo-c1-4','title','Μηνιαίος έλεγχος τεκμηρίωσης Morse (10 φάκελοι)','owner','Υπεύθυνη Ποιότητας','dueDate',to_char(d0+10,'YYYY-MM-DD'),'done',false,'doneAt',null,'doneBy','')),
      jsonb_build_object('problem','Πτώση ηλικιωμένου ασθενούς από την κλίνη στη ΜΕΘ κατά τη νυχτερινή βάρδια.',
        'whys',jsonb_build_array('Ο ασθενής προσπάθησε να σηκωθεί μόνος του.','Τα πλαϊνά κιγκλιδώματα ήταν κατεβασμένα και ο συναγερμός κλίνης ανενεργός.','Δεν είχε αναγνωριστεί ως υψηλού κινδύνου για πτώση.','Δεν έγινε εκτίμηση Morse κατά τη μεταφορά από την Παθολογική.','Η εκτίμηση κινδύνου δεν είναι υποχρεωτικό πεδίο στη μεταφορά.'),
        'causes',jsonb_build_object('people',jsonb_build_array('Κόπωση νυχτερινής βάρδιας'),'methods',jsonb_build_array('Η κλίμακα Morse δεν επαναλαμβάνεται στη μεταφορά'),'equipment',jsonb_build_array('Συναγερμός κλίνης απενεργοποιημένος'),'materials',jsonb_build_array('Ηρεμιστικά τις προηγούμενες ώρες'),'environment',jsonb_build_array('Χαμηλός φωτισμός θαλάμου'),'communication',jsonb_build_array('Ελλιπής παράδοση στη μεταφορά')),
        'rootCause','Η εκτίμηση κινδύνου πτώσης δεν επαναλαμβάνεται όταν ο ασθενής μεταφέρεται μεταξύ τμημάτων.',
        'updatedAt',(d0-2)+time '12:00','updatedBy','Υπεύθυνη Ποιότητας')),
    (2, 'Σταθόπουλος Κώστας', 'pending',
      'Διπλή ανεξάρτητη επαλήθευση και υπογραφή για βανκομυκίνη και αμινογλυκοσίδες· επισήμανση στο σύστημα συνταγογράφησης.',
      jsonb_build_array(
        jsonb_build_object('id','sa-demo-c2-1','title','Ορισμός λίστας αντιβιοτικών υψηλού κινδύνου','owner','Σταθόπουλος Κώστας','dueDate',to_char(d0-3,'YYYY-MM-DD'),'done',false,'doneAt',null,'doneBy',''),
        jsonb_build_object('id','sa-demo-c2-2','title','Πεδίο διπλής υπογραφής στο φύλλο χορήγησης','owner','Οικονόμου Κώστας','dueDate',to_char(d0+4,'YYYY-MM-DD'),'done',false,'doneAt',null,'doneBy',''),
        jsonb_build_object('id','sa-demo-c2-3','title','Ενημέρωση νοσηλευτών Παθολογικής','owner','Οικονόμου Κώστας','dueDate',to_char(d0+10,'YYYY-MM-DD'),'done',false,'doneAt',null,'doneBy','')),
      jsonb_build_object('problem','Χορήγηση διπλής δόσης βανκομυκίνης σε ασθενή της Παθολογικής.',
        'whys',jsonb_build_array('Η δόση χορηγήθηκε δύο φορές στην αλλαγή βάρδιας.','Η πρώτη χορήγηση δεν είχε καταγραφεί έγκαιρα.','','',''),
        'causes',jsonb_build_object('people',jsonb_build_array(),'methods',jsonb_build_array('Καμία διπλή επαλήθευση για φάρμακα υψηλού κινδύνου'),'equipment',jsonb_build_array(),'materials',jsonb_build_array(),'environment',jsonb_build_array(),'communication',jsonb_build_array('Προφορική παράδοση βάρδιας')),
        'rootCause','','updatedAt',(d0-4)+time '15:00','updatedBy','Σταθόπουλος Κώστας')),
    (3, 'Ιωάννου Δήμητρα', 'effective',
      'Καταγραφικό θερμοκρασίας με ειδοποίηση SMS και σύνδεση του ψυγείου σε UPS. Τεκμήρια επαλήθευσης: 30 ημέρες καταγραφής χωρίς απόκλιση, δοκιμή συναγερμού στις 2 βάρδιες.',
      jsonb_build_array(
        jsonb_build_object('id','sa-demo-c3-1','title','Εγκατάσταση καταγραφικού με ειδοποίηση SMS','owner','Ιωάννου Δήμητρα','dueDate',to_char(d0-25,'YYYY-MM-DD'),'done',true,'doneAt',(d0-26)+time '11:00','doneBy','Ιωάννου Δήμητρα'),
        jsonb_build_object('id','sa-demo-c3-2','title','Σύνδεση ψυγείου εμβολίων σε UPS','owner','Μαυρίδου Δήμητρα','dueDate',to_char(d0-22,'YYYY-MM-DD'),'done',true,'doneAt',(d0-23)+time '10:00','doneBy','Μαυρίδου Δήμητρα'),
        jsonb_build_object('id','sa-demo-c3-3','title','Επαλήθευση: δοκιμή συναγερμού και ανασκόπηση καταγραφών 30 ημερών','owner','Υπεύθυνη Ποιότητας','dueDate',to_char(d0-20,'YYYY-MM-DD'),'done',true,'doneAt',(d0-20)+time '13:00','doneBy','Υπεύθυνη Ποιότητας')),
      jsonb_build_object('problem','Το ψυγείο εμβολίων της Χειρουργικής ξεπέρασε τους 8°C για 2 ώρες.',
        'whys',jsonb_build_array('Ο θερμοστάτης απορρύθμισε μετά από διακοπή ρεύματος.','Το ψυγείο δεν ήταν συνδεδεμένο σε UPS.','Δεν υπήρχε συναγερμός θερμοκρασίας.','Ο έλεγχος γινόταν μόνο χειροκίνητα ανά βάρδια.',''),
        'causes',jsonb_build_object('people',jsonb_build_array(),'methods',jsonb_build_array('Χειροκίνητη καταγραφή μία φορά ανά βάρδια'),'equipment',jsonb_build_array('Χωρίς καταγραφικό με συναγερμό','Χωρίς UPS'),'materials',jsonb_build_array(),'environment',jsonb_build_array('Διακοπή ρεύματος'),'communication',jsonb_build_array()),
        'rootCause','Η ψυχρή αλυσίδα βασιζόταν μόνο σε χειροκίνητους ελέγχους χωρίς αυτόματο συναγερμό ή εφεδρική τροφοδοσία.',
        'updatedAt',(d0-28)+time '10:00','updatedBy','Ιωάννου Δήμητρα')),
    (4, 'Παπαδοπούλου Μαρία', 'pending',
      'Υποχρεωτική εκπαίδευση στην ασφαλή απόρριψη αιχμηρών και αντικατάσταση με βελόνες ασφαλείας. Σε επαλήθευση: έλεγχος περιεκτών σε 4 εβδομάδες.',
      jsonb_build_array(
        jsonb_build_object('id','sa-demo-c4-1','title','Εκπαίδευση νοσηλευτικού προσωπικού ΜΕΘ (2 κύκλοι)','owner','Παπαδοπούλου Μαρία','dueDate',to_char(d0-6,'YYYY-MM-DD'),'done',true,'doneAt',(d0-7)+time '13:00','doneBy','Παπαδοπούλου Μαρία'),
        jsonb_build_object('id','sa-demo-c4-2','title','Διάθεση βελονών ασφαλείας σε όλα τα τροχήλατα','owner','Παπαδάκη Μαρία','dueDate',to_char(d0-4,'YYYY-MM-DD'),'done',true,'doneAt',(d0-5)+time '09:00','doneBy','Παπαδάκη Μαρία'),
        jsonb_build_object('id','sa-demo-c4-3','title','Επαλήθευση: έλεγχος πλήρωσης περιεκτών αιχμηρών σε 4 εβδομάδες','owner','Υπεύθυνη Ποιότητας','dueDate',to_char(d0-2,'YYYY-MM-DD'),'done',true,'doneAt',(d0-2)+time '12:00','doneBy','Υπεύθυνη Ποιότητας')),
      jsonb_build_object('problem','Νυγμός νοσηλεύτριας της ΜΕΘ κατά την απόρριψη χρησιμοποιημένης βελόνας.',
        'whys',jsonb_build_array('Η νοσηλεύτρια επανατοποθέτησε το κάλυμμα στη βελόνα.','Ο περιέκτης αιχμηρών ήταν υπερπλήρης.','Οι περιέκτες δεν αντικαθίστανται σε σταθερό χρόνο.','Δεν υπήρχαν βελόνες ασφαλείας εκείνη την εβδομάδα.',''),
        'causes',jsonb_build_object('people',jsonb_build_array('Συνήθεια recapping'),'methods',jsonb_build_array('Χωρίς πρόγραμμα αντικατάστασης περιεκτών'),'equipment',jsonb_build_array(),'materials',jsonb_build_array('Έλλειψη βελονών ασφαλείας'),'environment',jsonb_build_array('Περιορισμένος χώρος στο τροχήλατο'),'communication',jsonb_build_array()),
        'rootCause','Απουσία βελονών ασφαλείας και προγράμματος αντικατάστασης περιεκτών, σε συνδυασμό με την πρακτική του recapping.',
        'updatedAt',(d0-10)+time '10:00','updatedBy','Παπαδοπούλου Μαρία')),
    (5, 'Βασιλείου Σπύρος', 'effective',
      'Νέες τυποποιημένες κάρτες προφυλάξεων (επαφής, σταγονιδίων, αερογενούς) σε όλα τα τμήματα. Τεκμήρια επαλήθευσης: έλεγχος 12 θαλάμων απομόνωσης με 100% σωστή σήμανση.',
      jsonb_build_array(
        jsonb_build_object('id','sa-demo-c5-1','title','Σχεδιασμός και εκτύπωση καρτών προφυλάξεων','owner','Υπεύθυνη Ποιότητας','dueDate',to_char(d0-16,'YYYY-MM-DD'),'done',true,'doneAt',(d0-16)+time '10:00','doneBy','Υπεύθυνη Ποιότητας'),
        jsonb_build_object('id','sa-demo-c5-2','title','Διανομή σε όλα τα τμήματα','owner','Βασιλείου Σπύρος','dueDate',to_char(d0-13,'YYYY-MM-DD'),'done',true,'doneAt',(d0-14)+time '11:30','doneBy','Βασιλείου Σπύρος'),
        jsonb_build_object('id','sa-demo-c5-3','title','Επαλήθευση: έλεγχος σήμανσης σε όλους τους θαλάμους απομόνωσης','owner','Παπαδοπούλου Μαρία','dueDate',to_char(d0-12,'YYYY-MM-DD'),'done',true,'doneAt',(d0-12)+time '12:00','doneBy','Παπαδοπούλου Μαρία')),
      jsonb_build_object('problem','Θάλαμος ασθενούς με CPE στην Καρδιολογική χωρίς σήμανση προφυλάξεων επαφής.',
        'whys',jsonb_build_array('Δεν τοποθετήθηκε κάρτα μετά το αποτέλεσμα της καλλιέργειας.','Δεν υπήρχαν διαθέσιμες κάρτες στο τμήμα.','Η σήμανση γινόταν χειρόγραφα κατά περίπτωση.','',''),
        'causes',jsonb_build_object('people',jsonb_build_array(),'methods',jsonb_build_array('Μη τυποποιημένη σήμανση'),'equipment',jsonb_build_array(),'materials',jsonb_build_array('Έλλειψη καρτών'),'environment',jsonb_build_array(),'communication',jsonb_build_array('Τηλεφωνική μόνο κοινοποίηση του αποτελέσματος')),
        'rootCause','Δεν υπήρχε τυποποιημένο υλικό σήμανσης ούτε γραπτή ειδοποίηση του τμήματος για τους φορείς CPE.',
        'updatedAt',(d0-17)+time '09:00','updatedBy','Βασιλείου Σπύρος')),
    (6, 'Παπαδοπούλου Μαρία', 'pending',
      'Έλεγχος στερέωσης ΚΦΚ πριν από κάθε μετακίνηση, συσκευές στερέωσης χωρίς ράμματα και λίστα ελέγχου ενδονοσοκομειακής μεταφοράς.',
      jsonb_build_array(
        jsonb_build_object('id','sa-demo-c6-1','title','Προμήθεια συσκευών στερέωσης ΚΦΚ χωρίς ράμματα','owner','Υπεύθυνη Ποιότητας','dueDate',to_char(d0-20,'YYYY-MM-DD'),'done',true,'doneAt',(d0-22)+time '10:00','doneBy','Υπεύθυνη Ποιότητας'),
        jsonb_build_object('id','sa-demo-c6-2','title','Λίστα ελέγχου ενδονοσοκομειακής μεταφοράς ασθενών ΜΕΘ','owner','Παπαδοπούλου Μαρία','dueDate',to_char(d0-8,'YYYY-MM-DD'),'done',true,'doneAt',(d0-9)+time '14:00','doneBy','Παπαδοπούλου Μαρία'),
        jsonb_build_object('id','sa-demo-c6-3','title','Εκπαίδευση ομάδας μεταφοράς (3 άτομα ανά μετακίνηση)','owner','Αντωνίου Μαρία','dueDate',to_char(d0-2,'YYYY-MM-DD'),'done',false,'doneAt',null,'doneBy',''),
        jsonb_build_object('id','sa-demo-c6-4','title','Έλεγχος 20 μεταφορών με τη νέα λίστα','owner','Παπαδάκη Μαρία','dueDate',to_char(d0+14,'YYYY-MM-DD'),'done',false,'doneAt',null,'doneBy','')),
      jsonb_build_object('problem','Τυχαία αποσύνδεση κεντρικού φλεβικού καθετήρα κατά τη μετακίνηση ασθενούς της ΜΕΘ για αξονική.',
        'whys',jsonb_build_array('Ο καθετήρας τραβήχτηκε κατά τη μεταφορά στο φορείο.','Δεν ήταν στερεωμένος με συσκευή στερέωσης.','Η στερέωση με ράμμα είχε χαλαρώσει και δεν ελέγχθηκε.','Δεν υπάρχει έλεγχος γραμμών πριν από τη μετακίνηση.','Δεν υπάρχει λίστα ελέγχου ενδονοσοκομειακής μεταφοράς.'),
        'causes',jsonb_build_object('people',jsonb_build_array('Μεταφορά με 2 άτομα αντί για 3'),'methods',jsonb_build_array('Χωρίς λίστα ελέγχου μεταφοράς'),'equipment',jsonb_build_array('Χωρίς συσκευές στερέωσης χωρίς ράμματα'),'materials',jsonb_build_array('Μεγάλο μήκος προεκτάσεων'),'environment',jsonb_build_array('Στενός ανελκυστήρας'),'communication',jsonb_build_array('Μη ενημέρωση του Ακτινολογικού για ασθενή με ΚΦΚ')),
        'rootCause','Δεν υπάρχει τυποποιημένη προετοιμασία της ενδονοσοκομειακής μεταφοράς που να περιλαμβάνει τον έλεγχο στερέωσης των γραμμών.',
        'updatedAt',(d0-25)+time '12:00','updatedBy','Παπαδοπούλου Μαρία'))
  ) c(n, owner, eff, descr, steps, rca) loop
    for v_capa in update public.quality_capa_actions qc set
    owner_label = r.owner,
    owner_labels = array[r.owner, 'Υπεύθυνη Ποιότητας'],
    description = r.descr,
    effectiveness_status = r.eff,
    verified_by = case when r.eff = 'effective' then p_actor end,
    verified_at = case when r.eff = 'effective' then (qc.due_date + 25) + time '11:00' end,
    created_at = to_date(substr(qc.code, 6, 6), 'YYMMDD') + time '10:00',
    history = jsonb_build_array(jsonb_build_object('id', 'CAPA-demo-' || r.n || '-1', 'at', to_date(substr(qc.code, 6, 6), 'YYMMDD') + time '10:00', 'action', 'capaAssigned',
        'actorId', p_actor::text, 'actor', 'Υπεύθυνη Ποιότητας', 'actorEmail', '', 'reason', null, 'detail', null))
      || case when qc.status in ('verification', 'closed') then jsonb_build_array(jsonb_build_object('id', 'CAPA-demo-' || r.n || '-2', 'at', (qc.due_date) + time '13:00', 'action', 'recordUpdated',
        'actorId', p_actor::text, 'actor', 'Υπεύθυνη Ποιότητας', 'actorEmail', '', 'reason', null, 'detail', jsonb_build_object('field', 'status'))) else '[]'::jsonb end,
    updated_at = now()
  where qc.organization_id = v_org and qc.source_type = 'incident'
    and right(qc.code, 2) = lpad(r.n::text, 2, '0')
    returning qc.id loop
      perform private.quality_capa_import_json(v_capa, r.steps, r.rca);
    end loop;
  end loop;
end;
$function$;
