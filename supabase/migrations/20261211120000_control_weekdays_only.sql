-- Controls: a daily control of the working days only (frequency.weekdaysOnly,
-- approved by the owner for departments closed at the weekend). Saturday and
-- Sunday hold no slots: after Friday's last entry, or an entry at the weekend,
-- the control is due by Monday's first slot. Mirrors nextDueAfterExecution in
-- src/features/controls/controlDueRules.js; the expected count of the
-- adherence report (controlAdherence.expectedOccurrences) leaves the weekend out.

-- The first day from p_day on that holds slots.
create or replace function private.control_working_day(p_frequency jsonb, p_day date)
returns date language sql immutable set search_path = '' as $$
  select case when coalesce(p_frequency ->> 'weekdaysOnly', '') = 'true' and p_frequency ->> 'kind' = 'daily'
              then p_day + case extract(isodow from p_day)::integer when 6 then 2 when 7 then 1 else 0 end
              else p_day end
$$;

create or replace function private.control_next_due(p_frequency jsonb, p_at timestamptz, p_done integer, p_tz text default 'Europe/Athens')
returns timestamptz language plpgsql immutable set search_path = '' as $$
declare
  v_unit text := private.control_period_unit(p_frequency);
  v_k integer := case when p_frequency ->> 'interval' ~ '^[0-9]+$' then greatest(1, (p_frequency ->> 'interval')::integer) else 1 end;
  v_local timestamp := p_at at time zone p_tz;
  v_target timestamp;
begin
  if p_frequency ->> 'kind' = 'daily' then
    if private.control_working_day(p_frequency, v_local::date) <> v_local::date then
      return private.control_slot_deadline(p_frequency, private.control_working_day(p_frequency, v_local::date), 0, p_tz);
    end if;
    if coalesce(p_done, 0) < private.control_required(p_frequency) then
      return private.control_slot_deadline(p_frequency, v_local::date, greatest(coalesce(p_done, 0), 0), p_tz);
    end if;
    return private.control_slot_deadline(p_frequency, private.control_working_day(p_frequency, v_local::date + 1), 0, p_tz);
  end if;
  v_target := case v_unit
    when 'week' then v_local + make_interval(days => 7 * v_k)
    when 'month' then date_trunc('month', v_local) + make_interval(months => v_k)
    when 'year' then date_trunc('year', v_local) + make_interval(years => v_k)
    else v_local + make_interval(days => v_k) end;
  return ((date_trunc(v_unit, v_target) + ('1 ' || v_unit)::interval) at time zone p_tz) - interval '1 second';
end;
$$;
