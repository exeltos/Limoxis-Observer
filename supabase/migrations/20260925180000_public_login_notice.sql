-- Login page: the maintenance notice and support e-mail are shown before
-- sign-in. Anonymous users still have no access to platform_settings; this
-- function returns only these public fields (the notice only when enabled).
create or replace function public.public_login_notice()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'noticeEl', case when s.maintenance_notice_enabled then nullif(s.maintenance_notice_el,'') end,
    'noticeEn', case when s.maintenance_notice_enabled then nullif(s.maintenance_notice_en,'') end,
    'supportEmail', nullif(s.support_email,'')
  )
  from public.platform_settings s
  where s.id='global'
$$;

revoke all on function public.public_login_notice() from public;
grant execute on function public.public_login_notice() to anon, authenticated;
