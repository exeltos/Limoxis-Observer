-- Defense-in-depth: these functions already enforce their own authorization
-- internally (role checks, demo-org-only checks), so anon calls fail today,
-- but the security advisor correctly flags that anon should never have had
-- EXECUTE in the first place - revoke it explicitly rather than relying only
-- on the internal check.
revoke execute on function public.delete_patient_for_testing(uuid, uuid) from anon;
revoke execute on function public.delete_patient_with_history(uuid, uuid, text) from anon;
revoke execute on function public.delete_surveillance_case_for_testing(uuid, uuid) from anon;
revoke execute on function public.employee_admin_history(uuid) from anon;

-- Pure trigger helpers (RETURNS trigger, only ever invoked internally by
-- trigger firing) should not be directly callable via
-- /rest/v1/rpc/... by anon or any signed-in user, matching the precedent
-- set in 20260912000153_restrict_test_reset_rpcs_and_trigger_execute.sql
-- for capture_clinical_audit() and handle_new_user().
revoke execute on function public.enforce_repeat_sample_terminal_parent() from anon;
revoke execute on function public.enforce_repeat_sample_terminal_parent() from authenticated;
revoke execute on function public.enforce_surveillance_governance_reason() from anon;
revoke execute on function public.enforce_surveillance_governance_reason() from authenticated;
