-- Same PUBLIC-grant issue as 20260915193207: these are pure trigger helpers
-- (RETURNS trigger) that should not be callable via /rest/v1/rpc/... by
-- anyone. Trigger firing does not require the firing role to hold EXECUTE,
-- so no re-grant is needed here.
revoke execute on function public.enforce_repeat_sample_terminal_parent() from public;
revoke execute on function public.enforce_surveillance_governance_reason() from public;
