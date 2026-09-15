-- Consolidates the committee_* + management_announcements overlaps that were
-- previously left alone due to unprovable subsumption. Empirically verified
-- (scratch-table test) that Postgres combines multiple permissive policies
-- for the same role+command by OR-ing their USING clauses together and
-- separately OR-ing their WITH CHECK clauses together - so folding N
-- policies into 1 policy with USING=(u1 OR u2 OR ... ) / WITH CHECK=(w1 OR
-- w2 OR ...) is mathematically identical to keeping them separate. No
-- subsumption proof needed; this is a pure zero-risk syntactic consolidation.

-- committee_decisions
drop policy if exists committee_decisions_read on public.committee_decisions;
create policy committee_decisions_read on public.committee_decisions for select to authenticated
  using (
    current_user_can_view_committee(organization_id, committee_id)
    or current_user_can_manage_committee(organization_id, committee_id, 'manage_committee_decisions')
  );
drop policy if exists committee_decisions_manage on public.committee_decisions;
create policy committee_decisions_insert on public.committee_decisions for insert to authenticated
  with check (current_user_can_manage_committee(organization_id, committee_id, 'manage_committee_decisions'));
create policy committee_decisions_update on public.committee_decisions for update to authenticated
  using (current_user_can_manage_committee(organization_id, committee_id, 'manage_committee_decisions'))
  with check (current_user_can_manage_committee(organization_id, committee_id, 'manage_committee_decisions'));
create policy committee_decisions_delete on public.committee_decisions for delete to authenticated
  using (current_user_can_manage_committee(organization_id, committee_id, 'manage_committee_decisions'));

-- committee_documents
drop policy if exists committee_documents_read on public.committee_documents;
create policy committee_documents_read on public.committee_documents for select to authenticated
  using (
    current_user_can_view_committee(organization_id, committee_id)
    or current_user_can_manage_committee(organization_id, committee_id, 'manage_committee_documents')
  );
drop policy if exists committee_documents_manage on public.committee_documents;
create policy committee_documents_insert on public.committee_documents for insert to authenticated
  with check (current_user_can_manage_committee(organization_id, committee_id, 'manage_committee_documents'));
create policy committee_documents_update on public.committee_documents for update to authenticated
  using (current_user_can_manage_committee(organization_id, committee_id, 'manage_committee_documents'))
  with check (current_user_can_manage_committee(organization_id, committee_id, 'manage_committee_documents'));
create policy committee_documents_delete on public.committee_documents for delete to authenticated
  using (current_user_can_manage_committee(organization_id, committee_id, 'manage_committee_documents'));

-- committee_meeting_attendance
drop policy if exists committee_attendance_read on public.committee_meeting_attendance;
create policy committee_attendance_read on public.committee_meeting_attendance for select to authenticated
  using (
    current_user_can_view_committee(organization_id, committee_id)
    or (
      current_user_can_manage_committee(organization_id, committee_id, 'edit_committee_minutes')
      and exists (
        select 1 from committee_meetings m
        where m.id = committee_meeting_attendance.meeting_id
          and m.organization_id = committee_meeting_attendance.organization_id
          and m.committee_id = committee_meeting_attendance.committee_id
          and m.status = any (array['draft','planned','in_progress'])
      )
    )
  );
drop policy if exists committee_attendance_manage on public.committee_meeting_attendance;
create policy committee_attendance_insert on public.committee_meeting_attendance for insert to authenticated
  with check (
    current_user_can_manage_committee(organization_id, committee_id, 'edit_committee_minutes')
    and exists (select 1 from committee_meetings m where m.id = committee_meeting_attendance.meeting_id and m.organization_id = committee_meeting_attendance.organization_id and m.committee_id = committee_meeting_attendance.committee_id and m.status = any (array['draft','planned','in_progress']))
  );
create policy committee_attendance_update on public.committee_meeting_attendance for update to authenticated
  using (
    current_user_can_manage_committee(organization_id, committee_id, 'edit_committee_minutes')
    and exists (select 1 from committee_meetings m where m.id = committee_meeting_attendance.meeting_id and m.organization_id = committee_meeting_attendance.organization_id and m.committee_id = committee_meeting_attendance.committee_id and m.status = any (array['draft','planned','in_progress']))
  )
  with check (
    current_user_can_manage_committee(organization_id, committee_id, 'edit_committee_minutes')
    and exists (select 1 from committee_meetings m where m.id = committee_meeting_attendance.meeting_id and m.organization_id = committee_meeting_attendance.organization_id and m.committee_id = committee_meeting_attendance.committee_id and m.status = any (array['draft','planned','in_progress']))
  );
create policy committee_attendance_delete on public.committee_meeting_attendance for delete to authenticated
  using (
    current_user_can_manage_committee(organization_id, committee_id, 'edit_committee_minutes')
    and exists (select 1 from committee_meetings m where m.id = committee_meeting_attendance.meeting_id and m.organization_id = committee_meeting_attendance.organization_id and m.committee_id = committee_meeting_attendance.committee_id and m.status = any (array['draft','planned','in_progress']))
  );

-- committee_members
drop policy if exists committee_members_read on public.committee_members;
create policy committee_members_read on public.committee_members for select to authenticated
  using (
    current_user_can_view_committee(organization_id, committee_id)
    or current_user_can_manage_committee(organization_id, committee_id, 'manage_committee_members')
  );
drop policy if exists committee_members_manage on public.committee_members;
create policy committee_members_insert on public.committee_members for insert to authenticated
  with check (current_user_can_manage_committee(organization_id, committee_id, 'manage_committee_members'));
create policy committee_members_update on public.committee_members for update to authenticated
  using (current_user_can_manage_committee(organization_id, committee_id, 'manage_committee_members'))
  with check (current_user_can_manage_committee(organization_id, committee_id, 'manage_committee_members'));
create policy committee_members_delete on public.committee_members for delete to authenticated
  using (current_user_can_manage_committee(organization_id, committee_id, 'manage_committee_members'));

-- committee_plan_items
drop policy if exists committee_plan_items_read on public.committee_plan_items;
create policy committee_plan_items_read on public.committee_plan_items for select to authenticated
  using (
    current_user_can_view_committee(organization_id, committee_id)
    or current_user_can_manage_committee(organization_id, committee_id, 'manage_committee_decisions')
  );
drop policy if exists committee_plan_items_manage on public.committee_plan_items;
create policy committee_plan_items_insert on public.committee_plan_items for insert to authenticated
  with check (current_user_can_manage_committee(organization_id, committee_id, 'manage_committee_decisions'));
create policy committee_plan_items_update on public.committee_plan_items for update to authenticated
  using (current_user_can_manage_committee(organization_id, committee_id, 'manage_committee_decisions'))
  with check (current_user_can_manage_committee(organization_id, committee_id, 'manage_committee_decisions'));
create policy committee_plan_items_delete on public.committee_plan_items for delete to authenticated
  using (current_user_can_manage_committee(organization_id, committee_id, 'manage_committee_decisions'));

-- committee_meetings: fold cancel + edit_minutes + finalize UPDATE policies into one
drop policy if exists committee_meetings_cancel on public.committee_meetings;
drop policy if exists committee_meetings_edit_minutes on public.committee_meetings;
drop policy if exists committee_meetings_finalize on public.committee_meetings;
create policy committee_meetings_update on public.committee_meetings for update to authenticated
  using (
    (status = any (array['draft','planned','in_progress']) and current_user_can_manage_committee(organization_id, committee_id, 'create_committee_meeting'))
    or (status = any (array['draft','planned','in_progress']) and current_user_can_manage_committee(organization_id, committee_id, 'edit_committee_minutes'))
    or (status = any (array['draft','planned','in_progress']) and current_user_can_manage_committee(organization_id, committee_id, 'finalize_committee_minutes'))
  )
  with check (
    (status = 'cancelled' and nullif(btrim(coalesce(cancellation_reason,'')),'') is not null and cancelled_at is not null and cancelled_by = (select auth.uid()) and current_user_can_manage_committee(organization_id, committee_id, 'create_committee_meeting'))
    or (status = any (array['draft','planned','in_progress']) and current_user_can_manage_committee(organization_id, committee_id, 'edit_committee_minutes'))
    or (status = any (array['approval_pending','finalized']) and (status = 'approval_pending' or finalized_at is not null) and current_user_can_manage_committee(organization_id, committee_id, 'finalize_committee_minutes'))
  );

-- committee_minutes_approvals: fold cancel + decide UPDATE policies into one
drop policy if exists committee_minutes_approvals_cancel on public.committee_minutes_approvals;
drop policy if exists committee_minutes_approvals_decide on public.committee_minutes_approvals;
create policy committee_minutes_approvals_update on public.committee_minutes_approvals for update to authenticated
  using (
    (status = 'pending' and current_user_can_manage_committee(organization_id, committee_id, 'finalize_committee_minutes'))
    or (approver_id = (select auth.uid()) and status = 'pending')
  )
  with check (
    (status = 'cancelled' and decided_at is null and current_user_can_manage_committee(organization_id, committee_id, 'finalize_committee_minutes'))
    or (approver_id = (select auth.uid()) and status = any (array['approved','rejected']) and decided_at is not null)
  );

-- committees: fold archive + edit UPDATE policies into one
drop policy if exists committees_archive on public.committees;
drop policy if exists committees_edit on public.committees;
create policy committees_update on public.committees for update to authenticated
  using (
    (status <> 'archived' and current_user_has_governance_capability(organization_id, 'archive_committee'))
    or (status <> 'archived' and current_user_has_governance_capability(organization_id, 'create_committee'))
  )
  with check (
    (status = 'archived' and current_user_has_governance_capability(organization_id, 'archive_committee'))
    or (status <> 'archived' and current_user_has_governance_capability(organization_id, 'create_committee'))
  );

-- management_announcements
drop policy if exists management_announcements_read_targeted on public.management_announcements;
create policy management_announcements_read on public.management_announcements for select to authenticated
  using (
    (is_org_member(organization_id) and (
      (audience_type = 'all')
      or (audience_type = 'user' and audience_values ? ((select auth.uid()))::text)
      or (audience_type = 'role' and exists (select 1 from organization_members om where om.organization_id = management_announcements.organization_id and om.user_id = (select auth.uid()) and om.status = 'active' and management_announcements.audience_values ? (om.role)::text))
      or (audience_type = 'department' and exists (select 1 from organization_members om join organization_member_scopes oms on oms.membership_id = om.id where om.organization_id = management_announcements.organization_id and om.user_id = (select auth.uid()) and om.status = 'active' and management_announcements.audience_values ? (oms.department_id)::text))
    ))
    or (is_org_admin(organization_id) or current_user_has_org_role(organization_id, array['infection_control_lead'::app_role]))
  );
drop policy if exists management_announcements_manage on public.management_announcements;
create policy management_announcements_insert on public.management_announcements for insert to authenticated
  with check (is_org_admin(organization_id) or current_user_has_org_role(organization_id, array['infection_control_lead'::app_role]));
create policy management_announcements_update on public.management_announcements for update to authenticated
  using (is_org_admin(organization_id) or current_user_has_org_role(organization_id, array['infection_control_lead'::app_role]))
  with check (is_org_admin(organization_id) or current_user_has_org_role(organization_id, array['infection_control_lead'::app_role]));
create policy management_announcements_delete on public.management_announcements for delete to authenticated
  using (is_org_admin(organization_id) or current_user_has_org_role(organization_id, array['infection_control_lead'::app_role]));
