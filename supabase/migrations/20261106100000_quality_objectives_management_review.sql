-- Quality Center, phase 4b: quality objectives and the management review.
--
-- quality_objectives            one row per objective (ISO 9001 §6.2): a target on
--                               a department register indicator, or a value the
--                               owner reports, with its owner and due date.
-- quality_management_reviews    one row per review (ISO 9001 §9.3, ΕΛΟΤ EN 15224):
--                               date, frequency, status (draft → approved).
-- quality_management_review_sections   one row per section of the minutes
--                               (the 16 inputs of the hospital's form), its text.
-- quality_management_review_actions    the decisions: what, who, by when, and
--                               the corrective action opened for it.
-- quality_management_review_participants  who took part and signed.
--
-- Read: Quality (roles, view_quality). Write: hospital administrators, quality
-- managers, manage_quality.

create table if not exists public.quality_objectives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  year integer not null,
  title text not null,
  description text,
  department_id uuid references public.departments(id) on delete set null,
  register_id uuid references public.department_registers(id) on delete set null,
  indicator_key text,
  target numeric,
  direction text not null default 'higher' check (direction in ('higher','lower')),
  unit text,
  reported_value numeric,
  owner_label text,
  owner_id uuid,
  due_date date,
  status text not null default 'active' check (status in ('active','achieved','not_achieved','cancelled')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);
create index if not exists quality_objectives_org_year_idx on public.quality_objectives (organization_id, year);

create table if not exists public.quality_management_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  title text not null,
  review_date date not null,
  period_from date,
  period_to date,
  frequency_days integer not null default 90 check (frequency_days between 7 and 730),
  next_review_date date,
  status text not null default 'draft' check (status in ('draft','in_review','approved')),
  summary text,
  approved_at timestamptz,
  approved_by_label text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (id, organization_id)
);
create index if not exists quality_management_reviews_org_date_idx on public.quality_management_reviews (organization_id, review_date desc);

create table if not exists public.quality_management_review_sections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  review_id uuid not null,
  key text not null,
  position integer not null default 0,
  title text not null,
  body text,
  unique (review_id, key),
  foreign key (review_id, organization_id) references public.quality_management_reviews(id, organization_id) on delete cascade
);

create table if not exists public.quality_management_review_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  review_id uuid not null,
  position integer not null default 0,
  section_key text,
  title text not null,
  owner_label text,
  due_date date,
  status text not null default 'open' check (status in ('open','done','cancelled')),
  capa_id uuid,
  foreign key (review_id, organization_id) references public.quality_management_reviews(id, organization_id) on delete cascade
);

create table if not exists public.quality_management_review_participants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  review_id uuid not null,
  position integer not null default 0,
  name text not null,
  role text,
  attended boolean not null default true,
  signed_at timestamptz,
  foreign key (review_id, organization_id) references public.quality_management_reviews(id, organization_id) on delete cascade
);

do $policies$
declare t text;
begin
  foreach t in array array['quality_objectives','quality_management_reviews','quality_management_review_sections','quality_management_review_actions','quality_management_review_participants'] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_read') then
      execute format($p$create policy %1$s_read on public.%1$s for select to authenticated using (
        public.current_user_is_platform_owner()
        or public.current_user_has_org_role(organization_id, array['hospital_admin'::public.app_role,'quality_manager'::public.app_role,'infection_control_lead'::public.app_role])
        or public.current_user_has_capability(organization_id, 'view_quality'))$p$, t);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_manage') then
      execute format($p$create policy %1$s_manage on public.%1$s for all to authenticated using (
        public.current_user_is_platform_owner()
        or public.current_user_has_org_role(organization_id, array['hospital_admin'::public.app_role,'quality_manager'::public.app_role])
        or public.current_user_has_capability(organization_id, 'manage_quality'))
        with check (
        public.current_user_is_platform_owner()
        or public.current_user_has_org_role(organization_id, array['hospital_admin'::public.app_role,'quality_manager'::public.app_role])
        or public.current_user_has_capability(organization_id, 'manage_quality'))$p$, t);
    end if;
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end
$policies$;

create or replace trigger trg_quality_objectives_touch before update on public.quality_objectives
  for each row execute function private.department_register_touch();
create or replace trigger trg_quality_management_reviews_touch before update on public.quality_management_reviews
  for each row execute function private.department_register_touch();
