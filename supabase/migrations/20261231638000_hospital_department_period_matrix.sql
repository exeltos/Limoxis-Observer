-- Αρχική του νοσοκομείου, 2ο μέρος (ιδιοκτήτης 24/11/2026): «Χάρτης τμημάτων».
-- Για την περίοδο και την περίοδο σύγκρισης, ανά τμήμα: θετικά δείγματα (και MDR/XDR), νέα επεισόδια επιτήρησης και
-- απομονώσεις, υγιεινή χεριών (με τον στόχο του τμήματος, αλλιώς του νοσοκομείου, αλλιώς 80%) και έλεγχοι εκτός χρόνου.
-- Οι ίδιοι ορισμοί με τη department_home_period_overview («Το τμήμα μου»), ώστε το άθροισμα να συμφωνεί με την Αρχική.
-- Μόνο αριθμοί, κανένα όνομα ασθενή. Καλούν: ο Διαχειριστής Νοσοκομείου / ο Ιδιοκτήτης Πλατφόρμας (όλα τα τμήματα),
-- οι ρόλοι λοιμώξεων (τα τμήματα του εύρους τους, αλλιώς όλα) και ο Υπεύθυνος Ποιότητας (όλα, χωρίς εργαστήριο και
-- επιτήρηση). Τιμές κλειδωμένης ενότητας: null.

create or replace function public.hospital_department_period_matrix(p_organization_id uuid, p_from date, p_to date, p_compare_from date, p_compare_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_admin boolean;
  v_clinical boolean;
  v_departments uuid[];
  v_disabled text[];
  v_today date := (now() at time zone 'Europe/Athens')::date;
  v_day_end timestamptz;
  v_first date;
  v_last date;
  v_hospital_target numeric;
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
  if p_from is null or p_to is null or p_compare_from is null or p_compare_to is null
     or p_to < p_from or p_to - p_from > 366 or p_compare_to < p_compare_from or p_compare_to - p_compare_from > 366 then
    raise exception 'INVALID_PERIOD' using errcode = '22023';
  end if;
  v_admin := public.current_user_is_platform_owner() or public.is_org_admin(p_organization_id);
  if not (v_admin or public.current_user_has_org_role(p_organization_id,
       array['infection_control_lead', 'infection_control_member', 'quality_manager']::public.app_role[])) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  -- Εργαστήριο και επιτήρηση: μόνο όσοι διαβάζουν κλινικά στοιχεία (όχι ο Υπεύθυνος Ποιότητας).
  v_clinical := v_admin or public.current_user_has_org_role(p_organization_id,
       array['infection_control_lead', 'infection_control_member']::public.app_role[]);

  -- Τα τμήματα: όλα για τον διαχειριστή και την ποιότητα· για τους ρόλους λοιμώξεων το εύρος τους, αλλιώς όλα.
  if not v_admin then
    select coalesce(array_agg(distinct oms.department_id), '{}'::uuid[]) into v_departments
      from public.organization_members om
      join public.organization_member_scopes oms on oms.membership_id = om.id
     where om.user_id = auth.uid() and om.organization_id = p_organization_id and om.status = 'active'
       and oms.department_id is not null;
  end if;
  if v_admin or coalesce(cardinality(v_departments), 0) = 0 then
    select coalesce(array_agg(d.id), '{}'::uuid[]) into v_departments
      from public.departments d
     where d.organization_id = p_organization_id;
  end if;

  v_disabled := coalesce(private.org_disabled_modules(p_organization_id), '{}'::text[]);
  if not v_clinical then
    v_disabled := v_disabled || array['laboratory', 'surveillance'];
  end if;
  v_day_end := ((v_today + 1)::timestamp at time zone 'Europe/Athens');
  v_first := least(p_from, p_compare_from);
  v_last := greatest(p_to, p_compare_to);

  select o.target into v_hospital_target
    from public.quality_objectives o
   where o.organization_id = p_organization_id and o.platform_indicator_key = 'hh-compliance'
     and o.year = extract(year from v_today)::integer and o.status = 'active' and o.target is not null
     and o.department_id is null
   order by o.updated_at desc
   limit 1;
  if v_hospital_target is null then
    select i.target_value into v_hospital_target
      from public.indicator_definitions i
     where i.indicator_key = 'hh-compliance' and i.status = 'active' and i.target_value is not null
       and (i.organization_id = p_organization_id or i.organization_id is null)
     order by (i.organization_id is null), i.effective_from desc nulls last
     limit 1;
  end if;
  v_hospital_target := coalesce(v_hospital_target, 80);

  with dep as (
    select d.id, d.name
      from public.departments d
     where d.organization_id = p_organization_id and d.id = any (v_departments)
  ),
  pos as (
    select s.department_id,
           (s.collected_at at time zone 'Europe/Athens')::date as day,
           exists (
             select 1 from public.microbiology_results r
              where r.organization_id = p_organization_id and r.sample_id = s.id and r.result_status = 'positive'
                and upper(coalesce(r.resistance_class, '')) in ('MDR', 'XDR', 'PDR')
             union all
             select 1 from public.amr_classifications a
               join public.microbiology_results r on r.id = a.microbiology_result_id
              where a.organization_id = p_organization_id and r.sample_id = s.id and r.result_status = 'positive'
                and a.status <> 'rejected' and upper(coalesce(a.classification, '')) in ('MDR', 'XDR', 'PDR')
           ) as mdr
      from public.laboratory_samples s
      cross join lateral (
        select r.organism
          from public.microbiology_results r
         where r.organization_id = p_organization_id and r.sample_id = s.id and r.result_status = 'positive'
         order by r.resulted_at desc nulls last
         limit 1
      ) res
     where not ('laboratory' = any (v_disabled))
       and s.organization_id = p_organization_id
       and s.department_id = any (v_departments)
       and s.patient_id is not null
       and coalesce(s.subject_type, 'patient') = 'patient'
       and s.status not in ('rejected', 'cancelled')
       and s.collected_at >= (v_first::timestamp at time zone 'Europe/Athens')
       and s.collected_at < least(((v_last + 1)::timestamp at time zone 'Europe/Athens'), v_day_end)
       and coalesce(res.organism, '') !~* '(επιμόλυνση|επιμολυνση|contaminat|3\s+είδ|3\s+ειδ)'
  ),
  episodes as (
    select x.department_id, (x.started_at at time zone 'Europe/Athens')::date as day
      from public.surveillance_cases x
     where not ('surveillance' = any (v_disabled))
       and x.organization_id = p_organization_id and x.status <> 'cancelled' and x.department_id = any (v_departments)
       and (x.started_at at time zone 'Europe/Athens')::date between v_first and v_last
    union all
    select x.department_id, (x.started_at at time zone 'Europe/Athens')::date
      from public.isolation_episodes x
     where not ('surveillance' = any (v_disabled))
       and x.organization_id = p_organization_id and x.status <> 'cancelled' and x.department_id = any (v_departments)
       and not exists (select 1 from public.surveillance_cases sc where sc.id = x.surveillance_case_id and sc.status = 'cancelled')
       and (x.started_at at time zone 'Europe/Athens')::date between v_first and v_last
  ),
  hh as (
    select h.department_id, h.observation_date as day, h.observations, h.compliant_observations
      from public.hand_hygiene_sessions h
     where not ('prevention' = any (v_disabled))
       and h.organization_id = p_organization_id and h.department_id = any (v_departments) and h.status = 'completed'
       and h.observation_date between v_first and least(v_last, v_today)
  ),
  targets as (
    select distinct on (o.department_id) o.department_id, o.target
      from public.quality_objectives o
     where o.organization_id = p_organization_id and o.platform_indicator_key = 'hh-compliance'
       and o.year = extract(year from v_today)::integer and o.status = 'active' and o.target is not null
       and o.department_id = any (v_departments)
     order by o.department_id, o.updated_at desc
  ),
  late_now as (
    select a.department_id, sum(c.performed - c.on_time) as n
      from public.control_adherence_counts(p_organization_id, (p_from::timestamp at time zone 'Europe/Athens'), ((p_to + 1)::timestamp at time zone 'Europe/Athens') - interval '1 microsecond') c
      join public.control_assignments a on a.id = c.assignment_id
     where not ('controls' = any (v_disabled)) and a.organization_id = p_organization_id and a.department_id = any (v_departments)
     group by a.department_id
  ),
  late_before as (
    select a.department_id, sum(c.performed - c.on_time) as n
      from public.control_adherence_counts(p_organization_id, (p_compare_from::timestamp at time zone 'Europe/Athens'), ((p_compare_to + 1)::timestamp at time zone 'Europe/Athens') - interval '1 microsecond') c
      join public.control_assignments a on a.id = c.assignment_id
     where not ('controls' = any (v_disabled)) and a.organization_id = p_organization_id and a.department_id = any (v_departments)
     group by a.department_id
  ),
  overdue as (
    select a.department_id,
           count(*) filter (where a.next_due_at >= (p_from::timestamp at time zone 'Europe/Athens')
                              and a.next_due_at < least(((p_to + 1)::timestamp at time zone 'Europe/Athens'), now())) as now_n,
           count(*) filter (where a.next_due_at >= (p_compare_from::timestamp at time zone 'Europe/Athens')
                              and a.next_due_at < least(((p_compare_to + 1)::timestamp at time zone 'Europe/Athens'), now())) as before_n
      from public.control_assignments a
     where not ('controls' = any (v_disabled))
       and a.organization_id = p_organization_id and a.department_id = any (v_departments) and a.status not in ('completed', 'cancelled')
     group by a.department_id
  ),
  drows as (
    select dep.id, dep.name,
           (select count(*) from pos where pos.department_id = dep.id and pos.day between p_from and p_to) as positives,
           (select count(*) from pos where pos.department_id = dep.id and pos.day between p_from and p_to and pos.mdr) as positives_mdr,
           (select count(*) from pos where pos.department_id = dep.id and pos.day between p_compare_from and p_compare_to) as positives_before,
           (select count(*) from episodes e where e.department_id = dep.id and e.day between p_from and p_to) as episodes,
           (select count(*) from episodes e where e.department_id = dep.id and e.day between p_compare_from and p_compare_to) as episodes_before,
           (select sum(hh.observations) from hh where hh.department_id = dep.id and hh.day between p_from and p_to) as hh_obs,
           (select sum(hh.compliant_observations) from hh where hh.department_id = dep.id and hh.day between p_from and p_to) as hh_ok,
           (select sum(hh.observations) from hh where hh.department_id = dep.id and hh.day between p_compare_from and p_compare_to) as hh_obs_before,
           (select sum(hh.compliant_observations) from hh where hh.department_id = dep.id and hh.day between p_compare_from and p_compare_to) as hh_ok_before,
           coalesce((select t.target from targets t where t.department_id = dep.id), v_hospital_target) as hh_target,
           coalesce((select l.n from late_now l where l.department_id = dep.id), 0) + coalesce((select o.now_n from overdue o where o.department_id = dep.id), 0) as late,
           coalesce((select l.n from late_before l where l.department_id = dep.id), 0) + coalesce((select o.before_n from overdue o where o.department_id = dep.id), 0) as late_before
      from dep
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'departmentId', r.id,
           'department', r.name,
           'positives', case when 'laboratory' = any (v_disabled) then null else r.positives end,
           'positivesMdr', case when 'laboratory' = any (v_disabled) then null else r.positives_mdr end,
           'comparePositives', case when 'laboratory' = any (v_disabled) then null else r.positives_before end,
           'episodes', case when 'surveillance' = any (v_disabled) then null else r.episodes end,
           'compareEpisodes', case when 'surveillance' = any (v_disabled) then null else r.episodes_before end,
           'handHygienePct', case when 'prevention' = any (v_disabled) or coalesce(r.hh_obs, 0) = 0 then null else round(100.0 * r.hh_ok / r.hh_obs, 1) end,
           'handHygieneObservations', case when 'prevention' = any (v_disabled) then null else coalesce(r.hh_obs, 0) end,
           'compareHandHygienePct', case when 'prevention' = any (v_disabled) or coalesce(r.hh_obs_before, 0) = 0 then null else round(100.0 * r.hh_ok_before / r.hh_obs_before, 1) end,
           'handHygieneTarget', r.hh_target,
           'lateControls', case when 'controls' = any (v_disabled) then null else r.late end,
           'compareLateControls', case when 'controls' = any (v_disabled) then null else r.late_before end
         ) order by r.name), '[]'::jsonb)
    into v_result
    from drows r;

  return jsonb_build_object('hospitalTarget', v_hospital_target, 'departments', v_result);
end
$function$;

revoke all on function public.hospital_department_period_matrix(uuid, date, date, date, date) from public, anon;
grant execute on function public.hospital_department_period_matrix(uuid, date, date, date, date) to authenticated;
