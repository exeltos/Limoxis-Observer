-- Limoxis Observer v0.27.2
-- Governance schema coverage: committees, controlled documents and controls.
-- Also tightens Quality RLS and removes obsolete Laboratory artefacts.

-- The capability bridge is deliberately kept in the database: UI visibility is not authorization.
create or replace function public.current_user_has_governance_capability(target_org uuid, requested_capability text)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.current_user_is_platform_owner()
  or public.current_user_has_capability(target_org,requested_capability)
  or exists (
    select 1 from public.organization_members om
    where om.organization_id=target_org and om.user_id=auth.uid() and om.status='active'
      and case requested_capability
        when 'view_committees' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','department_manager','quality_manager')
        when 'manage_committees' then om.role in ('hospital_admin','infection_control_lead')
        when 'view_documents' then true
        when 'manage_documents' then om.role in ('hospital_admin','infection_control_lead','quality_manager')
        else false
      end
  );
$$;

create table public.committees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  short_name text,
  committee_type text not null default 'custom',
  status text not null default 'active' check (status in ('draft','active','inactive','archived')),
  mandate text,
  legal_basis text,
  decision_number text,
  term_start date,
  term_end date,
  meeting_frequency text,
  quorum_rule text,
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,code),
  check (term_end is null or term_start is null or term_end >= term_start)
);

create table public.committee_members (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  member_name text not null,
  title text not null,
  responsibilities text,
  member_type text not null default 'regular' check (member_type in ('regular','alternate','observer','advisor')),
  has_vote boolean not null default true,
  approval_status text not null default 'not_required' check (approval_status in ('not_required','pending','approved','rejected')),
  started_at date,
  ended_at date,
  created_at timestamptz not null default now(),
  check (ended_at is null or started_at is null or ended_at >= started_at)
);

create table public.committee_meetings (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  scheduled_at timestamptz not null,
  status text not null default 'planned' check (status in ('planned','in_progress','finalized','cancelled')),
  minutes_number text,
  quorum_met boolean,
  agenda jsonb not null default '[]'::jsonb,
  minutes text,
  finalized_at timestamptz,
  finalized_by uuid references auth.users(id),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.committee_decisions (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  meeting_id uuid references public.committee_meetings(id) on delete set null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  action text,
  owner_id uuid references auth.users(id) on delete set null,
  due_date date,
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  status text not null default 'open' check (status in ('open','in_progress','completed','cancelled')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.controlled_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  title text not null,
  document_type text not null,
  department_id uuid references public.departments(id) on delete set null,
  audience text not null default 'organization' check (audience in ('organization','department','restricted')),
  status text not null default 'draft' check (status in ('draft','review','approved','published','superseded','archived')),
  version text not null default '0.1',
  description text,
  owner_id uuid references auth.users(id) on delete set null,
  revision_of_id uuid references public.controlled_documents(id) on delete set null,
  supersedes_id uuid references public.controlled_documents(id) on delete set null,
  effective_date date,
  review_date date,
  published_at timestamptz,
  published_by uuid references auth.users(id),
  created_by uuid not null default auth.uid() references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,code,version),
  check (review_date is null or effective_date is null or review_date >= effective_date)
);

create table public.document_approvals (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.controlled_documents(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  step_number integer not null check (step_number > 0),
  approver_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  comment text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique(document_id,step_number)
);

create table public.control_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  title text not null,
  category text not null,
  description text,
  owner_id uuid references auth.users(id) on delete set null,
  response_config jsonb not null default '{}'::jsonb,
  frequency_config jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('draft','active','inactive','archived')),
  created_by uuid not null default auth.uid() references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,code)
);

create table public.control_assignments (
  id uuid primary key default gen_random_uuid(),
  control_id uuid not null references public.control_definitions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  assignee_id uuid references auth.users(id) on delete set null,
  last_completed_at timestamptz,
  next_due_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled','due','overdue','paused')),
  unique(control_id,department_id)
);

create table public.control_executions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.control_assignments(id) on delete restrict,
  control_id uuid not null references public.control_definitions(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete restrict,
  status text not null default 'completed' check (status in ('completed','cancelled')),
  value_text text,
  response_data jsonb not null default '{}'::jsonb,
  notes text,
  has_finding boolean not null default false,
  performed_at timestamptz not null default now(),
  performed_by uuid not null default auth.uid() references auth.users(id),
  edited_at timestamptz,
  edited_by uuid references auth.users(id),
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id),
  cancellation_reason text,
  created_at timestamptz not null default now(),
  check (status <> 'cancelled' or (cancelled_at is not null and cancellation_reason is not null))
);

create table public.control_execution_revisions (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references public.control_executions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  before_data jsonb not null,
  after_data jsonb not null,
  reason text,
  changed_by uuid not null default auth.uid() references auth.users(id),
  changed_at timestamptz not null default now()
);

-- Composite tenant keys prevent a child row from naming a parent in another organization.
alter table public.committees add constraint committees_id_org_key unique(id,organization_id);
alter table public.committee_meetings add constraint committee_meetings_id_org_key unique(id,organization_id);
alter table public.controlled_documents add constraint controlled_documents_id_org_key unique(id,organization_id);
alter table public.control_definitions add constraint control_definitions_id_org_key unique(id,organization_id);
alter table public.control_assignments add constraint control_assignments_id_org_key unique(id,organization_id);
alter table public.control_executions add constraint control_executions_id_org_key unique(id,organization_id);
alter table public.committee_members add constraint committee_members_tenant_fk foreign key(committee_id,organization_id) references public.committees(id,organization_id) on delete cascade;
alter table public.committee_meetings add constraint committee_meetings_tenant_fk foreign key(committee_id,organization_id) references public.committees(id,organization_id) on delete cascade;
alter table public.committee_decisions add constraint committee_decisions_tenant_fk foreign key(committee_id,organization_id) references public.committees(id,organization_id) on delete cascade;
alter table public.committee_decisions add constraint committee_decisions_meeting_tenant_fk foreign key(meeting_id,organization_id) references public.committee_meetings(id,organization_id);
alter table public.document_approvals add constraint document_approvals_tenant_fk foreign key(document_id,organization_id) references public.controlled_documents(id,organization_id) on delete cascade;
alter table public.control_assignments add constraint control_assignments_tenant_fk foreign key(control_id,organization_id) references public.control_definitions(id,organization_id) on delete cascade;
alter table public.control_executions add constraint control_executions_assignment_tenant_fk foreign key(assignment_id,organization_id) references public.control_assignments(id,organization_id);
alter table public.control_executions add constraint control_executions_definition_tenant_fk foreign key(control_id,organization_id) references public.control_definitions(id,organization_id);
alter table public.control_execution_revisions add constraint control_revisions_tenant_fk foreign key(execution_id,organization_id) references public.control_executions(id,organization_id) on delete cascade;

create index committees_org_status_idx on public.committees(organization_id,status);
create index committee_meetings_due_idx on public.committee_meetings(organization_id,scheduled_at desc);
create index committee_decisions_due_idx on public.committee_decisions(organization_id,status,due_date);
create index documents_org_status_idx on public.controlled_documents(organization_id,status,review_date);
create index control_definitions_org_status_idx on public.control_definitions(organization_id,status);
create index control_assignments_due_idx on public.control_assignments(organization_id,department_id,next_due_at);
create index control_executions_history_idx on public.control_executions(control_id,department_id,performed_at desc);

alter table public.committees enable row level security;
alter table public.committee_members enable row level security;
alter table public.committee_meetings enable row level security;
alter table public.committee_decisions enable row level security;
alter table public.controlled_documents enable row level security;
alter table public.document_approvals enable row level security;
alter table public.control_definitions enable row level security;
alter table public.control_assignments enable row level security;
alter table public.control_executions enable row level security;
alter table public.control_execution_revisions enable row level security;

-- Child rows repeat organization_id so policies are cheap and tenant boundaries stay explicit.
do $$
declare t text;
begin
  foreach t in array array['committees','committee_members','committee_meetings','committee_decisions'] loop
    execute format('create policy %I on public.%I for select using (public.current_user_has_governance_capability(organization_id,''view_committees''))',t||'_read',t);
    execute format('create policy %I on public.%I for all using (public.current_user_has_governance_capability(organization_id,''manage_committees'')) with check (public.current_user_has_governance_capability(organization_id,''manage_committees''))',t||'_manage',t);
  end loop;
  foreach t in array array['controlled_documents','document_approvals'] loop
    execute format('create policy %I on public.%I for select using (public.current_user_has_governance_capability(organization_id,''view_documents''))',t||'_read',t);
    execute format('create policy %I on public.%I for all using (public.current_user_has_governance_capability(organization_id,''manage_documents'')) with check (public.current_user_has_governance_capability(organization_id,''manage_documents''))',t||'_manage',t);
  end loop;
end $$;

create policy control_definitions_read on public.control_definitions for select
using (public.current_user_has_capability(organization_id,'view_controls'));
create policy control_definitions_manage on public.control_definitions for all
using (public.current_user_has_capability(organization_id,'manage_controls'))
with check (public.current_user_has_capability(organization_id,'manage_controls'));
create policy control_assignments_read on public.control_assignments for select using (
  public.current_user_has_capability(organization_id,'manage_controls')
  or (public.current_user_has_capability(organization_id,'view_controls') and public.current_user_has_department_scope(organization_id,department_id))
);
create policy control_assignments_manage on public.control_assignments for all
using (public.current_user_has_capability(organization_id,'manage_controls'))
with check (public.current_user_has_capability(organization_id,'manage_controls'));
create policy control_executions_read on public.control_executions for select using (
  public.current_user_has_capability(organization_id,'manage_controls')
  or (public.current_user_has_capability(organization_id,'view_controls') and public.current_user_has_department_scope(organization_id,department_id))
);
create policy control_executions_insert on public.control_executions for insert with check (
  performed_by=auth.uid() and public.current_user_has_capability(organization_id,'view_controls')
  and public.current_user_has_department_scope(organization_id,department_id)
);
create policy control_executions_manage on public.control_executions for update
using (performed_by=auth.uid() or public.current_user_has_capability(organization_id,'manage_controls'))
with check (performed_by=auth.uid() or public.current_user_has_capability(organization_id,'manage_controls'));
create policy control_revisions_read on public.control_execution_revisions for select using (
  public.current_user_has_capability(organization_id,'view_controls')
);
create policy control_revisions_insert on public.control_execution_revisions for insert with check (
  changed_by=auth.uid() and public.current_user_has_capability(organization_id,'view_controls')
);

-- Quality fix: reporters can see their report; department roles only see their assigned scope.
drop policy if exists quality_incident_org_read on public.quality_incidents;
create policy quality_incident_org_read on public.quality_incidents for select using (
  reported_by=auth.uid()
  or public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager','infection_control_lead']::public.app_role[])
  or (department_id is not null
      and public.current_user_has_org_role(organization_id,array['department_manager']::public.app_role[])
      and public.current_user_has_department_scope(organization_id,department_id))
);

-- Laboratory cleanup: these indexes duplicate the canonical indexes created by v0.5.0.
drop index if exists public.idx_lab_samples_org_status;
drop index if exists public.idx_micro_results_sample;

-- Shared audit trigger keeps mutable governance records server-authored.
create trigger trg_committees_audit before insert or update on public.committees
for each row execute function public.set_repository_audit_fields();
create trigger trg_documents_audit before insert or update on public.controlled_documents
for each row execute function public.set_repository_audit_fields();
create trigger trg_control_definitions_audit before insert or update on public.control_definitions
for each row execute function public.set_repository_audit_fields();
