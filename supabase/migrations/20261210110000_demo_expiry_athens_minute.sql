-- A Demo closes when its last day ends in Athens, within a minute, not up to an hour
-- later and not two to three hours off (current_date is UTC). The check stays out of
-- the RLS helpers, which run per row on every list: the members of a closed Demo are
-- put on hold by private.apply_org_access, now every minute instead of every hour.

create or replace function private.org_access_open(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.organizations o
    where o.id = p_organization_id and o.status = 'active' and o.deletion_scheduled_at is null
      and (not o.is_demo or not exists (
        select 1 from public.platform_demo_entitlements e
        where e.organization_id = o.id
          and not (e.status = 'active'
                   and (now() at time zone 'Europe/Athens')::date between e.valid_from and e.valid_until)))
  );
$function$;

create or replace function public.current_demo_access()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'organizationId', o.id,
    'organizationName', o.name,
    'label', e.label,
    'validFrom', e.valid_from,
    'validUntil', e.valid_until,
    'status', coalesce(e.status, 'active'),
    'organizationStatus', o.status,
    'daysLeft', case when e.valid_until is null then null else e.valid_until - (now() at time zone 'Europe/Athens')::date end,
    'open', private.org_access_open(o.id)
  ) order by o.name), '[]'::jsonb)
  from public.organization_members om
  join public.organizations o on o.id = om.organization_id and o.is_demo
  left join public.platform_demo_entitlements e on e.organization_id = o.id
  where om.user_id = auth.uid() and (om.status = 'active' or om.access_hold is not null);
$function$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('limoxis-org-access', '* * * * *', 'select private.apply_all_org_access()');
  end if;
end $$;
