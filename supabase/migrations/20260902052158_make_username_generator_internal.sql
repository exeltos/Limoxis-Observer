-- Username allocation is an internal authentication helper.
-- The auth trigger executes as its SECURITY DEFINER owner, so signed-in clients do not
-- need direct RPC access to this function.

revoke execute on function public.generate_username(text) from authenticated;
