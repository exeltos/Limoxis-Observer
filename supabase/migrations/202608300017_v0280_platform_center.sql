-- Limoxis Observer v0.28.0 — Platform Owner Center, Demo entitlement and global reporting
alter table public.organizations add column if not exists region text;
alter table public.organizations add column if not exists city text;

create table if not exists public.demo_entitlements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  scope_type text not null default 'organization' check (scope_type in ('organization','account')),
  scope_id text not null,
  valid_from date not null default current_date,
  valid_until date,
  status text not null default 'active' check (status in ('scheduled','active','suspended','expired','revoked')),
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until is null or valid_until >= valid_from)
);
create index if not exists demo_entitlements_org_idx on public.demo_entitlements(organization_id,status,valid_until);
alter table public.demo_entitlements enable row level security;
drop policy if exists demo_entitlements_platform_all on public.demo_entitlements;
create policy demo_entitlements_platform_all on public.demo_entitlements for all using (public.current_user_is_platform_owner()) with check (public.current_user_is_platform_owner());

-- Platform owners require a platform-wide membership view.
drop policy if exists memberships_member_read on public.organization_members;
create policy memberships_member_read on public.organization_members for select using (public.current_user_is_platform_owner() or user_id = auth.uid() or public.has_org_role(organization_id, array['hospital_admin']::public.app_role[]));

drop policy if exists audit_platform_read on public.system_audit_log;
create policy audit_platform_read on public.system_audit_log for select using (public.current_user_is_platform_owner());

create or replace function public.platform_report_summary(p_organization_id uuid default null,p_from date default null,p_to date default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare r jsonb;
begin
 if not public.current_user_is_platform_owner() then raise exception 'platform owner required'; end if;
 select jsonb_build_object(
  'surveillance',(select count(*) from public.surveillance_cases s where (p_organization_id is null or s.organization_id=p_organization_id) and (p_from is null or s.created_at::date>=p_from) and (p_to is null or s.created_at::date<=p_to)),
  'laboratory',(select count(*) from public.laboratory_samples l where (p_organization_id is null or l.organization_id=p_organization_id) and (p_from is null or l.created_at::date>=p_from) and (p_to is null or l.created_at::date<=p_to)),
  'prevention',((select count(*) from public.hand_hygiene_sessions p where (p_organization_id is null or p.organization_id=p_organization_id) and (p_from is null or p.created_at::date>=p_from) and (p_to is null or p.created_at::date<=p_to)) + (select count(*) from public.waste_measurements p where (p_organization_id is null or p.organization_id=p_organization_id) and (p_from is null or p.created_at::date>=p_from) and (p_to is null or p.created_at::date<=p_to)) + (select count(*) from public.prevention_bundle_assessments p where (p_organization_id is null or p.organization_id=p_organization_id) and (p_from is null or p.created_at::date>=p_from) and (p_to is null or p.created_at::date<=p_to))),
  'controls',(select count(*) from public.control_executions c where (p_organization_id is null or c.organization_id=p_organization_id) and (p_from is null or c.created_at::date>=p_from) and (p_to is null or c.created_at::date<=p_to)),
  'quality',((select count(*) from public.quality_incidents q where (p_organization_id is null or q.organization_id=p_organization_id) and (p_from is null or q.created_at::date>=p_from) and (p_to is null or q.created_at::date<=p_to)) + (select count(*) from public.quality_findings q where (p_organization_id is null or q.organization_id=p_organization_id) and (p_from is null or q.created_at::date>=p_from) and (p_to is null or q.created_at::date<=p_to)) + (select count(*) from public.quality_capa_actions q where (p_organization_id is null or q.organization_id=p_organization_id) and (p_from is null or q.created_at::date>=p_from) and (p_to is null or q.created_at::date<=p_to))),
  'training',(select count(*) from public.training_records t where (p_organization_id is null or t.organization_id=p_organization_id) and (p_from is null or t.created_at::date>=p_from) and (p_to is null or t.created_at::date<=p_to)),
  'documents',(select count(*) from public.controlled_documents d where (p_organization_id is null or d.organization_id=p_organization_id) and (p_from is null or d.created_at::date>=p_from) and (p_to is null or d.created_at::date<=p_to)),
  'committees',(select count(*) from public.committees c where (p_organization_id is null or c.organization_id=p_organization_id) and (p_from is null or c.created_at::date>=p_from) and (p_to is null or c.created_at::date<=p_to)),
  'handHygiene',(select count(*) from public.hand_hygiene_sessions p where (p_organization_id is null or p.organization_id=p_organization_id) and (p_from is null or p.created_at::date>=p_from) and (p_to is null or p.created_at::date<=p_to)),
  'waste',(select count(*) from public.waste_measurements p where (p_organization_id is null or p.organization_id=p_organization_id) and (p_from is null or p.created_at::date>=p_from) and (p_to is null or p.created_at::date<=p_to)),
  'antimicrobial',(select count(*) from public.antimicrobial_therapies a where (p_organization_id is null or a.organization_id=p_organization_id) and (p_from is null or a.created_at::date>=p_from) and (p_to is null or a.created_at::date<=p_to)),'occupationalHealth',(select count(*) from public.occupational_health_visits o where (p_organization_id is null or o.organization_id=p_organization_id) and (p_from is null or o.created_at::date>=p_from) and (p_to is null or o.created_at::date<=p_to))
 ) into r; return r;
end $$;

grant execute on function public.platform_report_summary(uuid,date,date) to authenticated;
