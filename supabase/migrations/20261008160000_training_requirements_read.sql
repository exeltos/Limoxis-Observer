-- Required-training rules (training_records.record_type = 'requirement').
--
-- A requirement says which training a professional category or department
-- needs and how often. Like programmes, every member of the organization may
-- read them (department managers see their staff's competence against them);
-- writing stays with manage_training through the existing insert/update/delete
-- policies. Only the read policy changes: 'requirement' joins 'program'.

drop policy if exists training_records_read on public.training_records;
create policy training_records_read on public.training_records for select to public
  using (
    ((record_type in ('program','requirement')) and is_org_member(organization_id))
    or current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'hr_office'::app_role])
    or ((department_id is not null) and current_user_has_org_role(organization_id, ARRAY['department_manager'::app_role, 'department_user'::app_role]) and current_user_has_department_scope(organization_id, department_id))
    or (employee_user_id = (select auth.uid()))
    or current_user_has_capability(organization_id, 'manage_training')
  );
