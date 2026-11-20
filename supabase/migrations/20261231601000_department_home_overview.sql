-- «Το τμήμα μου» του Προϊσταμένου: μία ανάγνωση με όλους τους αριθμούς της
-- αρχικής του τμήματος (νοσηλευόμενοι, θετικά δείγματα 30 ημερών, επιτήρηση /
-- απομόνωση, υγιεινή χεριών, εκπρόθεσμοι έλεγχοι, αιτήματα βαρδιών,
-- εκπαιδεύσεις, πτώσεις / κατακλίσεις, εμβολιασμός γρίπης), τις δύο σειρές των
-- γραφημάτων (θετικά ανά εβδομάδα 12 εβδομάδων, υγιεινή χεριών ανά μήνα 6
-- μηνών) και τα 5 τελευταία θετικά.
--
-- Μόνο ανάγνωση. Ημερομηνίες σε ώρα Ευρώπης/Αθήνας. Οι ορισμοί είναι οι ίδιοι με
-- το dashboard_metrics (νοσηλευόμενοι, επιτήρηση, απομόνωση, έλεγχοι), το
-- division_overview (εκπαίδευση, γρίπη, υγιεινή χεριών, πτώσεις / κατακλίσεις)
-- και τη λίστα «Προς έλεγχο» (θετικό δείγμα ασθενή χωρίς επεισόδιο και χωρίς
-- απόφαση). Οι τιμές ενός κλειδωμένου module είναι null.
--
-- Πρόσβαση: Ιδιοκτήτης Πλατφόρμας, Διαχειριστής Νοσοκομείου ή χρήστης με εύρος
-- στο τμήμα (organization_member_scopes). Χωρίς τμήματα: τα τμήματα του εύρους
-- του χρήστη (ο διαχειριστής χωρίς εύρος: όλο το νοσοκομείο).
create or replace function public.department_home_overview(p_organization_id uuid, p_department_ids uuid[] default null)
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
  v_week0 date;
  v_month0 date;
  v_season date;
  v_target numeric;
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
  -- The figures include patients' names and results: only the roles that read the department's patients
  -- (patients_clinical_read), never any member with a department scope.
  if not (v_admin or public.current_user_has_org_role(p_organization_id,
       array['department_manager', 'infection_control_lead', 'infection_control_member', 'doctor_reviewer']::public.app_role[])) then
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
    if cardinality(v_departments) = 0 then
      raise exception 'PERMISSION_DENIED' using errcode = '42501';
    end if;
  end if;

  v_disabled := coalesce(private.org_disabled_modules(p_organization_id), '{}'::text[]);
  v_day_end := ((v_today + 1)::timestamp at time zone 'Europe/Athens');
  -- 12 εβδομάδες (Δευτέρα έως Κυριακή) ως την τρέχουσα· 6 μήνες ως τον τρέχοντα.
  v_week0 := date_trunc('week', v_today::timestamp)::date - 77;
  v_month0 := (date_trunc('month', v_today::timestamp) - interval '5 months')::date;
  -- Περίοδος αντιγριπικού εμβολιασμού: από 1 Σεπτεμβρίου.
  v_season := make_date(extract(year from v_today)::integer - case when extract(month from v_today) >= 9 then 0 else 1 end, 9, 1);

  -- Στόχος υγιεινής χεριών: ο στόχος του έτους του νοσοκομείου (του τμήματος πρώτα), αλλιώς ο ορισμός του δείκτη, αλλιώς 80%.
  select o.target into v_target
    from public.quality_objectives o
   where o.organization_id = p_organization_id and o.platform_indicator_key = 'hh-compliance'
     and o.year = extract(year from v_today)::integer and o.status = 'active' and o.target is not null
     and (o.department_id is null or o.department_id = any (v_departments))
   order by (o.department_id is null), o.updated_at desc
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

  with pos as (
    select s.id, s.sample_code, s.patient_id, s.collected_at,
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
       and s.collected_at >= (least(v_week0, v_today - 29)::timestamp at time zone 'Europe/Athens')
       and s.collected_at < v_day_end
  ),
  hh as (
    select h.observation_date, h.observations, h.compliant_observations
      from public.hand_hygiene_sessions h
     where h.organization_id = p_organization_id and h.department_id = any (v_departments) and h.status = 'completed'
       and h.observation_date between least(v_month0, v_today - 29) and v_today
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
  )
  select jsonb_build_object(
    'departmentIds', to_jsonb(v_departments),
    'today', v_today,
    'inpatients', (select count(*) from public.patients x
                    where x.organization_id = p_organization_id and x.discharge_date is null and x.department_id = any (v_departments)),
    'beds', null,
    'admissionsToday', (select count(*) from public.patient_admissions x
                         where x.organization_id = p_organization_id and x.department_id = any (v_departments) and x.admission_date = v_today),
    'positives30', case when 'laboratory' = any (v_disabled) then null else (select count(*) from pos where pos.day > v_today - 30) end,
    'positivesMdr30', case when 'laboratory' = any (v_disabled) then null else (select count(*) from pos where pos.day > v_today - 30 and pos.resistance is not null) end,
    'positivesAwaiting30', case when 'laboratory' = any (v_disabled) then null else (select count(*) from pos where pos.day > v_today - 30 and pos.awaiting) end,
    'activeSurveillance', case when 'surveillance' = any (v_disabled) then null else (select count(*) from public.surveillance_cases x
                            where x.organization_id = p_organization_id and x.status = 'active' and x.department_id = any (v_departments)) end,
    'activeIsolation', case when 'surveillance' = any (v_disabled) then null else (select count(*) from public.isolation_episodes x
                         where x.organization_id = p_organization_id and x.status = 'active' and x.department_id = any (v_departments)) end,
    'reassessmentsDueToday', case when 'surveillance' = any (v_disabled) then null else (select count(*) from public.isolation_episodes x
                               where x.organization_id = p_organization_id and x.status = 'active' and x.review_due_at < v_day_end and x.department_id = any (v_departments)) end,
    'handHygienePct', case when 'prevention' = any (v_disabled) then null else (select case when coalesce(sum(hh.observations), 0) = 0 then null
                        else round(100.0 * sum(hh.compliant_observations) / sum(hh.observations), 1) end from hh where hh.observation_date > v_today - 30) end,
    'handHygieneObservations', case when 'prevention' = any (v_disabled) then null else (select coalesce(sum(hh.observations), 0) from hh where hh.observation_date > v_today - 30) end,
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
    'weeklyPositives', case when 'laboratory' = any (v_disabled) then '[]'::jsonb else (
      select coalesce(jsonb_agg(jsonb_build_object(
               'week', w.week,
               'mdr', (select count(*) from pos where pos.day >= w.week and pos.day < w.week + 7 and pos.resistance is not null),
               'other', (select count(*) from pos where pos.day >= w.week and pos.day < w.week + 7 and pos.resistance is null)
             ) order by w.week), '[]'::jsonb)
        from (select (v_week0 + 7 * g)::date as week from generate_series(0, 11) as g) w) end,
    'monthlyHandHygiene', case when 'prevention' = any (v_disabled) then '[]'::jsonb else (
      select coalesce(jsonb_agg(jsonb_build_object(
               'month', to_char(m.month, 'YYYY-MM'),
               'observations', coalesce((select sum(hh.observations) from hh where hh.observation_date >= m.month and hh.observation_date < (m.month + interval '1 month')::date), 0),
               'compliant', coalesce((select sum(hh.compliant_observations) from hh where hh.observation_date >= m.month and hh.observation_date < (m.month + interval '1 month')::date), 0)
             ) order by m.month), '[]'::jsonb)
        from (select (v_month0 + make_interval(months => g))::date as month from generate_series(0, 5) as g) m) end,
    'latestPositives', case when 'laboratory' = any (v_disabled) then '[]'::jsonb else (
      select coalesce(jsonb_agg(jsonb_build_object(
               'sampleCode', l.sample_code,
               'patientId', l.patient_id,
               'patient', nullif(trim(concat_ws(' ', p.last_name, p.first_name)), ''),
               'patientCode', p.patient_code,
               'organism', l.organism,
               'resistance', l.resistance,
               'collectedAt', l.collected_at,
               'awaiting', l.awaiting
             ) order by l.collected_at desc, l.sample_code), '[]'::jsonb)
        from (select * from pos order by pos.collected_at desc, pos.sample_code limit 5) l
        left join public.patients p on p.id = l.patient_id and p.organization_id = p_organization_id) end
  ) into v_result;

  return v_result;
end
$function$;

revoke all on function public.department_home_overview(uuid, uuid[]) from public, anon;
grant execute on function public.department_home_overview(uuid, uuid[]) to authenticated;
