-- N3 · Sepsis protocols inside the surveillance episode and the 48–72 h
-- antimicrobial review («antibiotic time-out»).
--
-- New objects only: nothing existing is altered.
--
--   clinical_protocol_runs    one protocol started on a surveillance episode
--                             (protocol_key from the app's data-driven list:
--                             'sepsis_hour1', 'septic_shock', … more later).
--                             recognized_at is time zero of the bundle.
--   clinical_protocol_steps   one row per step of a run (pending / done /
--                             not_indicated + reason), with the time it was done.
--   clinical_protocol_events  append-only audit of a run: started, step
--                             recorded, recognition time changed (with reason),
--                             completed / closed. Who and when.
--   antimicrobial_therapy_reviews
--                             the 48–72 h review of an antimicrobial therapy:
--                             continue / de-escalate / IV→oral / stop, reasons,
--                             reviewer and time. A table (not columns on
--                             antimicrobial_therapies) because a therapy can be
--                             reviewed more than once ("continue, review again in
--                             24–48 h") and every decision stays in the history.
--
-- Future indicators (no screens yet, see docs/SEPSIS_STEWARDSHIP.md):
--   % antibiotic within 1 h  = runs whose 'antibiotic' step done_at
--                              ≤ recognized_at + 60 min / runs with recognized_at.
--   % review within 72 h     = therapies with a review reviewed_at
--                              ≤ started_at + 72 h / therapies lasting > 48 h.
--
-- Access mirrors the episode records: the infection control team, the Doctor
-- Reviewer and the Hospital Admin hospital-wide; the Department Manager and the
-- Link Nurse for episodes of their own departments (organization_member_scopes),
-- as isolation_episodes (20261129400000). Reviews follow antimicrobial_therapies:
-- the roles that manage antimicrobial therapy (IPC Lead, Doctor Reviewer,
-- Pharmacy, Hospital Admin) record them. Each table also gets the module gate of
-- 20261201200000 (Surveillance; reviews also Pharmacy, like the therapies).

create table if not exists public.clinical_protocol_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  surveillance_case_id uuid not null references public.surveillance_cases(id) on delete cascade,
  patient_id uuid null references public.patients(id) on delete set null,
  admission_id uuid null references public.patient_admissions(id) on delete set null,
  department_id uuid null references public.departments(id) on delete set null,
  protocol_key text not null check (protocol_key ~ '^[a-z0-9_]{2,60}$'),
  protocol_version text not null default '1',
  recognized_at timestamptz not null,
  recognition_source text null check (recognition_source is null or recognition_source in ('qsofa', 'sofa', 'clinical', 'other')),
  trigger_assessment_id uuid null references public.patient_clinical_scale_assessments(id) on delete set null,
  weight_kg numeric null check (weight_kg is null or (weight_kg > 0 and weight_kg < 500)),
  status text not null default 'open' check (status in ('open', 'completed', 'closed')),
  started_by uuid not null default auth.uid(),
  started_by_name text null,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  completed_by uuid null,
  completed_by_name text null,
  close_reason text null,
  updated_by uuid null,
  updated_at timestamptz not null default now(),
  check (status = 'open' or completed_at is not null)
);

create table if not exists public.clinical_protocol_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid not null references public.clinical_protocol_runs(id) on delete cascade,
  step_key text not null check (step_key ~ '^[a-z0-9_]{2,60}$'),
  status text not null default 'pending' check (status in ('pending', 'done', 'not_indicated')),
  done_at timestamptz null,
  value_text text null,
  not_indicated_reason text null,
  therapy_id uuid null references public.antimicrobial_therapies(id) on delete set null,
  laboratory_sample_id uuid null references public.laboratory_samples(id) on delete set null,
  recorded_by uuid not null default auth.uid(),
  recorded_by_name text null,
  recorded_at timestamptz not null default now(),
  updated_by uuid null,
  updated_at timestamptz not null default now(),
  unique (run_id, step_key),
  check (status <> 'done' or done_at is not null),
  check (status <> 'not_indicated' or length(trim(coalesce(not_indicated_reason, ''))) > 0)
);

create table if not exists public.clinical_protocol_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid not null references public.clinical_protocol_runs(id) on delete cascade,
  event_type text not null check (event_type in ('started', 'step_recorded', 'step_cleared', 'recognition_changed', 'weight_changed', 'completed', 'closed')),
  step_key text null,
  detail jsonb not null default '{}'::jsonb,
  reason text null,
  actor_id uuid not null default auth.uid(),
  actor_name text null,
  occurred_at timestamptz not null default now(),
  check (event_type <> 'recognition_changed' or length(trim(coalesce(reason, ''))) > 0)
);

create table if not exists public.antimicrobial_therapy_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  therapy_id uuid not null references public.antimicrobial_therapies(id) on delete cascade,
  surveillance_case_id uuid null references public.surveillance_cases(id) on delete cascade,
  decision text not null check (decision in ('continue', 'deescalate', 'iv_to_oral', 'stop')),
  reasons text[] not null default '{}' check (cardinality(reasons) > 0),
  note text null,
  new_regimen text null,
  reviewed_at timestamptz not null default now(),
  reviewed_by uuid not null default auth.uid(),
  reviewer_name text null,
  reviewer_job_title text null,
  created_at timestamptz not null default now()
);

create index if not exists clinical_protocol_runs_case_idx on public.clinical_protocol_runs (surveillance_case_id, started_at desc);
create index if not exists clinical_protocol_runs_open_idx on public.clinical_protocol_runs (organization_id, surveillance_case_id) where status = 'open';
create index if not exists clinical_protocol_runs_org_recognized_idx on public.clinical_protocol_runs (organization_id, recognized_at desc);
create index if not exists clinical_protocol_steps_run_idx on public.clinical_protocol_steps (run_id);
create index if not exists clinical_protocol_steps_org_idx on public.clinical_protocol_steps (organization_id);
create index if not exists clinical_protocol_events_run_idx on public.clinical_protocol_events (run_id, occurred_at desc);
create index if not exists clinical_protocol_events_org_idx on public.clinical_protocol_events (organization_id);
create index if not exists antimicrobial_therapy_reviews_therapy_idx on public.antimicrobial_therapy_reviews (therapy_id, reviewed_at desc);
create index if not exists antimicrobial_therapy_reviews_org_idx on public.antimicrobial_therapy_reviews (organization_id, reviewed_at desc);
create index if not exists antimicrobial_therapy_reviews_case_idx on public.antimicrobial_therapy_reviews (surveillance_case_id);

alter table public.clinical_protocol_runs enable row level security;
alter table public.clinical_protocol_steps enable row level security;
alter table public.clinical_protocol_events enable row level security;
alter table public.antimicrobial_therapy_reviews enable row level security;

grant select, insert, update on public.clinical_protocol_runs to authenticated;
grant select, insert, update on public.clinical_protocol_steps to authenticated;
grant select, insert on public.clinical_protocol_events to authenticated;
grant select, insert on public.antimicrobial_therapy_reviews to authenticated;

-- Runs ----------------------------------------------------------------------------------

create policy clinical_protocol_runs_read on public.clinical_protocol_runs for select to authenticated using (
  (select public.current_user_is_platform_owner())
  or coalesce(organization_id = any((select private.fast_orgs_demo_admin())::uuid[]), false)
  or coalesce(organization_id = any((select private.fast_orgs_role(array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]))::uuid[]), false)
  or (
    coalesce(organization_id = any((select private.fast_orgs_role(array['department_manager','link_nurse']::public.app_role[]))::uuid[]), false)
    and department_id is not null
    and coalesce((organization_id::text || ':' || department_id::text) = any((select private.current_user_department_scopes())::text[]), false)
  )
);

create policy clinical_protocol_runs_insert on public.clinical_protocol_runs for insert to authenticated with check (
  started_by = auth.uid()
  and exists (
    select 1 from public.surveillance_cases c
    where c.id = clinical_protocol_runs.surveillance_case_id
      and c.organization_id = clinical_protocol_runs.organization_id
  )
  and (
    (select public.current_user_is_platform_owner())
    or coalesce(organization_id = any((select private.fast_orgs_role(array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]))::uuid[]), false)
    or (
      coalesce(organization_id = any((select private.fast_orgs_role(array['department_manager','link_nurse']::public.app_role[]))::uuid[]), false)
      and department_id is not null
      and coalesce((organization_id::text || ':' || department_id::text) = any((select private.current_user_department_scopes())::text[]), false)
    )
  )
);

create policy clinical_protocol_runs_update on public.clinical_protocol_runs for update to authenticated
using (
  (select public.current_user_is_platform_owner())
  or coalesce(organization_id = any((select private.fast_orgs_role(array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]))::uuid[]), false)
  or (
    coalesce(organization_id = any((select private.fast_orgs_role(array['department_manager','link_nurse']::public.app_role[]))::uuid[]), false)
    and department_id is not null
    and coalesce((organization_id::text || ':' || department_id::text) = any((select private.current_user_department_scopes())::text[]), false)
  )
)
with check (
  (select public.current_user_is_platform_owner())
  or coalesce(organization_id = any((select private.fast_orgs_role(array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]))::uuid[]), false)
  or (
    coalesce(organization_id = any((select private.fast_orgs_role(array['department_manager','link_nurse']::public.app_role[]))::uuid[]), false)
    and department_id is not null
    and coalesce((organization_id::text || ':' || department_id::text) = any((select private.current_user_department_scopes())::text[]), false)
  )
);

-- Steps and events follow their run: whoever may read / write the run (visible to them
-- and in their scope) may read / write its steps and append its events.

create policy clinical_protocol_steps_read on public.clinical_protocol_steps for select to authenticated using (
  exists (select 1 from public.clinical_protocol_runs r where r.id = clinical_protocol_steps.run_id and r.organization_id = clinical_protocol_steps.organization_id)
);

create policy clinical_protocol_steps_insert on public.clinical_protocol_steps for insert to authenticated with check (
  recorded_by = auth.uid()
  and exists (
    select 1 from public.clinical_protocol_runs r
    where r.id = clinical_protocol_steps.run_id
      and r.organization_id = clinical_protocol_steps.organization_id
      and (
        (select public.current_user_is_platform_owner())
        or coalesce(r.organization_id = any((select private.fast_orgs_role(array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]))::uuid[]), false)
        or (
          coalesce(r.organization_id = any((select private.fast_orgs_role(array['department_manager','link_nurse']::public.app_role[]))::uuid[]), false)
          and r.department_id is not null
          and coalesce((r.organization_id::text || ':' || r.department_id::text) = any((select private.current_user_department_scopes())::text[]), false)
        )
      )
  )
);

create policy clinical_protocol_steps_update on public.clinical_protocol_steps for update to authenticated
using (
  exists (
    select 1 from public.clinical_protocol_runs r
    where r.id = clinical_protocol_steps.run_id
      and r.organization_id = clinical_protocol_steps.organization_id
      and (
        (select public.current_user_is_platform_owner())
        or coalesce(r.organization_id = any((select private.fast_orgs_role(array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]))::uuid[]), false)
        or (
          coalesce(r.organization_id = any((select private.fast_orgs_role(array['department_manager','link_nurse']::public.app_role[]))::uuid[]), false)
          and r.department_id is not null
          and coalesce((r.organization_id::text || ':' || r.department_id::text) = any((select private.current_user_department_scopes())::text[]), false)
        )
      )
  )
)
with check (
  exists (
    select 1 from public.clinical_protocol_runs r
    where r.id = clinical_protocol_steps.run_id
      and r.organization_id = clinical_protocol_steps.organization_id
      and (
        (select public.current_user_is_platform_owner())
        or coalesce(r.organization_id = any((select private.fast_orgs_role(array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]))::uuid[]), false)
        or (
          coalesce(r.organization_id = any((select private.fast_orgs_role(array['department_manager','link_nurse']::public.app_role[]))::uuid[]), false)
          and r.department_id is not null
          and coalesce((r.organization_id::text || ':' || r.department_id::text) = any((select private.current_user_department_scopes())::text[]), false)
        )
      )
  )
);

create policy clinical_protocol_events_read on public.clinical_protocol_events for select to authenticated using (
  exists (select 1 from public.clinical_protocol_runs r where r.id = clinical_protocol_events.run_id and r.organization_id = clinical_protocol_events.organization_id)
);

create policy clinical_protocol_events_insert on public.clinical_protocol_events for insert to authenticated with check (
  actor_id = auth.uid()
  and exists (
    select 1 from public.clinical_protocol_runs r
    where r.id = clinical_protocol_events.run_id
      and r.organization_id = clinical_protocol_events.organization_id
      and (
        (select public.current_user_is_platform_owner())
        or coalesce(r.organization_id = any((select private.fast_orgs_role(array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]))::uuid[]), false)
        or (
          coalesce(r.organization_id = any((select private.fast_orgs_role(array['department_manager','link_nurse']::public.app_role[]))::uuid[]), false)
          and r.department_id is not null
          and coalesce((r.organization_id::text || ':' || r.department_id::text) = any((select private.current_user_department_scopes())::text[]), false)
        )
      )
  )
);

-- Antimicrobial reviews -------------------------------------------------------------------

create policy antimicrobial_therapy_reviews_read on public.antimicrobial_therapy_reviews for select to authenticated using (
  (select public.current_user_is_platform_owner())
  or coalesce(organization_id = any((select private.fast_orgs_demo_admin())::uuid[]), false)
  or coalesce(organization_id = any((select private.fast_orgs_role(array['hospital_admin','infection_control_lead','infection_control_member','pharmacy','doctor_reviewer','laboratory']::public.app_role[]))::uuid[]), false)
);

create policy antimicrobial_therapy_reviews_insert on public.antimicrobial_therapy_reviews for insert to authenticated with check (
  reviewed_by = auth.uid()
  and exists (
    select 1 from public.antimicrobial_therapies t
    where t.id = antimicrobial_therapy_reviews.therapy_id
      and t.organization_id = antimicrobial_therapy_reviews.organization_id
  )
  and (
    (select public.current_user_is_platform_owner())
    or coalesce(organization_id = any((select private.fast_orgs_role(array['hospital_admin','infection_control_lead','doctor_reviewer','pharmacy']::public.app_role[]))::uuid[]), false)
  )
);

-- Module gates (same expression as 20261201200000_module_enforcement_db.sql) ---------------

create policy clinical_protocol_runs_module_gate on public.clinical_protocol_runs as restrictive for all to authenticated
  using ((select not private.current_user_has_locked_modules()) or organization_id is null or not (organization_id = any ((select private.current_user_locked_module_orgs('{surveillance}'::text[]))::uuid[])))
  with check ((select not private.current_user_has_locked_modules()) or organization_id is null or not (organization_id = any ((select private.current_user_locked_module_orgs('{surveillance}'::text[]))::uuid[])));

create policy clinical_protocol_steps_module_gate on public.clinical_protocol_steps as restrictive for all to authenticated
  using ((select not private.current_user_has_locked_modules()) or organization_id is null or not (organization_id = any ((select private.current_user_locked_module_orgs('{surveillance}'::text[]))::uuid[])))
  with check ((select not private.current_user_has_locked_modules()) or organization_id is null or not (organization_id = any ((select private.current_user_locked_module_orgs('{surveillance}'::text[]))::uuid[])));

create policy clinical_protocol_events_module_gate on public.clinical_protocol_events as restrictive for all to authenticated
  using ((select not private.current_user_has_locked_modules()) or organization_id is null or not (organization_id = any ((select private.current_user_locked_module_orgs('{surveillance}'::text[]))::uuid[])))
  with check ((select not private.current_user_has_locked_modules()) or organization_id is null or not (organization_id = any ((select private.current_user_locked_module_orgs('{surveillance}'::text[]))::uuid[])));

create policy antimicrobial_therapy_reviews_module_gate on public.antimicrobial_therapy_reviews as restrictive for all to authenticated
  using ((select not private.current_user_has_locked_modules()) or organization_id is null or not (organization_id = any ((select private.current_user_locked_module_orgs('{surveillance,pharmacy}'::text[]))::uuid[])))
  with check ((select not private.current_user_has_locked_modules()) or organization_id is null or not (organization_id = any ((select private.current_user_locked_module_orgs('{surveillance,pharmacy}'::text[]))::uuid[])));
