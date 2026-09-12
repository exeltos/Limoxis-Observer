-- Harden surveillance episode reopening at the database boundary.
-- This is a governance action and must not rely only on application-side role checks.

create or replace function public.reopen_surveillance_episode(
  p_case_id text,
  p_reason text
) returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_org uuid;
  v_previous_status text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if coalesce(trim(p_reason),'') = '' then
    raise exception 'REOPEN_REASON_REQUIRED';
  end if;

  select organization_id, status
    into v_org, v_previous_status
  from public.surveillance_cases
  where id = p_case_id
  for update;

  if not found then
    raise exception 'SURVEILLANCE_CASE_NOT_FOUND';
  end if;

  if not public.is_org_admin(v_org) then
    raise exception 'SURVEILLANCE_REOPEN_NOT_AUTHORIZED';
  end if;

  if v_previous_status = 'active' then
    raise exception 'SURVEILLANCE_CASE_ALREADY_ACTIVE';
  end if;

  update public.surveillance_cases
     set status = 'active',
         reopened_at = now(),
         reopened_by = auth.uid(),
         reopen_reason = trim(p_reason),
         updated_at = now()
   where id = p_case_id;

  insert into public.clinical_audit_log
    (organization_id, entity_type, entity_id, action, actor_id, metadata)
  values
    (v_org,
     'surveillance_case',
     p_case_id,
     'surveillance_reopened',
     auth.uid(),
     jsonb_build_object('reason',trim(p_reason),'previous_status',v_previous_status));
end;
$$;

revoke execute on function public.reopen_surveillance_episode(text, text) from public, anon;
grant execute on function public.reopen_surveillance_episode(text, text) to authenticated;
