-- Limoxis Observer v0.12.0 — Quality, Incidents, Findings, CAPA & Audits

create table if not exists public.quality_incidents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  title text not null,
  department_id uuid,
  occurred_at timestamptz not null,
  severity text not null check (severity in ('low','medium','high','critical')),
  status text not null default 'reported' check (status in ('reported','under_review','closed')),
  description text,
  reported_by uuid references auth.users(id),
  owner_id uuid references auth.users(id),
  linked_patient_id uuid,
  linked_surveillance_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,code)
);

create table if not exists public.quality_audits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  title text not null,
  audit_type text not null check (audit_type in ('internal','external')),
  department_id uuid,
  scope text,
  planned_date date,
  completed_date date,
  status text not null default 'planned' check (status in ('planned','in_progress','completed','cancelled')),
  lead_auditor_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,code)
);

create table if not exists public.quality_findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  title text not null,
  department_id uuid,
  identified_at timestamptz not null default now(),
  severity text not null check (severity in ('low','medium','high','critical')),
  status text not null default 'open' check (status in ('open','in_progress','closed')),
  description text,
  source_type text not null check (source_type in ('manual','incident','audit','control','other')),
  source_id text,
  owner_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,code)
);

create table if not exists public.quality_capa_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  title text not null,
  department_id uuid,
  source_type text not null check (source_type in ('incident','finding','audit','control','other')),
  source_id text,
  action_type text not null check (action_type in ('corrective','preventive')),
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  status text not null default 'open' check (status in ('open','in_progress','verification','closed')),
  description text,
  owner_id uuid references auth.users(id),
  due_date date,
  effectiveness_due date,
  effectiveness_status text default 'pending' check (effectiveness_status in ('pending','effective','not_effective')),
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,code)
);

create table if not exists public.quality_record_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_type text not null,
  source_id text not null,
  target_type text not null,
  target_id text not null,
  relationship text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.quality_incidents enable row level security;
alter table public.quality_audits enable row level security;
alter table public.quality_findings enable row level security;
alter table public.quality_capa_actions enable row level security;
alter table public.quality_record_links enable row level security;

create policy quality_incident_org_read on public.quality_incidents for select using (
  public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager','infection_control_lead','department_manager']::public.app_role[])
);
create policy quality_incident_report on public.quality_incidents for insert with check (
  public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager','infection_control_lead','infection_control_member','department_manager','department_user','laboratory','pharmacy','hr_office','occupational_physician','doctor_reviewer']::public.app_role[])
);
create policy quality_incident_manage on public.quality_incidents for update using (
  public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager']::public.app_role[])
) with check (public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager']::public.app_role[]));

create policy quality_audit_manage on public.quality_audits for all using (
  public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager']::public.app_role[])
) with check (public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager']::public.app_role[]));
create policy quality_audit_authorized_read on public.quality_audits for select using (
  public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager','infection_control_lead','department_manager']::public.app_role[])
);

create policy quality_finding_manage on public.quality_findings for all using (
  public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager']::public.app_role[])
) with check (public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager']::public.app_role[]));
create policy quality_finding_authorized_read on public.quality_findings for select using (
  public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager','infection_control_lead','department_manager']::public.app_role[])
);

create policy quality_capa_manage on public.quality_capa_actions for all using (
  public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager']::public.app_role[])
) with check (public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager']::public.app_role[]));
create policy quality_capa_authorized_read on public.quality_capa_actions for select using (
  public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager','infection_control_lead','department_manager']::public.app_role[])
);

create policy quality_links_authorized on public.quality_record_links for select using (
  public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager','infection_control_lead','department_manager']::public.app_role[])
);
create policy quality_links_manage on public.quality_record_links for all using (
  public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager']::public.app_role[])
) with check (public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager']::public.app_role[]));

create index if not exists idx_quality_incidents_org_status on public.quality_incidents(organization_id,status,occurred_at desc);
create index if not exists idx_quality_findings_org_status on public.quality_findings(organization_id,status,identified_at desc);
create index if not exists idx_quality_capa_org_status_due on public.quality_capa_actions(organization_id,status,due_date);
create index if not exists idx_quality_audits_org_status on public.quality_audits(organization_id,status,planned_date);
