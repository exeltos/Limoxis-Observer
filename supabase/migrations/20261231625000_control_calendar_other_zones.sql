-- Έλεγχοι: γρήγορο ημερολόγιο έτους και σε ζώνη ώρας άλλη από Europe/Athens (public.control_calendar_months, ίδια
-- υπογραφή, ίδιο αποτέλεσμα, SECURITY INVOKER). Το 20261231622000_control_calendar_monthly.sql έδινε τη σύνοψη μόνο για
-- Europe/Athens· οι άλλες ζώνες (και η προεπιλογή 'UTC' όταν η κλήση δεν δίνει ζώνη) έτρεχαν ακόμη το προηγούμενο σώμα
-- (~160-200 ms για ΙΑΣΩ 2026).
-- 1. Συχνοί έλεγχοι χωρίς καταχωρίσεις πριν από τη δημιουργία του ορισμού ή μετά το now(): μήνας στη ζώνη = μήνας Αθήνας
--    από την private.control_marks_monthly + όσες καταχωρίσεις πέφτουν ανάμεσα στην αρχή του μήνα στη ζώνη και στην
--    αρχή του στην Αθήνα (με πρόσημο ανάλογα με το ποια έρχεται πρώτη). Οι συχνοί δεν έχουν λίστα ημερών ('[]').
-- 2. Οι υπόλοιποι (μη συχνοί, που χρειάζονται τις ημέρες στη ζώνη, και όσοι έχουν καταχωρίσεις εκτός ορίων): από το
--    store, με τα όρια και την ορατότητα της control_execution_marks.
-- 3. Europe/Athens: όπως πριν. Ζώνη null ή οργανισμός με ready = false: το προηγούμενο σώμα αυτούσιο.
-- 4. Νέο ευρετήριο (οργανισμός, performed_at) στο store για τις καταχωρίσεις των 13 άκρων: μία ανάγνωση ανά άκρη.
-- ΙΑΣΩ 2026 ως hospital_admin, χρόνος ρολογιού σε DO block (5 κλήσεις): χωρίς ζώνη ('UTC') ~160-210 → ~48-54 ms,
-- Europe/London ~190 → ~50-57 ms, Europe/Athens ~36-44 ms (όπως πριν).
-- Ισότητα (md5) με το προηγούμενο σώμα: 3 νοσοκομεία × 2024-2026 × 5 χρήστες × Europe/Athens, UTC, Europe/London,
-- America/New_York, Asia/Kolkata, Asia/Tokyo, Pacific/Kiritimati (315 συγκρίσεις, καμία διαφορά).

-- Οι καταχωρίσεις ενός οργανισμού σε ένα διάστημα λίγων ωρών (οι άκρες των μηνών), χωρίς σάρωση ανά ανάθεση.
create index if not exists control_execution_marks_store_org_time_idx on private.control_execution_marks_store
  (organization_id, performed_at) include (assignment_id, counted, on_time) where eligible;

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
  if p_time_zone is null
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

  if p_time_zone <> 'Europe/Athens' then
    -- Άλλη ζώνη ώρας. Για τους συχνούς ελέγχους χωρίς καταχωρίσεις πριν από τη δημιουργία του ορισμού ή μετά το now(): ο
    -- μήνας της ζώνης = ο μήνας Αθήνας της σύνοψης ± οι καταχωρίσεις ανάμεσα στην αρχή του μήνα στη ζώνη και στην αρχή
    -- του στην Αθήνα (λίγες ώρες σε κάθε μία από τις 13 άκρες του έτους). Οι υπόλοιποι (μη συχνοί, με τις ημέρες τους, ή
    -- με καταχωρίσεις εκτός ορίων): από το store, με τα όρια της control_execution_marks.
    return query
    with vis as materialized (
      select a.id as assignment_id,
             case
               when f.cfg ->> 'kind' in ('daily', 'weekly') then true
               when f.cfg ->> 'kind' in ('monthly', 'yearly') then false
               else coalesce(case when f.cfg ->> 'interval' ~ '^[0-9]+(\.[0-9]+)?$'
                                  then nullif((f.cfg ->> 'interval')::numeric, 0) end, 1) < 28
             end as frequent,
             greatest(make_timestamptz(p_year, 1, 1, 0, 0, 0, p_time_zone), d.created_at) as lo,
             least(make_timestamptz(p_year + 1, 1, 1, 0, 0, 0, p_time_zone) - interval '1 microsecond', now()) as hi,
             not exists (select 1 from private.control_execution_marks_store s2
                         where s2.assignment_id = a.id and s2.eligible and s2.performed_at < d.created_at)
             and not exists (select 1 from private.control_execution_marks_store s3
                             where s3.assignment_id = a.id and s3.eligible and s3.performed_at > now()) as clean
      from public.control_assignments a
      join public.control_definitions d on d.id = a.control_id and d.organization_id = a.organization_id
      cross join lateral (select coalesce(a.frequency_config, d.frequency_config) as cfg) f
      where a.organization_id = p_organization_id
        and (select true from public.control_executions e
             where e.id = (select s1.execution_id from private.control_execution_marks_store s1
                           where s1.assignment_id = a.id and s1.eligible limit 1))
    ), edges as materialized (
      -- Οι 13 αρχές μηνών (Ιανουάριος ως Ιανουάριος του επόμενου έτους) στη ζώνη και στην Αθήνα.
      select g.b, make_timestamptz(p_year + (g.b - 1) / 12, (g.b - 1) % 12 + 1, 1, 0, 0, 0, p_time_zone) as tz_at,
                  make_timestamptz(p_year + (g.b - 1) / 12, (g.b - 1) % 12 + 1, 1, 0, 0, 0, 'Europe/Athens') as ath_at
      from generate_series(1, 13) g(b)
    ), parts as (
      select v.assignment_id, extract(month from m.month_start)::integer as b, m.done, m.late
      from vis v
      join private.control_marks_monthly m on m.assignment_id = v.assignment_id
      where v.clean and v.frequent and m.organization_id = p_organization_id
        and m.month_start >= make_date(p_year, 1, 1) and m.month_start < make_date(p_year + 1, 1, 1)
      union all
      -- Καταχωρίσεις ανάμεσα στις δύο αρχές του μήνα b: ανήκουν στον μήνα b της μίας ζώνης και στον b - 1 της άλλης.
      -- Μία ανάγνωση ανά άκρη (ευρετήριο control_execution_marks_store_org_time_idx), όχι μία ανά ανάθεση και άκρη.
      select w.assignment_id, t.b, t.sgn * w.n, t.sgn * w.l
      from (select s.assignment_id, g.b, g.tz_at < g.ath_at as ahead, count(*) as n, count(*) filter (where not s.on_time) as l
            from edges g
            cross join lateral (
              select s.assignment_id, s.on_time from private.control_execution_marks_store s
              where s.organization_id = p_organization_id and s.eligible and s.counted
                and s.performed_at >= least(g.tz_at, g.ath_at) and s.performed_at < greatest(g.tz_at, g.ath_at)) s
            group by s.assignment_id, g.b, g.tz_at < g.ath_at) w
      join vis v on v.assignment_id = w.assignment_id and v.clean and v.frequent
      cross join lateral (values (w.b, case when w.ahead then 1 else -1 end),
                                 (w.b - 1, case when w.ahead then -1 else 1 end)) t(b, sgn)
    ), rest as (
      select v.assignment_id, v.frequent, s.performed_at at time zone p_time_zone as local_at, s.on_time
      from vis v
      join private.control_execution_marks_store s on s.assignment_id = v.assignment_id
      where not (v.clean and v.frequent)
        and s.organization_id = p_organization_id and s.eligible and s.counted
        and s.performed_at >= v.lo and s.performed_at <= v.hi
    )
    select p.assignment_id, p.b - 1, sum(p.done)::bigint, sum(p.late)::bigint, '[]'::jsonb
    from parts p
    where p.b between 1 and 12
    group by p.assignment_id, p.b
    having sum(p.done) > 0
    union all
    select r.assignment_id, extract(month from r.local_at)::integer - 1, count(*), count(*) filter (where not r.on_time),
           case when bool_or(r.frequent) then '[]'::jsonb
                else jsonb_agg(jsonb_build_object('day', extract(day from r.local_at)::integer, 'late', not r.on_time) order by r.local_at)
                       filter (where not r.frequent) end
    from rest r
    group by r.assignment_id, extract(month from r.local_at);
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
