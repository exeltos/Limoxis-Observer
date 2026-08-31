-- Consolidate the superseded Platform Center demo grants into the entitlement
-- table used by authentication, tenant administration, and create-demo-access.
do $$
begin
  -- Some environments may have skipped the legacy migration because its old
  -- version prefix collided with another file. Keep consolidation safe there.
  if to_regclass('public.demo_entitlements') is not null then
    insert into public.platform_demo_entitlements (
      id, organization_id, label, valid_from, valid_until, status,
      created_by, created_at, updated_at
    )
    select
      id,
      organization_id,
      coalesce(nullif(notes, ''), nullif(scope_id, ''), 'Demo access'),
      valid_from,
      coalesce(valid_until, date '9999-12-31'),
      case status
        when 'suspended' then 'paused'
        when 'scheduled' then 'active'
        else status
      end,
      created_by,
      created_at,
      updated_at
    from public.demo_entitlements
    on conflict (id) do nothing;
  end if;
end $$;

drop table if exists public.demo_entitlements;
