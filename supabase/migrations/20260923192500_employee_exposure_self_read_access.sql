-- Align occupational exposure access with the employee self-profile and the
-- rest of the occupational-health domain. Keep writes restricted to occupational
-- health managers while allowing the linked employee to read their own incidents.

drop policy if exists occupational_exposure_incidents_read on public.occupational_exposure_incidents;
drop policy if exists occupational_exposure_incidents_write on public.occupational_exposure_incidents;

create policy occupational_exposure_incidents_select_authorized
on public.occupational_exposure_incidents
for select
to authenticated
using (
  current_user_is_platform_owner()
  or current_user_has_org_role(organization_id, array['occupational_physician'::app_role])
  or current_user_has_capability(organization_id, 'manage_occupational_health')
  or exists (
    select 1
    from public.employees e
    where e.id = occupational_exposure_incidents.employee_id
      and e.organization_id = occupational_exposure_incidents.organization_id
      and e.user_id = auth.uid()
  )
);

create policy occupational_exposure_incidents_insert_authorized
on public.occupational_exposure_incidents
for insert
to authenticated
with check (
  current_user_is_platform_owner()
  or current_user_has_org_role(organization_id, array['occupational_physician'::app_role])
  or current_user_has_capability(organization_id, 'manage_occupational_health')
);

create policy occupational_exposure_incidents_update_authorized
on public.occupational_exposure_incidents
for update
to authenticated
using (
  current_user_is_platform_owner()
  or current_user_has_org_role(organization_id, array['occupational_physician'::app_role])
  or current_user_has_capability(organization_id, 'manage_occupational_health')
)
with check (
  current_user_is_platform_owner()
  or current_user_has_org_role(organization_id, array['occupational_physician'::app_role])
  or current_user_has_capability(organization_id, 'manage_occupational_health')
);

create policy occupational_exposure_incidents_delete_authorized
on public.occupational_exposure_incidents
for delete
to authenticated
using (
  current_user_is_platform_owner()
  or current_user_has_org_role(organization_id, array['occupational_physician'::app_role])
  or current_user_has_capability(organization_id, 'manage_occupational_health')
);
