-- The platform owner creates organizations from the Platform Center
-- (tenantService.createPlatformOrganization inserts into public.organizations).
-- 20260909103130 dropped every policy of the table and recreated only SELECT;
-- UPDATE came back later, INSERT never did, so each new organization failed
-- with «new row violates row-level security policy». Only the platform owner
-- may insert, the same check as the UPDATE policy.
create policy organizations_platform_owner_insert on public.organizations
  for insert to authenticated
  with check ((select private.next_is_platform_owner()));
