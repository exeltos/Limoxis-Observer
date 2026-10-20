-- FileMaker-imported admissions: dates that match the patient's samples.
--
-- The FileMaker import (2026-10-19) created one patient_admissions row per
-- surveillance episode with admission_date = the episode start and no
-- discharge_date, although the stays are 'discharged'. The cultures that led to
-- the episode are usually dated a few days earlier, so the patient record showed
-- none of them. FileMaker has no hospital discharge date of its own; it has the
-- ICU stay (Indicators ICU: ΗΜΕΡΟΜΗΝΙΑ ΕΙΣΑΓΩΓΗΣ/ΕΞΟΔΟΥ ΜΕΘ) and the exit of
-- deceased patients (Death: Date of entry / Date of exit), both by case number.
--
-- private.fm_correct_admission_dates(org, from, to) corrects the admissions of
-- one import (created between from and to). It only UPDATEs, never deletes, and
-- keeps the original values in private.patient_admissions_backup_20261201 and
-- private.patients_backup_20261201. A later FileMaker import calls it again
-- for its own rows.
--
--  * admission_date is moved back to the earliest sample or episode of the stay
--    (calendar day in Europe/Athens): samples and episodes linked to this
--    admission (up to 60 days earlier), unlinked ones of its department (up to
--    30 days earlier), and the FileMaker ICU/death entry date. Never on or before
--    the previous admission of the patient, so admissions never overlap.
--  * discharge_date, when empty and the stay is not active, comes from the
--    FileMaker ICU exit (ICU admissions) or the death exit (any department), if
--    it falls within the stay and before the next admission.
--  * patients.admission_date / discharge_date follow the latest admission.

create table if not exists private.patient_admissions_backup_20261201 (
  admission_id uuid primary key,
  organization_id uuid not null,
  patient_id uuid not null,
  old_admission_date date,
  old_discharge_date date,
  new_admission_date date,
  new_discharge_date date,
  discharge_source text,
  changed_at timestamptz not null default now()
);

create table if not exists private.patients_backup_20261201 (
  patient_id uuid primary key,
  organization_id uuid not null,
  old_admission_date date,
  old_discharge_date date,
  new_admission_date date,
  new_discharge_date date,
  changed_at timestamptz not null default now()
);

revoke all on private.patient_admissions_backup_20261201 from public, anon, authenticated;
revoke all on private.patients_backup_20261201 from public, anon, authenticated;

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
  -- Staged in analysed temp tables: one query over every step otherwise
  -- rescans the FileMaker rows (jsonb) once per admission.
  create temp table fm_imported on commit drop as
  select x.* from (
    select a.id, a.organization_id, a.patient_id, a.department_id, a.admission_date, a.discharge_date,
           a.status, a.case_number, a.created_at, d.name as department_name,
           lag(greatest(a.admission_date, coalesce(a.discharge_date, a.admission_date)))
             over (partition by a.patient_id order by a.admission_date, a.id) as previous_bound
      from public.patient_admissions a
      left join public.departments d on d.id = a.department_id
     where a.organization_id = p_organization_id
  ) x
  where x.created_at >= p_created_from and x.created_at < p_created_to;
  analyze fm_imported;

  create temp table fm_filemaker on commit drop as
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
       and r.data->>'Date of exit' ~ '^\d{4}-\d{2}-\d{2}$';
  analyze fm_filemaker;

  create temp table fm_stay on commit drop as
  select i.id, f.source, f.entered, f.exited
    from fm_imported i
    join fm_filemaker f on f.case_number = i.case_number
   where f.entered <= f.exited
     and (f.source = 'filemaker_death' or i.department_name = 'ΜΕΘ');
  analyze fm_stay;

  create temp table fm_admission_plan on commit drop as
  with imported as (select * from fm_imported),
  stay_filemaker as (select * from fm_stay),
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
  )
  select w.id, w.organization_id, w.patient_id,
         w.admission_date as old_admission_date, w.discharge_date as old_discharge_date,
         w.new_admission_date,
         coalesce(w.discharge_date, d.exited) as new_discharge_date,
         d.source as discharge_source
    from with_next w
    left join discharge d on d.id = w.id
   where w.new_admission_date <> w.admission_date
      or (w.discharge_date is null and d.exited is not null);

  insert into private.patient_admissions_backup_20261201
    (admission_id, organization_id, patient_id, old_admission_date, old_discharge_date,
     new_admission_date, new_discharge_date, discharge_source)
  select id, organization_id, patient_id, old_admission_date, old_discharge_date,
         new_admission_date, new_discharge_date, discharge_source
    from fm_admission_plan
  on conflict (admission_id) do nothing;

  update public.patient_admissions a
     set admission_date = p.new_admission_date,
         discharge_date = p.new_discharge_date,
         updated_at = now()
    from fm_admission_plan p
   where a.id = p.id;
  get diagnostics v_admissions = row_count;

  -- The patient row mirrors its latest admission.
  create temp table fm_patient_plan on commit drop as
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
   where pt.id in (select patient_id from fm_admission_plan)
     and pt.admission_date in (
       select b.old_admission_date from private.patient_admissions_backup_20261201 b where b.patient_id = pt.id
     )
     and (latest.admission_date is distinct from pt.admission_date
          or (pt.discharge_date is null and pt.status <> 'active' and latest.discharge_date is not null));

  insert into private.patients_backup_20261201
    (patient_id, organization_id, old_admission_date, old_discharge_date, new_admission_date, new_discharge_date)
  select patient_id, organization_id, old_admission_date, old_discharge_date, new_admission_date, new_discharge_date
    from fm_patient_plan
  on conflict (patient_id) do nothing;

  update public.patients pt
     set admission_date = p.new_admission_date,
         discharge_date = p.new_discharge_date
    from fm_patient_plan p
   where pt.id = p.patient_id;
  get diagnostics v_patients = row_count;

  return query select v_admissions, v_patients;
end;
$$;

revoke all on function private.fm_correct_admission_dates(uuid, timestamptz, timestamptz) from public, anon, authenticated;

-- ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ: the FileMaker import of 2026-10-19.
select * from private.fm_correct_admission_dates(
  '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd',
  '2026-10-19 00:00:00+00',
  '2026-10-20 00:00:00+00'
);
