-- Committee decisions can now be assigned to a real user (committee_decisions.owner_id
-- already existed but was never written) and the app notifies that owner - and a
-- committee's members - through the existing management_announcements distribution
-- mechanism. committee_secretariat is a distinct role (per-committee, via work_assignments)
-- that can create meetings/decisions for its assigned committee but was not covered by the
-- announcement write/ack-read policies added for documents distribution, so widen those the
-- same way quality_manager was added - an unconditional org-role grant, matching this table's
-- existing granularity (role-based, not resource-scoped).
drop policy if exists management_announcements_insert on public.management_announcements;
create policy management_announcements_insert on public.management_announcements for insert to authenticated
  with check (is_org_admin(organization_id) or current_user_has_org_role(organization_id, array['infection_control_lead'::app_role,'quality_manager'::app_role,'committee_secretariat'::app_role]));
drop policy if exists management_announcements_update on public.management_announcements;
create policy management_announcements_update on public.management_announcements for update to authenticated
  using (is_org_admin(organization_id) or current_user_has_org_role(organization_id, array['infection_control_lead'::app_role,'quality_manager'::app_role,'committee_secretariat'::app_role]))
  with check (is_org_admin(organization_id) or current_user_has_org_role(organization_id, array['infection_control_lead'::app_role,'quality_manager'::app_role,'committee_secretariat'::app_role]));
drop policy if exists management_announcements_delete on public.management_announcements;
create policy management_announcements_delete on public.management_announcements for delete to authenticated
  using (is_org_admin(organization_id) or current_user_has_org_role(organization_id, array['infection_control_lead'::app_role,'quality_manager'::app_role,'committee_secretariat'::app_role]));

drop policy if exists management_announcement_ack_manager_read on public.management_announcement_acknowledgements;
create policy management_announcement_ack_manager_read on public.management_announcement_acknowledgements for select to authenticated
  using (is_org_admin(organization_id) or current_user_has_org_role(organization_id, array['infection_control_lead'::app_role,'quality_manager'::app_role,'committee_secretariat'::app_role]));

-- committee_decisions.owner_id already existed (referencing auth.users) but the write path
-- never populated it - the decision editor could only store a free-text owner_label, so the
-- assigned person could never be looked up or notified. No schema change needed here; this
-- comment documents that the application code now writes owner_id on create/update.
