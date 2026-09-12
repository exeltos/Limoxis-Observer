drop policy if exists laboratory_samples_read on public.laboratory_samples;
create policy laboratory_samples_read on public.laboratory_samples for select using(
  current_user_is_platform_owner()
  or current_user_has_org_role(organization_id, array['hospital_admin','infection_control_lead','infection_control_member','laboratory','doctor_reviewer']::app_role[])
  or (current_user_has_capability(organization_id,'view_lab') and department_id is not null and current_user_has_department_scope(organization_id, department_id))
  or (subject_type = 'employee' and (
    current_user_has_org_role(organization_id, array['occupational_physician']::app_role[])
    or current_user_has_capability(organization_id,'manage_occupational_health')
  ))
);
