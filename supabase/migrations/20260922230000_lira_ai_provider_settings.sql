create extension if not exists supabase_vault with schema vault;

create table if not exists public.lira_ai_provider_settings (
 organization_id uuid primary key references public.organizations(id) on delete cascade,
 provider text not null default 'none' check(provider in ('none','openai')),
 enabled boolean not null default false,
 model text,
 secret_id uuid,
 key_hint text,
 allow_aggregate_data boolean not null default true,
 allow_patient_level_data boolean not null default false,
 configured_by uuid references auth.users(id) on delete set null,
 configured_at timestamptz,
 updated_at timestamptz not null default now()
);
alter table public.lira_ai_provider_settings enable row level security;
revoke all on public.lira_ai_provider_settings from anon;
grant select on public.lira_ai_provider_settings to authenticated;

create policy "lira ai settings readable by managers"
on public.lira_ai_provider_settings for select to authenticated
using (
 public.current_user_is_platform_owner()
 or public.current_user_has_capability(organization_id,'manage_libraries')
);

create or replace function public.get_lira_ai_provider_settings(p_organization_id uuid)
returns table(provider text,enabled boolean,model text,key_hint text,allow_aggregate_data boolean,allow_patient_level_data boolean,configured_at timestamptz)
language sql security invoker set search_path=''
as $$
 select s.provider,s.enabled,s.model,s.key_hint,s.allow_aggregate_data,s.allow_patient_level_data,s.configured_at
 from public.lira_ai_provider_settings s where s.organization_id=p_organization_id
 and (public.current_user_is_platform_owner() or public.current_user_has_capability(p_organization_id,'manage_libraries'))
$$;
revoke all on function public.get_lira_ai_provider_settings(uuid) from public,anon;
grant execute on function public.get_lira_ai_provider_settings(uuid) to authenticated;
