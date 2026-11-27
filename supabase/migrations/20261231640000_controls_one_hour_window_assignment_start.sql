-- Έλεγχοι (ιδιοκτήτης 26/11/2026, «ναι σε όλα»): οι καταχωρίσεις γίνονται την ώρα του ελέγχου με ανοχή ±1 ώρα.
-- 1. Περιθώριο ±1 ώρα για όλους: όσοι γίνονται μία φορά την ημέρα είχαν 1 ώρα πριν έως 2 ώρες μετά (απόφαση 2/11)·
--    τώρα 1 ώρα μετά, όπως όσοι γίνονται συχνότερα. Το περιθώριο του ίδιου του ελέγχου (toleranceMinutes) ισχύει όπως πριν.
--    Οι προθεσμίες (next_due_at) και οι σημάνσεις «στην ώρα της» των αναθέσεων που αλλάζουν ξαναϋπολογίζονται.
-- 2. Από πότε ανατέθηκε ένας έλεγχος σε τμήμα (control_assignments.created_at): το «έπρεπε» και οι «χαμένες εκτελέσεις»
--    μετρούν από εκεί, όχι από τη δημιουργία του ελέγχου. Οι υπάρχουσες παίρνουν την ημέρα της πρώτης καταχώρισης· όσες
--    δεν έχουν καμία, την περίοδο της πρώτης τους προθεσμίας (μένει ίδια όσο δεν γίνεται καταχώριση)· ποτέ πριν από τη
--    δημιουργία του ελέγχου. Μια καταχώριση με παλαιότερη ημερομηνία (εισαγωγή ιστορικού, demo) τη φέρνει πιο πίσω.

-- 1. Περιθώριο
create or replace function private.control_slot_margin(p_frequency jsonb) returns integer language plpgsql immutable set search_path to '' as $f$
declare c integer;
begin
  if p_frequency ->> 'toleranceMinutes' ~ '^[0-9]+$' and (p_frequency ->> 'toleranceMinutes')::integer > 0 then
    return (p_frequency ->> 'toleranceMinutes')::integer;
  end if;
  c := private.control_set_times_count(p_frequency);
  return case when c = 0 then 0 else 60 end;
end $f$;

-- 2. Ημερομηνία ανάθεσης
alter table public.control_assignments add column if not exists created_at timestamptz;

update public.control_assignments a
   set created_at = greatest(d.created_at, coalesce(
         ((select min(e.performed_at) from public.control_executions e
            where e.assignment_id = a.id and e.status <> 'cancelled' and e.cancelled_at is null) at time zone 'Europe/Athens')::date::timestamp at time zone 'Europe/Athens',
         case when a.next_due_at is not null then private.control_period_start(coalesce(a.frequency_config, d.frequency_config), a.next_due_at) end,
         d.created_at))
  from public.control_definitions d
 where d.id = a.control_id and a.created_at is null;

alter table public.control_assignments alter column created_at set default now();
update public.control_assignments set created_at = now() where created_at is null;
alter table public.control_assignments alter column created_at set not null;

create or replace function private.control_assignment_start_from_execution()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if new.status <> 'cancelled' and new.cancelled_at is null then
    update public.control_assignments a
       set created_at = ((new.performed_at at time zone 'Europe/Athens')::date::timestamp at time zone 'Europe/Athens')
     where a.id = new.assignment_id and a.created_at > new.performed_at;
  end if;
  return null;
end;
$function$;

create or replace trigger control_executions_assignment_start after insert on public.control_executions
  for each row execute function private.control_assignment_start_from_execution();

-- 3. Νέες προθεσμίες και σημάνσεις για όσους γίνονται μία φορά την ημέρα χωρίς δικό τους περιθώριο.
do $$
declare
  r record;
  v_ids uuid[];
begin
  select array_agg(x.id) into v_ids
    from (select a.id, coalesce(a.frequency_config, d.frequency_config) as cfg
            from public.control_assignments a join public.control_definitions d on d.id = a.control_id) x
   where x.cfg ->> 'kind' = 'daily' and private.control_set_times_count(x.cfg) = 1
     and not coalesce((x.cfg ->> 'toleranceMinutes') ~ '^[0-9]+$' and (x.cfg ->> 'toleranceMinutes')::integer > 0, false);
  if v_ids is null then return; end if;
  for r in select unnest(v_ids) as id loop
    perform private.control_refresh_assignment_due(r.id);
  end loop;
  perform private.control_marks_lock(v_ids);
  perform private.control_marks_compute(null, v_ids);
end $$;
