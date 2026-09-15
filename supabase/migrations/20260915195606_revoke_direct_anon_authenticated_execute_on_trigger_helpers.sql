-- 20260915195429's "revoke ... from public" was a no-op for these: their
-- EXECUTE grant to anon/authenticated came from direct per-role
-- default-privilege grants (Supabase's function-default ACL grants each
-- of postgres/anon/authenticated/service_role individually, not via the
-- PUBLIC pseudo-role), so "FROM PUBLIC" never touched it. Revoke
-- directly from both anon and authenticated - same pure-trigger-helper
-- reasoning as 20260915193218 (trigger firing needs no EXECUTE grant on
-- the firing role). Also covers close_isolation_on_case_void, created
-- earlier in this batch (20260915195437), which inherited the same
-- default-grant problem before 20260915195511 hardened the default.
revoke execute on function public.audit_platform_settings_update() from anon, authenticated;
revoke execute on function public.capture_control_execution_revision() from anon, authenticated;
revoke execute on function public.close_isolation_on_case_void() from anon, authenticated;
revoke execute on function public.create_initial_patient_admission() from anon, authenticated;
revoke execute on function public.guard_committee_meeting_cancellation() from anon, authenticated;
revoke execute on function public.guard_committee_meeting_finalization() from anon, authenticated;
revoke execute on function public.guard_committee_minutes_approval_decision() from anon, authenticated;
revoke execute on function public.protect_committee_minutes_approval_identity() from anon, authenticated;
revoke execute on function public.protect_document_approval_identity() from anon, authenticated;
revoke execute on function public.set_repository_audit_fields() from anon, authenticated;
revoke execute on function public.touch_platform_settings() from anon, authenticated;
-- greek_to_latin: internal-only helper, called from generate_username()
-- (SECURITY DEFINER) which runs under the definer's identity for that
-- internal call, so this does not break generate_username's own callers.
revoke execute on function public.greek_to_latin(text) from anon, authenticated;
