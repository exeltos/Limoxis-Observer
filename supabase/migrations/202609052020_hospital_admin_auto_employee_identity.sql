create or replace function public.ensure_hospital_admin_employee()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
  v_full_name text;
  v_first_name text;
  v_last_name text;
  v_email text;
  v_job_title text;
begin
  if new.role::text <> 'hospital_admin' then return new; end if;
  if exists (select 1 from public.employees e where e.organization_id=new.organization_id and e.user_id=new.user_id) then return new; end if;

  select * into v_profile from public.profiles where id=new.user_id;
  v_full_name:=nullif(btrim(coalesce(v_profile.full_name,'')),'');
  v_email:=nullif(lower(btrim(coalesce(v_profile.contact_email,''))),'');
  v_job_title:=nullif(btrim(coalesce(v_profile.job_title,'')),'');

  if v_full_name is null then v_first_name:='Hospital'; v_last_name:='Admin';
  elsif position(' ' in v_full_name)=0 then v_first_name:=v_full_name; v_last_name:='—';
  else v_first_name:=split_part(v_full_name,' ',1); v_last_name:=btrim(substr(v_full_name,length(v_first_name)+1)); end if;

  insert into public.employees(organization_id,user_id,employee_code,first_name,last_name,first_name_en,last_name_en,employment_status,email,phone,profession_name,profession_name_en,created_by,updated_by)
  values(new.organization_id,new.user_id,'ADM-'||upper(replace(new.user_id::text,'-','')),v_first_name,v_last_name,v_first_name,v_last_name,'active',v_email,nullif(btrim(coalesce(v_profile.phone,'')),''),coalesce(v_job_title,'Hospital Admin'),coalesce(v_job_title,'Hospital Admin'),auth.uid(),auth.uid())
  on conflict (organization_id,employee_code) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_organization_member_hospital_admin_employee on public.organization_members;
create trigger trg_organization_member_hospital_admin_employee
after insert or update of role on public.organization_members
for each row when (new.role::text='hospital_admin')
execute function public.ensure_hospital_admin_employee();

insert into public.employees(organization_id,user_id,employee_code,first_name,last_name,first_name_en,last_name_en,employment_status,email,phone,profession_name,profession_name_en,created_by,updated_by)
select m.organization_id,m.user_id,'ADM-'||upper(replace(m.user_id::text,'-','')),
 case when nullif(btrim(coalesce(p.full_name,'')),'') is null then 'Hospital' when position(' ' in btrim(p.full_name))=0 then btrim(p.full_name) else split_part(btrim(p.full_name),' ',1) end,
 case when nullif(btrim(coalesce(p.full_name,'')),'') is null then 'Admin' when position(' ' in btrim(p.full_name))=0 then '—' else btrim(substr(btrim(p.full_name),length(split_part(btrim(p.full_name),' ',1))+1)) end,
 case when nullif(btrim(coalesce(p.full_name,'')),'') is null then 'Hospital' when position(' ' in btrim(p.full_name))=0 then btrim(p.full_name) else split_part(btrim(p.full_name),' ',1) end,
 case when nullif(btrim(coalesce(p.full_name,'')),'') is null then 'Admin' when position(' ' in btrim(p.full_name))=0 then '—' else btrim(substr(btrim(p.full_name),length(split_part(btrim(p.full_name),' ',1))+1)) end,
 'active',nullif(lower(btrim(coalesce(p.contact_email,''))),''),nullif(btrim(coalesce(p.phone,'')),''),coalesce(nullif(btrim(coalesce(p.job_title,'')),''),'Hospital Admin'),coalesce(nullif(btrim(coalesce(p.job_title,'')),''),'Hospital Admin'),null,null
from public.organization_members m left join public.profiles p on p.id=m.user_id
where m.role::text='hospital_admin' and not exists(select 1 from public.employees e where e.organization_id=m.organization_id and e.user_id=m.user_id)
on conflict (organization_id,employee_code) do nothing;
