-- The previous migration (20260915192641) revoked EXECUTE from the `anon`
-- role specifically, but these 3 functions actually had EXECUTE granted to
-- the PUBLIC pseudo-role (proacl showed a bare "=X/postgres" entry), which
-- anon inherits regardless of a role-specific revoke. Revoke from PUBLIC
-- explicitly, then re-grant to authenticated so real signed-in admins keep
-- access (the function's own internal role/demo-org checks remain the
-- actual authorization gate).
revoke execute on function public.delete_patient_for_testing(uuid, uuid) from public;
grant execute on function public.delete_patient_for_testing(uuid, uuid) to authenticated;

revoke execute on function public.delete_surveillance_case_for_testing(uuid, uuid) from public;
grant execute on function public.delete_surveillance_case_for_testing(uuid, uuid) to authenticated;

revoke execute on function public.employee_admin_history(uuid) from public;
grant execute on function public.employee_admin_history(uuid) to authenticated;
