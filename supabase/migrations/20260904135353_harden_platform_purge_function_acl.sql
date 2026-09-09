-- Limoxis Observer — harden Platform Owner organization purge RPC permissions
-- The function already validates auth.uid() and Platform Owner status internally.
-- This migration removes the explicit anon EXECUTE grant observed in production.

revoke all on function public.platform_purge_organization_tx(uuid,text) from public;
revoke execute on function public.platform_purge_organization_tx(uuid,text) from anon;
revoke execute on function public.platform_purge_organization_tx(uuid,text) from authenticated;

grant execute on function public.platform_purge_organization_tx(uuid,text) to authenticated;
grant execute on function public.platform_purge_organization_tx(uuid,text) to service_role;
