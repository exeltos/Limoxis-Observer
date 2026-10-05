-- Operating profile per organization: which parts of the platform a hospital
-- uses (src/core/organization/operatingProfile.js). Existing organizations keep
-- everything: profile 'full' with every add-on.
alter table public.organizations
  add column if not exists operating_profile text not null default 'full',
  add column if not exists enabled_addons text[] not null default array['occupational_health','pharmacy','prevalence_survey','lira']::text[];

alter table public.organizations drop constraint if exists organizations_operating_profile_check;
alter table public.organizations add constraint organizations_operating_profile_check
  check (operating_profile in ('laboratory','surveillance','full'));
alter table public.organizations drop constraint if exists organizations_enabled_addons_check;
alter table public.organizations add constraint organizations_enabled_addons_check
  check (enabled_addons <@ array['occupational_health','pharmacy','prevalence_survey','lira']::text[]);

-- 20260909103130 replaced every organizations policy with a read-only one, so
-- since then Platform Owner edits (details, pause, and now the operating
-- profile) were rejected by RLS. Restore update/delete for the Platform Owner
-- only; hospital admins keep editing their own profile through
-- update_organization_profile(), which does not touch the operating profile.
drop policy if exists organizations_platform_owner_update on public.organizations;
create policy organizations_platform_owner_update on public.organizations
  for update to authenticated
  using ((select private.next_is_platform_owner()))
  with check ((select private.next_is_platform_owner()));
drop policy if exists organizations_platform_owner_delete on public.organizations;
create policy organizations_platform_owner_delete on public.organizations
  for delete to authenticated
  using ((select private.next_is_platform_owner()));
