-- Limoxis Observer v0.4.0 — Patient & surveillance domain foundation
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_code text not null, first_name text, last_name text, date_of_birth date, department_id uuid references public.departments(id),
  admission_date date, discharge_date date, status text not null default 'active' check (status in ('active','discharged','deceased','transferred')),
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id, patient_code)
);
create table if not exists public.surveillance_cases (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete restrict, department_id uuid references public.departments(id),
  status text not null default 'active' check (status in ('active','closed','cancelled')), started_at timestamptz not null default now(), closed_at timestamptz,
  close_reason text, created_by uuid references auth.users(id), closed_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.surveillance_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  surveillance_case_id uuid not null references public.surveillance_cases(id) on delete cascade,
  event_type text not null check (event_type in ('clinical_assessment','sample','resistance_classification','antimicrobial_therapy','isolation','reassessment','outcome')),
  event_status text not null default 'pending' check (event_status in ('pending','in_progress','completed','cancelled','overdue')),
  occurred_at timestamptz, due_at timestamptz, payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id), completed_by uuid references auth.users(id), completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.patients enable row level security; alter table public.surveillance_cases enable row level security; alter table public.surveillance_events enable row level security;
create policy patients_tenant_read on public.patients for select using (public.is_org_member(organization_id));
create policy surveillance_tenant_read on public.surveillance_cases for select using (public.is_org_member(organization_id));
create policy surveillance_events_tenant_read on public.surveillance_events for select using (public.is_org_member(organization_id));
-- Write policies intentionally remain capability-specific and must be added through controlled RPCs in the next hardening pass.
create index if not exists patients_org_code_idx on public.patients(organization_id, patient_code);
create index if not exists surveillance_org_status_idx on public.surveillance_cases(organization_id, status);
create index if not exists surveillance_events_case_idx on public.surveillance_events(surveillance_case_id, event_type, event_status);
