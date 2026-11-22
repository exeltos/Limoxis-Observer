-- Έλεγχοι: ταχύτερο ημερολόγιο έτους (public.control_calendar_months). Ίδιο αποτέλεσμα, ίδια υπογραφή, ίδιοι έλεγχοι
-- (SECURITY INVOKER, RLS των πινάκων). Η private.control_execution_marks μένει όπως την άφησε το
-- 20261231614000_control_marks_rules_once.sql· εδώ μόνο ευρετήριο για αυτήν και νέα σύνοψη στο ημερολόγιο.
-- 1. Ευρετήριο κάλυψης για τις εκτελέσεις που μετρούν: δίνει τις γραμμές ήδη ταξινομημένες ανά ανάθεση και ημέρα Αθήνας,
--    χωρίς ανάγνωση του πίνακα και χωρίς ταξινόμηση πριν από την κατάταξη (row_number) της control_execution_marks.
-- 2. Το ημερολόγιο υπολογίζει το «συχνός» μία φορά ανά ανάθεση (όχι ανά εκτέλεση) και φτιάχνει τη λίστα ημερών (jsonb)
--    μόνο για τους μη συχνούς ελέγχους· πριν τη χτίζε για κάθε εκτέλεση και την πετούσε, με ταξινόμηση που έπεφτε στον δίσκο.
-- ΙΑΣΩ, έτος 2026 (2.174 γραμμές), ως hospital_admin: από ~600-700 ms σε ~370 ms. Έλεγχος ισότητας (except all και προς
-- τις δύο κατευθύνσεις) για ΙΑΣΩ και δύο demo νοσοκομεία, 2025 και 2026, ζώνες Europe/Athens, UTC, America/New_York.

create index if not exists control_executions_marks_idx on public.control_executions
  (organization_id, assignment_id, ((performed_at at time zone 'Europe/Athens')::date), performed_at, id)
  include (department_id)
  where status <> 'cancelled' and cancelled_at is null and not is_extra;

create or replace function public.control_calendar_months(p_organization_id uuid, p_year integer, p_time_zone text default 'UTC'::text)
 returns table(assignment_id uuid, month integer, done bigint, late bigint, marks jsonb)
 language plpgsql
 stable
 set search_path to ''
 set plan_cache_mode to 'force_custom_plan'
 set work_mem to '16MB'
as $function$
#variable_conflict use_column
begin
  return query
  with freq as materialized (
    -- «Συχνός» μία φορά ανά ανάθεση, όχι ανά εκτέλεση.
    select a.id as assignment_id,
           case
             when f.cfg ->> 'kind' in ('daily', 'weekly') then true
             when f.cfg ->> 'kind' in ('monthly', 'yearly') then false
             else coalesce(case when f.cfg ->> 'interval' ~ '^[0-9]+(\.[0-9]+)?$'
                                then nullif((f.cfg ->> 'interval')::numeric, 0) end, 1) < 28
           end as frequent
    from public.control_assignments a
    join public.control_definitions d on d.id = a.control_id
    cross join lateral (select coalesce(a.frequency_config, d.frequency_config) as cfg) f
    where a.organization_id = p_organization_id
  ), picked as materialized (
    select m.assignment_id, (m.performed_at at time zone p_time_zone) as local_at, not m.on_time as is_late, q.frequent
    from private.control_execution_marks(p_organization_id, make_timestamptz(p_year, 1, 1, 0, 0, 0, p_time_zone), make_timestamptz(p_year + 1, 1, 1, 0, 0, 0, p_time_zone) - interval '1 microsecond') m
    join freq q on q.assignment_id = m.assignment_id
    where m.counted
  ), counts as (
    select r.assignment_id, extract(month from r.local_at)::integer - 1 as month, count(*) as done,
           count(*) filter (where r.is_late) as late, bool_or(r.frequent) as frequent
    from picked r
    group by r.assignment_id, extract(month from r.local_at)
  ), day_marks as (
    -- Οι ημέρες (jsonb) μόνο για τους μη συχνούς ελέγχους· οι συχνοί δίνουν '[]'.
    select r.assignment_id, extract(month from r.local_at)::integer - 1 as month,
           jsonb_agg(jsonb_build_object('day', extract(day from r.local_at)::integer, 'late', r.is_late) order by r.local_at) as marks
    from picked r
    where r.frequent is not true
    group by r.assignment_id, extract(month from r.local_at)
  )
  select c.assignment_id, c.month, c.done, c.late,
         case when c.frequent then '[]'::jsonb else k.marks end
  from counts c
  left join day_marks k on k.assignment_id = c.assignment_id and k.month = c.month;
end;
$function$;
