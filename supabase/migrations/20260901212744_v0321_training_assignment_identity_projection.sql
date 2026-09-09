create or replace function public.project_training_assignment_identity()
returns trigger
language plpgsql
security definer
set search_path=public,auth,pg_temp
as $$
declare
  v_employee_id uuid;
  v_department_id uuid;
  v_email text;
  v_user_id uuid;
  v_count integer;
begin
  if new.record_type<>'assignment' then return new; end if;
  if nullif(new.payload->>'employeeId','') is null then return new; end if;

  select e.id,e.department_id,nullif(lower(trim(e.email)),'')
    into v_employee_id,v_department_id,v_email
  from public.employees e
  where e.organization_id=new.organization_id
    and e.employee_code=new.payload->>'employeeId'
  limit 1;

  if v_employee_id is null then return new; end if;
  new.department_id:=coalesce(new.department_id,v_department_id);

  if new.employee_user_id is null and v_email is not null then
    select count(distinct om.user_id),(array_agg(distinct om.user_id))[1]
      into v_count,v_user_id
    from public.organization_members om
    left join public.profiles p on p.id=om.user_id
    left join auth.users u on u.id=om.user_id
    where om.organization_id=new.organization_id
      and om.status='active'
      and lower(trim(coalesce(nullif(p.contact_email,''),u.email,'')))=v_email;
    if v_count=1 then new.employee_user_id:=v_user_id; end if;
  end if;

  new.payload:=new.payload || jsonb_build_object('employeeDbId',v_employee_id::text,'departmentId',coalesce(new.department_id,v_department_id)::text,'userId',case when new.employee_user_id is null then null else new.employee_user_id::text end);
  return new;
end;
$$;

revoke all on function public.project_training_assignment_identity() from public,anon,authenticated;
grant execute on function public.project_training_assignment_identity() to service_role;

drop trigger if exists trg_project_training_assignment_identity on public.training_records;
create trigger trg_project_training_assignment_identity
before insert or update of organization_id,record_type,department_id,employee_user_id,payload
on public.training_records
for each row execute function public.project_training_assignment_identity();