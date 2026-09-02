-- RLS policies invoke these helpers for authenticated application users.
-- EXECUTE is required for policy evaluation; revoking it causes legitimate
-- membership and tenant queries to fail with HTTP 403 before the policy can
-- return a boolean decision.

grant execute on function public.current_user_is_platform_owner() to authenticated;
grant execute on function public.current_user_profile_bootstrap() to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, public.app_role[]) to authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;
grant execute on function public.can_view_surveillance_record(uuid, uuid) to authenticated;
grant execute on function public.current_membership_ids() to authenticated;
grant execute on function public.current_user_can_access_control_department(uuid, uuid) to authenticated;
grant execute on function public.current_user_can_manage_committee(uuid, uuid, text) to authenticated;
grant execute on function public.current_user_can_view_committee(uuid, uuid) to authenticated;
grant execute on function public.current_user_has_capability(uuid, text) to authenticated;
grant execute on function public.current_user_has_department_scope(uuid, uuid) to authenticated;
grant execute on function public.current_user_has_governance_capability(uuid, text) to authenticated;
grant execute on function public.current_user_has_org_role(uuid, public.app_role[]) to authenticated;
