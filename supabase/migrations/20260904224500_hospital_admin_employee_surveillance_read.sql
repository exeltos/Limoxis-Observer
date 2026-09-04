drop policy if exists employee_surveillance_records_read on public.employee_surveillance_records;
create policy employee_surveillance_records_read on public.employee_surveillance_records
for select to authenticated
using (
  current_user_has_org_role(organization_id, array['hospital_admin','occupational_physician']::public.app_role[])
  or current_user_has_capability(organization_id, 'manage_occupational_health')
);

drop policy if exists employee_surveillance_batches_read on public.employee_surveillance_batches;
create policy employee_surveillance_batches_read on public.employee_surveillance_batches
for select to authenticated
using (
  current_user_has_org_role(organization_id, array['hospital_admin','occupational_physician']::public.app_role[])
  or current_user_has_capability(organization_id, 'manage_occupational_health')
);
