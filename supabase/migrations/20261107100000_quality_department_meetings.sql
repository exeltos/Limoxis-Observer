-- Quality Center, phase 5: department meetings.
--
-- quality_department_meetings              one row per meeting of a department
--                                          (ISO 9001 §9.1.3, §10): date, the month
--                                          its indicators refer to, agenda, minutes,
--                                          status (draft → final), next meeting.
-- quality_department_meeting_decisions     the decisions: what, who, by when, its
--                                          status, the corrective action opened for
--                                          it and the meeting it was carried from.
-- quality_department_meeting_participants  who took part.
--
-- Read: Quality (roles, view_quality) and the meeting's department.
-- Write: Quality (roles, manage_quality) and the meeting's department. A
-- department only reaches its own meetings; who else sees them all is given
-- view_quality.

create table if not exists public.quality_department_meetings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  code text not null,
  title text not null,
  kind text not null default 'regular' check (kind in ('regular','extraordinary')),
  meeting_date date not null,
  period_month date,
  agenda text,
  minutes text,
  next_meeting_date date,
  status text not null default 'draft' check (status in ('draft','final')),
  finalized_at timestamptz,
  finalized_by_label text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Numbered within the department (DM-2026-01, DM-2026-02…): a department sees only its own.
  unique (organization_id, department_id, code),
  unique (id, organization_id)
);
create index if not exists quality_department_meetings_org_department_idx on public.quality_department_meetings (organization_id, department_id, meeting_date desc);

create table if not exists public.quality_department_meeting_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  meeting_id uuid not null,
  position integer not null default 0,
  title text not null,
  owner_label text,
  due_date date,
  status text not null default 'open' check (status in ('open','done','cancelled')),
  capa_id uuid,
  carried_from text,
  foreign key (meeting_id, organization_id) references public.quality_department_meetings(id, organization_id) on delete cascade
);
create index if not exists quality_department_meeting_decisions_meeting_idx on public.quality_department_meeting_decisions (meeting_id);

create table if not exists public.quality_department_meeting_participants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  meeting_id uuid not null,
  position integer not null default 0,
  name text not null,
  role text,
  attended boolean not null default true,
  foreign key (meeting_id, organization_id) references public.quality_department_meetings(id, organization_id) on delete cascade
);
create index if not exists quality_department_meeting_participants_meeting_idx on public.quality_department_meeting_participants (meeting_id);

do $policies$
declare
  t text;
  scope text;
begin
  foreach t in array array['quality_department_meetings','quality_department_meeting_decisions','quality_department_meeting_participants'] loop
    execute format('alter table public.%I enable row level security', t);
    -- The meeting's department: on the meeting itself, or through its meeting.
    scope := case when t = 'quality_department_meetings'
      then 'public.current_user_has_department_scope(organization_id, department_id)'
      else 'exists (select 1 from public.quality_department_meetings m where m.id = meeting_id and public.current_user_has_department_scope(m.organization_id, m.department_id))' end;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_read') then
      execute format($p$create policy %1$s_read on public.%1$s for select to authenticated using (
        public.current_user_is_platform_owner()
        or public.current_user_has_org_role(organization_id, array['hospital_admin'::public.app_role,'quality_manager'::public.app_role,'infection_control_lead'::public.app_role])
        or public.current_user_has_capability(organization_id, 'view_quality')
        or %2$s)$p$, t, scope);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_manage') then
      execute format($p$create policy %1$s_manage on public.%1$s for all to authenticated using (
        public.current_user_is_platform_owner()
        or public.current_user_has_org_role(organization_id, array['hospital_admin'::public.app_role,'quality_manager'::public.app_role])
        or public.current_user_has_capability(organization_id, 'manage_quality')
        or %2$s)
        with check (
        public.current_user_is_platform_owner()
        or public.current_user_has_org_role(organization_id, array['hospital_admin'::public.app_role,'quality_manager'::public.app_role])
        or public.current_user_has_capability(organization_id, 'manage_quality')
        or %2$s)$p$, t, scope);
    end if;
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end
$policies$;

create or replace trigger trg_quality_department_meetings_touch before update on public.quality_department_meetings
  for each row execute function private.department_register_touch();
