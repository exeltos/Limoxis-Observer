-- Limoxis Observer — safe global maintenance notice for authenticated users
create or replace function public.get_platform_maintenance_notice()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'enabled', maintenance_notice_enabled,
    'message_el', maintenance_notice_el,
    'message_en', maintenance_notice_en,
    'updated_at', updated_at
  )
  from public.platform_settings
  where id = 'global';
$$;

revoke all on function public.get_platform_maintenance_notice() from public;
revoke all on function public.get_platform_maintenance_notice() from anon;
grant execute on function public.get_platform_maintenance_notice() to authenticated;
