-- Fixes a live gap found during the post-backfill RLS health audit: public.surveillance_cases
-- and public.surveillance_events have had RLS enabled with a read-only policy since v0.4.0,
-- but no write policy was ever added. That migration's own comment said so explicitly:
-- "Write policies intentionally remain capability-specific and must be added through
-- controlled RPCs in the next hardening pass." No such RPC or write policy exists anywhere
-- in the subsequent 28 migrations (verified: zero routines matching
-- '%surveillance_case%'/'%surveillance_event%'/'create_surveillance%').
--
-- Effect: creating a new surveillance episode — arguably the single most central clinical
-- action in an infection-control surveillance product — currently fails outright against
-- this live database, since RLS denies INSERT by default when no policy grants it.
--
-- Fix: add write policies matching the exact, already-established role set used by every
-- sibling clinical table in the same domain (clinical_assessments_write, isolation_episodes_write,
-- hai_classification_write all use this identical role list), rather than inventing a new one.
create policy surveillance_cases_write on public.surveillance_cases for all using (
  public.current_user_has_org_role(organization_id, array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[])
) with check (
  public.current_user_has_org_role(organization_id, array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[])
);

create policy surveillance_events_write on public.surveillance_events for all using (
  exists (
    select 1 from public.surveillance_cases sc
    where sc.id = surveillance_case_id
      and public.current_user_has_org_role(sc.organization_id, array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[])
  )
) with check (
  exists (
    select 1 from public.surveillance_cases sc
    where sc.id = surveillance_case_id
      and public.current_user_has_org_role(sc.organization_id, array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[])
  )
);
