-- Bulk creation of accounts from the employee roster, for the Hospital Admin too
-- (Management › Users), not only the Platform Owner. The admin sees the roster of
-- their own hospital only, and never which other organizations an e-mail already
-- belongs to: such a person is shown as «account in use» and is skipped (only the
-- Platform Owner links an account another hospital uses, as in the single creation).

create or replace function public.platform_employee_accounts(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
  v_owner boolean := public.current_user_is_platform_owner();
begin
  if auth.uid() is null or not (v_owner or public.is_org_admin(p_organization_id)) then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;

  with emp as (
    select e.id, e.user_id, e.department_id,
      btrim(concat_ws(' ', e.first_name, e.last_name)) as full_name,
      coalesce(e.profession_name, e.position_name) as profession_name,
      coalesce(d.name, e.department_name) as department_name,
      nullif(lower(btrim(coalesce(e.email, ''))), '') as email
    from public.employees e
    left join public.departments d on d.id = e.department_id
    where e.organization_id = p_organization_id and e.employment_status = 'active'
  ),
  dup as (
    select email from emp where email is not null group by email having count(*) > 1
  ),
  latest_item as (
    select distinct on (i.employee_id) i.employee_id, i.id, i.batch_id, i.status, i.error_code, i.role, i.department_id, i.send_count, i.last_sent_at, i.created_at
    from public.account_creation_items i
    where i.organization_id = p_organization_id
    order by i.employee_id, i.created_at desc
  ),
  latest_invite as (
    select distinct on (a.user_id) a.user_id, a.id, a.created_at, a.expires_at, a.accepted_at, a.revoked_at
    from public.account_invitations a
    where a.organization_id = p_organization_id
    order by a.user_id, a.created_at desc
  ),
  roster as (
    select jsonb_build_object(
      'employee_id', emp.id,
      'full_name', emp.full_name,
      'profession_name', emp.profession_name,
      'department_id', emp.department_id,
      'department_name', emp.department_name,
      'email', emp.email,
      'user_id', emp.user_id,
      'username', p.username,
      'member_role', m.role,
      'member_status', m.status,
      'account_state', case when emp.user_id is null then 'none' when m.status = 'active' then 'active' when m.status = 'invited' then 'invited' when m.status = 'disabled' then 'disabled' else 'other' end,
      'blocked_reason', case
        when emp.user_id is not null then null
        when emp.email is null then 'missing_email'
        when emp.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or emp.email ~ '\.invalid$' then 'invalid_email'
        when exists (select 1 from dup where dup.email = emp.email) then 'duplicate_email'
        when exists (select 1 from public.profiles xp join public.organization_members xm on xm.user_id = xp.id and xm.organization_id = p_organization_id where lower(xp.contact_email) = emp.email) then 'email_in_this_org'
        when ex.id is not null and not v_owner then 'account_in_use'
        else null end,
      'existing_user_id', case when v_owner then ex.id end,
      'existing_name', case when v_owner then ex.full_name end,
      'existing_is_demo', case when v_owner then ex.is_demo end,
      'existing_organizations', case when v_owner then ex.organizations end,
      'item_id', li.id,
      'item_batch_id', li.batch_id,
      'item_status', li.status,
      'item_error', li.error_code,
      'item_role', li.role,
      'item_created_at', li.created_at,
      'send_count', coalesce(li.send_count, 0),
      'last_sent_at', li.last_sent_at,
      'invitation_id', inv.id,
      'invitation_created_at', inv.created_at,
      'invitation_expires_at', inv.expires_at,
      'invitation_accepted_at', inv.accepted_at,
      'invitation_revoked_at', inv.revoked_at,
      'invitation_opened', case when inv.id is null then false else exists (select 1 from public.access_token_attempts t where t.invitation_id = inv.id and t.success) end,
      'email_status', ob.status,
      'email_error', ob.last_error
    ) as entry
    from emp
    left join public.profiles p on p.id = emp.user_id
    left join public.organization_members m on m.organization_id = p_organization_id and m.user_id = emp.user_id
    left join latest_item li on li.employee_id = emp.id
    left join latest_invite inv on inv.user_id = emp.user_id
    left join lateral (
      select o.status, o.last_error from public.notification_outbox o
      where inv.id is not null and o.entity_id = inv.id and o.notification_type = 'account_created'
      order by o.created_at desc limit 1
    ) ob on true
    left join lateral (
      select xp.id, xp.full_name, xp.is_demo,
        (select jsonb_agg(o.name order by o.name) from public.organization_members xm join public.organizations o on o.id = xm.organization_id where xm.user_id = xp.id) as organizations
      from public.profiles xp
      where emp.user_id is null and emp.email is not null and lower(xp.contact_email) = emp.email
        and not exists (select 1 from public.organization_members xm where xm.user_id = xp.id and xm.organization_id = p_organization_id)
      limit 1
    ) ex on true
  )
  select jsonb_build_object(
    'employees', coalesce((select jsonb_agg(entry order by entry->>'full_name') from roster), '[]'::jsonb),
    'departments', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name) order by d.name) from public.departments d where d.organization_id = p_organization_id and d.is_active), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$function$;
revoke all on function public.platform_employee_accounts(uuid) from public, anon;
grant execute on function public.platform_employee_accounts(uuid) to authenticated;
