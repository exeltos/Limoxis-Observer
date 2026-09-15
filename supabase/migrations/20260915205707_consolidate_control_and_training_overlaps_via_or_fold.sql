-- control_assignments
drop policy if exists control_assignments_read on public.control_assignments;
create policy control_assignments_read on public.control_assignments for select to public
  using (
    (current_user_has_capability(organization_id, 'view_controls') and current_user_can_access_control_department(organization_id, department_id))
    or current_user_has_capability(organization_id, 'manage_controls')
  );
drop policy if exists control_assignments_manage on public.control_assignments;
create policy control_assignments_insert on public.control_assignments for insert to public
  with check (current_user_has_capability(organization_id, 'manage_controls'));
create policy control_assignments_update on public.control_assignments for update to public
  using (current_user_has_capability(organization_id, 'manage_controls'))
  with check (current_user_has_capability(organization_id, 'manage_controls'));
create policy control_assignments_delete on public.control_assignments for delete to public
  using (current_user_has_capability(organization_id, 'manage_controls'));

-- control_definitions
drop policy if exists control_definitions_read on public.control_definitions;
create policy control_definitions_read on public.control_definitions for select to public
  using (
    current_user_has_capability(organization_id, 'view_controls')
    or current_user_has_capability(organization_id, 'manage_controls')
  );
drop policy if exists control_definitions_manage on public.control_definitions;
create policy control_definitions_insert on public.control_definitions for insert to public
  with check (current_user_has_capability(organization_id, 'manage_controls'));
create policy control_definitions_update on public.control_definitions for update to public
  using (current_user_has_capability(organization_id, 'manage_controls'))
  with check (current_user_has_capability(organization_id, 'manage_controls'));
create policy control_definitions_delete on public.control_definitions for delete to public
  using (current_user_has_capability(organization_id, 'manage_controls'));

-- control_executions: fold edit + void UPDATE policies into one
drop policy if exists control_executions_edit on public.control_executions;
drop policy if exists control_executions_void on public.control_executions;
create policy control_executions_update on public.control_executions for update to public
  using (
    (status = 'completed' and current_user_has_governance_capability(organization_id, 'edit_control_execution') and current_user_can_access_control_department(organization_id, department_id) and (performed_by = (select auth.uid()) or current_user_has_capability(organization_id, 'manage_controls')))
    or (status = 'completed' and current_user_has_governance_capability(organization_id, 'void_control_execution') and current_user_can_access_control_department(organization_id, department_id))
  )
  with check (
    (status = 'completed' and current_user_has_governance_capability(organization_id, 'edit_control_execution') and current_user_can_access_control_department(organization_id, department_id))
    or (status = 'cancelled' and cancelled_at is not null and nullif(btrim(cancellation_reason),'') is not null and current_user_has_governance_capability(organization_id, 'void_control_execution') and current_user_can_access_control_department(organization_id, department_id))
  );

-- training_records
drop policy if exists training_records_read on public.training_records;
create policy training_records_read on public.training_records for select to public
  using (
    ((record_type = 'program') and is_org_member(organization_id))
    or current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'hr_office'::app_role])
    or ((department_id is not null) and current_user_has_org_role(organization_id, ARRAY['department_manager'::app_role, 'department_user'::app_role]) and current_user_has_department_scope(organization_id, department_id))
    or (employee_user_id = (select auth.uid()))
    or current_user_has_capability(organization_id, 'manage_training')
  );
drop policy if exists training_records_manage on public.training_records;
create policy training_records_insert on public.training_records for insert to public
  with check (current_user_has_capability(organization_id, 'manage_training'));
create policy training_records_update on public.training_records for update to public
  using (current_user_has_capability(organization_id, 'manage_training'))
  with check (current_user_has_capability(organization_id, 'manage_training'));
create policy training_records_delete on public.training_records for delete to public
  using (current_user_has_capability(organization_id, 'manage_training'));
