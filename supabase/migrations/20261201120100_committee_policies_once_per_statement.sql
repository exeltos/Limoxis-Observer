-- Every committee policy called
-- public.current_user_can_view_committee / current_user_can_manage_committee
-- per row (~1.45 ms each). These read, once per statement (initplan), the
-- organizations where the user holds the governance capability and the
-- "organization:committee" pairs where the user is assigned secretariat or an
-- active member, mirroring the two functions exactly.

create or replace function private.current_user_committee_orgs(p_capabilities text[])
returns uuid[] language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(o.organization_id), '{}')
  from (select distinct om.organization_id from public.organization_members om where om.user_id = auth.uid()) o
  where exists (select 1 from unnest(p_capabilities) c(capability)
    where public.current_user_has_governance_capability(o.organization_id, c.capability));
$$;
grant execute on function private.current_user_committee_orgs(text[]) to authenticated;

create or replace function private.current_user_committee_pairs(p_include_members boolean)
returns text[] language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(distinct p.pair), '{}') from (
    select om.organization_id::text || ':' || wa.source_id::text as pair
    from public.organization_members om
    join public.work_assignments wa on wa.membership_id = om.id and wa.organization_id = om.organization_id
    where om.user_id = auth.uid() and om.status = 'active' and om.role::text = 'committee_secretariat'
      and wa.source_type = 'committee' and wa.source_id is not null
      and wa.status in ('open', 'in_progress', 'overdue')
    union all
    select cm.organization_id::text || ':' || cm.committee_id::text
    from public.committee_members cm
    where p_include_members and cm.user_id = auth.uid() and cm.ended_at is null
      and cm.approval_status in ('approved', 'not_required')
  ) p;
$$;
grant execute on function private.current_user_committee_pairs(boolean) to authenticated;

alter policy committees_read on public.committees
  using (((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['view_committees','edit_committee_minutes']))::uuid[]) or (organization_id::text || ':' || id::text) = any ((select private.current_user_committee_pairs(true))::text[])));

alter policy committee_meetings_read on public.committee_meetings
  using (((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['view_committees','edit_committee_minutes']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(true))::text[])));

alter policy committee_history_read on public.committee_history
  using (((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['view_committees','edit_committee_minutes']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(true))::text[])));

alter policy committee_minutes_approval_history_read on public.committee_minutes_approval_history
  using (((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['view_committees','edit_committee_minutes']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(true))::text[])));

alter policy committee_minutes_external_approvals_read on public.committee_minutes_external_approvals
  using (((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['view_committees','edit_committee_minutes']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(true))::text[])));

alter policy committee_minutes_approvals_read on public.committee_minutes_approvals
  using (approver_id = (select auth.uid()) or ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['view_committees','edit_committee_minutes']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(true))::text[])));

alter policy committee_attendance_read on public.committee_meeting_attendance
  using (((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['view_committees','edit_committee_minutes']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(true))::text[])) or (((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['edit_committee_minutes']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(false))::text[])) and exists (select 1 from public.committee_meetings m where m.id = committee_meeting_attendance.meeting_id and m.organization_id = committee_meeting_attendance.organization_id and m.committee_id = committee_meeting_attendance.committee_id and m.status = any (array['draft','planned','in_progress']))));

alter policy committee_decisions_read on public.committee_decisions
  using (((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['view_committees','edit_committee_minutes']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(true))::text[])) or ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['manage_committee_decisions']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(false))::text[])));

alter policy committee_decisions_insert on public.committee_decisions
  with check (((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['manage_committee_decisions']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(false))::text[])));

alter policy committee_decisions_update on public.committee_decisions
  using (((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['manage_committee_decisions']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(false))::text[])))
  with check (((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['manage_committee_decisions']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(false))::text[])));

alter policy committee_decisions_delete on public.committee_decisions
  using (((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['manage_committee_decisions']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(false))::text[])));

alter policy committee_documents_read on public.committee_documents
  using (((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['view_committees','edit_committee_minutes']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(true))::text[])) or ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['manage_committee_documents']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(false))::text[])));

alter policy committee_documents_insert on public.committee_documents
  with check (((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['manage_committee_documents']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(false))::text[])));

alter policy committee_documents_update on public.committee_documents
  using (((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['manage_committee_documents']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(false))::text[])))
  with check (((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['manage_committee_documents']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(false))::text[])));

alter policy committee_documents_delete on public.committee_documents
  using (((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['manage_committee_documents']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(false))::text[])));

alter policy committee_members_read on public.committee_members
  using (((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['view_committees','edit_committee_minutes']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(true))::text[])) or ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['manage_committee_members']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(false))::text[])));

alter policy committee_members_insert on public.committee_members
  with check (((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['manage_committee_members']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(false))::text[])));

alter policy committee_members_update on public.committee_members
  using (((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['manage_committee_members']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(false))::text[])))
  with check (((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['manage_committee_members']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(false))::text[])));

alter policy committee_members_delete on public.committee_members
  using (((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['manage_committee_members']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(false))::text[])));

alter policy committee_plan_items_read on public.committee_plan_items
  using (((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['view_committees','edit_committee_minutes']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(true))::text[])) or ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['manage_committee_decisions']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(false))::text[])));

alter policy committee_plan_items_insert on public.committee_plan_items
  with check (((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['manage_committee_decisions']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(false))::text[])));

alter policy committee_plan_items_update on public.committee_plan_items
  using (((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['manage_committee_decisions']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(false))::text[])))
  with check (((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['manage_committee_decisions']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(false))::text[])));

alter policy committee_plan_items_delete on public.committee_plan_items
  using (((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['manage_committee_decisions']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(false))::text[])));

alter policy committee_attendance_insert on public.committee_meeting_attendance
  with check ((((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['edit_committee_minutes']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(false))::text[])) and exists (select 1 from public.committee_meetings m where m.id = committee_meeting_attendance.meeting_id and m.organization_id = committee_meeting_attendance.organization_id and m.committee_id = committee_meeting_attendance.committee_id and m.status = any (array['draft','planned','in_progress']))));

alter policy committee_attendance_update on public.committee_meeting_attendance
  using ((((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['edit_committee_minutes']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(false))::text[])) and exists (select 1 from public.committee_meetings m where m.id = committee_meeting_attendance.meeting_id and m.organization_id = committee_meeting_attendance.organization_id and m.committee_id = committee_meeting_attendance.committee_id and m.status = any (array['draft','planned','in_progress']))))
  with check ((((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['edit_committee_minutes']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(false))::text[])) and exists (select 1 from public.committee_meetings m where m.id = committee_meeting_attendance.meeting_id and m.organization_id = committee_meeting_attendance.organization_id and m.committee_id = committee_meeting_attendance.committee_id and m.status = any (array['draft','planned','in_progress']))));

alter policy committee_attendance_delete on public.committee_meeting_attendance
  using ((((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['edit_committee_minutes']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(false))::text[])) and exists (select 1 from public.committee_meetings m where m.id = committee_meeting_attendance.meeting_id and m.organization_id = committee_meeting_attendance.organization_id and m.committee_id = committee_meeting_attendance.committee_id and m.status = any (array['draft','planned','in_progress']))));

alter policy committee_history_append on public.committee_history
  with check (((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['manage_committee_members','create_committee_meeting','edit_committee_minutes','finalize_committee_minutes','manage_committee_decisions','manage_committee_documents']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(false))::text[])));

alter policy committee_meetings_insert on public.committee_meetings
  with check (status = any (array['draft','planned']) and ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['create_committee_meeting']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(false))::text[])));

alter policy committee_meetings_update on public.committee_meetings
  using ((status = any (array['draft','planned','in_progress']) and ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['create_committee_meeting']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(false))::text[]))) or (status = any (array['draft','planned','in_progress']) and ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['edit_committee_minutes']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(false))::text[]))) or (status = any (array['draft','planned','in_progress']) and ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['finalize_committee_minutes']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(false))::text[]))))
  with check ((status = 'cancelled' and nullif(btrim(coalesce(cancellation_reason, '')), '') is not null and cancelled_at is not null and cancelled_by = (select auth.uid()) and ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['create_committee_meeting']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(false))::text[]))) or (status = any (array['draft','planned','in_progress']) and ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['edit_committee_minutes']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(false))::text[]))) or (status = any (array['approval_pending','finalized']) and (status = 'approval_pending' or finalized_at is not null) and ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['finalize_committee_minutes']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(false))::text[]))));

alter policy committee_minutes_approvals_request on public.committee_minutes_approvals
  with check (status = 'pending' and ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['finalize_committee_minutes']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(false))::text[])));

alter policy committee_minutes_approvals_update on public.committee_minutes_approvals
  using ((status = 'pending' and ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['finalize_committee_minutes']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(false))::text[]))) or (approver_id = (select auth.uid()) and status = 'pending'))
  with check ((status = 'cancelled' and decided_at is null and ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_committee_orgs(array['finalize_committee_minutes']))::uuid[]) or (organization_id::text || ':' || committee_id::text) = any ((select private.current_user_committee_pairs(false))::text[]))) or (approver_id = (select auth.uid()) and status = any (array['approved','rejected']) and decided_at is not null));
