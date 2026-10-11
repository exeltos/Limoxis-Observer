-- Recycle bin: a deleted record is kept here for 30 days, as it was (the rows of
-- every table the deletion removed), so it can be restored or deleted for good.
-- One row per deletion, written once; a restore or «delete for good» removes it.
-- Who sees an entry depends on its module:
--   every module      → Hospital Admin (and the Platform Owner)
--   clinical          → Infection Control Lead (surveillance, laboratory, prevention, controls)
--   quality           → Quality Manager (quality, documents)
--   occupational      → Occupational Physician (vaccinations, exposures, visits)
-- No SELECT/EXECUTE/RETURNING ... INTO (the Supabase SQL editor rewrites those).

create table if not exists public.recycle_bin (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  module text not null check (module in ('clinical', 'quality', 'occupational', 'administration')),
  kind text not null check (char_length(kind) between 1 and 80),
  label text not null check (char_length(label) between 1 and 300),
  detail text check (detail is null or char_length(detail) <= 300),
  -- {"parts":[{"table":"…","rows":[…]}]} in deletion order (children first).
  payload jsonb not null,
  deleted_at timestamptz not null default now(),
  deleted_by uuid default auth.uid() references auth.users(id) on delete set null,
  deleted_by_name text check (deleted_by_name is null or char_length(deleted_by_name) <= 200),
  expires_at timestamptz not null default (now() + interval '30 days')
);

create index if not exists recycle_bin_org_deleted_idx on public.recycle_bin (organization_id, deleted_at desc);
create index if not exists recycle_bin_deleted_by_idx on public.recycle_bin (deleted_by);

alter table public.recycle_bin enable row level security;

-- The roles that see (and restore or empty) an entry of a module.
create or replace function public.current_user_can_use_recycle_bin(p_organization_id uuid, p_module text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select public.current_user_has_org_role(p_organization_id, array['hospital_admin']::public.app_role[])
    or (p_module = 'clinical' and public.current_user_has_org_role(p_organization_id, array['infection_control_lead']::public.app_role[]))
    or (p_module = 'quality' and public.current_user_has_org_role(p_organization_id, array['quality_manager']::public.app_role[]))
    or (p_module = 'occupational' and public.current_user_has_org_role(p_organization_id, array['occupational_physician']::public.app_role[]));
$function$;

revoke all on function public.current_user_can_use_recycle_bin(uuid, text) from public, anon;
grant execute on function public.current_user_can_use_recycle_bin(uuid, text) to authenticated;

create policy recycle_bin_read on public.recycle_bin for select to authenticated
  using ((select public.current_user_can_use_recycle_bin(organization_id, module)));

-- Whoever deletes a record files it in the bin, under their own name.
create policy recycle_bin_insert on public.recycle_bin for insert to authenticated
  with check (
    deleted_by = auth.uid()
    and (select public.current_user_has_org_role(organization_id, array[
      'hospital_admin', 'infection_control_lead', 'infection_control_member', 'link_nurse', 'doctor_reviewer',
      'department_manager', 'department_user', 'laboratory', 'committee_secretariat', 'hr_office', 'pharmacy',
      'occupational_physician', 'quality_manager'
    ]::public.app_role[]))
  );

create policy recycle_bin_delete on public.recycle_bin for delete to authenticated
  using ((select public.current_user_can_use_recycle_bin(organization_id, module)));

revoke all on public.recycle_bin from anon;
grant select, insert, delete on public.recycle_bin to authenticated;

-- Entries past their 30 days go for good.
create or replace function public.purge_recycle_bin()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_count integer;
begin
  delete from public.recycle_bin where expires_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

revoke all on function public.purge_recycle_bin() from public, anon, authenticated;
grant execute on function public.purge_recycle_bin() to service_role;
