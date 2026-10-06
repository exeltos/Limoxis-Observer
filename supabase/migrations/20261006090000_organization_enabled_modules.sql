-- Per-module control of an organization's operating profile. The Platform Owner
-- switches the optional modules one by one; a preset (laboratory / surveillance /
-- full) is only a shortcut that fills the list. NULL keeps the old behaviour:
-- the modules follow operating_profile, so existing organizations are unchanged.
alter table public.organizations
  add column if not exists enabled_modules text[];

alter table public.organizations drop constraint if exists organizations_enabled_modules_check;
alter table public.organizations add constraint organizations_enabled_modules_check
  check (enabled_modules is null or enabled_modules <@ array['patients','laboratory','national','surveillance','indicators','prevention','controls','quality','training','governance']::text[]);

alter table public.organizations drop constraint if exists organizations_operating_profile_check;
alter table public.organizations add constraint organizations_operating_profile_check
  check (operating_profile in ('laboratory','surveillance','full','custom'));
