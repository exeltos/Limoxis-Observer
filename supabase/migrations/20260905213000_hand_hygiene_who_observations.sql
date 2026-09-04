create table if not exists public.hand_hygiene_observations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.hand_hygiene_sessions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  professional_category text not null,
  professionals_count integer not null default 1 check (professionals_count > 0),
  who_moment text not null check (who_moment in ('moment1','moment2','moment3','moment4','moment5')),
  action text not null check (action in ('HR','HW','MISSED')),
  gloves boolean not null default false,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hand_hygiene_observations_session_idx
  on public.hand_hygiene_observations(session_id, sort_order, created_at);
create index if not exists hand_hygiene_observations_org_idx
  on public.hand_hygiene_observations(organization_id, who_moment, action);

alter table public.hand_hygiene_sessions
  add column if not exists start_time time,
  add column if not exists end_time time;

alter table public.hand_hygiene_observations enable row level security;

drop policy if exists hand_hygiene_observations_read on public.hand_hygiene_observations;
create policy hand_hygiene_observations_read
on public.hand_hygiene_observations
for select
using (
  exists (
    select 1
    from public.hand_hygiene_sessions s
    where s.id = session_id
      and s.organization_id = organization_id
      and public.is_org_member(s.organization_id)
  )
);

drop policy if exists hand_hygiene_observations_write on public.hand_hygiene_observations;
create policy hand_hygiene_observations_write
on public.hand_hygiene_observations
for all
using (
  exists (
    select 1
    from public.hand_hygiene_sessions s
    where s.id = session_id
      and s.organization_id = organization_id
      and (
        public.is_org_admin(s.organization_id)
        or public.current_user_has_org_role(s.organization_id,array['infection_control_lead','infection_control_member']::public.app_role[])
        or public.current_user_has_capability(s.organization_id,'hand_hygiene_observer')
        or public.current_user_has_capability(s.organization_id,'record_hand_hygiene')
      )
  )
)
with check (
  exists (
    select 1
    from public.hand_hygiene_sessions s
    where s.id = session_id
      and s.organization_id = organization_id
      and (
        public.is_org_admin(s.organization_id)
        or public.current_user_has_org_role(s.organization_id,array['infection_control_lead','infection_control_member']::public.app_role[])
        or public.current_user_has_capability(s.organization_id,'hand_hygiene_observer')
        or public.current_user_has_capability(s.organization_id,'record_hand_hygiene')
      )
  )
);
