alter function public.training_check_in(text) security definer;
alter function public.training_check_in(text) set search_path=public,auth,pg_temp;
alter function public.training_complete(text,jsonb,jsonb,text) security definer;
alter function public.training_complete(text,jsonb,jsonb,text) set search_path=public,auth,pg_temp;
revoke all on function public.training_check_in(text) from public,anon;
revoke all on function public.training_complete(text,jsonb,jsonb,text) from public,anon;
grant execute on function public.training_check_in(text) to authenticated;
grant execute on function public.training_complete(text,jsonb,jsonb,text) to authenticated;