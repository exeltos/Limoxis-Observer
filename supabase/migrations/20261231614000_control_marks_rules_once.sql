-- Ταχύτητα της αρχικής σελίδας («Το τμήμα μου», department_home_period_overview): το μεγαλύτερο μέρος του χρόνου της
-- (ΙΑΣΩ: ~265 από τα ~314 ms ενός μήνα, ~960 από τα ~1080 ms ενός έτους) πήγαινε στους «Ελέγχους εκτός χρόνου», δηλαδή
-- στη private.control_execution_marks, που καλείται δύο φορές (περίοδος και σύγκριση). Εκεί οι βοηθητικές της συχνότητας
-- (control_required, control_slot_deadlines, control_slot_opens) υπολογίζονταν για κάθε ανάθεση (ΙΑΣΩ: 273), ενώ οι
-- διαφορετικές ρυθμίσεις συχνότητας είναι λίγες (ΙΑΣΩ: 24). Τώρα υπολογίζονται μία φορά ανά διαφορετική ρύθμιση (ίδιο
-- κείμενο jsonb) και ενώνονται με τις αναθέσεις. Επίσης η αρίθμηση των καταχωρίσεων ανά ημέρα γίνεται πάνω σε στενές
-- γραμμές πριν από την ένωση με τη συχνότητα, ώστε η ταξινόμηση ενός έτους να μένει στη μνήμη.
-- Ίδια λογική, ίδια υπογραφή, ίδια αποτελέσματα (ελέγχθηκαν όλα τα νοσοκομεία και η department_home_period_overview σε
-- συναλλαγή που ακυρώθηκε). Μήνας με σύγκριση: ~260 → ~95 ms· τρίμηνο ~365 → ~195 ms· έτος ~1080 → ~810 ms.

create or replace function private.control_execution_marks(p_organization_id uuid, p_from timestamp with time zone, p_to timestamp with time zone, p_tz text default 'Europe/Athens'::text)
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
