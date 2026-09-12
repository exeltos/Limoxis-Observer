grant execute on function public.can_view_surveillance_record(uuid, uuid) to authenticated;
grant execute on function public.current_membership_ids() to authenticated;
grant execute on function public.current_user_can_access_control_department(uuid, uuid) to authenticated;
grant execute on function public.current_user_can_manage_committee(uuid, uuid, text) to authenticated;
grant execute on function public.current_user_can_view_committee(uuid, uuid) to authenticated;
grant execute on function public.current_user_has_capability(uuid, text) to authenticated;
grant execute on function public.current_user_has_department_scope(uuid, uuid) to authenticated;
grant execute on function public.current_user_has_governance_capability(uuid, text) to authenticated;
grant execute on function public.current_user_has_org_role(uuid, public.app_role[]) to authenticated;
