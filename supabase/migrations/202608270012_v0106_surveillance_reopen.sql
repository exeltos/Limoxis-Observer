-- Limoxis Observer v0.10.6
-- Reopening a completed surveillance episode is a restricted governance action.
-- Application authorization grants this only to the platform/super administrator.

alter table if exists public.surveillance_cases
  add column if not exists reopened_at timestamptz,
  add column if not exists reopened_by uuid,
  add column if not exists reopen_reason text;

create or replace function public.reopen_surveillance_episode(
  p_case_id text,
  p_reason text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(trim(p_reason),'') = '' then
    raise exception 'Reopen reason is required';
  end if;

  update public.surveillance_cases
     set status = 'active',
         reopened_at = now(),
         reopened_by = auth.uid(),
         reopen_reason = p_reason,
         updated_at = now()
   where id = p_case_id
     and status <> 'active';

  insert into public.clinical_audit_log
    (organization_id, entity_type, entity_id, action, actor_id, metadata)
  select organization_id,
         'surveillance_case',
         id,
         'surveillance_reopened',
         auth.uid(),
         jsonb_build_object('reason',p_reason,'previous_status','completed')
    from public.surveillance_cases
   where id = p_case_id;
end;
$$;
