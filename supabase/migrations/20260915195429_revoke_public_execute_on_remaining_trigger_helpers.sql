-- Same pattern as 20260915193218: pure trigger helpers (RETURNS trigger),
-- only ever invoked internally by trigger firing, which does not require
-- the firing role to hold EXECUTE. None of these should be directly
-- callable via /rest/v1/rpc/... by anon or any signed-in user.
--
-- NOTE: this turned out to be a no-op for anon - see
-- 20260915195606_revoke_direct_anon_authenticated_execute_on_trigger_helpers.sql
-- for why and the actual fix. Kept here to match what was literally
-- applied, in order.
revoke execute on function public.audit_platform_settings_update() from public;
revoke execute on function public.capture_control_execution_revision() from public;
revoke execute on function public.create_initial_patient_admission() from public;
revoke execute on function public.guard_committee_meeting_cancellation() from public;
revoke execute on function public.guard_committee_meeting_finalization() from public;
revoke execute on function public.guard_committee_minutes_approval_decision() from public;
revoke execute on function public.protect_committee_minutes_approval_identity() from public;
revoke execute on function public.protect_document_approval_identity() from public;
revoke execute on function public.set_repository_audit_fields() from public;
revoke execute on function public.touch_platform_settings() from public;
-- greek_to_latin(text) is a pure string-transform helper (not a trigger),
-- but it is only ever called internally by other functions to derive
-- usernames; it has no legitimate standalone RPC use.
revoke execute on function public.greek_to_latin(text) from public;
