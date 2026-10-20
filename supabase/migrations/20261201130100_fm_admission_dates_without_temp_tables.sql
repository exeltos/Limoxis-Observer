-- private.fm_correct_admission_dates without temp tables.
--
-- 20261201130000 staged the work in temp tables, which plpgsql_check cannot
-- see (supabase/tests/plpgsql_functions_check.sql failed with "relation
-- fm_imported does not exist"). The same rules now run as two statements with
-- materialized CTEs: the FileMaker rows are read once, not once per admission.
-- The ΙΑΣΩ correction already ran in 20261201130000 and is not repeated here
-- (a second run changes nothing: 0 admissions, 0 patients).

create or replace function private.fm_correct_admission_dates(
  p_organization_id uuid,
  p_created_from timestamptz,
  p_created_to timestamptz
)
returns table (admissions_changed integer, patients_changed integer)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_admissions integer := 0;
  v_patients integer := 0;
begin
  with imported as materialized (
    select x.* from (
      select a.id, a.organization_id, a.patient_id, a.department_id, a.admission_date, a.discharge_date,
             a.status, a.case_number, a.created_at, d.name as department_name,
             lag(greatest(a.admission_date, coalesce(a.discharge_date, a.admission_date)))
               over (partition by a.patient_id order by a.admission_date, a.id) as previous_bound
        from public.patient_admissions a
        left join public.departments d on d.id = a.department_id
       where a.organization_id = p_organization_id
    ) x
    where x.created_at >= p_created_from and x.created_at < p_created_to
  ),
  filemaker as materialized (
    select trim(r.data->>'ΑΡΙΘΜΟΣ ΠΕΡΙΣΤΑΤΙΚΟΥ') as case_number, 'filemaker_icu'::text as source,
           (r.data->>'ΗΜΕΡΟΜΗΝΙΑ ΕΙΣΑΓΩΓΗΣ ΜΕΘ')::date as entered, (r.data->>'ΗΜΕΡΟΜΗΝΙΑ ΕΞΟΔΟΥ ΑΠΟ ΤΗ  ΜΕΘ')::date as exited
      from public.fm_stage_records r
     where r.base_table = 'Indicators ICU'
       and r.data->>'ΗΜΕΡΟΜΗΝΙΑ ΕΙΣΑΓΩΓΗΣ ΜΕΘ' ~ '^\d{4}-\d{2}-\d{2}$'
       and r.data->>'ΗΜΕΡΟΜΗΝΙΑ ΕΞΟΔΟΥ ΑΠΟ ΤΗ  ΜΕΘ' ~ '^\d{4}-\d{2}-\d{2}$'
    union all
    select trim(r.data->>'Kodikos Eisagogis'), 'filemaker_death',
           (r.data->>'Date of entry')::date, (r.data->>'Date of exit')::date
      from public.fm_stage_records r
     where r.base_table = 'Death'
       and r.data->>'Date of entry' ~ '^\d{4}-\d{2}-\d{2}$'
       and r.data->>'Date of exit' ~ '^\d{4}-\d{2}-\d{2}$'
  ),
  stay_filemaker as materialized (
    select i.id, f.source, f.entered, f.exited
      from imported i
      join filemaker f on f.case_number = i.case_number
     where f.entered <= f.exited
       and (f.source = 'filemaker_death' or i.department_name = 'ΜΕΘ')
  ),
  earliest as (
    select i.id, min(x.day) as day
      from imported i
      cross join lateral (
        select (coalesce(s.collected_at, s.requested_at) at time zone 'Europe/Athens')::date as day,
               (c.admission_id is not null and c.admission_id = i.id) as linked
          from public.laboratory_samples s
          left join public.surveillance_cases c on c.id = s.surveillance_case_id
         where s.patient_id = i.patient_id
           and coalesce(s.collected_at, s.requested_at) is not null
           and (c.admission_id = i.id
                or (c.admission_id is null
                    and (s.department_id is null or i.department_id is null or s.department_id = i.department_id)))
        union all
        select (c.started_at at time zone 'Europe/Athens')::date, c.admission_id is not null
          from public.surveillance_cases c
         where c.patient_id = i.patient_id
           and c.started_at is not null
           and c.status <> 'cancelled'
           and (c.admission_id = i.id
                or (c.admission_id is null
                    and (c.department_id is null or i.department_id is null or c.department_id = i.department_id)))
        union all
        select sf.entered, true from stay_filemaker sf where sf.id = i.id
      ) x
     where x.day < i.admission_date
       and x.day >= i.admission_date - case when x.linked then 60 else 30 end
       and (i.previous_bound is null or x.day > i.previous_bound)
     group by i.id
  ),
  planned as (
    select i.id, i.organization_id, i.patient_id, i.admission_date, i.discharge_date, i.status,
           coalesce(e.day, i.admission_date) as new_admission_date
      from imported i
      left join earliest e on e.id = i.id
  ),
  with_next as (
    select p.*,
           lead(p.new_admission_date) over (partition by p.patient_id order by p.admission_date, p.id) as next_admission_date
      from planned p
  ),
  discharge as (
    select w.id, max(sf.exited) as exited,
           string_agg(distinct sf.source, ',') as source
      from with_next w
      join stay_filemaker sf on sf.id = w.id
     where w.discharge_date is null
       and w.status <> 'active'
       and sf.exited >= w.new_admission_date
       and (w.next_admission_date is null or sf.exited < w.next_admission_date)
     group by w.id
  ),
  plan as materialized (
    select w.id, w.organization_id, w.patient_id,
           w.admission_date as old_admission_date, w.discharge_date as old_discharge_date,
           w.new_admission_date,
           coalesce(w.discharge_date, d.exited) as new_discharge_date,
           d.source as discharge_source
      from with_next w
      left join discharge d on d.id = w.id
     where w.new_admission_date <> w.admission_date
        or (w.discharge_date is null and d.exited is not null)
  ),
  backup as (
    insert into private.patient_admissions_backup_20261201
      (admission_id, organization_id, patient_id, old_admission_date, old_discharge_date,
       new_admission_date, new_discharge_date, discharge_source)
    select id, organization_id, patient_id, old_admission_date, old_discharge_date,
           new_admission_date, new_discharge_date, discharge_source
      from plan
    on conflict (admission_id) do nothing
    returning admission_id
  ),
  updated as (
    update public.patient_admissions a
       set admission_date = p.new_admission_date,
           discharge_date = p.new_discharge_date,
           updated_at = now()
      from plan p
     where a.id = p.id
    returning a.id
  )
  select count(*) into v_admissions from updated;

  -- The patient row mirrors its latest admission (this statement sees the
  -- admissions and the backup rows written above).
  with patient_plan as materialized (
    select pt.id as patient_id, pt.organization_id,
           pt.admission_date as old_admission_date, pt.discharge_date as old_discharge_date,
           latest.admission_date as new_admission_date,
           case when pt.discharge_date is null and pt.status <> 'active' then latest.discharge_date
                else pt.discharge_date end as new_discharge_date
      from public.patients pt
      join lateral (
        select a.admission_date, a.discharge_date
          from public.patient_admissions a
         where a.patient_id = pt.id
         order by a.admission_date desc, a.id desc
         limit 1
      ) latest on true
     where pt.organization_id = p_organization_id
       and pt.admission_date in (
         select b.old_admission_date from private.patient_admissions_backup_20261201 b where b.patient_id = pt.id
       )
       and (latest.admission_date is distinct from pt.admission_date
            or (pt.discharge_date is null and pt.status <> 'active' and latest.discharge_date is not null))
  ),
  backup as (
    insert into private.patients_backup_20261201
      (patient_id, organization_id, old_admission_date, old_discharge_date, new_admission_date, new_discharge_date)
    select patient_id, organization_id, old_admission_date, old_discharge_date, new_admission_date, new_discharge_date
      from patient_plan
    on conflict (patient_id) do nothing
    returning patient_id
  ),
  updated as (
    update public.patients pt
       set admission_date = p.new_admission_date,
           discharge_date = p.new_discharge_date
      from patient_plan p
     where pt.id = p.patient_id
    returning pt.id
  )
  select count(*) into v_patients from updated;

  return query select v_admissions, v_patients;
end;
$$;

revoke all on function private.fm_correct_admission_dates(uuid, timestamptz, timestamptz) from public, anon, authenticated;
