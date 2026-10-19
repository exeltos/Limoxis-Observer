-- Quality resources: the hospital's suppliers and its medical equipment.
--
-- quality_suppliers          a supplier, its certifications (with expiry), its
--                            yearly evaluations (six criteria, a score) and its
--                            nonconformities; kept by Quality.
-- quality_equipment          a device: what and where it is, who supplied it, how
--                            critical it is, and how often it is maintained and
--                            calibrated. The next due dates follow from its events.
-- quality_equipment_events   what happened to a device: maintenance, calibration,
--                            electrical safety test, failure, repair. A department
--                            records them on its own devices.
--
-- Reading: Quality (hospital administrator, quality manager, infection control
-- lead, view_quality) reads everything; a department reads its own devices and
-- their events. Writing: Quality (hospital administrator, quality manager,
-- manage_quality); a department adds events on its own devices. The checks are
-- worked out once per query (scalar subqueries), as in 20261110100200.

-- The organizations where the user manages Quality.
create or replace function private.current_user_quality_manage_orgs()
returns uuid[] language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(distinct om.organization_id), '{}') from public.organization_members om
  where om.user_id = auth.uid() and om.status = 'active'
    and (om.role = any (array['hospital_admin','quality_manager']::public.app_role[])
      or public.current_user_has_capability(om.organization_id, 'manage_quality'));
$$;
revoke all on function private.current_user_quality_manage_orgs() from public, anon;
grant execute on function private.current_user_quality_manage_orgs() to authenticated;

create table if not exists public.quality_suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null check (length(btrim(name)) > 1),
  category text not null default 'consumables',
  criticality text not null default 'medium' check (criticality in ('high','medium','low')),
  status text not null default 'active' check (status in ('active','inactive')),
  tax_id text,
  contact_name text,
  phone text,
  email text,
  address text,
  website text,
  products text,
  contract_ends_on date,
  notes text,
  certifications jsonb not null default '[]'::jsonb check (jsonb_typeof(certifications) = 'array'),
  evaluations jsonb not null default '[]'::jsonb check (jsonb_typeof(evaluations) = 'array'),
  nonconformities jsonb not null default '[]'::jsonb check (jsonb_typeof(nonconformities) = 'array'),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (id, organization_id)
);
create index if not exists quality_suppliers_org_idx on public.quality_suppliers (organization_id, status);

create table if not exists public.quality_equipment (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null check (length(btrim(name)) > 1),
  equipment_type text,
  department_id uuid references public.departments(id) on delete set null,
  location text,
  manufacturer text,
  model text,
  serial_number text,
  inventory_number text,
  supplier_id uuid references public.quality_suppliers(id) on delete set null,
  criticality text not null default 'medium' check (criticality in ('high','medium','low')),
  status text not null default 'in_service' check (status in ('in_service','retired')),
  installed_on date,
  warranty_ends_on date,
  maintenance_months integer check (maintenance_months is null or maintenance_months between 1 and 120),
  calibration_months integer check (calibration_months is null or calibration_months between 1 and 120),
  safety_months integer check (safety_months is null or safety_months between 1 and 120),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (id, organization_id)
);
create index if not exists quality_equipment_org_idx on public.quality_equipment (organization_id, department_id);
create index if not exists quality_equipment_supplier_idx on public.quality_equipment (supplier_id);

create table if not exists public.quality_equipment_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  equipment_id uuid not null,
  kind text not null check (kind in ('maintenance','calibration','safety','failure','repair')),
  happened_on date not null default current_date,
  result text not null default 'pass' check (result in ('pass','fail','returned','out_of_service')),
  performed_by text,
  description text,
  certificate text,
  capa_code text,
  recorded_by uuid default auth.uid(),
  recorded_at timestamptz not null default now(),
  foreign key (equipment_id, organization_id) references public.quality_equipment(id, organization_id) on delete cascade
);
create index if not exists quality_equipment_events_equipment_idx on public.quality_equipment_events (equipment_id, happened_on desc);
create index if not exists quality_equipment_events_org_idx on public.quality_equipment_events (organization_id, happened_on desc);

alter table public.quality_suppliers enable row level security;
alter table public.quality_equipment enable row level security;
alter table public.quality_equipment_events enable row level security;

create policy quality_suppliers_read on public.quality_suppliers for select to authenticated using (
  (select public.current_user_is_platform_owner())
  or organization_id = any ((select private.current_user_quality_read_orgs())::uuid[]));
create policy quality_suppliers_manage on public.quality_suppliers for all to authenticated
  using ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_quality_manage_orgs())::uuid[]))
  with check ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_quality_manage_orgs())::uuid[]));

create policy quality_equipment_read on public.quality_equipment for select to authenticated using (
  (select public.current_user_is_platform_owner())
  or organization_id = any ((select private.current_user_quality_read_orgs())::uuid[])
  or (department_id is not null and (organization_id::text || ':' || department_id::text) = any ((select private.current_user_department_scopes())::text[])));
create policy quality_equipment_manage on public.quality_equipment for all to authenticated
  using ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_quality_manage_orgs())::uuid[]))
  with check ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_quality_manage_orgs())::uuid[]));

-- An event is read, and added, by whoever reads its device; removed only by Quality.
create policy quality_equipment_events_read on public.quality_equipment_events for select to authenticated using (
  (select public.current_user_is_platform_owner())
  or organization_id = any ((select private.current_user_quality_read_orgs())::uuid[])
  or exists (select 1 from public.quality_equipment e where e.id = equipment_id and e.department_id is not null
    and (e.organization_id::text || ':' || e.department_id::text) = any ((select private.current_user_department_scopes())::text[])));
create policy quality_equipment_events_insert on public.quality_equipment_events for insert to authenticated with check (
  (select public.current_user_is_platform_owner())
  or organization_id = any ((select private.current_user_quality_manage_orgs())::uuid[])
  or exists (select 1 from public.quality_equipment e where e.id = equipment_id and e.organization_id = quality_equipment_events.organization_id and e.department_id is not null
    and (e.organization_id::text || ':' || e.department_id::text) = any ((select private.current_user_department_scopes())::text[])));
create policy quality_equipment_events_remove on public.quality_equipment_events for delete to authenticated using (
  (select public.current_user_is_platform_owner())
  or organization_id = any ((select private.current_user_quality_manage_orgs())::uuid[]));

revoke all on public.quality_suppliers from anon;
revoke all on public.quality_equipment from anon;
revoke all on public.quality_equipment_events from anon;
grant select, insert, update, delete on public.quality_suppliers to authenticated;
grant select, insert, update, delete on public.quality_equipment to authenticated;
grant select, insert, delete on public.quality_equipment_events to authenticated;
revoke update on public.quality_equipment_events from authenticated;

create or replace trigger trg_quality_suppliers_touch before update on public.quality_suppliers
  for each row execute function private.department_register_touch();
create or replace trigger trg_quality_equipment_touch before update on public.quality_equipment
  for each row execute function private.department_register_touch();
