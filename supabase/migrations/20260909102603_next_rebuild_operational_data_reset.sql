do $$
declare r record;
begin
  for r in
    select format('%I.%I', schemaname, tablename) as fqtn
    from pg_tables
    where schemaname = 'public'
      and tablename not in ('profiles','organizations','organization_members','organization_member_scopes','organization_member_capabilities','custom_roles','custom_role_capabilities','master_library_items','indicator_definitions','prevention_bundle_templates','external_reference_versions','platform_settings','system_audit_log')
  loop
    execute 'alter table ' || r.fqtn || ' disable trigger user';
    execute 'truncate table ' || r.fqtn || ' restart identity cascade';
    execute 'alter table ' || r.fqtn || ' enable trigger user';
  end loop;
end $$;

alter table public.organization_member_scopes disable trigger user;
truncate table public.organization_member_scopes restart identity cascade;
alter table public.organization_member_scopes enable trigger user;
alter table public.organization_member_capabilities disable trigger user;
truncate table public.organization_member_capabilities restart identity cascade;
alter table public.organization_member_capabilities enable trigger user;
alter table public.custom_role_capabilities disable trigger user;
truncate table public.custom_role_capabilities restart identity cascade;
alter table public.custom_role_capabilities enable trigger user;
alter table public.custom_roles disable trigger user;
truncate table public.custom_roles restart identity cascade;
alter table public.custom_roles enable trigger user;

alter table public.organization_members disable trigger user;
alter table public.master_library_items disable trigger user;
alter table public.indicator_definitions disable trigger user;
alter table public.prevention_bundle_templates disable trigger user;
alter table public.external_reference_versions disable trigger user;
alter table public.organizations disable trigger user;
alter table public.profiles disable trigger user;

delete from public.organization_members om using public.organizations o where om.organization_id=o.id and o.is_demo=true;
delete from public.master_library_items m using public.organizations o where m.organization_id=o.id and o.is_demo=true;
delete from public.indicator_definitions i using public.organizations o where i.organization_id=o.id and o.is_demo=true;
delete from public.prevention_bundle_templates p using public.organizations o where p.organization_id=o.id and o.is_demo=true;
delete from public.external_reference_versions e using public.organizations o where e.organization_id=o.id and o.is_demo=true;
delete from public.organizations where is_demo=true;
delete from public.profiles p where not p.is_platform_owner and not exists (select 1 from public.organization_members om join public.organizations o on o.id=om.organization_id and not o.is_demo where om.user_id=p.id);

alter table public.profiles enable trigger user;
alter table public.organizations enable trigger user;
alter table public.external_reference_versions enable trigger user;
alter table public.prevention_bundle_templates enable trigger user;
alter table public.indicator_definitions enable trigger user;
alter table public.master_library_items enable trigger user;
alter table public.organization_members enable trigger user;

truncate table public.system_audit_log restart identity;
