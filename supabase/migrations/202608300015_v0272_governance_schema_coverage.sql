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
  select not public.current_user_is_platform_owner() and (
  public.current_user_has_capability(target_org,requested_capability)
  or exists (
    select 1 from public.organization_members om
    where om.organization_id=target_org and om.user_id=auth.uid() and om.status='active'
      and case requested_capability
        when 'view_committees' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','department_manager','quality_manager')
        when 'manage_committees' then om.role in ('hospital_admin','infection_control_lead')
        when 'create_committee' then om.role in ('hospital_admin','infection_control_lead')
        when 'manage_committee_members' then om.role in ('hospital_admin','infection_control_lead')
        when 'create_committee_meeting' then om.role in ('hospital_admin','infection_control_lead')
        when 'edit_committee_minutes' then om.role in ('hospital_admin','infection_control_lead')
        when 'finalize_committee_minutes' then om.role in ('hospital_admin','infection_control_lead')
        when 'manage_committee_decisions' then om.role in ('hospital_admin','infection_control_lead')
        when 'manage_committee_documents' then om.role in ('hospital_admin','infection_control_lead')
        when 'archive_committee' then om.role in ('hospital_admin','infection_control_lead')
        when 'view_documents' then true
        when 'manage_documents' then om.role in ('hospital_admin','quality_manager')
        when 'submit_document_review' then om.role in ('hospital_admin','quality_manager')
        when 'approve_document' then om.role in ('hospital_admin','quality_manager')
        when 'publish_document' then om.role in ('hospital_admin','quality_manager')
        when 'supersede_document' then om.role in ('hospital_admin','quality_manager')
        when 'archive_document' then om.role in ('hospital_admin','quality_manager')
        when 'delete_document_draft' then om.role in ('hospital_admin','quality_manager')
        when 'execute_control' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','department_manager','department_user','laboratory','quality_manager')
        when 'edit_control_definition' then om.role in ('hospital_admin','infection_control_lead','department_manager','quality_manager')
        when 'edit_control_execution' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','department_manager','department_user','laboratory','quality_manager')
        when 'void_control_execution' then om.role in ('hospital_admin','infection_control_lead','department_manager','quality_manager')
        when 'archive_control_definition' then om.role in ('hospital_admin','infection_control_lead','quality_manager')
        when 'delete_control_draft' then om.role in ('hospital_admin','infection_control_lead','quality_manager')
        else false
      end
  ));
$$;

-- Secretariat authority is record-assigned, never organization-wide. An assignment
-- supplements a capability; it cannot grant committee creation or archival authority.
create or replace function public.current_user_can_manage_committee(target_org uuid,target_committee uuid,requested_capability text)
returns boolean language sql stable security definer set search_path=public as $$
  select public.current_user_has_governance_capability(target_org,requested_capability)
  or (
    requested_capability in ('manage_committee_members','create_committee_meeting','edit_committee_minutes','finalize_committee_minutes','manage_committee_decisions','manage_committee_documents')
    and exists (
      select 1
      from public.organization_members om
      join public.work_assignments wa on wa.membership_id=om.id and wa.organization_id=om.organization_id
      where om.organization_id=target_org and om.user_id=auth.uid() and om.status='active'
        and om.role::text='committee_secretariat'
        and wa.source_type='committee' and wa.source_id=target_committee
        and wa.status in ('open','in_progress','overdue')
    )
  );
$$;

create or replace function public.current_user_can_view_committee(target_org uuid,target_committee uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.current_user_has_governance_capability(target_org,'view_committees')
  or public.current_user_can_manage_committee(target_org,target_committee,'edit_committee_minutes');
$$;

create or replace function public.current_user_can_access_control_department(target_org uuid,target_department uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select not public.current_user_is_platform_owner() and (
    public.current_user_has_org_role(target_org,array['hospital_admin','infection_control_lead','infection_control_member','laboratory','quality_manager']::public.app_role[])
    or (target_department is not null and public.current_user_has_department_scope(target_org,target_department))
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
  status text not null default 'planned' check (status in ('draft','planned','in_progress','approval_pending','finalized','cancelled')),
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

create table public.committee_meeting_attendance (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.committee_meetings(id) on delete cascade,
  committee_id uuid not null references public.committees(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  member_id uuid references public.committee_members(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  attendee_name text not null,
  attendance_status text not null default 'not_recorded' check (attendance_status in ('not_recorded','present','absent','excused')),
  has_vote boolean not null default true,
  recorded_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(meeting_id,member_id)
);

create table public.committee_minutes_approvals (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.committee_meetings(id) on delete cascade,
  committee_id uuid not null references public.committees(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  approver_id uuid not null references auth.users(id) on delete cascade,
  member_id uuid references public.committee_members(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  comment text,
  requested_by uuid not null default auth.uid() references auth.users(id),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(meeting_id,approver_id)
);

create table public.committee_plan_items (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  indicator text,
  baseline text,
  target text,
  owner_id uuid references auth.users(id) on delete set null,
  due_date date,
  status text not null default 'open' check (status in ('open','in_progress','completed','cancelled')),
  created_by uuid not null default auth.uid() references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.committee_documents (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid,
  document_kind text not null default 'evidence' check (document_kind in ('establishment','agenda','minutes','decision','evidence','other')),
  attachment jsonb,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  check (document_id is not null or attachment is not null)
);

create table public.committee_history (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  action text not null,
  reason text,
  event_data jsonb not null default '{}'::jsonb,
  actor_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
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
alter table public.committee_members add constraint committee_members_id_org_committee_key unique(id,organization_id,committee_id);
alter table public.committee_meetings add constraint committee_meetings_id_org_key unique(id,organization_id);
alter table public.committee_meetings add constraint committee_meetings_id_org_committee_key unique(id,organization_id,committee_id);
alter table public.controlled_documents add constraint controlled_documents_id_org_key unique(id,organization_id);
alter table public.control_definitions add constraint control_definitions_id_org_key unique(id,organization_id);
alter table public.control_assignments add constraint control_assignments_id_org_key unique(id,organization_id);
alter table public.control_assignments add constraint control_assignments_execution_key unique(id,organization_id,control_id,department_id);
alter table public.control_executions add constraint control_executions_id_org_key unique(id,organization_id);
alter table public.committee_members add constraint committee_members_tenant_fk foreign key(committee_id,organization_id) references public.committees(id,organization_id) on delete cascade;
alter table public.committee_meetings add constraint committee_meetings_tenant_fk foreign key(committee_id,organization_id) references public.committees(id,organization_id) on delete cascade;
alter table public.committee_decisions add constraint committee_decisions_tenant_fk foreign key(committee_id,organization_id) references public.committees(id,organization_id) on delete cascade;
alter table public.committee_decisions add constraint committee_decisions_meeting_tenant_fk foreign key(meeting_id,organization_id) references public.committee_meetings(id,organization_id);
alter table public.committee_meeting_attendance add constraint committee_attendance_meeting_tenant_fk foreign key(meeting_id,organization_id,committee_id) references public.committee_meetings(id,organization_id,committee_id) on delete cascade;
alter table public.committee_meeting_attendance add constraint committee_attendance_member_tenant_fk foreign key(member_id,organization_id,committee_id) references public.committee_members(id,organization_id,committee_id) on delete set null (member_id);
alter table public.committee_minutes_approvals add constraint committee_minutes_approvals_meeting_tenant_fk foreign key(meeting_id,organization_id,committee_id) references public.committee_meetings(id,organization_id,committee_id) on delete cascade;
alter table public.committee_minutes_approvals add constraint committee_minutes_approvals_member_tenant_fk foreign key(member_id,organization_id,committee_id) references public.committee_members(id,organization_id,committee_id) on delete set null (member_id);
alter table public.committee_plan_items add constraint committee_plan_items_tenant_fk foreign key(committee_id,organization_id) references public.committees(id,organization_id) on delete cascade;
alter table public.committee_documents add constraint committee_documents_tenant_fk foreign key(committee_id,organization_id) references public.committees(id,organization_id) on delete cascade;
alter table public.committee_documents add constraint committee_documents_document_tenant_fk foreign key(document_id,organization_id) references public.controlled_documents(id,organization_id) on delete cascade;
alter table public.committee_history add constraint committee_history_tenant_fk foreign key(committee_id,organization_id) references public.committees(id,organization_id) on delete cascade;
alter table public.document_approvals add constraint document_approvals_tenant_fk foreign key(document_id,organization_id) references public.controlled_documents(id,organization_id) on delete cascade;
alter table public.control_assignments add constraint control_assignments_tenant_fk foreign key(control_id,organization_id) references public.control_definitions(id,organization_id) on delete cascade;
alter table public.control_executions add constraint control_executions_assignment_tenant_fk foreign key(assignment_id,organization_id,control_id,department_id) references public.control_assignments(id,organization_id,control_id,department_id);
alter table public.control_executions add constraint control_executions_definition_tenant_fk foreign key(control_id,organization_id) references public.control_definitions(id,organization_id);
alter table public.control_execution_revisions add constraint control_revisions_tenant_fk foreign key(execution_id,organization_id) references public.control_executions(id,organization_id) on delete cascade;

create index committees_org_status_idx on public.committees(organization_id,status);
create index committee_meetings_due_idx on public.committee_meetings(organization_id,scheduled_at desc);
create index committee_decisions_due_idx on public.committee_decisions(organization_id,status,due_date);
create index committee_attendance_meeting_idx on public.committee_meeting_attendance(organization_id,committee_id,meeting_id);
create index committee_minutes_approvals_status_idx on public.committee_minutes_approvals(organization_id,committee_id,status);
create index committee_plan_items_due_idx on public.committee_plan_items(organization_id,committee_id,status,due_date);
create index committee_documents_committee_idx on public.committee_documents(organization_id,committee_id,document_kind);
create index committee_history_committee_idx on public.committee_history(organization_id,committee_id,created_at desc);
create index documents_org_status_idx on public.controlled_documents(organization_id,status,review_date);
create index control_definitions_org_status_idx on public.control_definitions(organization_id,status);
create index control_assignments_due_idx on public.control_assignments(organization_id,department_id,next_due_at);
create index control_executions_history_idx on public.control_executions(control_id,department_id,performed_at desc);

alter table public.committees enable row level security;
alter table public.committee_members enable row level security;
alter table public.committee_meetings enable row level security;
alter table public.committee_decisions enable row level security;
alter table public.committee_meeting_attendance enable row level security;
alter table public.committee_minutes_approvals enable row level security;
alter table public.committee_plan_items enable row level security;
alter table public.committee_documents enable row level security;
alter table public.committee_history enable row level security;
alter table public.controlled_documents enable row level security;
alter table public.document_approvals enable row level security;
alter table public.control_definitions enable row level security;
alter table public.control_assignments enable row level security;
alter table public.control_executions enable row level security;
alter table public.control_execution_revisions enable row level security;

-- Committee policies mirror the explicit frontend lifecycle capabilities. Assignment
-- checks are tied to committee_id and cannot be reused against another committee.
create policy committees_read on public.committees for select using (
  public.current_user_can_view_committee(organization_id,id)
);
create policy committees_insert on public.committees for insert with check (
  status in ('draft','active') and public.current_user_has_governance_capability(organization_id,'create_committee')
);
create policy committees_edit on public.committees for update using (
  status<>'archived' and public.current_user_has_governance_capability(organization_id,'create_committee')
) with check (
  status<>'archived' and public.current_user_has_governance_capability(organization_id,'create_committee')
);
create policy committees_archive on public.committees for update using (
  status<>'archived' and public.current_user_has_governance_capability(organization_id,'archive_committee')
) with check (
  status='archived' and public.current_user_has_governance_capability(organization_id,'archive_committee')
);

create policy committee_members_read on public.committee_members for select using (
  public.current_user_can_view_committee(organization_id,committee_id)
);
create policy committee_members_manage on public.committee_members for all using (
  public.current_user_can_manage_committee(organization_id,committee_id,'manage_committee_members')
) with check (
  public.current_user_can_manage_committee(organization_id,committee_id,'manage_committee_members')
);

create policy committee_meetings_read on public.committee_meetings for select using (
  public.current_user_can_view_committee(organization_id,committee_id)
);
create policy committee_meetings_insert on public.committee_meetings for insert with check (
  status in ('draft','planned') and public.current_user_can_manage_committee(organization_id,committee_id,'create_committee_meeting')
);
create policy committee_meetings_edit_minutes on public.committee_meetings for update using (
  status in ('draft','planned','in_progress') and public.current_user_can_manage_committee(organization_id,committee_id,'edit_committee_minutes')
) with check (
  status in ('draft','planned','in_progress') and public.current_user_can_manage_committee(organization_id,committee_id,'edit_committee_minutes')
);
create policy committee_meetings_finalize on public.committee_meetings for update using (
  status in ('draft','planned','in_progress') and public.current_user_can_manage_committee(organization_id,committee_id,'finalize_committee_minutes')
) with check (
  status in ('approval_pending','finalized') and (status='approval_pending' or finalized_at is not null)
  and public.current_user_can_manage_committee(organization_id,committee_id,'finalize_committee_minutes')
);

create policy committee_decisions_read on public.committee_decisions for select using (
  public.current_user_can_view_committee(organization_id,committee_id)
);
create policy committee_decisions_manage on public.committee_decisions for all using (
  public.current_user_can_manage_committee(organization_id,committee_id,'manage_committee_decisions')
) with check (
  public.current_user_can_manage_committee(organization_id,committee_id,'manage_committee_decisions')
);

create policy committee_attendance_read on public.committee_meeting_attendance for select using (
  public.current_user_can_view_committee(organization_id,committee_id)
);
create policy committee_attendance_manage on public.committee_meeting_attendance for all using (
  public.current_user_can_manage_committee(organization_id,committee_id,'edit_committee_minutes')
  and exists (select 1 from public.committee_meetings m where m.id=meeting_id and m.organization_id=organization_id and m.committee_id=committee_id and m.status in ('draft','planned','in_progress'))
) with check (
  public.current_user_can_manage_committee(organization_id,committee_id,'edit_committee_minutes')
  and exists (select 1 from public.committee_meetings m where m.id=meeting_id and m.organization_id=organization_id and m.committee_id=committee_id and m.status in ('draft','planned','in_progress'))
);

create policy committee_minutes_approvals_read on public.committee_minutes_approvals for select using (
  approver_id=auth.uid() or public.current_user_can_view_committee(organization_id,committee_id)
);
create policy committee_minutes_approvals_request on public.committee_minutes_approvals for insert with check (
  status='pending' and public.current_user_can_manage_committee(organization_id,committee_id,'finalize_committee_minutes')
);
create policy committee_minutes_approvals_decide on public.committee_minutes_approvals for update using (
  approver_id=auth.uid() and status='pending'
) with check (
  approver_id=auth.uid() and status in ('approved','rejected') and decided_at is not null
);

create policy committee_plan_items_read on public.committee_plan_items for select using (
  public.current_user_can_view_committee(organization_id,committee_id)
);
create policy committee_plan_items_manage on public.committee_plan_items for all using (
  public.current_user_can_manage_committee(organization_id,committee_id,'manage_committee_decisions')
) with check (
  public.current_user_can_manage_committee(organization_id,committee_id,'manage_committee_decisions')
);

create policy committee_documents_read on public.committee_documents for select using (
  public.current_user_can_view_committee(organization_id,committee_id)
);
create policy committee_documents_manage on public.committee_documents for all using (
  public.current_user_can_manage_committee(organization_id,committee_id,'manage_committee_documents')
) with check (
  public.current_user_can_manage_committee(organization_id,committee_id,'manage_committee_documents')
);

create policy committee_history_read on public.committee_history for select using (
  public.current_user_can_view_committee(organization_id,committee_id)
);
create policy committee_history_append on public.committee_history for insert with check (
  public.current_user_can_manage_committee(organization_id,committee_id,'manage_committee_members')
  or public.current_user_can_manage_committee(organization_id,committee_id,'edit_committee_minutes')
  or public.current_user_can_manage_committee(organization_id,committee_id,'manage_committee_decisions')
  or public.current_user_can_manage_committee(organization_id,committee_id,'manage_committee_documents')
);

create policy document_approvals_read on public.document_approvals for select using (
  approver_id=auth.uid() or public.current_user_has_governance_capability(organization_id,'view_documents')
);
create policy document_approvals_request on public.document_approvals for insert with check (
  status='pending' and public.current_user_has_governance_capability(organization_id,'submit_document_review')
);
create policy document_approvals_decide on public.document_approvals for update using (
  approver_id=auth.uid() and status='pending'
  and public.current_user_has_governance_capability(organization_id,'approve_document')
) with check (
  approver_id=auth.uid() and status in ('approved','rejected') and decided_at is not null
  and public.current_user_has_governance_capability(organization_id,'approve_document')
);

create policy controlled_documents_read on public.controlled_documents for select using (
  public.current_user_has_governance_capability(organization_id,'view_documents')
);
create policy controlled_documents_insert on public.controlled_documents for insert with check (
  status='draft' and public.current_user_has_governance_capability(organization_id,'manage_documents')
);
create policy controlled_documents_edit_draft on public.controlled_documents for update using (
  status='draft' and public.current_user_has_governance_capability(organization_id,'manage_documents')
) with check (
  status='draft' and public.current_user_has_governance_capability(organization_id,'manage_documents')
);
create policy controlled_documents_submit_review on public.controlled_documents for update using (
  status='draft' and public.current_user_has_governance_capability(organization_id,'submit_document_review')
) with check (
  status='review' and public.current_user_has_governance_capability(organization_id,'submit_document_review')
);
create policy controlled_documents_approve on public.controlled_documents for update using (
  status='review' and public.current_user_has_governance_capability(organization_id,'approve_document')
) with check (
  status='approved' and public.current_user_has_governance_capability(organization_id,'approve_document')
);
create policy controlled_documents_publish on public.controlled_documents for update using (
  status='approved' and public.current_user_has_governance_capability(organization_id,'publish_document')
) with check (
  status='published' and public.current_user_has_governance_capability(organization_id,'publish_document')
);
create policy controlled_documents_archive on public.controlled_documents for update using (
  status='published' and public.current_user_has_governance_capability(organization_id,'archive_document')
) with check (
  status='archived' and public.current_user_has_governance_capability(organization_id,'archive_document')
);
create policy controlled_documents_supersede on public.controlled_documents for update using (
  status='published' and public.current_user_has_governance_capability(organization_id,'supersede_document')
) with check (
  status='superseded' and public.current_user_has_governance_capability(organization_id,'supersede_document')
);
create policy controlled_documents_delete_draft on public.controlled_documents for delete using (
  status='draft' and public.current_user_has_governance_capability(organization_id,'delete_document_draft')
);

create policy control_definitions_read on public.control_definitions for select
using (public.current_user_has_capability(organization_id,'view_controls'));
create policy control_definitions_manage on public.control_definitions for all
using (public.current_user_has_capability(organization_id,'manage_controls'))
with check (public.current_user_has_capability(organization_id,'manage_controls'));
create policy control_assignments_read on public.control_assignments for select using (
  public.current_user_has_capability(organization_id,'view_controls')
  and public.current_user_can_access_control_department(organization_id,department_id)
);
create policy control_assignments_manage on public.control_assignments for all
using (public.current_user_has_capability(organization_id,'manage_controls'))
with check (public.current_user_has_capability(organization_id,'manage_controls'));
create policy control_executions_read on public.control_executions for select using (
  public.current_user_has_capability(organization_id,'view_controls')
  and public.current_user_can_access_control_department(organization_id,department_id)
);
create policy control_executions_insert on public.control_executions for insert with check (
  performed_by=auth.uid() and public.current_user_has_governance_capability(organization_id,'execute_control')
  and public.current_user_can_access_control_department(organization_id,department_id)
);
create policy control_executions_edit on public.control_executions for update using (
  status='completed' and public.current_user_has_governance_capability(organization_id,'edit_control_execution')
  and (performed_by=auth.uid() or public.current_user_has_capability(organization_id,'manage_controls'))
) with check (
  status='completed' and public.current_user_has_governance_capability(organization_id,'edit_control_execution')
);
create policy control_executions_void on public.control_executions for update using (
  status='completed' and public.current_user_has_governance_capability(organization_id,'void_control_execution')
) with check (
  status='cancelled' and cancelled_at is not null and nullif(trim(cancellation_reason),'') is not null
  and public.current_user_has_governance_capability(organization_id,'void_control_execution')
);
create policy control_revisions_read on public.control_execution_revisions for select using (
  exists (
    select 1 from public.control_executions execution
    where execution.id=control_execution_revisions.execution_id
      and execution.organization_id=control_execution_revisions.organization_id
  )
);
create policy control_revisions_insert on public.control_execution_revisions for insert with check (
  changed_by=auth.uid()
  and exists (
    select 1 from public.control_executions execution
    where execution.id=control_execution_revisions.execution_id
      and execution.organization_id=control_execution_revisions.organization_id
      and (execution.performed_by=auth.uid() or public.current_user_has_capability(control_execution_revisions.organization_id,'manage_controls'))
  )
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

-- Apply the same department boundary to the rest of Quality. The original policies
-- granted every department manager hospital-wide visibility.
drop policy if exists quality_audit_authorized_read on public.quality_audits;
create policy quality_audit_authorized_read on public.quality_audits for select using (
  public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager','infection_control_lead']::public.app_role[])
  or (department_id is not null
      and public.current_user_has_org_role(organization_id,array['department_manager']::public.app_role[])
      and public.current_user_has_department_scope(organization_id,department_id))
);
drop policy if exists quality_finding_authorized_read on public.quality_findings;
create policy quality_finding_authorized_read on public.quality_findings for select using (
  owner_id=auth.uid()
  or public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager','infection_control_lead']::public.app_role[])
  or (department_id is not null
      and public.current_user_has_org_role(organization_id,array['department_manager']::public.app_role[])
      and public.current_user_has_department_scope(organization_id,department_id))
);
drop policy if exists quality_capa_authorized_read on public.quality_capa_actions;
create policy quality_capa_authorized_read on public.quality_capa_actions for select using (
  owner_id=auth.uid()
  or public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager','infection_control_lead']::public.app_role[])
  or (department_id is not null
      and public.current_user_has_org_role(organization_id,array['department_manager']::public.app_role[])
      and public.current_user_has_department_scope(organization_id,department_id))
);
drop policy if exists quality_links_authorized on public.quality_record_links;
create policy quality_links_authorized on public.quality_record_links for select using (
  public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager','infection_control_lead']::public.app_role[])
);

-- Laboratory cleanup: these indexes duplicate the canonical indexes created by v0.5.0.
drop index if exists public.idx_lab_samples_org_status;
drop index if exists public.idx_micro_results_sample;

-- Shared audit trigger keeps mutable governance records server-authored.
create or replace function public.protect_committee_minutes_approval_identity()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.id<>old.id or new.organization_id<>old.organization_id or new.committee_id<>old.committee_id
     or new.meeting_id<>old.meeting_id or new.approver_id<>old.approver_id
     or new.requested_by<>old.requested_by or new.requested_at<>old.requested_at then
    raise exception 'Committee minutes approval identity is immutable';
  end if;
  return new;
end;
$$;

create or replace function public.protect_document_approval_identity()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.id<>old.id or new.organization_id<>old.organization_id or new.document_id<>old.document_id
     or new.step_number<>old.step_number or new.approver_id is distinct from old.approver_id
     or new.created_at<>old.created_at then
    raise exception 'Document approval identity is immutable';
  end if;
  return new;
end;
$$;

create trigger trg_committees_audit before insert or update on public.committees
for each row execute function public.set_repository_audit_fields();
create trigger trg_committee_meetings_audit before insert or update on public.committee_meetings
for each row execute function public.set_repository_audit_fields();
create trigger trg_committee_attendance_audit before insert or update on public.committee_meeting_attendance
for each row execute function public.set_repository_audit_fields();
create trigger trg_committee_minutes_approvals_audit before insert or update on public.committee_minutes_approvals
for each row execute function public.set_repository_audit_fields();
create trigger trg_committee_minutes_approvals_identity before update on public.committee_minutes_approvals
for each row execute function public.protect_committee_minutes_approval_identity();
create trigger trg_committee_plan_items_audit before insert or update on public.committee_plan_items
for each row execute function public.set_repository_audit_fields();
create trigger trg_documents_audit before insert or update on public.controlled_documents
for each row execute function public.set_repository_audit_fields();
create trigger trg_document_approvals_identity before update on public.document_approvals
for each row execute function public.protect_document_approval_identity();
create trigger trg_control_definitions_audit before insert or update on public.control_definitions
for each row execute function public.set_repository_audit_fields();
