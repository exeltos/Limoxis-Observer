alter table public.surveillance_cases
  add column if not exists admission_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.surveillance_cases'::regclass
      and conname='surveillance_cases_admission_id_fkey'
  ) then
    alter table public.surveillance_cases
      add constraint surveillance_cases_admission_id_fkey
      foreign key (admission_id) references public.patient_admissions(id) on delete set null;
  end if;
end $$;

create index if not exists surveillance_cases_admission_idx
  on public.surveillance_cases(organization_id, admission_id, started_at desc);

update public.surveillance_cases sc
set admission_id = (
  select pa.id
  from public.patient_admissions pa
  where pa.organization_id=sc.organization_id
    and pa.patient_id=sc.patient_id
    and pa.admission_date <= sc.started_at::date
    and (pa.discharge_date is null or pa.discharge_date >= sc.started_at::date)
    and (pa.department_id is null or sc.department_id is null or pa.department_id=sc.department_id)
  order by (pa.department_id=sc.department_id) desc, pa.admission_date desc
  limit 1
)
where sc.admission_id is null;
