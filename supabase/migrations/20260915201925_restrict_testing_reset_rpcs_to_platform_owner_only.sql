-- delete_patient_for_testing / delete_surveillance_case_for_testing are
-- wired into service-layer wrapper functions (deletePatientForTesting,
-- deleteClinicalCaseForTesting) that are exported but never imported or
-- called anywhere else in src/ - dead code from the UI's perspective.
-- Their internal checks (platform_owner OR demo-org-admin role, AND
-- target org must be is_demo) already made them safe, but per review
-- feedback: a "*_for_testing" RPC should not stay directly callable by
-- every authenticated user in production regardless of internal checks,
-- especially when nothing in the shipped UI actually needs that access
-- today. Revoking authenticated removes zero current functionality.
revoke execute on function public.delete_patient_for_testing(uuid, uuid) from authenticated;
revoke execute on function public.delete_surveillance_case_for_testing(uuid, uuid) from authenticated;
-- Platform owner keeps access via the service_role/postgres path
-- (Supabase SQL editor, or a future dedicated admin tool) rather than a
-- standing authenticated-role RPC grant.
