alter function public.greek_to_latin(text) set search_path = pg_catalog, public;

revoke execute on function public.capture_clinical_audit() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

revoke execute on function public.can_view_surveillance_record(uuid, uuid) from public, anon;
revoke execute on function public.current_membership_ids() from public, anon;
revoke execute on function public.current_user_can_access_control_department(uuid, uuid) from public, anon;
revoke execute on function public.current_user_has_capability(uuid, text) from public, anon;
revoke execute on function public.current_user_has_department_scope(uuid, uuid) from public, anon;
revoke execute on function public.current_user_has_org_role(uuid, public.app_role[]) from public, anon;
revoke execute on function public.current_user_is_platform_owner() from public, anon;
revoke execute on function public.generate_username(text) from public, anon;
revoke execute on function public.has_org_role(uuid, public.app_role[]) from public, anon;
revoke execute on function public.is_org_admin(uuid) from public, anon;
revoke execute on function public.is_org_member(uuid) from public, anon;
revoke execute on function public.platform_report_summary(uuid, date, date) from public, anon;
revoke execute on function public.reopen_surveillance_episode(text, text) from public, anon;
