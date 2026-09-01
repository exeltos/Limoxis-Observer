drop policy if exists committee_minutes_approvals_cancel on public.committee_minutes_approvals;
create policy committee_minutes_approvals_cancel
on public.committee_minutes_approvals
for update
to authenticated
using (
  status = 'pending'
  and public.current_user_can_manage_committee(organization_id, committee_id, 'finalize_committee_minutes')
)
with check (
  status = 'cancelled'
  and decided_at is null
  and public.current_user_can_manage_committee(organization_id, committee_id, 'finalize_committee_minutes')
);
