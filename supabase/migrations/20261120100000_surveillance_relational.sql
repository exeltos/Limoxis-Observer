-- Infection surveillance, clinical assessment and laboratory records: every
-- value in a column of its own. Part 1 of 2 (additive; the JSON columns stay
-- until 20261120100100_surveillance_relational_json_retired.sql removes them).
--
-- A. A surveillance case keeps what its start event carried in
--    surveillance_events.payload {reviewDue, room, reason, reasonEn,
--    suspectedSource, detail} and the «isolation not required» decision
--    {required, detail} in columns: surveillance_cases.review_due_on, room,
--    reason, reason_en, suspected_source, isolation_required,
--    isolation_decided_at, isolation_decided_by; the event keeps its detail
--    («created», «updated», «no») in surveillance_events.detail. Events stay the
--    case's timeline.
-- B. clinical_assessments.signs_symptoms / risk_factors (text arrays) become
--    clinical_assessment_findings: one row per sign, laboratory sign or risk
--    factor, in its list order, with an optional code, a text / numeric / yes-no
--    value and when it was observed (FileMaker records fever readings, yes / no
--    answers and dates there).
-- C. hai_classifications.criteria_evidence becomes hai_classification_criteria
--    (the criteria ticked, in order); isolation_episodes.precautions becomes
--    isolation_episode_precautions.
-- D. Laboratory. microbiology_result_organisms holds one row per organism of a
--    result, in the order of the result's organism label (the label stays: the
--    analysis, cluster and indicator functions and the immutability of validated
--    results read it; the rows are kept equal to it by the database and cannot
--    be written by clients). microbiology_results.organisms (always empty) goes
--    in part 2. amr_classifications.calculation_snapshot becomes mechanism,
--    categories_tested and amr_classification_categories (each antimicrobial
--    category with whether the isolate was susceptible).
-- E. Columns the FileMaker infection records need: surveillance_cases.case_kind
--    (infection, blood culture, MDR screening on admission, neonatal),
--    hospital_acquired, sepsis_severity, final_diagnosis;
--    surveillance_case_infection_types (the infection types recorded, several per
--    case); surveillance_surgical_procedures; surveillance_neonatal_details;
--    patient_admissions.case_number; laboratory_samples.environmental_position,
--    sampling_round, scheduled_check; employee_certificates.document_type,
--    cme_credits; hand_hygiene_sessions.people_observed; notifiable disease
--    reports that come from a clinical notification rather than a laboratory
--    finding (source, patient, department, disease label, deadline, doctor).
--
-- Until part 2 runs, rows still written in the earlier JSON shape (an
-- application version from before this change) are copied into the new columns
-- and rows by the *_legacy triggers below, so nothing is lost while the
-- application is being deployed. The copy of the existing rows is verified field
-- by field; any difference raises and rolls the migration back.
--
-- Every new table: organization_id, a composite foreign key to its parent's
-- (id, organization_id), created/updated at/by kept by
-- public.set_repository_audit_fields() (added after the copy), indexes on the
-- foreign keys, row-level security as its parent's in the fast-read style, no
-- anon.

-- 0. Parent keys --------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['surveillance_cases','clinical_assessments','hai_classifications','isolation_episodes','microbiology_results','amr_classifications'] loop
    if not exists (select 1 from pg_constraint where conname = t || '_id_organization_key') then
      execute format('alter table public.%I add constraint %I unique (id, organization_id)', t, t || '_id_organization_key');
    end if;
  end loop;
end
$$;

-- A. Surveillance cases and events ---------------------------------------------------

alter table public.surveillance_cases
  add column if not exists case_kind text,
  add column if not exists review_due_on date,
  add column if not exists room text,
  add column if not exists reason text,
  add column if not exists reason_en text,
  add column if not exists suspected_source text,
  add column if not exists isolation_required boolean,
  add column if not exists isolation_decided_at timestamptz,
  add column if not exists isolation_decided_by uuid references auth.users(id),
  add column if not exists hospital_acquired boolean,
  add column if not exists sepsis_severity text,
  add column if not exists final_diagnosis text;
alter table public.surveillance_cases
  add constraint surveillance_cases_case_kind_check check (case_kind is null or case_kind in ('infection','blood_culture','mdr_on_admission','neonatal')),
  add constraint surveillance_cases_suspected_source_check check (suspected_source is null or suspected_source in ('bloodstream','urinary','respiratory','surgicalSite','other')),
  add constraint surveillance_cases_sepsis_severity_check check (sepsis_severity is null or sepsis_severity in ('sepsis','septic_shock')),
  add constraint surveillance_cases_isolation_decision_check check (isolation_decided_at is null or isolation_required is not null);
create index if not exists surveillance_cases_isolation_decided_by_idx on public.surveillance_cases (isolation_decided_by);
comment on column public.surveillance_cases.case_kind is 'What the case is (FileMaker «TypeOFlimoxis»): infection, blood_culture, mdr_on_admission (MDR screening on admission), neonatal. Null for cases opened in Limoxis.';
comment on column public.surveillance_cases.review_due_on is 'Next review date set when the surveillance started (or was last edited).';
comment on column public.surveillance_cases.suspected_source is 'bloodstream, urinary, respiratory, surgicalSite, other; null = under assessment.';
comment on column public.surveillance_cases.isolation_required is 'false when the team recorded that isolation is not required (isolation_decided_at / _by). An isolation episode is the «required» decision.';
comment on column public.surveillance_cases.hospital_acquired is 'FileMaker «Νοσοκομειακή»: the infection was recorded as hospital-acquired.';
comment on column public.surveillance_cases.sepsis_severity is 'FileMaker «Βαρύτητα σήψης»: sepsis or septic_shock.';

alter table public.surveillance_events add column if not exists detail text;
comment on column public.surveillance_events.detail is 'Short timeline detail of the event (created, updated, no, …).';

-- B. Clinical assessment findings ------------------------------------------------------

create table public.clinical_assessment_findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assessment_id uuid not null,
  kind text not null check (kind in ('sign','lab_sign','risk_factor')),
  position integer not null check (position >= 1),
  label text not null check (btrim(label) <> ''),
  code text,
  value_text text,
  value_numeric numeric,
  value_boolean boolean,
  observed_at timestamptz,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  foreign key (assessment_id, organization_id) references public.clinical_assessments(id, organization_id) on delete cascade,
  unique (assessment_id, kind, position)
);
create index clinical_assessment_findings_org_idx on public.clinical_assessment_findings (organization_id);
create index clinical_assessment_findings_parent_idx on public.clinical_assessment_findings (assessment_id, organization_id);
create index clinical_assessment_findings_code_idx on public.clinical_assessment_findings (organization_id, kind, code) where code is not null;
comment on table public.clinical_assessment_findings is 'Signs (sign), laboratory signs (lab_sign) and risk factors (risk_factor) of a clinical assessment, in list order. label is the wording shown; code, value_* and observed_at are filled when the source recorded them.';

-- C. HAI criteria and isolation precautions ----------------------------------------------

create table public.hai_classification_criteria (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hai_classification_id uuid not null,
  position integer not null check (position >= 1),
  criterion_id text not null check (btrim(criterion_id) <> ''),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  foreign key (hai_classification_id, organization_id) references public.hai_classifications(id, organization_id) on delete cascade,
  unique (hai_classification_id, position)
);
create index hai_classification_criteria_org_idx on public.hai_classification_criteria (organization_id);
create index hai_classification_criteria_parent_idx on public.hai_classification_criteria (hai_classification_id, organization_id);

create table public.isolation_episode_precautions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  isolation_episode_id uuid not null,
  position integer not null check (position >= 1),
  precaution text not null check (btrim(precaution) <> ''),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  foreign key (isolation_episode_id, organization_id) references public.isolation_episodes(id, organization_id) on delete cascade,
  unique (isolation_episode_id, position)
);
create index isolation_episode_precautions_org_idx on public.isolation_episode_precautions (organization_id);
create index isolation_episode_precautions_parent_idx on public.isolation_episode_precautions (isolation_episode_id, organization_id);

-- D. Laboratory ---------------------------------------------------------------------------

create table public.microbiology_result_organisms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  microbiology_result_id uuid not null,
  position integer not null check (position >= 1),
  organism text not null check (btrim(organism) <> ''),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  foreign key (microbiology_result_id, organization_id) references public.microbiology_results(id, organization_id) on delete cascade,
  unique (microbiology_result_id, position)
);
create index microbiology_result_organisms_org_idx on public.microbiology_result_organisms (organization_id);
create index microbiology_result_organisms_parent_idx on public.microbiology_result_organisms (microbiology_result_id, organization_id);
create index microbiology_result_organisms_name_idx on public.microbiology_result_organisms (organization_id, lower(organism));
comment on table public.microbiology_result_organisms is 'One row per organism of a microbiology result, in the order of microbiology_results.organism (the label shown). Kept equal to the label by private.microbiology_result_organisms_sync(); clients only read it.';

alter table public.amr_classifications
  add column if not exists mechanism text,
  add column if not exists categories_tested integer check (categories_tested is null or categories_tested >= 0);
comment on column public.amr_classifications.mechanism is 'Resistance mechanism behind the classification (KPC, NDM, OXA-48, ESBL, …).';

create table public.amr_classification_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  amr_classification_id uuid not null,
  susceptible boolean not null,
  position integer not null check (position >= 1),
  category text not null check (btrim(category) <> ''),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  foreign key (amr_classification_id, organization_id) references public.amr_classifications(id, organization_id) on delete cascade,
  unique (amr_classification_id, susceptible, position),
  unique (amr_classification_id, category)
);
create index amr_classification_categories_org_idx on public.amr_classification_categories (organization_id);
create index amr_classification_categories_parent_idx on public.amr_classification_categories (amr_classification_id, organization_id);
comment on table public.amr_classification_categories is 'The antimicrobial categories an AMR classification counted: susceptible = false for the non-susceptible ones, in their order.';

-- E. FileMaker infection records ---------------------------------------------------------

create table public.surveillance_case_infection_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  surveillance_case_id uuid not null,
  position integer not null check (position >= 1),
  infection_type text not null check (infection_type in ('urinary_tract','pneumonia','ventilator_pneumonia','central_line_bloodstream',
    'primary_bloodstream','secondary_bloodstream','surgical_site','soft_tissue','gastrointestinal','thrombophlebitis','fever','other')),
  label text not null check (btrim(label) <> ''),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  foreign key (surveillance_case_id, organization_id) references public.surveillance_cases(id, organization_id) on delete cascade,
  unique (surveillance_case_id, position)
);
create index surveillance_case_infection_types_org_idx on public.surveillance_case_infection_types (organization_id, infection_type);
create index surveillance_case_infection_types_parent_idx on public.surveillance_case_infection_types (surveillance_case_id, organization_id);
comment on table public.surveillance_case_infection_types is 'The infection types recorded for a case (FileMaker «Είδος λοίμωξης», several per case): a code and the recorded wording.';

create table public.surveillance_surgical_procedures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  surveillance_case_id uuid not null,
  position integer not null check (position >= 1),
  performed_on date,
  description text,
  antibiotic_prophylaxis boolean,
  reoperation boolean,
  devices_added boolean,
  devices_added_details text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  foreign key (surveillance_case_id, organization_id) references public.surveillance_cases(id, organization_id) on delete cascade,
  unique (surveillance_case_id, position)
);
create index surveillance_surgical_procedures_org_idx on public.surveillance_surgical_procedures (organization_id);
create index surveillance_surgical_procedures_parent_idx on public.surveillance_surgical_procedures (surveillance_case_id, organization_id);
comment on table public.surveillance_surgical_procedures is 'Operations of the patient that a case records: date, operation, antibiotic prophylaxis, re-operation, drains / implants added.';

create table public.surveillance_neonatal_details (
  surveillance_case_id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  unit_admitted_on date,
  admitted_from text check (admitted_from is null or admitted_from in ('delivery_room','maternity_ward','home','other')),
  admitted_from_details text,
  care_level text check (care_level is null or care_level in ('intensive','intermediate','basic')),
  infection_episode integer check (infection_episode is null or infection_episode between 1 and 20),
  outcome_answer boolean,
  outcome_notes text,
  record_number text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  foreign key (surveillance_case_id, organization_id) references public.surveillance_cases(id, organization_id) on delete cascade
);
create index surveillance_neonatal_details_org_idx on public.surveillance_neonatal_details (organization_id);
create index surveillance_neonatal_details_parent_idx on public.surveillance_neonatal_details (surveillance_case_id, organization_id);
comment on table public.surveillance_neonatal_details is 'Neonatal unit details of a case: unit admission date, where the baby came from, care level, which infection episode of the stay this is, the FileMaker «Έκβαση» yes / no answer and its notes, the unit record number.';

alter table public.patient_admissions add column if not exists case_number text;
create index if not exists patient_admissions_case_number_idx on public.patient_admissions (organization_id, case_number) where case_number is not null;
comment on column public.patient_admissions.case_number is 'The hospital''s case (admission) number.';

alter table public.laboratory_samples
  add column if not exists environmental_position text,
  add column if not exists sampling_round smallint check (sampling_round is null or sampling_round between 0 and 9),
  add column if not exists scheduled_check boolean;
comment on column public.laboratory_samples.environmental_position is 'Where in the sampled place the specimen was taken (FileMaker «θέση»).';
comment on column public.laboratory_samples.sampling_round is '0 = first culture, 1 = first repeat, 2 = second repeat, …';
comment on column public.laboratory_samples.scheduled_check is 'true = scheduled (routine) sampling, false = extra sampling.';

alter table public.employee_certificates
  add column if not exists document_type text,
  add column if not exists cme_credits numeric(7,2) check (cme_credits is null or cme_credits >= 0);
alter table public.hand_hygiene_sessions
  add column if not exists people_observed integer check (people_observed is null or people_observed >= 0);
comment on column public.hand_hygiene_sessions.people_observed is 'How many people were observed in the session.';

alter table public.notifiable_disease_reports
  add column if not exists source text not null default 'laboratory',
  add column if not exists patient_id uuid references public.patients(id) on delete set null,
  add column if not exists department_id uuid references public.departments(id) on delete set null,
  add column if not exists disease_label text,
  add column if not exists notification_deadline text,
  add column if not exists reporting_doctor text;
alter table public.notifiable_disease_reports
  add constraint notifiable_disease_reports_source_check check (source in ('laboratory','clinical')),
  add constraint notifiable_disease_reports_deadline_check check (notification_deadline is null or notification_deadline in ('24h','week'));
create index if not exists notifiable_disease_reports_patient_idx on public.notifiable_disease_reports (patient_id);
create index if not exists notifiable_disease_reports_department_idx on public.notifiable_disease_reports (department_id);
comment on column public.notifiable_disease_reports.source is 'laboratory: a report on a laboratory finding (finding_key is the finding); clinical: a notification made from the clinical diagnosis (finding_key is the source record key).';

-- Row-level security ----------------------------------------------------------------------
-- Read: as the parent (the Platform Owner, the parent's reader roles of the
-- organisation, or whoever reads the parent row: the parent's policy applies
-- inside exists(), which covers the department manager's scope). Write: the
-- parent's writer roles of the organisation.

alter table public.clinical_assessment_findings enable row level security;
create policy clinical_assessment_findings_read on public.clinical_assessment_findings for select to authenticated using (
  (select public.current_user_is_platform_owner())
  or organization_id = any ((select private.fast_orgs_role(array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]))::uuid[])
  or exists (select 1 from public.clinical_assessments p where p.id = assessment_id));
create policy clinical_assessment_findings_insert on public.clinical_assessment_findings for insert to authenticated with check (
  (select public.current_user_is_platform_owner())
  or organization_id = any ((select private.fast_orgs_role(array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]))::uuid[]));
create policy clinical_assessment_findings_update on public.clinical_assessment_findings for update to authenticated
  using ((select public.current_user_is_platform_owner())
    or organization_id = any ((select private.fast_orgs_role(array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]))::uuid[]))
  with check ((select public.current_user_is_platform_owner())
    or organization_id = any ((select private.fast_orgs_role(array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]))::uuid[]));
create policy clinical_assessment_findings_delete on public.clinical_assessment_findings for delete to authenticated using (
  (select public.current_user_is_platform_owner())
  or organization_id = any ((select private.fast_orgs_role(array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]))::uuid[]));

alter table public.hai_classification_criteria enable row level security;
create policy hai_classification_criteria_read on public.hai_classification_criteria for select to authenticated using (
  (select public.current_user_is_platform_owner())
  or organization_id = any ((select private.fast_orgs_role(array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]))::uuid[])
  or exists (select 1 from public.hai_classifications p where p.id = hai_classification_id));
create policy hai_classification_criteria_insert on public.hai_classification_criteria for insert to authenticated with check (
  (select public.current_user_is_platform_owner())
  or organization_id = any ((select private.fast_orgs_role(array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]))::uuid[]));
create policy hai_classification_criteria_update on public.hai_classification_criteria for update to authenticated
  using ((select public.current_user_is_platform_owner())
    or organization_id = any ((select private.fast_orgs_role(array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]))::uuid[]))
  with check ((select public.current_user_is_platform_owner())
    or organization_id = any ((select private.fast_orgs_role(array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]))::uuid[]));
create policy hai_classification_criteria_delete on public.hai_classification_criteria for delete to authenticated using (
  (select public.current_user_is_platform_owner())
  or organization_id = any ((select private.fast_orgs_role(array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]))::uuid[]));

alter table public.isolation_episode_precautions enable row level security;
create policy isolation_episode_precautions_read on public.isolation_episode_precautions for select to authenticated using (
  (select public.current_user_is_platform_owner())
  or organization_id = any ((select private.fast_orgs_role(array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]))::uuid[])
  or exists (select 1 from public.isolation_episodes p where p.id = isolation_episode_id));
create policy isolation_episode_precautions_insert on public.isolation_episode_precautions for insert to authenticated with check (
  (select public.current_user_is_platform_owner())
  or organization_id = any ((select private.fast_orgs_role(array['infection_control_lead','infection_control_member']::public.app_role[]))::uuid[]));
create policy isolation_episode_precautions_update on public.isolation_episode_precautions for update to authenticated
  using ((select public.current_user_is_platform_owner())
    or organization_id = any ((select private.fast_orgs_role(array['infection_control_lead','infection_control_member']::public.app_role[]))::uuid[]))
  with check ((select public.current_user_is_platform_owner())
    or organization_id = any ((select private.fast_orgs_role(array['infection_control_lead','infection_control_member']::public.app_role[]))::uuid[]));
create policy isolation_episode_precautions_delete on public.isolation_episode_precautions for delete to authenticated using (
  (select public.current_user_is_platform_owner())
  or organization_id = any ((select private.fast_orgs_role(array['infection_control_lead','infection_control_member']::public.app_role[]))::uuid[]));

-- Organisms: read as the result (whoever reads its sample); written only by the
-- database from the result's label.
alter table public.microbiology_result_organisms enable row level security;
create policy microbiology_result_organisms_read on public.microbiology_result_organisms for select to authenticated using (
  (select public.current_user_is_platform_owner())
  or exists (select 1 from public.microbiology_results p where p.id = microbiology_result_id));

alter table public.amr_classification_categories enable row level security;
create policy amr_classification_categories_read on public.amr_classification_categories for select to authenticated using (
  (select public.current_user_is_platform_owner())
  or organization_id = any ((select private.fast_orgs_role(array['hospital_admin','infection_control_lead','infection_control_member','laboratory','pharmacy','doctor_reviewer']::public.app_role[]))::uuid[]));
create policy amr_classification_categories_insert on public.amr_classification_categories for insert to authenticated with check (
  (select public.current_user_is_platform_owner())
  or organization_id = any ((select private.fast_orgs_role(array['hospital_admin','laboratory','infection_control_lead','infection_control_member']::public.app_role[]))::uuid[]));
create policy amr_classification_categories_update on public.amr_classification_categories for update to authenticated
  using ((select public.current_user_is_platform_owner())
    or organization_id = any ((select private.fast_orgs_role(array['hospital_admin','laboratory','infection_control_lead','infection_control_member']::public.app_role[]))::uuid[]))
  with check ((select public.current_user_is_platform_owner())
    or organization_id = any ((select private.fast_orgs_role(array['hospital_admin','laboratory','infection_control_lead','infection_control_member']::public.app_role[]))::uuid[]));
create policy amr_classification_categories_delete on public.amr_classification_categories for delete to authenticated using (
  (select public.current_user_is_platform_owner())
  or organization_id = any ((select private.fast_orgs_role(array['hospital_admin','laboratory','infection_control_lead','infection_control_member']::public.app_role[]))::uuid[]));

do $$
declare t text;
begin
  foreach t in array array['surveillance_case_infection_types','surveillance_surgical_procedures','surveillance_neonatal_details'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format($p$create policy %I on public.%I for select to authenticated using (
      (select public.current_user_is_platform_owner())
      or organization_id = any ((select private.fast_orgs_role(array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]))::uuid[])
      or exists (select 1 from public.surveillance_cases p where p.id = surveillance_case_id))$p$, t || '_read', t);
    execute format($p$create policy %I on public.%I for insert to authenticated with check (
      (select public.current_user_is_platform_owner())
      or organization_id = any ((select private.fast_orgs_role(array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]))::uuid[]))$p$, t || '_insert', t);
    execute format($p$create policy %I on public.%I for update to authenticated
      using ((select public.current_user_is_platform_owner())
        or organization_id = any ((select private.fast_orgs_role(array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]))::uuid[]))
      with check ((select public.current_user_is_platform_owner())
        or organization_id = any ((select private.fast_orgs_role(array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]))::uuid[]))$p$, t || '_update', t);
    execute format($p$create policy %I on public.%I for delete to authenticated using (
      (select public.current_user_is_platform_owner())
      or organization_id = any ((select private.fast_orgs_role(array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]))::uuid[]))$p$, t || '_delete', t);
  end loop;
end
$$;

do $$
declare t text;
begin
  foreach t in array array['clinical_assessment_findings','hai_classification_criteria','isolation_episode_precautions','microbiology_result_organisms',
    'amr_classification_categories','surveillance_case_infection_types','surveillance_surgical_procedures','surveillance_neonatal_details'] loop
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    if t = 'microbiology_result_organisms' then
      execute format('grant select on table public.%I to authenticated', t);
    else
      execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
    end if;
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end
$$;

-- Writers in the earlier JSON shape -----------------------------------------------------------
-- One place reads each earlier shape: the copy below, the demo seeds (which
-- describe their rows in it) and the *_legacy triggers use these.

-- A start event's {reviewDue, room, reason, reasonEn, suspectedSource} onto its case.
create or replace function private.surveillance_case_apply_start(p_case_id uuid, p_start jsonb)
returns void language sql security invoker set search_path = '' as $function$
  update public.surveillance_cases c set
    review_due_on = case when p_start->>'reviewDue' ~ '^\d{4}-\d{2}-\d{2}' then left(p_start->>'reviewDue', 10)::date end,
    room = nullif(p_start->>'room', ''),
    reason = nullif(p_start->>'reason', ''),
    reason_en = nullif(p_start->>'reasonEn', ''),
    suspected_source = nullif(p_start->>'suspectedSource', ''),
    updated_at = now()
  where c.id = p_case_id;
$function$;

-- The «isolation not required» decision onto its case.
create or replace function private.surveillance_case_apply_isolation_not_required(p_case_id uuid, p_at timestamptz, p_by uuid)
returns void language sql security invoker set search_path = '' as $function$
  update public.surveillance_cases c set isolation_required = false, isolation_decided_at = p_at, isolation_decided_by = p_by, updated_at = now()
  where c.id = p_case_id;
$function$;

-- Text arrays of signs and risk factors as findings, after those the assessment has.
create or replace function private.clinical_assessment_add_lists(p_assessment_id uuid, p_signs jsonb, p_risks jsonb)
returns void language sql security invoker set search_path = '' as $function$
  insert into public.clinical_assessment_findings(organization_id, assessment_id, kind, position, label, created_by, created_at, updated_by, updated_at)
  select a.organization_id, a.id, l.kind,
    coalesce((select max(f.position) from public.clinical_assessment_findings f where f.assessment_id = a.id and f.kind = l.kind), 0) + l.ord,
    l.label, a.created_by, a.created_at, coalesce(a.updated_by, a.created_by), a.updated_at
  from public.clinical_assessments a
  cross join lateral (
    select 'sign'::text as kind, e.ord, e.value #>> '{}' as label
    from jsonb_array_elements(case when jsonb_typeof(p_signs) = 'array' then p_signs else '[]'::jsonb end) with ordinality e(value, ord)
    union all
    select 'risk_factor', e.ord, e.value #>> '{}'
    from jsonb_array_elements(case when jsonb_typeof(p_risks) = 'array' then p_risks else '[]'::jsonb end) with ordinality e(value, ord)
  ) l
  where a.id = p_assessment_id and btrim(coalesce(l.label, '')) <> '';
$function$;

create or replace function private.hai_classification_add_criteria(p_hai_id uuid, p_criteria jsonb)
returns void language sql security invoker set search_path = '' as $function$
  insert into public.hai_classification_criteria(organization_id, hai_classification_id, position, criterion_id, created_by, created_at, updated_by, updated_at)
  select h.organization_id, h.id,
    coalesce((select max(x.position) from public.hai_classification_criteria x where x.hai_classification_id = h.id), 0) + e.ord,
    e.value #>> '{}', h.classified_by, h.created_at, h.classified_by, h.updated_at
  from public.hai_classifications h
  cross join lateral jsonb_array_elements(case when jsonb_typeof(p_criteria) = 'array' then p_criteria else '[]'::jsonb end) with ordinality e(value, ord)
  where h.id = p_hai_id and btrim(coalesce(e.value #>> '{}', '')) <> '';
$function$;

create or replace function private.isolation_episode_add_precautions(p_episode_id uuid, p_precautions jsonb)
returns void language sql security invoker set search_path = '' as $function$
  insert into public.isolation_episode_precautions(organization_id, isolation_episode_id, position, precaution, created_by, created_at, updated_by, updated_at)
  select i.organization_id, i.id,
    coalesce((select max(x.position) from public.isolation_episode_precautions x where x.isolation_episode_id = i.id), 0) + e.ord,
    e.value #>> '{}', i.created_by, i.created_at, coalesce(i.updated_by, i.created_by), i.updated_at
  from public.isolation_episodes i
  cross join lateral jsonb_array_elements(case when jsonb_typeof(p_precautions) = 'array' then p_precautions else '[]'::jsonb end) with ordinality e(value, ord)
  where i.id = p_episode_id and btrim(coalesce(e.value #>> '{}', '')) <> '';
$function$;

-- {mechanism, categoriesTested, susceptibleCategories[], nonSusceptibleCategories[]}.
create or replace function private.amr_classification_apply_snapshot(p_amr_id uuid, p_snapshot jsonb)
returns void language plpgsql security invoker set search_path = '' as $function$
begin
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' or p_snapshot = '{}'::jsonb then return; end if;
  update public.amr_classifications a set
    mechanism = coalesce(a.mechanism, nullif(p_snapshot->>'mechanism', '')),
    categories_tested = coalesce(a.categories_tested, case when p_snapshot->>'categoriesTested' ~ '^\d+$' then (p_snapshot->>'categoriesTested')::integer end)
  where a.id = p_amr_id;
  insert into public.amr_classification_categories(organization_id, amr_classification_id, susceptible, position, category, created_by, created_at, updated_by, updated_at)
  select a.organization_id, a.id, l.susceptible, l.ord, l.category, a.classified_by, a.created_at, a.classified_by, a.created_at
  from public.amr_classifications a
  cross join lateral (
    select true as susceptible, e.ord, e.value #>> '{}' as category
    from jsonb_array_elements(case when jsonb_typeof(p_snapshot->'susceptibleCategories') = 'array' then p_snapshot->'susceptibleCategories' else '[]'::jsonb end) with ordinality e(value, ord)
    union all
    select false, e.ord, e.value #>> '{}'
    from jsonb_array_elements(case when jsonb_typeof(p_snapshot->'nonSusceptibleCategories') = 'array' then p_snapshot->'nonSusceptibleCategories' else '[]'::jsonb end) with ordinality e(value, ord)
  ) l
  where a.id = p_amr_id
  on conflict do nothing;
end;
$function$;

-- The organisms of a result's label, split as the application splits it.
create or replace function private.organism_list(p_label text)
returns table(ord integer, organism text) language sql immutable set search_path = '' as $function$
  select (row_number() over (order by s.ord))::integer, s.name
  from (select btrim(x.part) as name, x.ord from regexp_split_to_table(coalesce(p_label, ''), '\s*[,;+]\s*|\s+/\s+') with ordinality x(part, ord)) s
  where s.name <> '';
$function$;

-- Keeps a result's organism rows equal to its label. Part 2 also removes the
-- rows beyond a shortened label; until then a shortened draft label leaves its
-- surplus rows, which part 2 reconciles.
create or replace function private.microbiology_result_organisms_sync()
returns trigger language plpgsql security definer set search_path = '' as $function$
begin
  insert into public.microbiology_result_organisms(organization_id, microbiology_result_id, position, organism, created_by, created_at, updated_by, updated_at)
  select new.organization_id, new.id, o.ord, o.organism, coalesce(new.updated_by, new.created_by), now(), coalesce(new.updated_by, new.created_by), now()
  from private.organism_list(new.organism) o
  on conflict (microbiology_result_id, position) do update
    set organism = excluded.organism, updated_by = excluded.updated_by, updated_at = now()
    where public.microbiology_result_organisms.organism is distinct from excluded.organism;
  return null;
end;
$function$;

-- The earlier application shape, until part 2 retires it -------------------------------------

create or replace function private.surveillance_events_legacy()
returns trigger language plpgsql security invoker set search_path = '' as $function$
begin
  if new.payload is null or jsonb_typeof(new.payload) <> 'object' or new.payload = '{}'::jsonb then return new; end if;
  if new.payload ? 'detail' then new.detail := nullif(new.payload->>'detail', ''); end if;
  if new.event_type in ('surveillance_start', 'isolation_not_required') and not exists (
    select 1 from public.surveillance_events e
    where e.surveillance_case_id = new.surveillance_case_id and e.event_type = new.event_type and e.id <> new.id
      and (e.created_at, e.id) > (new.created_at, new.id)) then
    if new.event_type = 'surveillance_start' then
      perform private.surveillance_case_apply_start(new.surveillance_case_id, new.payload);
    elsif coalesce(new.payload->>'required', 'false') = 'false' then
      perform private.surveillance_case_apply_isolation_not_required(new.surveillance_case_id, coalesce(new.occurred_at, new.created_at), new.created_by);
    end if;
  end if;
  return new;
end;
$function$;

create or replace function private.clinical_assessments_legacy()
returns trigger language plpgsql security invoker set search_path = '' as $function$
begin
  perform private.clinical_assessment_add_lists(new.id, new.signs_symptoms, new.risk_factors);
  return null;
end;
$function$;

create or replace function private.hai_classifications_legacy()
returns trigger language plpgsql security invoker set search_path = '' as $function$
begin
  perform private.hai_classification_add_criteria(new.id, new.criteria_evidence);
  return null;
end;
$function$;

create or replace function private.isolation_episodes_legacy()
returns trigger language plpgsql security invoker set search_path = '' as $function$
begin
  perform private.isolation_episode_add_precautions(new.id, new.precautions);
  return null;
end;
$function$;

create or replace function private.amr_classifications_legacy()
returns trigger language plpgsql security invoker set search_path = '' as $function$
begin
  perform private.amr_classification_apply_snapshot(new.id, new.calculation_snapshot);
  return null;
end;
$function$;

-- Copy and verify -------------------------------------------------------------------------------

-- A. The latest start event and «not required» decision of each case (the ones
-- the application shows: newest first by creation, then id).
with s as (
  select distinct on (e.surveillance_case_id) e.surveillance_case_id, e.payload
  from public.surveillance_events e
  where e.event_type = 'surveillance_start'
  order by e.surveillance_case_id, e.created_at desc, e.id desc
)
update public.surveillance_cases c set
  review_due_on = case when s.payload->>'reviewDue' ~ '^\d{4}-\d{2}-\d{2}' then left(s.payload->>'reviewDue', 10)::date end,
  room = nullif(s.payload->>'room', ''),
  reason = nullif(s.payload->>'reason', ''),
  reason_en = nullif(s.payload->>'reasonEn', ''),
  suspected_source = nullif(s.payload->>'suspectedSource', '')
from s where s.surveillance_case_id = c.id;

with n as (
  select distinct on (e.surveillance_case_id) e.surveillance_case_id, coalesce(e.occurred_at, e.created_at) as at, e.created_by
  from public.surveillance_events e
  where e.event_type = 'isolation_not_required'
  order by e.surveillance_case_id, e.created_at desc, e.id desc
)
update public.surveillance_cases c set isolation_required = false, isolation_decided_at = n.at, isolation_decided_by = n.created_by
from n where n.surveillance_case_id = c.id;

update public.surveillance_events e set detail = nullif(e.payload->>'detail', '')
where jsonb_typeof(e.payload) = 'object' and e.payload ? 'detail';

-- B–D. Lists.
insert into public.clinical_assessment_findings(organization_id, assessment_id, kind, position, label, created_by, created_at, updated_by, updated_at)
select a.organization_id, a.id, l.kind, l.ord, l.label, a.created_by, a.created_at, coalesce(a.updated_by, a.created_by), a.updated_at
from public.clinical_assessments a
cross join lateral (
  select 'sign'::text as kind, e.ord, e.value #>> '{}' as label
  from jsonb_array_elements(case when jsonb_typeof(a.signs_symptoms) = 'array' then a.signs_symptoms else '[]'::jsonb end) with ordinality e(value, ord)
  union all
  select 'risk_factor', e.ord, e.value #>> '{}'
  from jsonb_array_elements(case when jsonb_typeof(a.risk_factors) = 'array' then a.risk_factors else '[]'::jsonb end) with ordinality e(value, ord)
) l;

insert into public.hai_classification_criteria(organization_id, hai_classification_id, position, criterion_id, created_by, created_at, updated_by, updated_at)
select h.organization_id, h.id, e.ord, e.value #>> '{}', h.classified_by, h.created_at, h.classified_by, h.updated_at
from public.hai_classifications h
cross join lateral jsonb_array_elements(case when jsonb_typeof(h.criteria_evidence) = 'array' then h.criteria_evidence else '[]'::jsonb end) with ordinality e(value, ord);

insert into public.isolation_episode_precautions(organization_id, isolation_episode_id, position, precaution, created_by, created_at, updated_by, updated_at)
select i.organization_id, i.id, e.ord, e.value #>> '{}', i.created_by, i.created_at, coalesce(i.updated_by, i.created_by), i.updated_at
from public.isolation_episodes i
cross join lateral jsonb_array_elements(case when jsonb_typeof(i.precautions) = 'array' then i.precautions else '[]'::jsonb end) with ordinality e(value, ord);

insert into public.microbiology_result_organisms(organization_id, microbiology_result_id, position, organism, created_by, created_at, updated_by, updated_at)
select m.organization_id, m.id, o.ord, o.organism, m.created_by, m.created_at, coalesce(m.updated_by, m.created_by), m.updated_at
from public.microbiology_results m
cross join lateral private.organism_list(m.organism) o;

update public.amr_classifications a set
  mechanism = nullif(a.calculation_snapshot->>'mechanism', ''),
  categories_tested = case when a.calculation_snapshot->>'categoriesTested' ~ '^\d+$' then (a.calculation_snapshot->>'categoriesTested')::integer end
where jsonb_typeof(a.calculation_snapshot) = 'object' and a.calculation_snapshot <> '{}'::jsonb;

insert into public.amr_classification_categories(organization_id, amr_classification_id, susceptible, position, category, created_by, created_at, updated_by, updated_at)
select a.organization_id, a.id, l.susceptible, l.ord, l.category, a.classified_by, a.created_at, a.classified_by, a.created_at
from public.amr_classifications a
cross join lateral (
  select true as susceptible, e.ord, e.value #>> '{}' as category
  from jsonb_array_elements(case when jsonb_typeof(a.calculation_snapshot->'susceptibleCategories') = 'array' then a.calculation_snapshot->'susceptibleCategories' else '[]'::jsonb end) with ordinality e(value, ord)
  union all
  select false, e.ord, e.value #>> '{}'
  from jsonb_array_elements(case when jsonb_typeof(a.calculation_snapshot->'nonSusceptibleCategories') = 'array' then a.calculation_snapshot->'nonSusceptibleCategories' else '[]'::jsonb end) with ordinality e(value, ord)
) l;

do $verify$
declare
  v_bad text := '';
  v_n bigint;
begin
  -- The case columns equal its latest start event, field by field.
  select count(*) into v_n
  from public.surveillance_cases c
  join lateral (select e.payload from public.surveillance_events e where e.surveillance_case_id = c.id and e.event_type = 'surveillance_start'
                order by e.created_at desc, e.id desc limit 1) s on true
  where coalesce(to_char(c.review_due_on, 'YYYY-MM-DD'), '') is distinct from coalesce(left(s.payload->>'reviewDue', 10), '')
     or coalesce(c.room, '') is distinct from coalesce(s.payload->>'room', '')
     or coalesce(c.reason, '') is distinct from coalesce(s.payload->>'reason', '')
     or coalesce(c.reason_en, '') is distinct from coalesce(s.payload->>'reasonEn', '')
     or coalesce(c.suspected_source, '') is distinct from coalesce(s.payload->>'suspectedSource', '');
  if v_n > 0 then v_bad := v_bad || format('(''case start'', %s) ', v_n); end if;
  select count(*) into v_n from public.surveillance_cases c
  where (c.review_due_on is not null or c.room is not null or c.reason is not null or c.reason_en is not null or c.suspected_source is not null)
    and not exists (select 1 from public.surveillance_events e where e.surveillance_case_id = c.id and e.event_type = 'surveillance_start');
  if v_n > 0 then v_bad := v_bad || format('(''case start without event'', %s) ', v_n); end if;

  -- The «not required» decision.
  select count(*) into v_n
  from public.surveillance_cases c
  left join lateral (select coalesce(e.occurred_at, e.created_at) as at, e.created_by from public.surveillance_events e
                     where e.surveillance_case_id = c.id and e.event_type = 'isolation_not_required' order by e.created_at desc, e.id desc limit 1) n on true
  where (n.at is null) is distinct from (c.isolation_required is null)
     or c.isolation_decided_at is distinct from n.at or c.isolation_decided_by is distinct from n.created_by
     or (n.at is not null and c.isolation_required is distinct from false);
  if v_n > 0 then v_bad := v_bad || format('(''isolation not required'', %s) ', v_n); end if;

  select count(*) into v_n from public.surveillance_events e
  where coalesce(e.detail, '') is distinct from coalesce(case when jsonb_typeof(e.payload) = 'object' then e.payload->>'detail' end, '');
  if v_n > 0 then v_bad := v_bad || format('(''event detail'', %s) ', v_n); end if;

  -- Every list, element by element and in order.
  select count(*) into v_n from public.clinical_assessments a
  where coalesce((select jsonb_agg(f.label order by f.position) from public.clinical_assessment_findings f where f.assessment_id = a.id and f.kind = 'sign'), '[]'::jsonb)
          is distinct from (select coalesce(jsonb_agg(e.value #>> '{}' order by e.ord), '[]'::jsonb) from jsonb_array_elements(case when jsonb_typeof(a.signs_symptoms) = 'array' then a.signs_symptoms else '[]'::jsonb end) with ordinality e(value, ord))
     or coalesce((select jsonb_agg(f.label order by f.position) from public.clinical_assessment_findings f where f.assessment_id = a.id and f.kind = 'risk_factor'), '[]'::jsonb)
          is distinct from (select coalesce(jsonb_agg(e.value #>> '{}' order by e.ord), '[]'::jsonb) from jsonb_array_elements(case when jsonb_typeof(a.risk_factors) = 'array' then a.risk_factors else '[]'::jsonb end) with ordinality e(value, ord));
  if v_n > 0 then v_bad := v_bad || format('(''assessment signs / risk factors'', %s) ', v_n); end if;

  select count(*) into v_n from public.hai_classifications h
  where coalesce((select jsonb_agg(x.criterion_id order by x.position) from public.hai_classification_criteria x where x.hai_classification_id = h.id), '[]'::jsonb)
        is distinct from (select coalesce(jsonb_agg(e.value #>> '{}' order by e.ord), '[]'::jsonb) from jsonb_array_elements(case when jsonb_typeof(h.criteria_evidence) = 'array' then h.criteria_evidence else '[]'::jsonb end) with ordinality e(value, ord));
  if v_n > 0 then v_bad := v_bad || format('(''HAI criteria'', %s) ', v_n); end if;

  select count(*) into v_n from public.isolation_episodes i
  where coalesce((select jsonb_agg(x.precaution order by x.position) from public.isolation_episode_precautions x where x.isolation_episode_id = i.id), '[]'::jsonb)
        is distinct from (select coalesce(jsonb_agg(e.value #>> '{}' order by e.ord), '[]'::jsonb) from jsonb_array_elements(case when jsonb_typeof(i.precautions) = 'array' then i.precautions else '[]'::jsonb end) with ordinality e(value, ord));
  if v_n > 0 then v_bad := v_bad || format('(''isolation precautions'', %s) ', v_n); end if;

  -- Organism rows rebuild the label (separators normalised to ", ").
  select count(*) into v_n from public.microbiology_results m
  where coalesce((select string_agg(o.organism, ', ' order by o.position) from public.microbiology_result_organisms o where o.microbiology_result_id = m.id), '')
        is distinct from coalesce(array_to_string(array(select btrim(x) from regexp_split_to_table(coalesce(m.organism, ''), '\s*[,;+]\s*|\s+/\s+') x where btrim(x) <> ''), ', '), '');
  if v_n > 0 then v_bad := v_bad || format('(''organisms'', %s) ', v_n); end if;
  select count(*) into v_n from public.microbiology_results m
  where jsonb_typeof(m.organisms) = 'array' and jsonb_array_length(m.organisms) > 0;
  if v_n > 0 then v_bad := v_bad || format('(''organisms jsonb not empty'', %s) ', v_n); end if;

  select count(*) into v_n from public.amr_classifications a
  where jsonb_typeof(a.calculation_snapshot) = 'object' and (
       coalesce(a.mechanism, '') is distinct from coalesce(a.calculation_snapshot->>'mechanism', '')
    or coalesce(a.categories_tested::text, '') is distinct from coalesce(a.calculation_snapshot->>'categoriesTested', '')
    or coalesce((select jsonb_agg(x.category order by x.position) from public.amr_classification_categories x where x.amr_classification_id = a.id and x.susceptible), '[]'::jsonb)
         is distinct from coalesce(a.calculation_snapshot->'susceptibleCategories', '[]'::jsonb)
    or coalesce((select jsonb_agg(x.category order by x.position) from public.amr_classification_categories x where x.amr_classification_id = a.id and not x.susceptible), '[]'::jsonb)
         is distinct from coalesce(a.calculation_snapshot->'nonSusceptibleCategories', '[]'::jsonb)
    or (a.calculation_snapshot - array['mechanism','categoriesTested','susceptibleCategories','nonSusceptibleCategories']) <> '{}'::jsonb);
  if v_n > 0 then v_bad := v_bad || format('(''AMR snapshot'', %s) ', v_n); end if;

  -- No start payload key left behind.
  select count(*) into v_n from public.surveillance_events e
  where jsonb_typeof(e.payload) = 'object'
    and (e.payload - array['reviewDue','room','reason','reasonEn','suspectedSource','detail','required']) <> '{}'::jsonb;
  if v_n > 0 then v_bad := v_bad || format('(''unknown event payload keys'', %s) ', v_n); end if;

  if v_bad <> '' then raise exception 'SURVEILLANCE_RELATIONAL_COPY_MISMATCH: %', v_bad; end if;
end
$verify$;

-- Triggers from now on (after the copy, which kept the original stamps) ---------------------------

do $$
declare t text;
begin
  foreach t in array array['clinical_assessment_findings','hai_classification_criteria','isolation_episode_precautions','microbiology_result_organisms',
    'amr_classification_categories','surveillance_case_infection_types','surveillance_surgical_procedures','surveillance_neonatal_details'] loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.set_repository_audit_fields()', 'trg_' || t || '_audit_fields', t);
  end loop;
end
$$;

create trigger trg_microbiology_result_organisms_sync after insert or update of organism on public.microbiology_results
  for each row execute function private.microbiology_result_organisms_sync();
create trigger trg_surveillance_events_legacy before insert or update of payload on public.surveillance_events
  for each row execute function private.surveillance_events_legacy();
create trigger trg_clinical_assessments_legacy after insert on public.clinical_assessments
  for each row when (new.signs_symptoms <> '[]'::jsonb or new.risk_factors <> '[]'::jsonb) execute function private.clinical_assessments_legacy();
create trigger trg_hai_classifications_legacy after insert on public.hai_classifications
  for each row when (new.criteria_evidence <> '[]'::jsonb) execute function private.hai_classifications_legacy();
create trigger trg_isolation_episodes_legacy after insert on public.isolation_episodes
  for each row when (new.precautions <> '[]'::jsonb) execute function private.isolation_episodes_legacy();
create trigger trg_amr_classifications_legacy after insert on public.amr_classifications
  for each row when (new.calculation_snapshot <> '{}'::jsonb) execute function private.amr_classifications_legacy();

revoke all on function private.surveillance_case_apply_start(uuid, jsonb), private.surveillance_case_apply_isolation_not_required(uuid, timestamptz, uuid),
  private.clinical_assessment_add_lists(uuid, jsonb, jsonb), private.hai_classification_add_criteria(uuid, jsonb), private.isolation_episode_add_precautions(uuid, jsonb),
  private.amr_classification_apply_snapshot(uuid, jsonb), private.organism_list(text), private.microbiology_result_organisms_sync(),
  private.surveillance_events_legacy(), private.clinical_assessments_legacy(), private.hai_classifications_legacy(), private.isolation_episodes_legacy(),
  private.amr_classifications_legacy()
  from public, anon;
grant execute on function private.surveillance_case_apply_start(uuid, jsonb), private.surveillance_case_apply_isolation_not_required(uuid, timestamptz, uuid),
  private.clinical_assessment_add_lists(uuid, jsonb, jsonb), private.hai_classification_add_criteria(uuid, jsonb), private.isolation_episode_add_precautions(uuid, jsonb),
  private.amr_classification_apply_snapshot(uuid, jsonb), private.organism_list(text)
  to authenticated, service_role;
