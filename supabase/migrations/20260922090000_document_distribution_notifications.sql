-- Lets a published controlled document be distributed as a required-acknowledgement
-- announcement (reusing the existing management_announcements / acknowledgements
-- infrastructure instead of a new table), and lets document managers see who has
-- acknowledged it, not only their own row.

-- A distribution announcement needs to deep-link back to the document it is about.
alter table public.management_announcements add column if not exists link_path text;

-- quality_manager already owns controlled documents (manage_documents / publish_document)
-- but could not create the announcement used to distribute one for acknowledgement.
-- Broaden the existing announcement write policies to include it, alongside the
-- roles they already allow.
drop policy if exists management_announcements_insert on public.management_announcements;
create policy management_announcements_insert on public.management_announcements for insert to authenticated
  with check (is_org_admin(organization_id) or current_user_has_org_role(organization_id, array['infection_control_lead'::app_role,'quality_manager'::app_role]));
drop policy if exists management_announcements_update on public.management_announcements;
create policy management_announcements_update on public.management_announcements for update to authenticated
  using (is_org_admin(organization_id) or current_user_has_org_role(organization_id, array['infection_control_lead'::app_role,'quality_manager'::app_role]))
  with check (is_org_admin(organization_id) or current_user_has_org_role(organization_id, array['infection_control_lead'::app_role,'quality_manager'::app_role]));
drop policy if exists management_announcements_delete on public.management_announcements;
create policy management_announcements_delete on public.management_announcements for delete to authenticated
  using (is_org_admin(organization_id) or current_user_has_org_role(organization_id, array['infection_control_lead'::app_role,'quality_manager'::app_role]));

-- Acknowledgements are otherwise only visible to the user who recorded them
-- (management_announcement_ack_read). Add an additional permissive policy so
-- document/announcement managers can read the full roster for a distribution -
-- Postgres OR's multiple permissive policies for the same command together, so
-- this only widens visibility, it never narrows the existing self-read grant.
create policy management_announcement_ack_manager_read on public.management_announcement_acknowledgements for select to authenticated
  using (is_org_admin(organization_id) or current_user_has_org_role(organization_id, array['infection_control_lead'::app_role,'quality_manager'::app_role]));
