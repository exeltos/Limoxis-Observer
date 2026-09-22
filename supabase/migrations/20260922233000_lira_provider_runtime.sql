create or replace function public.get_lira_provider_runtime_secret(p_organization_id uuid)
returns table(provider text,model text,api_key text,allow_aggregate_data boolean,allow_patient_level_data boolean)
language sql security definer set search_path=''
as $$
 select s.provider,s.model,v.decrypted_secret,s.allow_aggregate_data,s.allow_patient_level_data
 from public.lira_ai_provider_settings s
 join vault.decrypted_secrets v on v.id=s.secret_id
 where s.organization_id=p_organization_id and s.enabled=true and s.provider<>'none'
$$;
revoke all on function public.get_lira_provider_runtime_secret(uuid) from public,anon,authenticated;
grant execute on function public.get_lira_provider_runtime_secret(uuid) to service_role;
