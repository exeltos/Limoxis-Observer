-- First operating-profile preset renamed 'laboratory' -> 'basic' (patients only; the
-- laboratory and ΕΟΔΥ/EARS-Net reports become modules the Platform Owner unlocks).
-- 'laboratory' stays valid for organizations saved earlier: the app reads it as
-- patients + laboratory + ΕΟΔΥ/EARS-Net, so nothing changes for them.
alter table public.organizations drop constraint if exists organizations_operating_profile_check;
alter table public.organizations add constraint organizations_operating_profile_check
  check (operating_profile in ('basic','laboratory','surveillance','full','custom'));
