alter table public.profiles disable trigger user;
alter table public.organization_members disable trigger user;

insert into public.profiles (id,full_name,is_platform_owner,created_at,updated_at,username,contact_email,phone,job_title,is_demo,demo_entitlement_id)
select p.id,p.full_name,p.is_platform_owner,p.created_at,p.updated_at,p.username,p.contact_email,p.phone,p.job_title,false,null
from legacy_archive.profiles_snapshot p
where p.is_platform_owner = true
   or exists (
      select 1 from legacy_archive.organization_members_snapshot om
      join public.organizations o on o.id=om.organization_id and not o.is_demo
      where om.user_id=p.id
   )
on conflict (id) do nothing;

insert into public.organization_members (id,organization_id,user_id,role,status,created_at,updated_at,custom_role_id)
select om.id,om.organization_id,om.user_id,om.role,om.status,om.created_at,om.updated_at,null
from legacy_archive.organization_members_snapshot om
join public.organizations o on o.id=om.organization_id and not o.is_demo
join public.profiles p on p.id=om.user_id
on conflict do nothing;

alter table public.organization_members enable trigger user;
alter table public.profiles enable trigger user;
