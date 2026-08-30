-- Limoxis Observer v0.27.1
-- Data-access foundation: Training, Environmental Standards, Control Drafts.
-- RLS mirrors current frontend role/scope intent instead of relying on UI hiding.

create table if not exists public.training_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  record_key text not null,
  record_type text not null default 'state',
  department_id uuid references public.departments(id) on delete set null,
  employee_user_id uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,record_key)
);

create table if not exists public.environmental_standards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  record_key text not null,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,record_key)
);

create table if not exists public.control_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  record_key text not null,
  control_id text,
  department_id uuid references public.departments(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id),
  payload jsonb not null default '{}'::jsonb,
  saved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,record_key)
);

create index if not exists idx_training_records_org_type on public.training_records(organization_id,record_type);
create index if not exists idx_training_records_scope on public.training_records(organization_id,department_id,employee_user_id);
create index if not exists idx_environmental_standards_org on public.environmental_standards(organization_id);
create index if not exists idx_control_drafts_owner on public.control_drafts(organization_id,created_by,saved_at desc);
create index if not exists idx_control_drafts_department on public.control_drafts(organization_id,department_id);


-- Capability bridge for RLS.
-- The frontend remains responsible for UX, but authorization is repeated here.
-- Custom-role capabilities and add-on grants are included so UI capability grants do not bypass DB enforcement.
-- Kept the v0.8.0 parameter name capability_key: earlier migrations' RLS
-- policies (hand_hygiene_write, waste_write, employees_read/write, etc.)
-- already depend on this function by that signature, so CREATE OR REPLACE
-- must not rename it (Postgres rejects the rename, and DROP ... CASCADE
-- would silently delete those dependent policies).
create or replace function public.current_user_has_capability(target_org uuid, capability_key text)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.current_user_is_platform_owner()
  or exists (
    select 1
    from public.organization_members om
    where om.user_id=auth.uid()
      and om.organization_id=target_org
      and om.status='active'
      and (
        exists (
          select 1
          from public.custom_role_capabilities crc
          where crc.custom_role_id=om.custom_role_id
            and crc.capability=capability_key
        )
        or exists (
          select 1
          from public.organization_member_capabilities omc
          where omc.membership_id=om.id
            and (
              (omc.capability='lab_access' and capability_key='view_lab')
              or (omc.capability='quality_access' and capability_key in ('view_quality','view_controls'))
            )
        )
        or case capability_key
          when 'view_training' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','department_manager','department_user','hr_office')
          when 'manage_training' then om.role in ('hospital_admin')
          when 'view_prevention' then om.role in ('hospital_admin','infection_control_lead','infection_control_member')
          when 'view_lab' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','laboratory')
          when 'manage_libraries' then om.role in ('hospital_admin','infection_control_lead')
          when 'view_controls' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','department_manager','department_user','laboratory','quality_manager')
          when 'manage_controls' then om.role in ('hospital_admin','infection_control_lead','quality_manager')
          else false
        end
      )
  );
$$;

alter table public.training_records enable row level security;
alter table public.environmental_standards enable row level security;
alter table public.control_drafts enable row level security;

-- Training
-- Full hospital-wide training visibility: Hospital Admin + IPC Lead.
-- HR may view workforce training.
-- Department managers/users only receive department-scoped training records.
-- Individual employee-linked records are visible to that authenticated employee.
create policy training_records_read on public.training_records
for select using (
  (record_type='program' and public.is_org_member(organization_id))
  or public.current_user_has_org_role(
    organization_id,
    array['hospital_admin','infection_control_lead','infection_control_member','hr_office']::public.app_role[]
  )
  or (
    department_id is not null
    and public.current_user_has_org_role(
      organization_id,
      array['department_manager','department_user']::public.app_role[]
    )
    and public.current_user_has_department_scope(organization_id,department_id)
  )
  or employee_user_id = auth.uid()
);

-- Current frontend MANAGE_TRAINING is granted to Hospital Admin.
create policy training_records_manage on public.training_records
for all using (
  public.current_user_has_capability(organization_id,'manage_training')
) with check (
  public.current_user_has_capability(organization_id,'manage_training')
);

-- Environmental standards are consumed by IPC and Laboratory workflows.
create policy environmental_standards_read on public.environmental_standards
for select using (
  public.current_user_has_org_role(
    organization_id,
    array['hospital_admin','infection_control_lead','infection_control_member','laboratory']::public.app_role[]
  )
);

-- Current frontend library-management authority: Hospital Admin / Infection Control Lead.
create policy environmental_standards_manage on public.environmental_standards
for all using (
  public.current_user_has_capability(organization_id,'manage_libraries')
) with check (
  public.current_user_has_capability(organization_id,'manage_libraries')
);

-- Control drafts are private working data by default.
-- The creator can always read/update/delete their own draft.
-- Hospital/Quality managers may manage all.
-- Department managers may access drafts only inside their assigned department.
create policy control_drafts_read on public.control_drafts
for select using (
  created_by = auth.uid()
  or public.current_user_has_capability(organization_id,'manage_controls')
  or (
    department_id is not null
    and public.current_user_has_org_role(
      organization_id,
      array['department_manager']::public.app_role[]
    )
    and public.current_user_has_department_scope(organization_id,department_id)
  )
);

create policy control_drafts_insert on public.control_drafts
for insert with check (
  public.is_org_member(organization_id)
  and created_by = auth.uid()
  and (
    department_id is null
    or public.current_user_has_capability(organization_id,'manage_controls')
    or public.current_user_has_department_scope(organization_id,department_id)
  )
);

create policy control_drafts_update on public.control_drafts
for update using (
  created_by = auth.uid()
  or public.current_user_has_capability(organization_id,'manage_controls')
) with check (
  created_by = auth.uid()
  or public.current_user_has_capability(organization_id,'manage_controls')
);

create policy control_drafts_delete on public.control_drafts
for delete using (
  created_by = auth.uid()
  or public.current_user_has_capability(organization_id,'manage_controls')
);

-- Force server-owned actor/timestamps on cloud writes.
create or replace function public.set_repository_audit_fields()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  new.updated_at = now();
  if tg_op='INSERT' then
    if to_jsonb(new) ? 'created_by' and new.created_by is null then new.created_by = auth.uid(); end if;
    if to_jsonb(new) ? 'updated_by' and new.updated_by is null then new.updated_by = auth.uid(); end if;
  else
    if to_jsonb(new) ? 'updated_by' then new.updated_by = auth.uid(); end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_training_records_audit on public.training_records;
create trigger trg_training_records_audit before insert or update on public.training_records
for each row execute function public.set_repository_audit_fields();

drop trigger if exists trg_environmental_standards_audit on public.environmental_standards;
create trigger trg_environmental_standards_audit before insert or update on public.environmental_standards
for each row execute function public.set_repository_audit_fields();
