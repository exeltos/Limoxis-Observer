create or replace function public.capture_control_execution_revision()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_actor uuid;
  v_reason text;
  v_before jsonb;
  v_after jsonb;
begin
  if old.status <> 'completed' then
    return new;
  end if;

  v_before := to_jsonb(old) - array['edited_at','edited_by'];
  v_after  := to_jsonb(new) - array['edited_at','edited_by'];

  if v_before = v_after then
    return new;
  end if;

  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Authenticated user required to edit a completed control execution';
  end if;

  new.edited_at := now();
  new.edited_by := v_actor;

  v_reason := coalesce(
    nullif(new.response_data ->> 'editReason', ''),
    nullif(new.cancellation_reason, ''),
    'Post-completion edit'
  );

  insert into public.control_execution_revisions (
    execution_id,
    organization_id,
    before_data,
    after_data,
    reason,
    changed_by,
    changed_at
  ) values (
    old.id,
    old.organization_id,
    to_jsonb(old),
    to_jsonb(new),
    v_reason,
    v_actor,
    now()
  );

  return new;
end;
$$;

drop trigger if exists trg_control_execution_revision on public.control_executions;
create trigger trg_control_execution_revision
before update on public.control_executions
for each row
execute function public.capture_control_execution_revision();
