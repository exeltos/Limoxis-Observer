-- Έλεγχοι: οι ενημερώσεις του πίνακα «μετρά / εμπρόθεσμα» μιας ανάθεσης γίνονται η μία μετά την άλλη.
--
-- Μια αλλαγή συχνότητας ξαναϋπολογίζει όσες καταχωρίσεις βλέπει· μια καταχώριση που γράφεται την ίδια
-- στιγμή διαβάζει ακόμη την παλιά συχνότητα (η αλλαγή δεν έχει γίνει commit). Χωρίς συντονισμό καμία από
-- τις δύο δεν ξαναϋπολογίζει την άλλη και ο πίνακας κρατά παλιό αποτέλεσμα. Τώρα κάθε trigger παίρνει
-- πρώτα κλείδωμα συναλλαγής ανά ανάθεση (pg_advisory_xact_lock, με σταθερή σειρά για να μη γίνεται
-- αδιέξοδο) και μετά διαβάζει: όποια έρθει δεύτερη περιμένει το commit της πρώτης και, σε READ COMMITTED,
-- οι επόμενες εντολές της βλέπουν ό,τι εκείνη έγραψε. Το ίδιο κλείδωμα σειριοποιεί και δύο καταχωρίσεις
-- της ίδιας ανάθεσης που γράφονται ταυτόχρονα.

create or replace function private.control_marks_lock(p_assignment_ids uuid[])
 returns void
 language plpgsql
 volatile
 set search_path to ''
as $function$
declare
  v_id uuid;
begin
  for v_id in select distinct x from unnest(p_assignment_ids) x where x is not null order by x loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('control_marks:' || v_id::text, 0));
  end loop;
end;
$function$;

create or replace function private.control_execution_marks_sync()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_done text[] := '{}';
  v_assignment uuid;
  v_at timestamptz;
  v_next timestamptz;
  v_daily boolean;
  v_day date;
  v_lock uuid[];
  i integer;
begin
  -- Μία ενημέρωση κάθε φορά ανά ανάθεση (βλ. την επικεφαλίδα): πρώτα η σειρά, μετά η ανάγνωση.
  v_lock := case tg_op when 'INSERT' then array[new.assignment_id] when 'DELETE' then array[old.assignment_id] else array[old.assignment_id, new.assignment_id] end;
  perform private.control_marks_lock(v_lock);
  for i in 1..2 loop
    if i = 1 then
      continue when tg_op = 'INSERT';
      continue when not exists (select 1 from public.organizations o where o.id = old.organization_id);
      v_assignment := old.assignment_id;
      v_at := old.performed_at;
    else
      continue when tg_op = 'DELETE';
      v_assignment := new.assignment_id;
      v_at := new.performed_at;
    end if;
    -- Η επόμενη καταχώριση μόνο για μη ημερήσιους κανόνες (οι ημερήσιοι κρίνονται μόνο μέσα στην ημέρα τους).
    select coalesce(a.frequency_config, d.frequency_config) ->> 'kind' = 'daily' into v_daily
      from public.control_assignments a join public.control_definitions d on d.id = a.control_id
     where a.id = v_assignment;
    v_next := null;
    if v_daily is not true then
      select min(e.performed_at) into v_next from public.control_executions e
       where e.assignment_id = v_assignment and e.performed_at > v_at
         and e.status <> 'cancelled' and e.cancelled_at is null and not e.is_extra;
    end if;
    foreach v_day in array array[(v_at at time zone 'Europe/Athens')::date, (v_next at time zone 'Europe/Athens')::date] loop
      continue when v_day is null or (v_assignment::text || ':' || v_day::text) = any (v_done);
      v_done := v_done || (v_assignment::text || ':' || v_day::text);
      perform private.control_marks_compute(null, array[v_assignment], v_day, v_day);
    end loop;
  end loop;
  return null;
end;
$function$;

-- Trigger αναθέσεων: νέα συχνότητα → όλες οι καταχωρίσεις της ανάθεσης.
create or replace function private.control_assignment_marks_sync()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  perform private.control_marks_lock(array[new.id]);
  perform private.control_marks_compute(null, array[new.id]);
  return null;
end;
$function$;

-- Trigger ορισμών: νέα συχνότητα → οι αναθέσεις του ορισμού που δεν έχουν δική τους συχνότητα.
create or replace function private.control_definition_marks_sync()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_ids uuid[];
begin
  select array_agg(a.id) into v_ids from public.control_assignments a where a.control_id = new.id and a.frequency_config is null;
  if v_ids is not null then
    perform private.control_marks_lock(v_ids);
    perform private.control_marks_compute(null, v_ids);
  end if;
  return null;
end;
$function$;
