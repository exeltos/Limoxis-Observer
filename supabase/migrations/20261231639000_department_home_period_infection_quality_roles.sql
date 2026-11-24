-- Αρχική του νοσοκομείου, 2ο μέρος (ιδιοκτήτης 24/11/2026): η ίδια Αρχική για τους ρόλους λοιμώξεων και ποιότητας.
-- department_home_period_overview: (1) καλεί και ο Υπεύθυνος Ποιότητας· (2) ρόλοι λοιμώξεων ή ποιότητας χωρίς εύρος
-- τμημάτων διαβάζουν όλο το νοσοκομείο (πριν: PERMISSION_DENIED)· (3) όποιος δεν διαβάζει κλινικά στοιχεία (ο Υπεύθυνος
-- Ποιότητας) παίρνει null στο εργαστήριο και την επιτήρηση, όπως σε κλειδωμένη ενότητα. Ίδια υπογραφή και δικαιώματα.

create or replace function public.department_home_period_overview(p_organization_id uuid, p_department_ids uuid[] default null, p_from date default null, p_to date default null, p_compare_from date default null, p_compare_to date default null, p_bucket text default 'week')
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_admin boolean;
  v_departments uuid[];
  v_department uuid;
  v_disabled text[];
  v_today date := (now() at time zone 'Europe/Athens')::date;
  v_day_end timestamptz;
  v_from date;
  v_to date;
  v_cfrom date;
  v_cto date;
  v_months integer;
  v_bucket text := case when p_bucket = 'month' then 'month' else 'week' end;
  v_hh_months integer;
  v_hh_from date;
  v_chh_from date;
  v_first date;
  v_last date;
  v_season date;
  v_target numeric;
  v_late jsonb;
  v_result jsonb;
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
  -- The figures come from the department's patients' records: only the roles that read them
  -- (patients_clinical_read), never any member with a department scope.
  if not (v_admin or public.current_user_has_org_role(p_organization_id,
       array['department_manager', 'infection_control_lead', 'infection_control_member', 'doctor_reviewer', 'quality_manager']::public.app_role[])) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  if coalesce(cardinality(p_department_ids), 0) > 0 then
    foreach v_department in array p_department_ids loop
      if not (v_admin or public.current_user_has_department_scope(p_organization_id, v_department)) then
        raise exception 'PERMISSION_DENIED' using errcode = '42501';
      end if;
    end loop;
    select coalesce(array_agg(d.id), '{}'::uuid[]) into v_departments
      from public.departments d
     where d.organization_id = p_organization_id and d.id = any (p_department_ids);
  elsif v_admin then
    select coalesce(array_agg(d.id), '{}'::uuid[]) into v_departments
      from public.departments d
     where d.organization_id = p_organization_id;
  else
    select coalesce(array_agg(distinct oms.department_id), '{}'::uuid[]) into v_departments
      from public.organization_members om
      join public.organization_member_scopes oms on oms.membership_id = om.id
     where om.user_id = auth.uid() and om.organization_id = p_organization_id and om.status = 'active'
       and oms.department_id is not null;
    -- Λοιμώξεις και ποιότητα χωρίς εύρος τμημάτων: όλο το νοσοκομείο (η Αρχική του νοσοκομείου, 24/11/2026).
    if cardinality(v_departments) = 0 and public.current_user_has_org_role(p_organization_id, array['infection_control_lead', 'infection_control_member', 'quality_manager']::public.app_role[]) then
      select coalesce(array_agg(d.id), '{}'::uuid[]) into v_departments from public.departments d where d.organization_id = p_organization_id;
    end if;
    if cardinality(v_departments) = 0 then
      raise exception 'PERMISSION_DENIED' using errcode = '42501';
    end if;
  end if;

  -- The period: by default the current month; the comparison: by default the period of the same length just before.
  v_from := coalesce(p_from, date_trunc('month', v_today::timestamp)::date);
  v_to := coalesce(p_to, case when p_from is null then (date_trunc('month', v_today::timestamp) + interval '1 month' - interval '1 day')::date
                              else (date_trunc('month', p_from::timestamp) + interval '1 month' - interval '1 day')::date end);
  if v_to < v_from or v_to - v_from > 366 then
    raise exception 'INVALID_PERIOD' using errcode = '22023';
  end if;
  v_months := (extract(year from v_to)::integer * 12 + extract(month from v_to)::integer) - (extract(year from v_from)::integer * 12 + extract(month from v_from)::integer) + 1;
  if p_compare_from is not null and p_compare_to is not null then
    v_cfrom := p_compare_from;
    v_cto := p_compare_to;
  elsif v_from = date_trunc('month', v_from::timestamp)::date and v_to = (date_trunc('month', v_to::timestamp) + interval '1 month' - interval '1 day')::date then
    v_cfrom := (v_from - make_interval(months => v_months))::date;
    v_cto := v_from - 1;
  else
    v_cfrom := v_from - (v_to - v_from + 1);
    v_cto := v_from - 1;
  end if;
  if v_cto < v_cfrom or v_cto - v_cfrom > 366 then
    raise exception 'INVALID_PERIOD' using errcode = '22023';
  end if;
  -- Hand hygiene per month: the months of the period, at least the last 6 up to its end; the comparison as many up to its end.
  v_hh_months := greatest(6, v_months);
  v_hh_from := (date_trunc('month', v_to::timestamp) - make_interval(months => v_hh_months - 1))::date;
  v_chh_from := (date_trunc('month', v_cto::timestamp) - make_interval(months => v_hh_months - 1))::date;
  v_first := least(v_from, v_cfrom);
  v_last := greatest(v_to, v_cto);

  v_disabled := coalesce(private.org_disabled_modules(p_organization_id), '{}'::text[]);
  -- Εργαστήριο και επιτήρηση μόνο για όσους διαβάζουν κλινικά στοιχεία (όχι ο Υπεύθυνος Ποιότητας).
  if not (v_admin or public.current_user_has_org_role(p_organization_id, array['department_manager', 'infection_control_lead', 'infection_control_member', 'doctor_reviewer']::public.app_role[])) then
    v_disabled := v_disabled || array['laboratory', 'surveillance'];
  end if;
  v_day_end := ((v_today + 1)::timestamp at time zone 'Europe/Athens');
  -- Περίοδος αντιγριπικού εμβολιασμού: από 1 Σεπτεμβρίου.
  v_season := make_date(extract(year from v_today)::integer - case when extract(month from v_today) >= 9 then 0 else 1 end, 9, 1);

  -- Στόχος υγιεινής χεριών: ο στόχος του έτους του νοσοκομείου (του τμήματος πρώτα), αλλιώς ο ορισμός του δείκτη, αλλιώς 80%.
  select o.target into v_target
    from public.quality_objectives o
   where o.organization_id = p_organization_id and o.platform_indicator_key = 'hh-compliance'
     and o.year = extract(year from v_today)::integer and o.status = 'active' and o.target is not null
     and (o.department_id is null or o.department_id = any (v_departments))
   -- Για όλο το νοσοκομείο (χωρίς τμήματα: η Αρχική του Διαχειριστή) ο στόχος του νοσοκομείου πρώτα, όχι ενός τμήματος.
   order by case when coalesce(cardinality(p_department_ids), 0) = 0 then (o.department_id is not null) else (o.department_id is null) end, o.updated_at desc
   limit 1;
  if v_target is null then
    select i.target_value into v_target
      from public.indicator_definitions i
     where i.indicator_key = 'hh-compliance' and i.status = 'active' and i.target_value is not null
       and (i.organization_id = p_organization_id or i.organization_id is null)
     order by (i.organization_id is null), i.effective_from desc nulls last
     limit 1;
  end if;
  v_target := coalesce(v_target, 80);

  -- «Έλεγχοι εκτός χρόνου» of each period: executions done outside their window, and assignments that fell overdue in it
  -- and are still not done.
  if 'controls' = any (v_disabled) then
    v_late := jsonb_build_object('current', null, 'compare', null);
  else
    select jsonb_build_object(
      'current',
        coalesce((select sum(c.performed - c.on_time)
                    from public.control_adherence_counts(p_organization_id, (v_from::timestamp at time zone 'Europe/Athens'), ((v_to + 1)::timestamp at time zone 'Europe/Athens') - interval '1 microsecond') c
                    join public.control_assignments a on a.id = c.assignment_id
                   where a.organization_id = p_organization_id and a.department_id = any (v_departments)), 0)
        + (select count(*) from public.control_assignments a
            where a.organization_id = p_organization_id and a.department_id = any (v_departments) and a.status not in ('completed', 'cancelled')
              and a.next_due_at >= (v_from::timestamp at time zone 'Europe/Athens')
              and a.next_due_at < least(((v_to + 1)::timestamp at time zone 'Europe/Athens'), now())),
      'compare',
        coalesce((select sum(c.performed - c.on_time)
                    from public.control_adherence_counts(p_organization_id, (v_cfrom::timestamp at time zone 'Europe/Athens'), ((v_cto + 1)::timestamp at time zone 'Europe/Athens') - interval '1 microsecond') c
                    join public.control_assignments a on a.id = c.assignment_id
                   where a.organization_id = p_organization_id and a.department_id = any (v_departments)), 0)
        + (select count(*) from public.control_assignments a
            where a.organization_id = p_organization_id and a.department_id = any (v_departments) and a.status not in ('completed', 'cancelled')
              and a.next_due_at >= (v_cfrom::timestamp at time zone 'Europe/Athens')
              and a.next_due_at < least(((v_cto + 1)::timestamp at time zone 'Europe/Athens'), now()))
    ) into v_late;
  end if;

  with pos as (
    select s.id, s.patient_id,
           (s.collected_at at time zone 'Europe/Athens')::date as day,
           s.surveillance_case_id is null and s.surveillance_review_status is null and s.sample_code !~ '-R[0-9]+$' as awaiting,
           res.organism,
           rz.resistance
      from public.laboratory_samples s
      cross join lateral (
        select r.organism
          from public.microbiology_results r
         where r.organization_id = p_organization_id and r.sample_id = s.id and r.result_status = 'positive'
         order by r.resulted_at desc nulls last
         limit 1
      ) res
      -- The sample's resistance across all its positive results, from the result itself or its AMR classification.
      cross join lateral (
        select (array_agg(z.c order by case z.c when 'PDR' then 3 when 'XDR' then 2 else 1 end desc))[1] as resistance
          from (
            select upper(r.resistance_class) as c
              from public.microbiology_results r
             where r.organization_id = p_organization_id and r.sample_id = s.id and r.result_status = 'positive'
               and upper(coalesce(r.resistance_class, '')) in ('MDR', 'XDR', 'PDR')
            union all
            select upper(a.classification)
              from public.amr_classifications a
              join public.microbiology_results r on r.id = a.microbiology_result_id
             where a.organization_id = p_organization_id and r.sample_id = s.id and r.result_status = 'positive'
               and a.status <> 'rejected' and upper(coalesce(a.classification, '')) in ('MDR', 'XDR', 'PDR')
          ) z
      ) rz
     where s.organization_id = p_organization_id
       and s.department_id = any (v_departments)
       and s.patient_id is not null
       and coalesce(s.subject_type, 'patient') = 'patient'
       and s.status not in ('rejected', 'cancelled')
       and s.collected_at >= (v_first::timestamp at time zone 'Europe/Athens')
       and s.collected_at < least(((v_last + 1)::timestamp at time zone 'Europe/Athens'), v_day_end)
       -- A positive result that is the laboratory's contamination note is not a positive of the department
       -- (the pattern of private.mdr_excluded_organism, 20261231223000, without its Candida part).
       and coalesce(res.organism, '') !~* '(επιμόλυνση|επιμολυνση|contaminat|3\s+είδ|3\s+ειδ)'
  ),
  hh as (
    select h.observation_date, h.observations, h.compliant_observations
      from public.hand_hygiene_sessions h
     where h.organization_id = p_organization_id and h.department_id = any (v_departments) and h.status = 'completed'
       and h.observation_date between least(v_hh_from, v_chh_from, v_first) and least(v_last, v_today)
  ),
  staff as (
    select e.id
      from public.employees e
     where e.organization_id = p_organization_id and e.department_id = any (v_departments) and e.employment_status = 'active'
  ),
  flu as (
    select count(*) as active_staff,
           count(*) filter (where exists (
             select 1
               from public.employee_vaccinations v
               left join public.master_library_items li on li.id = v.vaccine_item_id
              where v.employee_id = s.id and v.organization_id = p_organization_id
                and v.status in ('complete', 'renew_soon')
                and v.vaccination_date between v_season and v_today
                and (li.code = 'VAC-INFLUENZA' or lower(coalesce(v.vaccine_label_snapshot, '')) ~ '(γρίπ|γριπ|influenza|flu)')
           )) as vaccinated,
           count(*) filter (where exists (
             select 1
               from public.employee_vaccinations v
               left join public.master_library_items li on li.id = v.vaccine_item_id
              where v.employee_id = s.id and v.organization_id = p_organization_id
                and coalesce(v.vaccination_date, v.created_at::date) between v_season and v_today
                and (li.code = 'VAC-INFLUENZA' or lower(coalesce(v.vaccine_label_snapshot, '')) ~ '(γρίπ|γριπ|influenza|flu)')
           )) as flu_recorded
      from staff s
  ),
  tr as (
    select count(*) filter (where t.due_date between v_today - 365 and v_today) as due,
           count(*) filter (where t.due_date between v_today - 365 and v_today and (t.status = 'completed' or t.attendance is true)) as done,
           count(*) filter (where t.status in ('assigned', 'in_progress') and t.attendance is not true and t.due_date between v_today and v_today + 30) as expiring
      from public.training_assignments t
     where t.organization_id = p_organization_id and t.department_id = any (v_departments) and t.status <> 'cancelled'
  ),
  inc as (
    select count(*) filter (where i.category in ('fall', 'odipy-fall')) as falls,
           count(*) filter (where i.category in ('pressureinjury', 'odipy-ulcer')) as ulcers
      from public.quality_incidents i
     where i.organization_id = p_organization_id and i.department_id = any (v_departments) and i.lifecycle_status <> 'voided'
       and (coalesce(i.occurred_at, i.created_at) at time zone 'Europe/Athens')::date > v_today - 30
  ),
  -- The organisms of the period's positive samples (the chosen result's organism, trimmed), the most frequent first, and
  -- how many samples of the same organism the comparison period has: counts only, never a patient.
  org as (
    select g.organism, g.n, g.mdr, row_number() over (order by g.n desc, g.organism) as rank
      from (select nullif(btrim(pos.organism), '') as organism, count(*) as n, count(*) filter (where pos.resistance is not null) as mdr
              from pos
             where pos.day between v_from and v_to and nullif(btrim(pos.organism), '') is not null
             group by 1) g
  ),
  corg as (
    select nullif(btrim(pos.organism), '') as organism, count(*) as n
      from pos
     where pos.day between v_cfrom and v_cto and nullif(btrim(pos.organism), '') is not null
     group by 1
  ),
  -- The buckets of the chart: the weeks (Monday to Sunday) or the months of each period, by position.
  buckets as (
    select 'current' as part, b.start, greatest(b.start, v_from) as first_day, least(b.next - 1, v_to) as last_day
      from (select g::date as start,
                   (g + case when v_bucket = 'month' then interval '1 month' else interval '7 days' end)::date as next
              from generate_series(date_trunc(v_bucket, v_from::timestamp), v_to::timestamp,
                                   case when v_bucket = 'month' then interval '1 month' else interval '7 days' end) g) b
    union all
    select 'compare', b.start, greatest(b.start, v_cfrom), least(b.next - 1, v_cto)
      from (select g::date as start,
                   (g + case when v_bucket = 'month' then interval '1 month' else interval '7 days' end)::date as next
              from generate_series(date_trunc(v_bucket, v_cfrom::timestamp), v_cto::timestamp,
                                   case when v_bucket = 'month' then interval '1 month' else interval '7 days' end) g) b
  )
  select jsonb_build_object(
    'departmentIds', to_jsonb(v_departments),
    'today', v_today,
    'from', v_from,
    'to', v_to,
    'compareFrom', v_cfrom,
    'compareTo', v_cto,
    'bucket', v_bucket,
    'inpatients', (select count(*) from public.patients x
                    where x.organization_id = p_organization_id and x.discharge_date is null and x.department_id = any (v_departments)),
    'beds', null,
    'admissionsToday', (select count(*) from public.patient_admissions x
                         where x.organization_id = p_organization_id and x.department_id = any (v_departments) and x.admission_date = v_today),
    -- The figures of the period; the same under 'compare' for the comparison period.
    'positives', case when 'laboratory' = any (v_disabled) then null else (select count(*) from pos where pos.day between v_from and v_to) end,
    'positivesMdr', case when 'laboratory' = any (v_disabled) then null else (select count(*) from pos where pos.day between v_from and v_to and pos.resistance is not null) end,
    'positivesAwaiting', case when 'laboratory' = any (v_disabled) then null else (select count(*) from pos where pos.day between v_from and v_to and pos.awaiting) end,
    'patients', case when 'laboratory' = any (v_disabled) then null else (select count(distinct pos.patient_id) from pos where pos.day between v_from and v_to) end,
    'organismsCount', case when 'laboratory' = any (v_disabled) then null else (select count(*) from org) end,
    'organismsOtherCount', case when 'laboratory' = any (v_disabled) then null else (select coalesce(sum(org.n), 0) from org where org.rank > 4) end,
    'newSurveillance', case when 'surveillance' = any (v_disabled) then null else (select count(*) from public.surveillance_cases x
                         where x.organization_id = p_organization_id and x.status <> 'cancelled' and x.department_id = any (v_departments)
                           and (x.started_at at time zone 'Europe/Athens')::date between v_from and v_to) end,
    'newIsolation', case when 'surveillance' = any (v_disabled) then null else (select count(*) from public.isolation_episodes x
                      where x.organization_id = p_organization_id and x.status <> 'cancelled'
                        and not exists (select 1 from public.surveillance_cases sc where sc.id = x.surveillance_case_id and sc.status = 'cancelled') and x.department_id = any (v_departments)
                        and (x.started_at at time zone 'Europe/Athens')::date between v_from and v_to) end,
    'handHygienePct', case when 'prevention' = any (v_disabled) then null else (select case when coalesce(sum(hh.observations), 0) = 0 then null
                        else round(100.0 * sum(hh.compliant_observations) / sum(hh.observations), 1) end from hh where hh.observation_date between v_from and v_to) end,
    'handHygieneObservations', case when 'prevention' = any (v_disabled) then null else (select coalesce(sum(hh.observations), 0) from hh where hh.observation_date between v_from and v_to) end,
    'lateControls', v_late -> 'current',
    'compare', jsonb_build_object(
      'positives', case when 'laboratory' = any (v_disabled) then null else (select count(*) from pos where pos.day between v_cfrom and v_cto) end,
      'positivesMdr', case when 'laboratory' = any (v_disabled) then null else (select count(*) from pos where pos.day between v_cfrom and v_cto and pos.resistance is not null) end,
      'positivesAwaiting', case when 'laboratory' = any (v_disabled) then null else (select count(*) from pos where pos.day between v_cfrom and v_cto and pos.awaiting) end,
      'patients', case when 'laboratory' = any (v_disabled) then null else (select count(distinct pos.patient_id) from pos where pos.day between v_cfrom and v_cto) end,
      'organismsCount', case when 'laboratory' = any (v_disabled) then null else (select count(*) from corg) end,
      'newSurveillance', case when 'surveillance' = any (v_disabled) then null else (select count(*) from public.surveillance_cases x
                           where x.organization_id = p_organization_id and x.status <> 'cancelled' and x.department_id = any (v_departments)
                             and (x.started_at at time zone 'Europe/Athens')::date between v_cfrom and v_cto) end,
      'newIsolation', case when 'surveillance' = any (v_disabled) then null else (select count(*) from public.isolation_episodes x
                        where x.organization_id = p_organization_id and x.status <> 'cancelled'
                        and not exists (select 1 from public.surveillance_cases sc where sc.id = x.surveillance_case_id and sc.status = 'cancelled') and x.department_id = any (v_departments)
                          and (x.started_at at time zone 'Europe/Athens')::date between v_cfrom and v_cto) end,
      'handHygienePct', case when 'prevention' = any (v_disabled) then null else (select case when coalesce(sum(hh.observations), 0) = 0 then null
                          else round(100.0 * sum(hh.compliant_observations) / sum(hh.observations), 1) end from hh where hh.observation_date between v_cfrom and v_cto) end,
      'handHygieneObservations', case when 'prevention' = any (v_disabled) then null else (select coalesce(sum(hh.observations), 0) from hh where hh.observation_date between v_cfrom and v_cto) end,
      'lateControls', v_late -> 'compare'
    ),
    -- Today, whatever the period («Για μένα σήμερα», the tiles' small lines and the announcements' footer).
    'reassessmentsDueToday', case when 'surveillance' = any (v_disabled) then null else (select count(*) from public.isolation_episodes x
                               where x.organization_id = p_organization_id and x.status = 'active' and x.review_due_at < v_day_end and x.department_id = any (v_departments)) end,
    'handHygieneTarget', v_target,
    'overdueControls', case when 'controls' = any (v_disabled) then null else (select count(*) from public.control_assignments x
                         where x.organization_id = p_organization_id and x.next_due_at < now() and x.status not in ('completed', 'cancelled') and x.department_id = any (v_departments)) end,
    'controlsDueToday', case when 'controls' = any (v_disabled) then null else (select count(*) from public.control_assignments x
                          where x.organization_id = p_organization_id and x.status = 'scheduled' and x.next_due_at < v_day_end and x.department_id = any (v_departments)) end,
    'pendingRosterRequests', (select count(*) from public.roster_requests q
                               where q.organization_id = p_organization_id and q.status = 'pending' and q.department_id = any (v_departments)),
    'trainingExpiring30', case when 'training' = any (v_disabled) then null else (select tr.expiring from tr) end,
    'trainingPct', case when 'training' = any (v_disabled) or coalesce((select tr.due from tr), 0) = 0 then null
                     else (select round(100.0 * tr.done / tr.due, 1) from tr) end,
    'fluPct', case when 'occupational_health' = any (v_disabled) or coalesce((select flu.active_staff from flu), 0) = 0 or coalesce((select flu.flu_recorded from flu), 0) = 0 then null
                else (select round(100.0 * flu.vaccinated / flu.active_staff, 1) from flu) end,
    'falls30', case when 'quality' = any (v_disabled) then null else (select inc.falls from inc) end,
    'pressureUlcers30', case when 'quality' = any (v_disabled) then null else (select inc.ulcers from inc) end,
    -- The positives per week (or month) of the two periods.
    'positivesSeries', case when 'laboratory' = any (v_disabled) then '[]'::jsonb else (
      select coalesce(jsonb_agg(jsonb_build_object(
               'start', b.start,
               'mdr', (select count(*) from pos where pos.day between b.first_day and b.last_day and pos.resistance is not null),
               'other', (select count(*) from pos where pos.day between b.first_day and b.last_day and pos.resistance is null)
             ) order by b.start), '[]'::jsonb)
        from buckets b where b.part = 'current') end,
    'positivesCompareSeries', case when 'laboratory' = any (v_disabled) then '[]'::jsonb else (
      select coalesce(jsonb_agg(jsonb_build_object(
               'start', b.start,
               'mdr', (select count(*) from pos where pos.day between b.first_day and b.last_day and pos.resistance is not null),
               'other', (select count(*) from pos where pos.day between b.first_day and b.last_day and pos.resistance is null)
             ) order by b.start), '[]'::jsonb)
        from buckets b where b.part = 'compare') end,
    -- Hand hygiene per month of the two periods (as many months each, the last one the period's last).
    'monthlyHandHygiene', case when 'prevention' = any (v_disabled) then '[]'::jsonb else (
      select coalesce(jsonb_agg(jsonb_build_object(
               'month', to_char(m.month, 'YYYY-MM'),
               'observations', coalesce((select sum(hh.observations) from hh where hh.observation_date >= m.month and hh.observation_date < (m.month + interval '1 month')::date), 0),
               'compliant', coalesce((select sum(hh.compliant_observations) from hh where hh.observation_date >= m.month and hh.observation_date < (m.month + interval '1 month')::date), 0)
             ) order by m.month), '[]'::jsonb)
        from (select (v_hh_from + make_interval(months => g))::date as month from generate_series(0, v_hh_months - 1) as g) m) end,
    'monthlyHandHygieneCompare', case when 'prevention' = any (v_disabled) then '[]'::jsonb else (
      select coalesce(jsonb_agg(jsonb_build_object(
               'month', to_char(m.month, 'YYYY-MM'),
               'observations', coalesce((select sum(hh.observations) from hh where hh.observation_date >= m.month and hh.observation_date < (m.month + interval '1 month')::date), 0),
               'compliant', coalesce((select sum(hh.compliant_observations) from hh where hh.observation_date >= m.month and hh.observation_date < (m.month + interval '1 month')::date), 0)
             ) order by m.month), '[]'::jsonb)
        from (select (v_chh_from + make_interval(months => g))::date as month from generate_series(0, v_hh_months - 1) as g) m) end,
    -- The 4 most frequent organisms of the period, each with its count in the comparison period.
    'organisms', case when 'laboratory' = any (v_disabled) then '[]'::jsonb else (
      select coalesce(jsonb_agg(jsonb_build_object('organism', org.organism, 'count', org.n, 'mdr', org.mdr,
               'compareCount', coalesce((select corg.n from corg where corg.organism = org.organism), 0)) order by org.rank), '[]'::jsonb)
        from org where org.rank <= 4) end
  ) into v_result;

  return v_result;
end
$function$;
