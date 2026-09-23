create table public.patient_clinical_scale_assessments (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 patient_id uuid not null references public.patients(id) on delete cascade,
 admission_id uuid null references public.patient_admissions(id) on delete set null,
 scale_definition_id uuid not null references public.clinical_scale_definitions(id),
 scale_key text not null,
 scale_version text not null,
 assessed_at timestamptz not null default now(),
 answers jsonb not null,
 score numeric not null,
 score_parts jsonb not null default '{}'::jsonb,
 interpretation text null,
 status text not null default 'final' check(status in ('draft','final','amended')),
 created_by uuid not null default auth.uid(),
 created_at timestamptz not null default now()
);
create index patient_clinical_scale_assessments_patient_idx on public.patient_clinical_scale_assessments(organization_id,patient_id,assessed_at desc);
alter table public.patient_clinical_scale_assessments enable row level security;
grant select,insert on public.patient_clinical_scale_assessments to authenticated;
create policy patient_scale_read on public.patient_clinical_scale_assessments for select to authenticated using(public.current_user_is_platform_owner() or public.current_user_has_org_role(organization_id,array['hospital_admin'::public.app_role,'infection_control_lead'::public.app_role,'link_nurse'::public.app_role,'doctor_reviewer'::public.app_role,'quality_manager'::public.app_role,'department_manager'::public.app_role,'staff_user'::public.app_role]));
create policy patient_scale_insert on public.patient_clinical_scale_assessments for insert to authenticated with check(created_by=auth.uid() and (public.current_user_is_platform_owner() or public.current_user_has_org_role(organization_id,array['hospital_admin'::public.app_role,'infection_control_lead'::public.app_role,'doctor_reviewer'::public.app_role,'department_manager'::public.app_role,'staff_user'::public.app_role])));
