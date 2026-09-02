-- Remove the remaining auth RLS init-plan warnings in Controls.
-- Authorization semantics are intentionally unchanged.

alter policy control_executions_insert
on public.control_executions
with check (
  performed_by = (select auth.uid())
  and current_user_has_governance_capability(organization_id, 'execute_control'::text)
  and current_user_can_access_control_department(organization_id, department_id)
);

alter policy control_executions_edit
on public.control_executions
using (
  status = 'completed'::text
  and current_user_has_governance_capability(organization_id, 'edit_control_execution'::text)
  and (
    performed_by = (select auth.uid())
    or current_user_has_capability(organization_id, 'manage_controls'::text)
  )
)
with check (
  status = 'completed'::text
  and current_user_has_governance_capability(organization_id, 'edit_control_execution'::text)
);

alter policy control_revisions_insert
on public.control_execution_revisions
with check (
  changed_by = (select auth.uid())
  and exists (
    select 1
    from public.control_executions execution
    where execution.id = control_execution_revisions.execution_id
      and execution.organization_id = control_execution_revisions.organization_id
      and (
        execution.performed_by = (select auth.uid())
        or current_user_has_capability(
          control_execution_revisions.organization_id,
          'manage_controls'::text
        )
      )
  )
);
