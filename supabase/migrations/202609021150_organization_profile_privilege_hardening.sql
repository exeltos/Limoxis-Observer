revoke all on table public.organizations from anon;
revoke all on table public.organizations from authenticated;
grant select on table public.organizations to authenticated;

revoke all on function public.update_organization_profile(uuid,text,text,text,text,text,text,text,integer) from public;
revoke all on function public.update_organization_profile(uuid,text,text,text,text,text,text,text,integer) from anon;
grant execute on function public.update_organization_profile(uuid,text,text,text,text,text,text,text,integer) to authenticated;
