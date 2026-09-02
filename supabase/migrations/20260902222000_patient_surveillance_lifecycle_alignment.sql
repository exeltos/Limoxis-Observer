-- IND02 strict role audit: patient and surveillance lifecycle mutations require
-- explicit capabilities. Read access never implies create/edit/delete/close/reopen.

create or replace function public.current_user_can_patient_capability(target_org uuid,target_department uuid,target_capability text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select
    public.current_user_is_platform_owner()
    or (
      public.current_user_has_capability(target_org,target_capability)
      and public.current_user_has_org_role(target_org,array['infection_control_lead']::public.app_role[])
    );
$$;

revoke all on function public.current_user_can_patient_capability(uuid,uuid,text) from public;
grant execute on function public.current_user_can_patient_capability(uuid,uuid,text) to authenticated;

create or replace function public.current_user_can_surveillance_capability(target_org uuid,target_department uuid,target_case uuid,target_capability text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select
    public.current_user_is_platform_owner()
    or (
      public.current_user_has_capability(target_org,target_capability)
      and (
        public.current_user_has_org_role(target_org,array['infection_control_lead']::public.app_role[])
        or (target_case is not null and public.current_user_has_case_assignment(target_org,target_case))
      )
    );
$$;

revoke all on function public.current_user_can_surveillance_capability(uuid,uuid,uuid,text) from public;
grant execute on function public.current_user_can_surveillance_capability(uuid,uuid,uuid,text) to authenticated;

-- Patient lifecycle. IPC Lead owns operational patient registry mutation;
-- Platform Owner retains the approved platform-wide override.
drop policy if exists patients_insert on public.patients;
create policy patients_insert on public.patients
for insert to authenticated
with check (public.current_user_can_patient_capability(organization_id,department_id,'create_patient'));

drop policy if exists patients_update on public.patients;
create policy patients_update on public.patients
for update to authenticated
using (public.current_user_can_patient_capability(organization_id,department_id,'edit_patient'))
with check (public.current_user_can_patient_capability(organization_id,department_id,'edit_patient'));

drop policy if exists patients_delete on public.patients;
create policy patients_delete on public.patients
for delete to authenticated
using (public.current_user_can_patient_capability(organization_id,department_id,'delete_patient'));

-- Surveillance creation/edit/deletion are distinct from governance transitions.
drop policy if exists surveillance_insert on public.surveillance_cases;
create policy surveillance_insert on public.surveillance_cases
for insert to authenticated
with check (public.current_user_can_surveillance_capability(organization_id,department_id,null,'create_surveillance'));

drop policy if exists surveillance_update on public.surveillance_cases;
create policy surveillance_update on public.surveillance_cases
for update to authenticated
using (public.current_user_can_surveillance_capability(organization_id,department_id,id,'edit_surveillance'))
with check (public.current_user_can_surveillance_capability(organization_id,department_id,id,'edit_surveillance'));

drop policy if exists surveillance_delete on public.surveillance_cases;
create policy surveillance_delete on public.surveillance_cases
for delete to authenticated
using (public.current_user_can_surveillance_capability(organization_id,department_id,id,'delete_surveillance'));

-- Governance transitions use controlled RPCs so close/reopen cannot be smuggled
-- through a generic row update that only requires edit_surveillance.
create or replace function public.close_surveillance_case(p_case_id uuid,p_reason text default null)
returns public.surveillance_cases
language plpgsql security definer
set search_path = ''
as $$
declare
  v_case public.surveillance_cases;
begin
  select * into v_case from public.surveillance_cases where id = p_case_id;
  if v_case.id is null then raise exception 'Surveillance case not found'; end if;
  if not public.current_user_can_surveillance_capability(v_case.organization_id,v_case.department_id,v_case.id,'close_surveillance') then
    raise exception 'Surveillance close denied';
  end if;
  if v_case.status <> 'active' then raise exception 'Only active surveillance cases can be closed'; end if;
  update public.surveillance_cases
  set status='closed',closed_at=now(),close_reason=nullif(trim(p_reason),''),closed_by=auth.uid(),updated_at=now()
  where id=p_case_id returning * into v_case;
  return v_case;
end;
$$;

create or replace function public.reopen_surveillance_case(p_case_id uuid)
returns public.surveillance_cases
language plpgsql security definer
set search_path = ''
as $$
declare
  v_case public.surveillance_cases;
begin
  select * into v_case from public.surveillance_cases where id = p_case_id;
  if v_case.id is null then raise exception 'Surveillance case not found'; end if;
  if not public.current_user_can_surveillance_capability(v_case.organization_id,v_case.department_id,v_case.id,'reopen_surveillance') then
    raise exception 'Surveillance reopen denied';
  end if;
  if v_case.status <> 'closed' then raise exception 'Only closed surveillance cases can be reopened'; end if;
  update public.surveillance_cases
  set status='active',closed_at=null,close_reason=null,closed_by=null,updated_at=now()
  where id=p_case_id returning * into v_case;
  return v_case;
end;
$$;

revoke all on function public.close_surveillance_case(uuid,text) from public;
revoke all on function public.reopen_surveillance_case(uuid) from public;
grant execute on function public.close_surveillance_case(uuid,text) to authenticated;
grant execute on function public.reopen_surveillance_case(uuid) to authenticated;
