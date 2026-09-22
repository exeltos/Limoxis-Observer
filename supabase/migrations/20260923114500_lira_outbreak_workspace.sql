-- LIRA Phase 5H: governed outbreak investigation workspace persistence.
create table if not exists public.lira_outbreak_investigations (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 title text not null, organism text, department_id uuid references public.departments(id) on delete set null,
 status text not null default 'draft' check(status in ('draft','active','closed')),
 definition_id text, definition_version text, definition_json jsonb not null default '{}'::jsonb,
 scope_from date, scope_to date, hypotheses jsonb not null default '[]'::jsonb, decisions jsonb not null default '[]'::jsonb,
 created_by uuid not null default auth.uid() references auth.users(id) on delete restrict, created_at timestamptz not null default now(),
 updated_by uuid references auth.users(id) on delete set null, updated_at timestamptz not null default now(), closed_at timestamptz,
 check ((definition_id is null and definition_version is null) or (definition_id is not null and definition_version is not null)),
 check (scope_to is null or scope_from is null or scope_to>=scope_from)
);
create table if not exists public.lira_outbreak_investigation_events (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 investigation_id uuid not null references public.lira_outbreak_investigations(id) on delete cascade,
 event_type text not null check(event_type in ('snapshot','hypothesis','decision','status','case_review')),
 payload jsonb not null default '{}'::jsonb, created_by uuid not null default auth.uid() references auth.users(id) on delete restrict, created_at timestamptz not null default now()
);
create index if not exists lira_outbreak_investigations_org_status_idx on public.lira_outbreak_investigations(organization_id,status,updated_at desc);
create index if not exists lira_outbreak_events_investigation_idx on public.lira_outbreak_investigation_events(investigation_id,created_at);
alter table public.lira_outbreak_investigations enable row level security;
alter table public.lira_outbreak_investigation_events enable row level security;
revoke all on table public.lira_outbreak_investigations from public,anon;
revoke all on table public.lira_outbreak_investigation_events from public,anon;
grant select,insert,update on table public.lira_outbreak_investigations to authenticated;
grant select,insert on table public.lira_outbreak_investigation_events to authenticated;
create policy lira_outbreak_investigations_select on public.lira_outbreak_investigations for select to authenticated using (public.current_user_is_platform_owner() or public.current_user_has_org_role(organization_id,array['hospital_admin','infection_control_lead','infection_control_member','laboratory','doctor_reviewer','quality_manager']::public.app_role[]));
create policy lira_outbreak_investigations_insert on public.lira_outbreak_investigations for insert to authenticated with check ((select auth.uid()) is not null and (public.current_user_is_platform_owner() or public.current_user_has_org_role(organization_id,array['hospital_admin','infection_control_lead','infection_control_member']::public.app_role[])));
create policy lira_outbreak_investigations_update on public.lira_outbreak_investigations for update to authenticated using (public.current_user_is_platform_owner() or public.current_user_has_org_role(organization_id,array['hospital_admin','infection_control_lead','infection_control_member']::public.app_role[])) with check (public.current_user_is_platform_owner() or public.current_user_has_org_role(organization_id,array['hospital_admin','infection_control_lead','infection_control_member']::public.app_role[]));
create policy lira_outbreak_events_select on public.lira_outbreak_investigation_events for select to authenticated using (public.current_user_is_platform_owner() or public.current_user_has_org_role(organization_id,array['hospital_admin','infection_control_lead','infection_control_member','laboratory','doctor_reviewer','quality_manager']::public.app_role[]));
create policy lira_outbreak_events_insert on public.lira_outbreak_investigation_events for insert to authenticated with check ((select auth.uid()) is not null and (public.current_user_is_platform_owner() or public.current_user_has_org_role(organization_id,array['hospital_admin','infection_control_lead','infection_control_member']::public.app_role[])) and exists(select 1 from public.lira_outbreak_investigations i where i.id=investigation_id and i.organization_id=lira_outbreak_investigation_events.organization_id));
