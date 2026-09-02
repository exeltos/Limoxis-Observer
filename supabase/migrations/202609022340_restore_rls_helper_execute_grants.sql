-- RLS policies call these helpers while requests execute as the authenticated role.
-- EXECUTE is required for policy evaluation; the functions themselves retain
-- their existing SECURITY DEFINER / membership semantics.
grant execute on function public.current_user_is_platform_owner() to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;
