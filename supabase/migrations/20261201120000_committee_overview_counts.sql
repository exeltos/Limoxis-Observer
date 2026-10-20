-- The Committees list and the calendar read every meeting, every attendance
-- row (~2,700) and every decision (~1,100) of the organization, page by page
-- (13 requests in 3 rounds, ~1.9 MB), and each row costs a committee
-- visibility check under RLS: seconds per page. The list shows only how many
-- meetings each committee has and its open decisions, so it now reads one row
-- per committee with those counts plus the open decisions; attendance and the
-- closed decisions are read only for the committee that is opened.
-- SECURITY INVOKER: every table is read under the caller's own RLS, exactly as
-- the full read was. Open decisions are those the list counts as pending
-- (status not completed/closed); open meetings are not finalized/cancelled.
create or replace function public.committee_overview_counts(p_organization_id uuid)
returns table(committee_id uuid, meetings_total bigint, meetings_open bigint, decisions_open bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with meetings as (
    select m.committee_id, count(*) as total, count(*) filter (where m.status not in ('finalized', 'cancelled')) as open
    from public.committee_meetings m
    where m.organization_id = p_organization_id
    group by m.committee_id
  ),
  decisions as (
    select d.committee_id, count(*) as open
    from public.committee_decisions d
    where d.organization_id = p_organization_id
      and d.status not in ('completed', 'closed')
    group by d.committee_id
  )
  select c.id, coalesce(m.total, 0), coalesce(m.open, 0), coalesce(d.open, 0)
  from public.committees c
  left join meetings m on m.committee_id = c.id
  left join decisions d on d.committee_id = c.id
  where c.organization_id = p_organization_id
$$;

grant execute on function public.committee_overview_counts(uuid) to authenticated;
