-- Announcements (owner, 12/11/2026): the audience list holds hospitals and demo hospitals together. A member of a demo
-- hospital reads the active announcements of the period that name that demo hospital (the old «show in every demo»
-- policy and the hospital administrator's policy stay as they are).
create policy platform_announcements_demo_target_read on public.platform_announcements for select to authenticated
  using (
    status = 'active' and starts_at <= now() and (ends_at is null or ends_at > now())
    and exists (
      select 1
      from public.organization_members om
      join public.organizations o on o.id = om.organization_id
      where om.user_id = auth.uid() and om.status = 'active' and o.is_demo
        and om.organization_id = any(audience_org_ids)
    )
  );
