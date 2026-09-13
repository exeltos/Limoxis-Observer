-- Employee administrative history: append-only audit events without clinical payloads.
-- The Employee record History tab reads these rows through a permission-checked RPC.

create or replace function private.audit_employee_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_org uuid := coalesce(new.organization_id,old.organization_id);
  v_employee_id uuid := coalesce(new.id,old.id);
  v_employee_code text := coalesce(new.employee_code,old.employee_code);
  v_actor uuid := (select auth.uid());
  v_actor_role public.app_role;
  v_actor_name text;
  v_changed jsonb := '[]'::jsonb;
begin
  if tg_op = 'UPDATE' then
    select coalesce(jsonb_agg(k order by k),'[]'::jsonb)
      into v_changed
    from jsonb_object_keys(
      to_jsonb(new) - array['id','organization_id','created_at','created_by','updated_at','updated_by']
    ) as keys(k)
    where (to_jsonb(new)->k) is distinct from (to_jsonb(old)->k);

    if jsonb_array_length(v_changed)=0 then
      return new;
    end if;
  end if;

  if v_actor is not null then
    select p.full_name into v_actor_name
    from public.profiles p
    where p.id=v_actor;

    if public.current_user_is_platform_owner() then
      v_actor_role := 'platform_owner'::public.app_role;
    else
      select om.role into v_actor_role
      from public.organization_members om
      where om.organization_id=v_org
        and om.user_id=v_actor
        and om.status='active'
      order by om.created_at desc
      limit 1;
    end if;
  end if;

  insert into public.system_audit_log(
    organization_id,actor_user_id,actor_role,event_type,entity_type,entity_id,metadata
  ) values (
    v_org,v_actor,v_actor_role,lower(tg_op),'employees',v_employee_id::text,
    jsonb_build_object(
      'source','employee_record',
      'employee_code',v_employee_code,
      'actor_name',coalesce(v_actor_name,''),
      'changed_fields',case when tg_op='UPDATE' then v_changed else '[]'::jsonb end
    )
  );

  return coalesce(new,old);
end;
$function$;

drop trigger if exists employees_administrative_audit on public.employees;
create trigger employees_administrative_audit
after insert or update or delete on public.employees
for each row execute function private.audit_employee_change();

-- Seed creation history for employee rows that pre-date the trigger.
insert into public.system_audit_log(
  organization_id,actor_user_id,actor_role,event_type,entity_type,entity_id,metadata,created_at
)
select
  e.organization_id,
  e.created_by,
  case
    when p.is_platform_owner then 'platform_owner'::public.app_role
    else (
      select om.role
      from public.organization_members om
      where om.organization_id=e.organization_id
        and om.user_id=e.created_by
        and om.status='active'
      order by om.created_at desc
      limit 1
    )
  end,
  'insert','employees',e.id::text,
  jsonb_build_object(
    'source','employee_record_backfill',
    'employee_code',e.employee_code,
    'actor_name',coalesce(p.full_name,''),
    'changed_fields','[]'::jsonb
  ),
  e.created_at
from public.employees e
left join public.profiles p on p.id=e.created_by
where not exists (
  select 1 from public.system_audit_log a
  where a.entity_type='employees'
    and a.entity_id=e.id::text
    and a.event_type='insert'
);

create or replace function public.employee_admin_history(p_employee_id uuid)
returns table(
  audit_id bigint,
  action text,
  occurred_at timestamptz,
  actor_name text,
  actor_role text,
  changed_fields jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_org uuid;
begin
  select e.organization_id into v_org
  from public.employees e
  where e.id=p_employee_id;

  if v_org is null then
    return;
  end if;

  if not (
    public.current_user_is_platform_owner()
    or public.current_user_has_org_role(v_org,array['hospital_admin','hr_office','occupational_physician','infection_control_lead']::public.app_role[])
    or public.current_user_has_capability(v_org,'employees.manage')
    or public.current_user_has_capability(v_org,'occupational_health.view')
    or public.current_user_has_capability(v_org,'occupational_health.manage')
  ) then
    raise exception 'Employee history access denied';
  end if;

  return query
  select
    a.id,
    a.event_type,
    a.created_at,
    coalesce(nullif(a.metadata->>'actor_name',''),p.full_name,'')::text,
    coalesce(a.actor_role::text,'')::text,
    coalesce(a.metadata->'changed_fields','[]'::jsonb)
  from public.system_audit_log a
  left join public.profiles p on p.id=a.actor_user_id
  where a.organization_id=v_org
    and a.entity_type='employees'
    and a.entity_id=p_employee_id::text
  order by a.created_at desc,a.id desc;
end;
$function$;

grant execute on function public.employee_admin_history(uuid) to authenticated;
