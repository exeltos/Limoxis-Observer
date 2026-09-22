create or replace function public.store_lira_provider_secret(p_organization_id uuid,p_secret text,p_existing_secret_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if p_existing_secret_id is not null then
   perform vault.update_secret(p_existing_secret_id,p_secret,'lira_ai_'||p_organization_id::text,'LIRA AI provider credential');
   return p_existing_secret_id;
 end if;
 select vault.create_secret(p_secret,'lira_ai_'||p_organization_id::text,'LIRA AI provider credential') into v_id;
 return v_id;
end $$;
create or replace function public.delete_lira_provider_secret(p_secret_id uuid)
returns void language plpgsql security definer set search_path='' as $$ begin delete from vault.secrets where id=p_secret_id; end $$;
revoke all on function public.store_lira_provider_secret(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.delete_lira_provider_secret(uuid) from public,anon,authenticated;
grant execute on function public.store_lira_provider_secret(uuid,text,uuid) to service_role;
grant execute on function public.delete_lira_provider_secret(uuid) to service_role;
