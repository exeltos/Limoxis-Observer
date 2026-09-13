-- Public training email links are intentionally token-only. The functions are
-- SECURITY DEFINER and validate the opaque access token before exposing or
-- changing any training record. Anonymous recipients therefore need EXECUTE.

revoke execute on function public.training_email_access(text) from public;
revoke execute on function public.training_confirm_attendance(text) from public;
revoke execute on function public.training_submit_evaluation(text,jsonb,jsonb,text,boolean) from public;

grant execute on function public.training_email_access(text) to anon, authenticated, service_role;
grant execute on function public.training_confirm_attendance(text) to anon, authenticated, service_role;
grant execute on function public.training_submit_evaluation(text,jsonb,jsonb,text,boolean) to anon, authenticated, service_role;
