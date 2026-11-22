-- Έλεγχοι: αποθηκευμένα «μετρά / εμπρόθεσμα» ανά καταχώριση, αντί για υπολογισμό ~53.000 καταχωρίσεων σε κάθε κλήση.
-- Η private.control_execution_marks (ημερολόγιο έτους, «Έλεγχοι εκτός χρόνου», αρχική «Το τμήμα μου») διαβάζει πλέον τον
-- πίνακα private.control_execution_marks_store· ίδια υπογραφή, ίδιο αποτέλεσμα, ίδιοι έλεγχοι πρόσβασης.
-- 1. Μία γραμμή ανά καταχώριση (FK με on delete cascade): ημέρα Αθήνας, σειρά μέσα στην ημέρα (rk), μετρά, εμπρόθεσμη.
--    Ακυρωμένες και έκτακτες μένουν με eligible = false και δεν διαβάζονται.
-- 2. Ίδιοι κανόνες με τον ζωντανό υπολογισμό (κατάταξη ανά ανάθεση και ημέρα Αθήνας κατά (performed_at, id), μόνο
--    μη ακυρωμένες και μη έκτακτες· οι μη ημερήσιοι κρίνονται από την προηγούμενη καταχώριση με control_next_due).
--    Τα όρια του διαστήματος (p_from, p_to, now(), δημιουργία του ελέγχου) εφαρμόζονται κατά την ανάγνωση: η σειρά μιας
--    καταχώρισης δεν αλλάζει από όσες ακολουθούν, άρα οι μελλοντικές καταχωρίσεις και οι άκρες δίνουν το ίδιο.
-- 3. Ενημέρωση με triggers (SECURITY DEFINER, search_path ''), μόνο για ό,τι επηρεάζεται: η ημέρα της καταχώρισης (παλιά
--    και νέα) και η επόμενη καταχώριση της ανάθεσης (η εμπρόθεσμη των μη ημερήσιων κοιτά την προηγούμενη). Αλλαγή
--    συχνότητας σε ανάθεση ή ορισμό ξαναϋπολογίζει όλες τις καταχωρίσεις των αναθέσεων που επηρεάζονται.
-- 4. Πρόσβαση: η ανάγνωση περνά από public.control_assignments, control_definitions και control_executions, με τη RLS
--    τους όπως πριν. Η RLS της control_executions κρίνει μόνο οργανισμό και τμήμα, που το FK
--    control_executions_assignment_tenant_fk κρατά ίδια με της ανάθεσης: όλες οι καταχωρίσεις μιας ανάθεσης φαίνονται ή
--    κρύβονται μαζί. Γι' αυτό αρκεί ο έλεγχος μίας καταχώρισης ανά ανάθεση (όχι 53.000 αναζητήσεις), και η αποθηκευμένη
--    σειρά είναι ίδια με αυτήν που θα έβγαζε ο ζωντανός υπολογισμός για κάθε χρήστη.
-- 5. Ζώνη ώρας άλλη από Europe/Athens, ή οργανισμός με ready = false στο private.control_marks_orgs: ο ζωντανός
--    υπολογισμός (private.control_execution_marks_live, το προηγούμενο σώμα αυτούσιο).
-- 6. private.control_execution_marks_verify: πλήθος διαφορών αποθηκευμένου και ζωντανού αποτελέσματος (0 = ίδια).
-- ΙΑΣΩ ως hospital_admin: control_execution_marks έτους ~270 → ~56 ms· control_calendar_months 2026 ~400 → ~170 ms·
-- department_home_period_overview έτους ~680 → ~260 ms, μήνα ~100 → ~34 ms. Καταχώριση: +3-5 ms (trigger).
-- Ισότητα ελέγχθηκε σε συναλλαγές που ακυρώθηκαν: 3 νοσοκομεία, 10 διαστήματα, 5 χρήστες, triggers (εισαγωγή,
-- μετακίνηση, ακύρωση, έκτακτη, διαγραφή, αλλαγή συχνότητας): 0 διαφορές.

create table if not exists private.control_execution_marks_store (
  execution_id uuid primary key references public.control_executions(id) on delete cascade,
  organization_id uuid not null,
  assignment_id uuid not null,
  performed_at timestamptz not null,
  local_day date not null,
  eligible boolean not null,
  rk integer,
  counted boolean,
  on_time boolean,
  computed_at timestamptz not null default now()
);

-- Η ανάγνωση πάει ανά ανάθεση με εύρος χρόνου (και ο έλεγχος πρόσβασης ανά ανάθεση παίρνει από εδώ μία καταχώριση).
create index if not exists control_execution_marks_store_read_idx on private.control_execution_marks_store
  (assignment_id, performed_at) include (organization_id, counted, on_time, execution_id) where eligible;
create index if not exists control_execution_marks_store_org_idx on private.control_execution_marks_store (organization_id, local_day);

-- Οργανισμοί υπό ανακατασκευή (ready = false): διαβάζουν τον ζωντανό υπολογισμό. Χωρίς γραμμή = έτοιμος (τα triggers
-- κρατούν τον πίνακα πλήρη από την πρώτη καταχώριση).
create table if not exists private.control_marks_orgs (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  ready boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table private.control_execution_marks_store enable row level security;
alter table private.control_marks_orgs enable row level security;

create policy control_execution_marks_store_read on private.control_execution_marks_store for select to authenticated
  using (( select public.current_user_is_platform_owner()) or coalesce(organization_id = any (( select private.fast_orgs_capability('view_controls'::text))::uuid[]), false));
create policy control_marks_orgs_read on private.control_marks_orgs for select to authenticated
  using (( select public.current_user_is_platform_owner()) or coalesce(organization_id = any (( select private.fast_orgs_capability('view_controls'::text))::uuid[]), false));

-- Μόνο ανάγνωση, για την control_execution_marks (SECURITY INVOKER). Το σχήμα private δεν εκτίθεται στο API.
grant select on private.control_execution_marks_store to authenticated;
grant select on private.control_marks_orgs to authenticated;

-- Υπολογισμός και upsert. p_organization_id ή/και p_assignment_ids (null = όλα), προαιρετικά μόνο οι ημέρες Αθήνας
-- p_from_day..p_to_day. Ολόκληρες ημέρες, άρα η σειρά (rk) βγαίνει σωστή· η προηγούμενη καταχώριση έρχεται από το
-- ίδιο σύνολο ή, για την πρώτη του διαστήματος, από τον πίνακα.
create or replace function private.control_marks_compute(p_organization_id uuid, p_assignment_ids uuid[] default null, p_from_day date default null, p_to_day date default null)
 returns integer
 language plpgsql
 volatile
 set search_path to ''
 set plan_cache_mode to 'force_custom_plan'
as $function$
declare
  v_rows integer;
begin
  insert into private.control_execution_marks_store as s
    (execution_id, organization_id, assignment_id, performed_at, local_day, eligible, rk, counted, on_time, computed_at)
  with ex as materialized (
    select e.id, e.organization_id, e.assignment_id, e.performed_at,
           (e.performed_at at time zone 'Europe/Athens')::date as local_day,
           (e.status <> 'cancelled' and e.cancelled_at is null and not e.is_extra) as eligible
    from public.control_executions e
    where (p_organization_id is null or e.organization_id = p_organization_id)
      and (p_assignment_ids is null or e.assignment_id = any (p_assignment_ids))
      and (p_from_day is null or e.performed_at >= (p_from_day::timestamp at time zone 'Europe/Athens'))
      and (p_to_day is null or e.performed_at < ((p_to_day + 1)::timestamp at time zone 'Europe/Athens'))
  ), cfgs as materialized (
    select a.id as assignment_id, coalesce(a.frequency_config, d.frequency_config) as cfg
    from public.control_assignments a
    join public.control_definitions d on d.id = a.control_id and d.organization_id = a.organization_id
    where a.id in (select x.assignment_id from ex x)
  ), rules as materialized (
    select u.k, private.control_required(u.cfg) as required, private.control_slot_deadlines(u.cfg) as deadlines,
           private.control_slot_opens(u.cfg) as opens
    from (select distinct on (coalesce(c.cfg::text, '')) coalesce(c.cfg::text, '') as k, c.cfg from cfgs c) u
  ), defs as materialized (
    select c.assignment_id, c.cfg as f, c.cfg ->> 'kind' = 'daily' as daily, u.required, u.deadlines, u.opens
    from cfgs c join rules u on u.k = coalesce(c.cfg::text, '')
  ), ranked as (
    select x.id, x.organization_id, x.assignment_id, x.performed_at, x.local_day, x.eligible,
           row_number() over (partition by x.assignment_id, x.local_day, x.eligible order by x.performed_at, x.id) as rk,
           lag(x.performed_at) over (partition by x.assignment_id, x.eligible order by x.performed_at, x.id) as prev
    from ex x
  )
  select r.id, r.organization_id, r.assignment_id, r.performed_at, r.local_day, r.eligible,
         case when r.eligible then r.rk end,
         case when r.eligible then (not x.daily or r.rk <= x.required) end,
         case when r.eligible then
           case when x.daily then r.rk <= x.required
                  and r.performed_at >= (r.local_day::timestamp + make_interval(mins => coalesce(x.opens[r.rk], 0))) at time zone 'Europe/Athens'
                  and r.performed_at <=
                  case when x.deadlines[r.rk] >= 1440 then ((r.local_day + 1)::timestamp at time zone 'Europe/Athens') - interval '1 second'
                       else (r.local_day::timestamp + make_interval(mins => x.deadlines[r.rk])) at time zone 'Europe/Athens' end
                else coalesce(r.performed_at <= private.control_next_due(x.f,
                       case when r.prev < r.performed_at then r.prev
                            when r.prev is null and p_from_day is null then null
                            else (select max(p.performed_at) from public.control_executions p
                                  where p.assignment_id = r.assignment_id and p.performed_at < r.performed_at
                                    and p.status <> 'cancelled' and p.cancelled_at is null and not p.is_extra) end, 1, 'Europe/Athens'), true) end
         end,
         now()
  from ranked r
  left join defs x on x.assignment_id = r.assignment_id
  on conflict (execution_id) do update
    set organization_id = excluded.organization_id, assignment_id = excluded.assignment_id, performed_at = excluded.performed_at,
        local_day = excluded.local_day, eligible = excluded.eligible, rk = excluded.rk, counted = excluded.counted,
        on_time = excluded.on_time, computed_at = excluded.computed_at
    where (s.organization_id, s.assignment_id, s.performed_at, s.local_day, s.eligible, s.rk, s.counted, s.on_time)
          is distinct from (excluded.organization_id, excluded.assignment_id, excluded.performed_at, excluded.local_day,
                            excluded.eligible, excluded.rk, excluded.counted, excluded.on_time);
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$function$;

-- Ο ζωντανός υπολογισμός, αυτούσιος από το 20261231614000_control_marks_rules_once.sql: για άλλες ζώνες ώρας, για
-- οργανισμούς υπό ανακατασκευή και για τον έλεγχο ισότητας.
create or replace function private.control_execution_marks_live(p_organization_id uuid, p_from timestamp with time zone, p_to timestamp with time zone, p_tz text default 'Europe/Athens'::text)
 returns table(assignment_id uuid, performed_at timestamp with time zone, counted boolean, on_time boolean)
 language plpgsql
 stable
 set search_path to ''
 set plan_cache_mode to 'force_custom_plan'
as $function$
#variable_conflict use_column
begin
  return query
  with cfgs as materialized (
    select a.id as assignment_id, d.created_at, s.cfg
    from public.control_assignments a
    join public.control_definitions d on d.id = a.control_id and d.organization_id = a.organization_id
    cross join lateral (select coalesce(a.frequency_config, d.frequency_config) as cfg) s
    where a.organization_id = p_organization_id
  ), rules as materialized (
    -- The frequency helpers once per distinct frequency (by its text), not once per assignment.
    select u.k, private.control_required(u.cfg) as required, private.control_slot_deadlines(u.cfg) as deadlines,
           private.control_slot_opens(u.cfg) as opens
    from (select distinct on (coalesce(c.cfg::text, '')) coalesce(c.cfg::text, '') as k, c.cfg from cfgs c) u
  ), defs as materialized (
    select c.assignment_id, c.created_at, c.cfg as f, c.cfg ->> 'kind' = 'daily' as daily, u.required, u.deadlines, u.opens
    from cfgs c join rules u on u.k = coalesce(c.cfg::text, '')
  ), ranked as (
    -- The entries are ranked on their own (narrow rows, sorted in memory), then joined to their frequency.
    select x.assignment_id, k.performed_at, x.f, x.daily, x.required, x.deadlines, x.opens, x.created_at, k.local_day, k.rk
    from (select e.assignment_id, e.performed_at, (e.performed_at at time zone p_tz)::date as local_day,
                 row_number() over (partition by e.assignment_id, (e.performed_at at time zone p_tz)::date order by e.performed_at, e.id) as rk
          from public.control_executions e
          where e.organization_id = p_organization_id
            and e.status <> 'cancelled' and e.cancelled_at is null and not e.is_extra
            and e.performed_at >= (date_trunc('day', p_from at time zone p_tz) at time zone p_tz)
            and e.performed_at <= least(p_to, now())) k
    join defs x on x.assignment_id = k.assignment_id
  )
  select r.assignment_id, r.performed_at,
         (not r.daily or r.rk <= r.required),
         case when r.daily then r.rk <= r.required
                and r.performed_at >= (r.local_day::timestamp + make_interval(mins => coalesce(r.opens[r.rk], 0))) at time zone p_tz
                and r.performed_at <=
                case when r.deadlines[r.rk] >= 1440 then ((r.local_day + 1)::timestamp at time zone p_tz) - interval '1 second'
                     else (r.local_day::timestamp + make_interval(mins => r.deadlines[r.rk])) at time zone p_tz end
              else coalesce(r.performed_at <= private.control_next_due(r.f,
                     (select max(p.performed_at) from public.control_executions p
                      where p.assignment_id = r.assignment_id and p.performed_at < r.performed_at
                        and p.status <> 'cancelled' and p.cancelled_at is null and not p.is_extra), 1, p_tz), true) end
  from ranked r
  where r.performed_at >= greatest(p_from, r.created_at);
end;
$function$;

-- Ανάγνωση από τον πίνακα (Europe/Athens), αλλιώς ο ζωντανός υπολογισμός. Τα όρια του διαστήματος εδώ, όπως πριν.
create or replace function private.control_execution_marks(p_organization_id uuid, p_from timestamp with time zone, p_to timestamp with time zone, p_tz text default 'Europe/Athens'::text)
 returns table(assignment_id uuid, performed_at timestamp with time zone, counted boolean, on_time boolean)
 language plpgsql
 stable
 set search_path to ''
 set plan_cache_mode to 'force_custom_plan'
as $function$
#variable_conflict use_column
begin
  if p_tz is distinct from 'Europe/Athens'
     or exists (select 1 from private.control_marks_orgs o where o.organization_id = p_organization_id and not o.ready) then
    return query select * from private.control_execution_marks_live(p_organization_id, p_from, p_to, p_tz);
    return;
  end if;
  return query
  with vis as materialized (
    -- Αναθέσεις που βλέπει ο χρήστης, και η RLS της public.control_executions: μία καταχώριση ανά ανάθεση αρκεί, γιατί
    -- η πολιτική κρίνει μόνο οργανισμό και τμήμα, που το FK control_executions_assignment_tenant_fk κρατά ίδια με
    -- της ανάθεσης (όλες οι καταχωρίσεις μιας ανάθεσης φαίνονται ή κρύβονται μαζί).
    select a.id as assignment_id, d.created_at
    from public.control_assignments a
    join public.control_definitions d on d.id = a.control_id and d.organization_id = a.organization_id
    where a.organization_id = p_organization_id
      and (select true from public.control_executions e
           where e.id = (select s1.execution_id from private.control_execution_marks_store s1
                         where s1.assignment_id = a.id and s1.eligible limit 1))
  )
  select s.assignment_id, s.performed_at, s.counted, s.on_time
  from vis v
  join private.control_execution_marks_store s on s.assignment_id = v.assignment_id
  where s.organization_id = p_organization_id and s.eligible
    and s.performed_at >= greatest(p_from, v.created_at)
    and s.performed_at <= least(p_to, now());
end;
$function$;

-- Πλήθος διαφορών (και προς τις δύο κατευθύνσεις) ανάμεσα σε ό,τι δίνει η control_execution_marks και στον ζωντανό υπολογισμό.
create or replace function private.control_execution_marks_verify(p_organization_id uuid, p_from timestamp with time zone, p_to timestamp with time zone)
 returns bigint
 language sql
 stable
 set search_path to ''
as $function$
  select count(*) from (
    (select * from private.control_execution_marks(p_organization_id, p_from, p_to)
     except all
     select * from private.control_execution_marks_live(p_organization_id, p_from, p_to))
    union all
    (select * from private.control_execution_marks_live(p_organization_id, p_from, p_to)
     except all
     select * from private.control_execution_marks(p_organization_id, p_from, p_to))
  ) x;
$function$;

-- Trigger καταχωρίσεων: η ημέρα Αθήνας της καταχώρισης (παλιά και νέα) και η ημέρα της επόμενης καταχώρισης της ανάθεσης.
-- Όταν σβήνεται ολόκληρος ο οργανισμός, οι γραμμές φεύγουν με το cascade και δεν ξαναϋπολογίζεται τίποτα.
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
  i integer;
begin
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
    perform private.control_marks_compute(null, v_ids);
  end if;
  return null;
end;
$function$;

-- Αρχική συμπλήρωση όλων των οργανισμών (~20 s για ΙΑΣΩ), πριν από τα triggers ώστε το κλείδωμα της
-- public.control_executions που παίρνει το create trigger να κρατά λίγο.
select private.control_marks_compute(o.id) from public.organizations o;

create trigger control_executions_marks_sync_insert after insert on public.control_executions
  for each row execute function private.control_execution_marks_sync();
create trigger control_executions_marks_sync_update after update of performed_at, status, cancelled_at, is_extra, assignment_id, organization_id on public.control_executions
  for each row when (old.performed_at is distinct from new.performed_at or old.status is distinct from new.status
                     or old.cancelled_at is distinct from new.cancelled_at or old.is_extra is distinct from new.is_extra
                     or old.assignment_id is distinct from new.assignment_id or old.organization_id is distinct from new.organization_id)
  execute function private.control_execution_marks_sync();
create trigger control_executions_marks_sync_delete after delete on public.control_executions
  for each row execute function private.control_execution_marks_sync();
create trigger control_assignments_marks_sync after update of frequency_config, control_id on public.control_assignments
  for each row when (old.frequency_config is distinct from new.frequency_config or old.control_id is distinct from new.control_id)
  execute function private.control_assignment_marks_sync();
create trigger control_definitions_marks_sync after update of frequency_config on public.control_definitions
  for each row when (old.frequency_config is distinct from new.frequency_config)
  execute function private.control_definition_marks_sync();

-- Δεύτερο πέρασμα μετά τα triggers (γράφει μόνο ό,τι άλλαξε στο μεταξύ, ~3 s): καμία καταχώριση δεν χάνεται.
select private.control_marks_compute(o.id) from public.organizations o;
insert into private.control_marks_orgs as m (organization_id, ready, updated_at)
select o.id, true, now() from public.organizations o
on conflict (organization_id) do update set ready = true, updated_at = excluded.updated_at;
analyze private.control_execution_marks_store;
