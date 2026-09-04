-- Limoxis Observer — harden patient admission RPC permissions
-- The RPC is used by authenticated clinical workflows and already relies on
-- the caller's RLS permissions because it is SECURITY INVOKER.
-- Production had drifted to an explicit anon EXECUTE grant; remove it.

revoke all on function public.create_patient_admission(uuid,uuid,uuid,date,date,text,text) from public;
revoke execute on function public.create_patient_admission(uuid,uuid,uuid,date,date,text,text) from anon;
revoke execute on function public.create_patient_admission(uuid,uuid,uuid,date,date,text,text) from authenticated;

grant execute on function public.create_patient_admission(uuid,uuid,uuid,date,date,text,text) to authenticated;
grant execute on function public.create_patient_admission(uuid,uuid,uuid,date,date,text,text) to service_role;
