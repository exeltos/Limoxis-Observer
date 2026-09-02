create or replace function public.current_user_profile_bootstrap()
returns table (
  id uuid,
  full_name text,
  username text,
  contact_email text,
  phone text,
  job_title text,
  is_platform_owner boolean,
  is_demo boolean,
  demo_entitlement_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.full_name,
    p.username,
    p.contact_email,
    p.phone,
    p.job_title,
    coalesce(p.is_platform_owner, false),
    coalesce(p.is_demo, false),
    p.demo_entitlement_id
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke all on function public.current_user_profile_bootstrap() from public, anon;
grant execute on function public.current_user_profile_bootstrap() to authenticated;
