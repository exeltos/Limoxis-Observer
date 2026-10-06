-- Per-module control of an organization's operating profile. The Platform Owner
-- switches the optional modules one by one; a preset (laboratory / surveillance /
-- full) is only a shortcut that fills the list. NULL keeps the old behaviour:
-- the modules follow operating_profile, so existing organizations are unchanged.
-- The two columns of 20261005090000 are repeated (if not exists) so this file also
-- runs on a database that has not received that migration yet. The Platform Owner
-- update/delete policies from that file are still needed: apply it as well.
alter table public.organizations
  add column if not exists operating_profile text not null default 'full',
  add column if not exists enabled_addons text[] not null default array['occupational_health','pharmacy','prevalence_survey','lira']::text[],
  add column if not exists enabled_modules text[];

alter table public.organizations drop constraint if exists organizations_enabled_addons_check;
alter table public.organizations add constraint organizations_enabled_addons_check
  check (enabled_addons <@ array['occupational_health','pharmacy','prevalence_survey','lira']::text[]);

alter table public.organizations drop constraint if exists organizations_enabled_modules_check;
alter table public.organizations add constraint organizations_enabled_modules_check
  check (enabled_modules is null or enabled_modules <@ array['patients','laboratory','national','surveillance','indicators','prevention','controls','quality','training','governance']::text[]);

alter table public.organizations drop constraint if exists organizations_operating_profile_check;
alter table public.organizations add constraint organizations_operating_profile_check
  check (operating_profile in ('laboratory','surveillance','full','custom'));
