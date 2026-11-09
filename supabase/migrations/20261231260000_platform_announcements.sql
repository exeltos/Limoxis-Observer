-- Announcements of the platform owner to the hospital administrators (owner, 8/11/2026): an announcement or a
-- product promotion, shown in a window when a hospital administrator opens the application, once or at every visit,
-- to every hospital or to the chosen ones, within its period. The owner sees who has seen it.
-- A platform-level record: it belongs to no hospital (audience_org_ids names the hospitals; empty = every hospital).
create table if not exists public.platform_announcements (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'announcement' check (kind in ('announcement','promotion')),
  title_el text not null check (length(btrim(title_el)) > 0),
  title_en text,
  body_el text not null check (length(btrim(body_el)) > 0),
  body_en text,
  cta_label_el text,
  cta_label_en text,
  cta_url text check (cta_url is null or cta_url ~ '^(/|https://)'),
  image_url text check (image_url is null or image_url ~ '^https://'),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  audience_org_ids uuid[] not null default '{}',
  frequency text not null default 'once' check (frequency in ('once','every_visit')),
  status text not null default 'active' check (status in ('active','stopped')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_announcements_window check (ends_at is null or ends_at > starts_at)
);
create index if not exists platform_announcements_active_idx on public.platform_announcements (status, starts_at, ends_at);

-- Who has seen an announcement: one row per administrator, in the hospital where it was shown.
create table if not exists public.platform_announcement_views (
  announcement_id uuid not null references public.platform_announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);
create index if not exists platform_announcement_views_org_idx on public.platform_announcement_views (organization_id);

alter table public.platform_announcements enable row level security;
alter table public.platform_announcement_views enable row level security;
revoke all on public.platform_announcements from anon;
revoke all on public.platform_announcement_views from anon;
grant select, insert, update, delete on public.platform_announcements to authenticated;
grant select, insert, update on public.platform_announcement_views to authenticated;

-- The owner writes and reads them all.
create policy platform_announcements_owner_all on public.platform_announcements for all to authenticated
  using (public.current_user_is_platform_owner()) with check (public.current_user_is_platform_owner());
-- A hospital administrator reads the active ones of the period that are meant for one of their hospitals.
create policy platform_announcements_admin_read on public.platform_announcements for select to authenticated
  using (
    status = 'active' and starts_at <= now() and (ends_at is null or ends_at > now())
    and exists (
      select 1 from public.organization_members om
      where om.user_id = auth.uid() and om.status = 'active' and om.role = 'hospital_admin'
        and (cardinality(audience_org_ids) = 0 or om.organization_id = any(audience_org_ids))
    )
  );

-- The administrator records that they saw it (their own row, in a hospital they administer); the owner reads them all.
create policy platform_announcement_views_own_read on public.platform_announcement_views for select to authenticated
  using (user_id = auth.uid() or public.current_user_is_platform_owner());
create policy platform_announcement_views_own_insert on public.platform_announcement_views for insert to authenticated
  with check (user_id = auth.uid() and public.current_user_has_org_role(organization_id, array['hospital_admin'::public.app_role]));
create policy platform_announcement_views_own_update on public.platform_announcement_views for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.current_user_has_org_role(organization_id, array['hospital_admin'::public.app_role]));
