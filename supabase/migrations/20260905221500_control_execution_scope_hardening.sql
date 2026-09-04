drop policy if exists control_executions_edit on public.control_executions;
create policy control_executions_edit on public.control_executions
for update using (
  status='completed'
  and public.current_user_has_governance_capability(organization_id,'edit_control_execution')
  and public.current_user_can_access_control_department(organization_id,department_id)
  and (
    performed_by=auth.uid()
    or public.current_user_has_capability(organization_id,'manage_controls')
  )
)
with check (
  status='completed'
  and public.current_user_has_governance_capability(organization_id,'edit_control_execution')
  and public.current_user_can_access_control_department(organization_id,department_id)
);

drop policy if exists control_executions_void on public.control_executions;
create policy control_executions_void on public.control_executions
for update using (
  status='completed'
  and public.current_user_has_governance_capability(organization_id,'void_control_execution')
  and public.current_user_can_access_control_department(organization_id,department_id)
)
with check (
  status='cancelled'
  and cancelled_at is not null
  and nullif(trim(cancellation_reason),'') is not null
  and public.current_user_has_governance_capability(organization_id,'void_control_execution')
  and public.current_user_can_access_control_department(organization_id,department_id)
);
