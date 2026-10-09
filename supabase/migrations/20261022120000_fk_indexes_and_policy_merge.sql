-- Database advisor clean-up (2026-10-09).
--
-- 1. Covering indexes for the 7 foreign keys the performance advisor reports
--    without one. The (meeting_id, status) index is widened so it also covers the
--    composite tenant foreign key (meeting_id, organization_id, committee_id);
--    queries by meeting and status keep using it.
-- 2. antimicrobial_therapies and antimicrobial_therapy_administrations each had two
--    permissive SELECT policies (role-based read + Demo administrator read), which
--    Postgres evaluates one after the other for every row. They become one policy
--    with the same two conditions joined by OR, so every user sees exactly the
--    same rows as before.

create index if not exists committee_minutes_external_committee_idx on public.committee_minutes_external_approvals (committee_id);
create index if not exists committee_minutes_external_member_idx on public.committee_minutes_external_approvals (member_id);
create index if not exists committee_minutes_external_recorded_by_idx on public.committee_minutes_external_approvals (recorded_by);
create index if not exists committee_minutes_external_requested_by_idx on public.committee_minutes_external_approvals (requested_by);
create index if not exists committee_minutes_external_meeting_tenant_idx on public.committee_minutes_external_approvals (meeting_id, organization_id, committee_id, status);
drop index if exists public.committee_minutes_external_meeting_idx;

create index if not exists employee_position_acknowledgements_employee_id_idx on public.employee_position_acknowledgements (employee_id);
create index if not exists employee_position_acknowledgements_acknowledged_by_idx on public.employee_position_acknowledgements (acknowledged_by);

alter policy antimicrobial_therapies_read on public.antimicrobial_therapies
  using (
    current_user_is_platform_owner()
    or current_user_has_org_role(organization_id, array['infection_control_lead','infection_control_member','pharmacy','doctor_reviewer','laboratory']::app_role[])
    or (select current_user_is_demo_admin(organization_id))
  );
drop policy if exists antimicrobial_therapies_demo_admin_read on public.antimicrobial_therapies;

alter policy antimicrobial_therapy_administrations_select on public.antimicrobial_therapy_administrations
  using (
    current_user_is_platform_owner()
    or current_user_has_org_role(organization_id, array['infection_control_lead','infection_control_member','pharmacy','doctor_reviewer','laboratory']::app_role[])
    or (select current_user_is_demo_admin(organization_id))
  );
drop policy if exists antimicrobial_therapy_administrations_demo_admin_read on public.antimicrobial_therapy_administrations;
