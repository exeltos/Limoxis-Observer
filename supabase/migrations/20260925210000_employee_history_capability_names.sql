-- Capability keys in SQL use the frontend catalogue IDs (underscore form).
-- employee_admin_history was the only helper still using the old dotted names,
-- which never match a custom-role or add-on grant, so a custom role holding
-- manage_staff_admin / *_occupational_health could not open employee history.

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
    or public.current_user_has_capability(v_org,'manage_staff_admin')
    or public.current_user_has_capability(v_org,'view_occupational_health')
    or public.current_user_has_capability(v_org,'manage_occupational_health')
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


revoke execute on function public.employee_admin_history(uuid) from public, anon;
grant execute on function public.employee_admin_history(uuid) to authenticated;
