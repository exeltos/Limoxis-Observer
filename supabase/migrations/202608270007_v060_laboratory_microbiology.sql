-- Limoxis Observer v0.6.0 — Laboratory & Microbiology Core
-- Structured AST, validation, critical-result communication and versioned AMR classification.

alter table public.laboratory_samples
  add column if not exists requested_at timestamptz,
  add column if not exists requested_by uuid references auth.users(id),
  add column if not exists priority text not null default 'routine' check (priority in ('routine','urgent','critical')),
  add column if not exists specimen_condition text,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_reason text;

alter table public.microbiology_results
  add column if not exists method text,
  add column if not exists preliminary boolean not null default false,
  add column if not exists validation_status text not null default 'draft' check (validation_status in ('draft','validated','amended')),
  add column if not exists validated_at timestamptz,
  add column if not exists amended_from uuid references public.microbiology_results(id),
  add column if not exists interpretation_standard text,
  add column if not exists interpretation_version text;

create table if not exists public.antimicrobial_susceptibility_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  microbiology_result_id uuid not null references public.microbiology_results(id) on delete cascade,
  antimicrobial_code text,
  antimicrobial_name text not null,
  method text not null,
  mic_value numeric,
  mic_operator text check (mic_operator in ('<','<=','=','>=','>') or mic_operator is null),
  zone_diameter_mm numeric,
  sir_category text not null check (sir_category in ('S','I','R')),
  breakpoint_standard text not null default 'EUCAST',
  breakpoint_version text not null,
  technical_uncertainty boolean not null default false,
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (microbiology_result_id, antimicrobial_name)
);

create table if not exists public.amr_classifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  microbiology_result_id uuid not null references public.microbiology_results(id) on delete cascade,
  classification text check (classification in ('MDR','XDR','PDR') or classification is null),
  definition_source text not null,
  definition_version text not null,
  calculation_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'proposed' check (status in ('proposed','reviewed','confirmed','overridden')),
  rationale text,
  classified_by uuid references auth.users(id),
  classified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.critical_result_communications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  microbiology_result_id uuid not null references public.microbiology_results(id) on delete cascade,
  communicated_at timestamptz not null,
  communicated_by uuid not null references auth.users(id),
  recipient_name text not null,
  recipient_role text,
  communication_method text not null check (communication_method in ('phone','in_person','secure_message','other')),
  read_back_confirmed boolean,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.antimicrobial_susceptibility_results enable row level security;
alter table public.amr_classifications enable row level security;
alter table public.critical_result_communications enable row level security;

create policy ast_authorized_read on public.antimicrobial_susceptibility_results for select using (
  public.current_user_has_org_role(organization_id, array['hospital_admin','infection_control_lead','infection_control_member','laboratory','pharmacy','doctor_reviewer']::public.app_role[])
);
create policy ast_lab_write on public.antimicrobial_susceptibility_results for all using (
  public.current_user_has_org_role(organization_id, array['laboratory']::public.app_role[])
) with check (public.current_user_has_org_role(organization_id, array['laboratory']::public.app_role[]));

create policy amr_authorized_read on public.amr_classifications for select using (
  public.current_user_has_org_role(organization_id, array['hospital_admin','infection_control_lead','infection_control_member','laboratory','pharmacy','doctor_reviewer']::public.app_role[])
);
create policy amr_lab_ipc_write on public.amr_classifications for all using (
  public.current_user_has_org_role(organization_id, array['laboratory','infection_control_lead','infection_control_member']::public.app_role[])
) with check (public.current_user_has_org_role(organization_id, array['laboratory','infection_control_lead','infection_control_member']::public.app_role[]));

create policy critical_comm_authorized_read on public.critical_result_communications for select using (
  public.current_user_has_org_role(organization_id, array['hospital_admin','infection_control_lead','infection_control_member','laboratory','doctor_reviewer']::public.app_role[])
);
create policy critical_comm_lab_write on public.critical_result_communications for insert with check (
  public.current_user_has_org_role(organization_id, array['laboratory']::public.app_role[])
);

create index if not exists idx_lab_samples_org_status on public.laboratory_samples(organization_id,status,collected_at desc);
create index if not exists idx_micro_results_sample on public.microbiology_results(sample_id,resulted_at desc);
create index if not exists idx_ast_result on public.antimicrobial_susceptibility_results(microbiology_result_id);
create index if not exists idx_critical_comm_result on public.critical_result_communications(microbiology_result_id,communicated_at desc);

-- Legacy critical communication columns remain readable during migration, but new writes use
-- critical_result_communications so repeated/escalated communications are preserved rather than overwritten.
