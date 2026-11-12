-- Αρχική του Διευθυντή Διεύθυνσης: σύνοψη ανά τμήμα της διεύθυνσης (12/11/2026).
--
-- public.division_overview(org, διεύθυνση) επιστρέφει μόνο αριθμούς, ποτέ γραμμές εργαζομένων:
--   προσωπικό των κατηγοριών της διεύθυνσης (σύνολο, σε άδεια, νέοι 30 ημερών), πρόγραμμα βαρδιών της επόμενης
--   περιόδου (21 έως 20, όπως το rosterPeriod της εφαρμογής: δημοσιευμένο / πρόχειρο / λείπει) και νύχτες χωρίς
--   κάλυψη (όπως το checkRoster του rosterEngine.js), αιτήματα σε αναμονή (και πάνω από 3 ημέρες), εκπαίδευση
--   (ολοκληρωμένες αναθέσεις με προθεσμία το τελευταίο 12μηνο, αναθέσεις που λήγουν σε 30 ημέρες), αντιγριπικός
--   εμβολιασμός της τρέχουσας περιόδου (από 1 Σεπτεμβρίου, ποσοστό μόνο), συμμόρφωση υγιεινής χεριών 90 ημερών,
--   πτώσεις και έλκη πίεσης 30 ημερών, ανοιχτά συμβάντα. Ποσοστά 0–100 ή null όταν δεν υπάρχουν δεδομένα ή η
--   ενότητα είναι κλειδωμένη για το νοσοκομείο. Ημερομηνίες σε ώρα Ευρώπης/Αθήνας.
-- Καλούν: ο Διευθυντής Διεύθυνσης (μόνο τις διευθύνσεις του) ή ο Διαχειριστής νοσοκομείου / Ιδιοκτήτης πλατφόρμας
-- (οποιαδήποτε διεύθυνση του νοσοκομείου, για την προεπισκόπηση ρόλου).

-- Νύχτες της περιόδου με λιγότερους στη νύχτα από όσους χρειάζονται (rosterEngine.js: demandFor + checkRoster).
-- null όταν το πρόγραμμα δεν έχει ακόμη καμία βάρδια.
create or replace function private.roster_uncovered_nights(p_demand jsonb, p_members jsonb, p_assignments jsonb, p_start date, p_end date)
returns integer
language sql
immutable
set search_path to ''
as $function$
  with members as (
    select m.value->>'employeeId' as employee_id
      from jsonb_array_elements(case when jsonb_typeof(p_members) = 'array' then p_members else '[]'::jsonb end) m(value)
     where coalesce(m.value->>'active', 'true') <> 'false'
       and m.value->>'employeeId' is not null
  ),
  days as (
    select g::date as day, extract(isodow from g) in (6, 7) as weekend
      from generate_series(p_start, p_end, interval '1 day') g
  ),
  codes as (
    select d.day, m.employee_id,
           case when length(c.code) > 2 and substr(c.code, 2, 1) = ':' then left(c.code, 1) else c.code end as kind
      from days d
     cross join members m
     cross join lateral (select p_assignments -> m.employee_id ->> d.day::text as code) c
  ),
  need as (
    select d.day,
           (case
              when jsonb_typeof(p_demand -> 'overrides' -> d.day::text) = 'object' and (p_demand -> 'overrides' -> d.day::text) ? 'N'
                then case when (p_demand -> 'overrides' -> d.day::text ->> 'N') ~ '^\s*[0-9]+(\.[0-9]+)?\s*$' then (p_demand -> 'overrides' -> d.day::text ->> 'N')::numeric else 0 end
              else case when (p_demand -> case when d.weekend then 'weekend' else 'weekday' end ->> 'N') ~ '^\s*[0-9]+(\.[0-9]+)?\s*$'
                then (p_demand -> case when d.weekend then 'weekend' else 'weekday' end ->> 'N')::numeric else 0 end
            end)
           + coalesce((
               select sum(greatest(0, case when (s.value ->> case when d.weekend then 'weekend' else 'weekday' end) ~ '^\s*[0-9]+(\.[0-9]+)?\s*$'
                 then (s.value ->> case when d.weekend then 'weekend' else 'weekday' end)::numeric else 0 end))
                 from jsonb_array_elements(case when jsonb_typeof(p_demand -> 'custom') = 'array' then p_demand -> 'custom' else '[]'::jsonb end) s(value)
                where s.value ->> 'code' like 'N:%'
             ), 0) as n
      from days d
  )
  select case
    when not exists (select 1 from codes where kind in ('M', 'I', 'A', 'N')) then null
    else (
      select count(*)::integer
        from need
       where need.n > (select count(*) from codes where codes.day = need.day and codes.kind = 'N')
    )
  end;
$function$;
revoke all on function private.roster_uncovered_nights(jsonb, jsonb, jsonb, date, date) from public, anon, authenticated;

create or replace function public.division_overview(p_organization_id uuid, p_division_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_admin boolean;
  v_director boolean;
  v_divisions jsonb;
  v_division_id uuid;
  v_division_name text;
  v_categories text[];
  v_has_categories boolean;
  v_disabled text[];
  v_today date := (now() at time zone 'Europe/Athens')::date;
  v_next_start date;
  v_next_end date;
  v_season date;
  v_rows jsonb;
begin
  if auth.uid() is null then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if p_organization_id is null then
    raise exception 'ORGANIZATION_REQUIRED' using errcode = '22023';
  end if;
  if private.password_change_pending() then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  v_admin := public.current_user_is_platform_owner() or public.is_org_admin(p_organization_id);
  v_director := private.current_user_is_division_director(p_organization_id);
  if not (v_admin or v_director) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  -- Περίοδος βαρδιών: 21 του μήνα έως 20 του επόμενου· η «επόμενη» είναι αυτή μετά την τρέχουσα.
  v_next_start := ((date_trunc('month', v_today - 20) + interval '1 month')::date + 20);
  v_next_end := ((v_next_start + interval '1 month')::date - 1);
  -- Περίοδος αντιγριπικού εμβολιασμού: από 1 Σεπτεμβρίου.
  v_season := make_date(extract(year from v_today)::integer - case when extract(month from v_today) >= 9 then 0 else 1 end, 9, 1);

  select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name) order by d.name, d.id), '[]'::jsonb)
    into v_divisions
    from public.hr_divisions d
   where d.organization_id = p_organization_id
     and (v_admin or d.id in (select private.hr_my_divisions(p_organization_id)));

  if p_division_id is not null then
    if not exists (select 1 from jsonb_array_elements(v_divisions) e where (e ->> 'id')::uuid = p_division_id) then
      raise exception 'PERMISSION_DENIED' using errcode = '42501';
    end if;
    v_division_id := p_division_id;
  else
    v_division_id := (v_divisions -> 0 ->> 'id')::uuid;
  end if;

  if v_division_id is null then
    return jsonb_build_object(
      'divisions', v_divisions, 'division', null, 'nextMonth', to_char(v_next_start, 'YYYY-MM'),
      'nextPeriod', jsonb_build_object('start', v_next_start, 'end', v_next_end),
      'departments', '[]'::jsonb, 'totals', null);
  end if;

  select d.name into v_division_name from public.hr_divisions d where d.id = v_division_id;
  select coalesce(array_agg(distinct c.professional_category order by c.professional_category), '{}'::text[])
    into v_categories
    from public.hr_division_categories c
   where c.division_id = v_division_id and c.organization_id = p_organization_id;
  v_has_categories := cardinality(v_categories) > 0;
  v_disabled := coalesce(private.org_disabled_modules(p_organization_id), '{}'::text[]);

  with dep as (
    select d.id, d.name
      from public.hr_division_departments dd
      join public.departments d on d.id = dd.department_id and d.organization_id = dd.organization_id
     where dd.division_id = v_division_id and dd.organization_id = p_organization_id
  ),
  staff as (
    select e.id, e.department_id, e.employment_status, e.hire_date
      from public.employees e
     where e.organization_id = p_organization_id
       and e.department_id in (select dep.id from dep)
       and e.employment_status in ('active', 'leave')
       and private.employee_professional_category(e.profession_name, e.staff_category) = any (v_categories)
  ),
  per as (
    select dep.id, dep.name,
      (select count(*) from staff s where s.department_id = dep.id) as staff,
      (select count(*) from staff s where s.department_id = dep.id and s.employment_status = 'leave') as on_leave,
      (select count(*) from staff s where s.department_id = dep.id and s.hire_date > v_today - 30 and s.hire_date <= v_today) as new30,
      ro.status as roster_status,
      ro.uncovered,
      rq.pending, rq.pending_old,
      tr.due, tr.done, tr.expiring,
      fl.active_staff, fl.vaccinated,
      hh.obs, hh.ok,
      inc.falls, inc.ulcers, inc.open_count
    from dep
    left join lateral (
      select r.status, private.roster_uncovered_nights(r.demand, r.members, r.assignments, r.period_start, r.period_end) as uncovered
        from public.department_rosters r
       where r.organization_id = p_organization_id and r.department_id = dep.id and r.period_start = v_next_start
       order by (r.status = 'published') desc, r.updated_at desc
       limit 1
    ) ro on true
    left join lateral (
      select count(*) as pending,
             count(*) filter (where q.created_at < now() - interval '3 days') as pending_old
        from public.roster_requests q
       where q.organization_id = p_organization_id and q.department_id = dep.id and q.status = 'pending'
         and exists (select 1 from staff s where s.id = q.employee_id)
    ) rq on true
    left join lateral (
      select count(*) filter (where t.due_date between v_today - 365 and v_today) as due,
             count(*) filter (where t.due_date between v_today - 365 and v_today and (t.status = 'completed' or t.attendance is true)) as done,
             count(*) filter (where t.status in ('assigned', 'in_progress') and t.attendance is not true and t.due_date between v_today and v_today + 30) as expiring
        from public.training_assignments t
       where t.organization_id = p_organization_id and t.department_id = dep.id and t.status <> 'cancelled'
         and exists (select 1 from staff s where s.id = t.employee_id)
    ) tr on true
    left join lateral (
      select count(*) as active_staff,
             count(*) filter (where exists (
               select 1
                 from public.employee_vaccinations v
                 left join public.master_library_items li on li.id = v.vaccine_item_id
                where v.employee_id = s.id and v.organization_id = p_organization_id
                  and v.status in ('complete', 'renew_soon')
                  and v.vaccination_date between v_season and v_today
                  and (li.code = 'VAC-INFLUENZA' or lower(coalesce(v.vaccine_label_snapshot, '')) ~ '(γρίπ|γριπ|influenza|flu)')
             )) as vaccinated
        from staff s
       where s.department_id = dep.id and s.employment_status = 'active'
    ) fl on true
    left join lateral (
      select sum(h.observations) as obs, sum(h.compliant_observations) as ok
        from public.hand_hygiene_sessions h
       where h.organization_id = p_organization_id and h.department_id = dep.id and h.status = 'completed'
         and h.observation_date between v_today - 90 and v_today
    ) hh on true
    left join lateral (
      select count(*) filter (where i.category in ('fall', 'odipy-fall') and (coalesce(i.occurred_at, i.created_at) at time zone 'Europe/Athens')::date > v_today - 30) as falls,
             count(*) filter (where i.category in ('pressureinjury', 'odipy-ulcer') and (coalesce(i.occurred_at, i.created_at) at time zone 'Europe/Athens')::date > v_today - 30) as ulcers,
             count(*) filter (where i.status in ('reported', 'under_review')) as open_count
        from public.quality_incidents i
       where i.organization_id = p_organization_id and i.department_id = dep.id and i.lifecycle_status <> 'voided'
    ) inc on true
  )
  select coalesce(jsonb_agg(to_jsonb(per) order by per.name, per.id), '[]'::jsonb) into v_rows from per;

  return jsonb_build_object(
    'divisions', v_divisions,
    'division', jsonb_build_object('id', v_division_id, 'name', v_division_name, 'categories', to_jsonb(v_categories)),
    'nextMonth', to_char(v_next_start, 'YYYY-MM'),
    'nextPeriod', jsonb_build_object('start', v_next_start, 'end', v_next_end),
    'departments', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', r ->> 'id',
        'name', r ->> 'name',
        'staff', case when v_has_categories then (r ->> 'staff')::integer end,
        'staffOnLeave', case when v_has_categories then (r ->> 'on_leave')::integer end,
        'staffNew30', case when v_has_categories then (r ->> 'new30')::integer end,
        'rosterNextMonth', coalesce(r ->> 'roster_status', 'missing'),
        'uncoveredNights', (r ->> 'uncovered')::integer,
        'pendingRequests', case when v_has_categories then (r ->> 'pending')::integer end,
        'pendingRequestsOver3Days', case when v_has_categories then (r ->> 'pending_old')::integer end,
        'trainingPct', case when 'training' = any (v_disabled) or not v_has_categories or coalesce((r ->> 'due')::integer, 0) = 0 then null
          else round(100.0 * (r ->> 'done')::numeric / (r ->> 'due')::numeric, 1) end,
        'trainingExpiring30', case when 'training' = any (v_disabled) or not v_has_categories then null else (r ->> 'expiring')::integer end,
        'fluPct', case when 'occupational_health' = any (v_disabled) or not v_has_categories or coalesce((r ->> 'active_staff')::integer, 0) = 0 then null
          else round(100.0 * (r ->> 'vaccinated')::numeric / (r ->> 'active_staff')::numeric, 1) end,
        'handHygienePct', case when 'prevention' = any (v_disabled) or coalesce((r ->> 'obs')::numeric, 0) = 0 then null
          else round(100.0 * (r ->> 'ok')::numeric / (r ->> 'obs')::numeric, 1) end,
        'falls30', case when 'quality' = any (v_disabled) then null else (r ->> 'falls')::integer end,
        'pressureUlcers30', case when 'quality' = any (v_disabled) then null else (r ->> 'ulcers')::integer end,
        'incidentsOpen', case when 'quality' = any (v_disabled) then null else (r ->> 'open_count')::integer end
      ) order by ord), '[]'::jsonb)
      from jsonb_array_elements(v_rows) with ordinality as x(r, ord)
    ),
    'totals', (
      select jsonb_build_object(
        'departments', count(*),
        'staff', case when v_has_categories then coalesce(sum((r ->> 'staff')::integer), 0) end,
        'staffOnLeave', case when v_has_categories then coalesce(sum((r ->> 'on_leave')::integer), 0) end,
        'staffNew30', case when v_has_categories then coalesce(sum((r ->> 'new30')::integer), 0) end,
        'rosterPublished', count(*) filter (where r ->> 'roster_status' = 'published'),
        'rosterDraft', count(*) filter (where r ->> 'roster_status' = 'draft'),
        'rosterMissing', count(*) filter (where r ->> 'roster_status' is null),
        'uncoveredNights', sum((r ->> 'uncovered')::integer),
        'pendingRequests', case when v_has_categories then coalesce(sum((r ->> 'pending')::integer), 0) end,
        'pendingRequestsOver3Days', case when v_has_categories then coalesce(sum((r ->> 'pending_old')::integer), 0) end,
        'trainingPct', case when 'training' = any (v_disabled) or not v_has_categories or coalesce(sum((r ->> 'due')::integer), 0) = 0 then null
          else round(100.0 * sum((r ->> 'done')::numeric) / sum((r ->> 'due')::numeric), 1) end,
        'trainingExpiring30', case when 'training' = any (v_disabled) or not v_has_categories then null else coalesce(sum((r ->> 'expiring')::integer), 0) end,
        'fluPct', case when 'occupational_health' = any (v_disabled) or not v_has_categories or coalesce(sum((r ->> 'active_staff')::integer), 0) = 0 then null
          else round(100.0 * sum((r ->> 'vaccinated')::numeric) / sum((r ->> 'active_staff')::numeric), 1) end,
        'handHygienePct', case when 'prevention' = any (v_disabled) or coalesce(sum((r ->> 'obs')::numeric), 0) = 0 then null
          else round(100.0 * sum((r ->> 'ok')::numeric) / sum((r ->> 'obs')::numeric), 1) end,
        'falls30', case when 'quality' = any (v_disabled) then null else coalesce(sum((r ->> 'falls')::integer), 0) end,
        'pressureUlcers30', case when 'quality' = any (v_disabled) then null else coalesce(sum((r ->> 'ulcers')::integer), 0) end,
        'incidentsOpen', case when 'quality' = any (v_disabled) then null else coalesce(sum((r ->> 'open_count')::integer), 0) end
      )
      from jsonb_array_elements(v_rows) as x(r)
    )
  );
end
$function$;
revoke all on function public.division_overview(uuid, uuid) from public, anon;
grant execute on function public.division_overview(uuid, uuid) to authenticated;
