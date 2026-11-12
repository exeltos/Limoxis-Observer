-- Το παράθυρο ώρας των ελέγχων δεν ισχύει όταν γράφεται το πακέτο δεδομένων
-- Demo (επαναφορά από αξιολογητή με οποιονδήποτε ρόλο): οι παλιές εκτελέσεις
-- του Demo γράφονται μαζί. Μόνο μέσα στην επαναφορά (limoxis.test_reset) και
-- μόνο σε Demo οργανισμό. Κατά τα άλλα ίδιο με την τρέχουσα έκδοση.
create or replace function private.control_executions_window_guard()
returns trigger language plpgsql security definer set search_path to ''
as $function$
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
  if coalesce(current_setting('limoxis.test_reset', true), '') = 'on'
     and exists (select 1 from public.organizations o where o.id = new.organization_id and o.is_demo) then
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
  if v_done >= coalesce(array_length(v_opens, 1), 0) then return new; end if;
  v_minute := (extract(hour from now() at time zone v_tz) * 60 + extract(minute from now() at time zone v_tz))::integer;
  for i in (v_done + 1)..array_length(v_opens, 1) loop
    if v_minute >= v_opens[i] and v_minute <= v_closes[i] then return new; end if;
  end loop;
  raise exception 'control_outside_window' using errcode = 'P0001',
    hint = 'This control is recorded from 1 hour before its time until its margin after; ask the hospital administrator.';
end;
$function$;
