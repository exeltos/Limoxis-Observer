-- Ταχύτητα των ελέγχων (ημερολόγιο, συμμόρφωση): οι μικρές βοηθητικές συναρτήσεις της συχνότητας ήταν SQL με
-- SET search_path, οπότε η PostgreSQL ξανασχεδίαζε το ερώτημά τους σε κάθε κλήση και καλούσαν η μία την άλλη
-- (ΙΑΣΩ: 576 από τα 652 ms ενός έτους πήγαιναν σε 273 αναθέσεις). Σε plpgsql κρατούν το σχέδιο στη μνήμη.
-- Ίδια λογική, ίδια αποτελέσματα (ελέγχθηκαν όλες οι αναθέσεις όλων των νοσοκομείων σε συναλλαγή που ακυρώθηκε).

create or replace function private.control_period_unit(p_frequency jsonb) returns text language plpgsql immutable set search_path to '' as $f$
begin
  return case p_frequency ->> 'kind' when 'weekly' then 'week' when 'monthly' then 'month' when 'yearly' then 'year' else 'day' end;
end $f$;

create or replace function private.control_period_start(p_frequency jsonb, p_at timestamptz, p_tz text default 'Europe/Athens') returns timestamptz language plpgsql immutable set search_path to '' as $f$
begin
  return date_trunc(private.control_period_unit(p_frequency), p_at at time zone p_tz) at time zone p_tz;
end $f$;

create or replace function private.control_period_end(p_frequency jsonb, p_at timestamptz, p_tz text default 'Europe/Athens') returns timestamptz language plpgsql immutable set search_path to '' as $f$
declare v_unit text := private.control_period_unit(p_frequency);
begin
  return (date_trunc(v_unit, p_at at time zone p_tz) + ('1 ' || v_unit)::interval) at time zone p_tz;
end $f$;

create or replace function private.control_working_day(p_frequency jsonb, p_day date) returns date language plpgsql immutable set search_path to '' as $f$
begin
  if coalesce(p_frequency ->> 'weekdaysOnly', '') = 'true' and p_frequency ->> 'kind' = 'daily' then
    return p_day + case extract(isodow from p_day)::integer when 6 then 2 when 7 then 1 else 0 end;
  end if;
  return p_day;
end $f$;

-- The distinct valid «HH:MM» times of the day.
create or replace function private.control_set_times_count(p_frequency jsonb) returns integer language plpgsql immutable set search_path to '' as $f$
declare v_times jsonb := p_frequency -> 'times'; x text; seen text[] := '{}';
begin
  if jsonb_typeof(v_times) is distinct from 'array' then return 0; end if;
  for x in select btrim(e) from jsonb_array_elements_text(v_times) e loop
    if x ~ '^[0-9]{1,2}:[0-9]{2}$' and split_part(x, ':', 1)::integer < 24 and split_part(x, ':', 2)::integer < 60 and not (x = any(seen)) then
      seen := seen || x;
    end if;
  end loop;
  return cardinality(seen);
end $f$;

-- The minutes of the day each slot starts at: the set times (sorted, distinct) or the day split evenly.
create or replace function private.control_slot_starts(p_frequency jsonb) returns integer[] language plpgsql immutable set search_path to '' as $f$
declare v_times jsonb := p_frequency -> 'times'; x text; v integer; starts integer[] := '{}'; n integer; i integer;
begin
  if jsonb_typeof(v_times) = 'array' then
    for x in select btrim(e) from jsonb_array_elements_text(v_times) e loop
      if x ~ '^[0-9]{1,2}:[0-9]{2}$' and split_part(x, ':', 1)::integer < 24 and split_part(x, ':', 2)::integer < 60 then
        v := split_part(x, ':', 1)::integer * 60 + split_part(x, ':', 2)::integer;
        if not (v = any(starts)) then starts := starts || v; end if;
      end if;
    end loop;
  end if;
  if cardinality(starts) > 0 then
    return (select array_agg(s order by s) from unnest(starts) s);
  end if;
  n := greatest(1, case when p_frequency ->> 'timesPerDay' ~ '^[0-9]+$' then (p_frequency ->> 'timesPerDay')::integer else 1 end);
  for i in 0 .. n - 1 loop starts := starts || (i * 1440 / n)::integer; end loop;
  return starts;
end $f$;

create or replace function private.control_slot_margin(p_frequency jsonb) returns integer language plpgsql immutable set search_path to '' as $f$
declare c integer;
begin
  if p_frequency ->> 'toleranceMinutes' ~ '^[0-9]+$' and (p_frequency ->> 'toleranceMinutes')::integer > 0 then
    return (p_frequency ->> 'toleranceMinutes')::integer;
  end if;
  c := private.control_set_times_count(p_frequency);
  return case when c = 0 then 0 when c = 1 then 120 else 60 end;
end $f$;

create or replace function private.control_slot_deadlines(p_frequency jsonb) returns integer[] language plpgsql immutable set search_path to '' as $f$
declare s integer[] := private.control_slot_starts(p_frequency); mg integer := private.control_slot_margin(p_frequency); r integer[] := '{}'; i integer; nxt integer;
begin
  for i in 1 .. coalesce(cardinality(s), 0) loop
    nxt := coalesce(s[i + 1], 1440);
    r := r || case when mg > 0 then least(s[i] + mg, nxt) else nxt end;
  end loop;
  return case when cardinality(r) = 0 then null else r end;
end $f$;

create or replace function private.control_slot_opens(p_frequency jsonb) returns integer[] language plpgsql immutable set search_path to '' as $f$
declare s integer[] := private.control_slot_starts(p_frequency); timed boolean := private.control_set_times_count(p_frequency) > 0; r integer[] := '{}'; i integer;
begin
  for i in 1 .. coalesce(cardinality(s), 0) loop
    r := r || case when timed then greatest(0, s[i] - 60) else 0 end;
  end loop;
  return case when cardinality(r) = 0 then null else r end;
end $f$;

create or replace function private.control_required(p_frequency jsonb) returns integer language plpgsql immutable set search_path to '' as $f$
begin
  return case when p_frequency ->> 'kind' = 'daily' then cardinality(private.control_slot_starts(p_frequency)) else 1 end;
end $f$;

create or replace function private.control_slot_deadline(p_frequency jsonb, p_day date, p_index integer, p_tz text default 'Europe/Athens') returns timestamptz language plpgsql immutable set search_path to '' as $f$
declare m integer := coalesce((private.control_slot_deadlines(p_frequency))[least(greatest(p_index, 0), private.control_required(p_frequency) - 1) + 1], 1440);
begin
  if m >= 1440 then return ((p_day + 1)::timestamp at time zone p_tz) - interval '1 second'; end if;
  return (p_day::timestamp + make_interval(mins => m)) at time zone p_tz;
end $f$;
