revoke execute on function public.training_email_access(text) from public, anon;
revoke execute on function public.training_confirm_attendance(text) from public, anon;
revoke execute on function public.training_submit_evaluation(text,jsonb,jsonb,text) from public, anon;
revoke execute on function public.queue_training_invitation(text,text) from public, anon;
grant execute on function public.training_email_access(text) to authenticated;
grant execute on function public.training_confirm_attendance(text) to authenticated;
grant execute on function public.training_submit_evaluation(text,jsonb,jsonb,text) to authenticated;
grant execute on function public.queue_training_invitation(text,text) to authenticated;
