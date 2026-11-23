-- Έλεγχοι: σχεδόν άμεσο ημερολόγιο έτους (public.control_calendar_months). Ίδια υπογραφή, ίδιο αποτέλεσμα, ίδιοι έλεγχοι
-- πρόσβασης (SECURITY INVOKER, RLS των πινάκων).
-- 1. private.control_marks_monthly: μία γραμμή ανά (οργανισμός, ανάθεση, μήνας Αθήνας) με ό,τι δείχνει το ημερολόγιο για
--    τις καταχωρίσεις που μετρούν (eligible και counted του private.control_execution_marks_store): πλήθος, εκπρόθεσμες
--    και τις ημέρες (jsonb, κατά performed_at). Μήνας χωρίς καταχωρίσεις μένει με done = 0 και δεν διαβάζεται.
-- 2. Ενημέρωση από triggers επιπέδου εντολής στο store (εισαγωγή, αλλαγή, διαγραφή και η διαγραφή cascade): ξαναμετρούνται
--    ολόκληροι μόνο οι μήνες που άγγιξε η εντολή (παλιοί και νέοι), αφού πρώτα παρθεί το ίδιο κλείδωμα ανά ανάθεση
--    (private.control_marks_lock) με τα triggers του store. Ό,τι αλλάζει στο store (καταχώριση, ακύρωση, διαγραφή, νέα
--    συχνότητα) περνά στον μήνα στην ίδια συναλλαγή.
-- 3. Τα όρια που εξαρτώνται από τη στιγμή της ανάγνωσης (now(), δημιουργία του ορισμού) εφαρμόζονται κατά την ανάγνωση:
--    αν μια ανάθεση έχει καταχωρίσεις πριν από τη δημιουργία του ορισμού ή μετά το now() (δύο αναζητήσεις στο ευρετήριο),
--    η σύνοψη δίνει μόνο τους μήνες που είναι ολόκληροι μετά τη δημιουργία και πριν από τον τρέχοντα μήνα, και ο μήνας
--    δημιουργίας και ο τρέχων μήνας μετρώνται από το store με τα ίδια όρια όπως η control_execution_marks. Αλλιώς τα όρια
--    δεν κόβουν τίποτα και όλο το έτος έρχεται από τη σύνοψη.
-- 4. Ορατότητα: ίδιος κανόνας με την control_execution_marks (αναθέσεις και ορισμοί με τη RLS τους, και μία καταχώριση
--    ανά ανάθεση από την public.control_executions).
-- 5. Ζώνη ώρας άλλη από Europe/Athens, ή οργανισμός με ready = false στο private.control_marks_orgs: το προηγούμενο σώμα
--    αυτούσιο (από τη control_execution_marks).
-- ΙΑΣΩ ως hospital_admin (καλύτερο από 5): 2024 ~160 → ~37 ms, 2025 ~205 → ~36 ms, 2026 ~175 → ~36 ms.
-- Ισότητα ελέγχθηκε σε συναλλαγές που ακυρώθηκαν: 3 νοσοκομεία × 2024-2026 × Europe/Athens και UTC × 5 χρήστες (90
-- συγκρίσεις md5, καμία διαφορά)· και μετά από εισαγωγή, μετακίνηση, ακύρωση, έκτακτη, διαγραφή, μελλοντική καταχώριση,
-- καταχώριση πριν από τη δημιουργία του ορισμού και αλλαγή συχνότητας: σύνοψη = νέος υπολογισμός από το store, ημερολόγιο =
-- προηγούμενο σώμα.

create table if not exists private.control_marks_monthly (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assignment_id uuid not null references public.control_assignments(id) on delete cascade,
  month_start date not null,
  done bigint not null,
  late bigint not null,
  marks jsonb not null,
  computed_at timestamptz not null default now(),
  primary key (assignment_id, month_start, organization_id)
);
create index if not exists control_marks_monthly_org_idx on private.control_marks_monthly (organization_id, month_start);

alter table private.control_marks_monthly enable row level security;
create policy control_marks_monthly_read on private.control_marks_monthly for select to authenticated
  using (( select public.current_user_is_platform_owner()) or coalesce(organization_id = any (( select private.fast_orgs_capability('view_controls'::text))::uuid[]), false));
-- Μόνο ανάγνωση, για την control_calendar_months (SECURITY INVOKER). Το σχήμα private δεν εκτίθεται στο API.
grant select on private.control_marks_monthly to authenticated;

-- Trigger του store: οι μήνες (παλιοί και νέοι) που άγγιξε η εντολή, ξαναμετρημένοι ολόκληροι από το store.
-- Όταν σβήνεται ο οργανισμός ή η ανάθεση, οι γραμμές φεύγουν με το cascade και δεν ξαναγράφεται τίποτα.
create or replace function private.control_marks_monthly_sync()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_orgs uuid[];
  v_assignments uuid[];
  v_months date[];
begin
  if tg_op = 'INSERT' then
    select array_agg(k.organization_id), array_agg(k.assignment_id), array_agg(k.month_start) into v_orgs, v_assignments, v_months
      from (select distinct n.organization_id, n.assignment_id, date_trunc('month', n.local_day)::date as month_start from new_rows n) k;
  elsif tg_op = 'DELETE' then
    select array_agg(k.organization_id), array_agg(k.assignment_id), array_agg(k.month_start) into v_orgs, v_assignments, v_months
      from (select distinct o.organization_id, o.assignment_id, date_trunc('month', o.local_day)::date as month_start from old_rows o) k;
  else
    select array_agg(k.organization_id), array_agg(k.assignment_id), array_agg(k.month_start) into v_orgs, v_assignments, v_months
      from (select n.organization_id, n.assignment_id, date_trunc('month', n.local_day)::date as month_start from new_rows n
            union
            select o.organization_id, o.assignment_id, date_trunc('month', o.local_day)::date from old_rows o) k;
  end if;
  if v_assignments is null then
    return null;
  end if;
  -- Μία ενημέρωση κάθε φορά ανά ανάθεση, όπως στα triggers του store: πρώτα η σειρά, μετά η ανάγνωση.
  perform private.control_marks_lock(v_assignments);
  insert into private.control_marks_monthly as m (organization_id, assignment_id, month_start, done, late, marks, computed_at)
  select k.organization_id, k.assignment_id, k.month_start, x.done, x.late, coalesce(x.marks, '[]'::jsonb), now()
  from unnest(v_orgs, v_assignments, v_months) as k(organization_id, assignment_id, month_start)
  join public.organizations o on o.id = k.organization_id
  join public.control_assignments a on a.id = k.assignment_id
  cross join lateral (
    select count(*) as done, count(*) filter (where not s.on_time) as late,
           jsonb_agg(jsonb_build_object('day', extract(day from s.local_day)::integer, 'late', not s.on_time) order by s.performed_at) as marks
    from private.control_execution_marks_store s
    where s.assignment_id = k.assignment_id and s.organization_id = k.organization_id and s.eligible and s.counted
      and s.performed_at >= (k.month_start::timestamp at time zone 'Europe/Athens')
      and s.performed_at < ((k.month_start + interval '1 month')::timestamp at time zone 'Europe/Athens')
  ) x
  on conflict (assignment_id, month_start, organization_id) do update
    set done = excluded.done, late = excluded.late, marks = excluded.marks, computed_at = excluded.computed_at
    where (m.done, m.late, m.marks) is distinct from (excluded.done, excluded.late, excluded.marks);
  return null;
end;
$function$;

create trigger control_marks_store_monthly_insert after insert on private.control_execution_marks_store
  referencing new table as new_rows
  for each statement execute function private.control_marks_monthly_sync();
create trigger control_marks_store_monthly_update after update on private.control_execution_marks_store
  referencing old table as old_rows new table as new_rows
  for each statement execute function private.control_marks_monthly_sync();
create trigger control_marks_store_monthly_delete after delete on private.control_execution_marks_store
  referencing old table as old_rows
  for each statement execute function private.control_marks_monthly_sync();

-- Αρχική συμπλήρωση στην ίδια συναλλαγή με τα triggers: καμία αλλαγή του store δεν χάνεται.
insert into private.control_marks_monthly as m (organization_id, assignment_id, month_start, done, late, marks, computed_at)
select s.organization_id, s.assignment_id, date_trunc('month', s.local_day)::date, count(*), count(*) filter (where not s.on_time),
       jsonb_agg(jsonb_build_object('day', extract(day from s.local_day)::integer, 'late', not s.on_time) order by s.performed_at), now()
from private.control_execution_marks_store s
join public.organizations o on o.id = s.organization_id
join public.control_assignments a on a.id = s.assignment_id
where s.eligible and s.counted
group by s.organization_id, s.assignment_id, date_trunc('month', s.local_day)::date
on conflict (assignment_id, month_start, organization_id) do update
  set done = excluded.done, late = excluded.late, marks = excluded.marks, computed_at = excluded.computed_at;
analyze private.control_marks_monthly;

create or replace function public.control_calendar_months(p_organization_id uuid, p_year integer, p_time_zone text default 'UTC'::text)
 returns table(assignment_id uuid, month integer, done bigint, late bigint, marks jsonb)
 language plpgsql
 stable
 set search_path to ''
 set plan_cache_mode to 'force_custom_plan'
 set work_mem to '16MB'
as $function$
#variable_conflict use_column
declare
  v_from timestamptz;
  v_to timestamptz;
  v_now_month date;
begin
  if p_time_zone is distinct from 'Europe/Athens'
     or exists (select 1 from private.control_marks_orgs o where o.organization_id = p_organization_id and not o.ready) then
    -- Το προηγούμενο σώμα αυτούσιο.
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
    return;
  end if;

  v_from := make_timestamptz(p_year, 1, 1, 0, 0, 0, 'Europe/Athens');
  v_to := make_timestamptz(p_year + 1, 1, 1, 0, 0, 0, 'Europe/Athens') - interval '1 microsecond';
  v_now_month := date_trunc('month', now() at time zone 'Europe/Athens')::date;
  return query
  with vis as materialized (
    -- Αναθέσεις που βλέπει ο χρήστης, όπως στην control_execution_marks: μία καταχώριση ανά ανάθεση αρκεί για τη RLS της
    -- public.control_executions (οργανισμός και τμήμα, ίδια με της ανάθεσης χάρη στο FK).
    select a.id as assignment_id,
           case
             when f.cfg ->> 'kind' in ('daily', 'weekly') then true
             when f.cfg ->> 'kind' in ('monthly', 'yearly') then false
             else coalesce(case when f.cfg ->> 'interval' ~ '^[0-9]+(\.[0-9]+)?$'
                                then nullif((f.cfg ->> 'interval')::numeric, 0) end, 1) < 28
           end as frequent,
           greatest(v_from, d.created_at) as lo,
           least(v_to, now()) as hi,
           -- Ολόκληροι μήνες [full_from, full_to) μέσα στο έτος. Αν η ανάθεση έχει καταχωρίσεις πριν από τη δημιουργία του
           -- ορισμού, αρχίζουν από τον πρώτο μήνα μετά από αυτήν· αν έχει καταχωρίσεις μετά το now(), σταματούν πριν από τον
           -- τρέχοντα μήνα. Αλλιώς τα δύο όρια δεν κόβουν τίποτα και όλο το έτος έρχεται από τη σύνοψη.
           greatest(case when not exists (select 1 from private.control_execution_marks_store s2
                                          where s2.assignment_id = a.id and s2.eligible and s2.performed_at < d.created_at)
                         then make_date(p_year, 1, 1)
                         when (date_trunc('month', d.created_at at time zone 'Europe/Athens') at time zone 'Europe/Athens') >= d.created_at
                         then date_trunc('month', d.created_at at time zone 'Europe/Athens')::date
                         else (date_trunc('month', d.created_at at time zone 'Europe/Athens') + interval '1 month')::date end,
                    make_date(p_year, 1, 1)) as full_from,
           least(case when exists (select 1 from private.control_execution_marks_store s3
                                   where s3.assignment_id = a.id and s3.eligible and s3.performed_at > now())
                      then v_now_month else make_date(p_year + 1, 1, 1) end,
                 make_date(p_year + 1, 1, 1)) as full_to
    from public.control_assignments a
    join public.control_definitions d on d.id = a.control_id and d.organization_id = a.organization_id
    cross join lateral (select coalesce(a.frequency_config, d.frequency_config) as cfg) f
    where a.organization_id = p_organization_id
      and (select true from public.control_executions e
           where e.id = (select s1.execution_id from private.control_execution_marks_store s1
                         where s1.assignment_id = a.id and s1.eligible limit 1))
  ), live as (
    -- Οι μήνες εκτός σύνοψης (μήνας δημιουργίας, τρέχων μήνας): από το store, με τα όρια της control_execution_marks.
    select v.assignment_id, v.frequent, s.performed_at, s.on_time
    from vis v
    cross join lateral (
      select s.performed_at, s.on_time from private.control_execution_marks_store s
      where s.assignment_id = v.assignment_id and s.organization_id = p_organization_id and s.eligible and s.counted
        and s.performed_at >= v.lo and s.performed_at <= v.hi
        and s.performed_at < case when v.full_from < v.full_to then v.full_from::timestamp at time zone 'Europe/Athens' else 'infinity'::timestamptz end
      union all
      select s.performed_at, s.on_time from private.control_execution_marks_store s
      where v.full_from < v.full_to
        and s.assignment_id = v.assignment_id and s.organization_id = p_organization_id and s.eligible and s.counted
        and s.performed_at >= greatest(v.lo, v.full_to::timestamp at time zone 'Europe/Athens') and s.performed_at <= v.hi
    ) s
  )
  select m.assignment_id, extract(month from m.month_start)::integer - 1, m.done, m.late,
         case when v.frequent then '[]'::jsonb else m.marks end
  from vis v
  join private.control_marks_monthly m on m.assignment_id = v.assignment_id
  where m.organization_id = p_organization_id and m.done > 0
    and m.month_start >= v.full_from and m.month_start < v.full_to
  union all
  select r.assignment_id, extract(month from r.performed_at at time zone 'Europe/Athens')::integer - 1, count(*),
         count(*) filter (where not r.on_time),
         case when bool_or(r.frequent) then '[]'::jsonb
              else jsonb_agg(jsonb_build_object('day', extract(day from r.performed_at at time zone 'Europe/Athens')::integer, 'late', not r.on_time) order by r.performed_at)
                     filter (where not r.frequent) end
  from live r
  group by r.assignment_id, extract(month from r.performed_at at time zone 'Europe/Athens');
end;
$function$;
