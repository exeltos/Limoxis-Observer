drop policy if exists committee_history_append on public.committee_history;
create policy committee_history_append on public.committee_history
for insert to authenticated
with check (
  public.current_user_can_manage_committee(organization_id,committee_id,'manage_committee_members')
  or public.current_user_can_manage_committee(organization_id,committee_id,'create_committee_meeting')
  or public.current_user_can_manage_committee(organization_id,committee_id,'edit_committee_minutes')
  or public.current_user_can_manage_committee(organization_id,committee_id,'manage_committee_decisions')
  or public.current_user_can_manage_committee(organization_id,committee_id,'manage_committee_documents')
);