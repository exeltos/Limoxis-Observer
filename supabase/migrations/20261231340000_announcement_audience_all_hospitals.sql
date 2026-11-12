-- Announcements (owner, 12/11/2026): «Where it shows» chooses hospitals and demos separately.
--   audience_all_hospitals  every registered (non-demo) hospital
--   show_in_demo            every demo hospital (already there)
--   audience_org_ids        single hospitals or demo hospitals
-- Nothing chosen in the screen is saved as both «all» flags on. Older rows keep what they did: an empty list meant
-- every hospital.
alter table public.platform_announcements add column if not exists audience_all_hospitals boolean not null default false;
update public.platform_announcements set audience_all_hospitals = true
  where cardinality(audience_org_ids) = 0 and audience_all_hospitals = false;

-- The hospital administrator reads the ones for every hospital or naming their hospital.
alter policy platform_announcements_admin_read on public.platform_announcements
  using (
    status = 'active' and starts_at <= now() and (ends_at is null or ends_at > now())
    and exists (
      select 1 from public.organization_members om
      join public.organizations o on o.id = om.organization_id
      where om.user_id = auth.uid() and om.status = 'active' and om.role = 'hospital_admin'
        and ((audience_all_hospitals and not o.is_demo) or om.organization_id = any(audience_org_ids))
    )
  );
