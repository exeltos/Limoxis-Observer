-- Controls: a department records a daily control with set times only inside the
-- window of one of its times (1 hour before to the control's margin after, the same
-- on-time window as private.control_slot_opens / control_slot_deadlines). Outside it
-- the database refuses the regular entry (control_outside_window): the department
-- asks the hospital administrator. The hospital administrator and the platform owner
-- record at any time. Imports and service work (no signed-in user), extra entries
-- (with their reason), cancelled ones, other frequencies and controls without set
-- times are not held to a window. The screen offers the same rule (recordWindow).
create or replace function private.control_executions_window_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_frequency jsonb;
  v_opens integer[];
  v_closes integer[];
  v_done integer;
  v_minute integer;
  v_tz constant text := 'Europe/Athens';
  i integer;
begin
  if auth.uid() is null then return new; end if;
  if new.status = 'cancelled' or new.cancelled_at is not null or coalesce(new.is_extra, false) then return new; end if;
  if public.current_user_is_platform_owner()
     or public.current_user_has_org_role(new.organization_id, array['hospital_admin']::public.app_role[]) then
    return new;
  end if;
  select coalesce(a.frequency_config, d.frequency_config) into v_frequency
  from public.control_assignments a join public.control_definitions d on d.id = a.control_id
  where a.id = new.assignment_id;
  if v_frequency is null or coalesce(v_frequency ->> 'kind', 'daily') <> 'daily'
     or private.control_set_times_count(v_frequency) = 0 then
    return new;
  end if;
  v_opens := private.control_slot_opens(v_frequency);
  v_closes := private.control_slot_deadlines(v_frequency);
  select count(*) into v_done from public.control_executions e
  where e.assignment_id = new.assignment_id and e.status <> 'cancelled' and e.cancelled_at is null and not e.is_extra
    and (e.performed_at at time zone v_tz)::date = (now() at time zone v_tz)::date;
  -- The day's entries are complete: the period guard decides (an extra entry, with its reason).
  if v_done >= coalesce(array_length(v_opens, 1), 0) then return new; end if;
  v_minute := (extract(hour from now() at time zone v_tz) * 60 + extract(minute from now() at time zone v_tz))::integer;
  for i in (v_done + 1)..array_length(v_opens, 1) loop
    if v_minute >= v_opens[i] and v_minute <= v_closes[i] then return new; end if;
  end loop;
  raise exception 'control_outside_window' using errcode = 'P0001',
    hint = 'This control is recorded from 1 hour before its time until its margin after; ask the hospital administrator.';
end;
$$;

create or replace trigger control_executions_window_guard before insert on public.control_executions
  for each row execute function private.control_executions_window_guard();
