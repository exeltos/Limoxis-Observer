-- control_revisions_read's qual only checked that a matching
-- control_executions row existed (id+organization_id) - which the FK
-- guarantees is true for every revision row regardless of caller, making
-- this policy an effective no-op. Replace it with the same authorization
-- control_executions_read itself requires (capability + department scope),
-- evaluated against the parent execution's organization/department.
drop policy if exists control_revisions_read on public.control_execution_revisions;
create policy control_revisions_read on public.control_execution_revisions
  for select
  to public
  using (exists (
    select 1 from public.control_executions execution
    where execution.id = control_execution_revisions.execution_id
      and execution.organization_id = control_execution_revisions.organization_id
      and current_user_has_capability(execution.organization_id,'view_controls')
      and current_user_can_access_control_department(execution.organization_id, execution.department_id)
  ));
