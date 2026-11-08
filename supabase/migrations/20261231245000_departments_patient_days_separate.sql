-- Κλινοημέρες (owner, 8/11/2026): a department whose patient days are counted apart from the hospital's total
-- (e.g. Παιδιατρική, ΜΕΘ Παίδων). The hospital's rates per 1,000 patient days leave out its cases, so numerator and
-- denominator cover the same patients; the department's own rates use its own patient days.
alter table public.departments add column if not exists patient_days_separate boolean not null default false;
comment on column public.departments.patient_days_separate is 'Patient days counted apart from the hospital total: the department''s cases are left out of the hospital''s rates per 1,000 patient days.';

-- The hospital's patient-day measures (indicator_metric_snapshot, hospital scope): the cases of such departments are left
-- out of the numerators that go over patient days (active surveillance, resistant surveillance, MDR bacteraemia,
-- bacteraemia, MDR isolations), and their own patient-day rows are not added to the hospital's total.
do $$
declare def text;
begin
  select pg_get_functiondef('private.indicator_metric_snapshot(uuid,date,date,uuid)'::regprocedure) into def;
  if position('patient_days_separate' in def) > 0 then return; end if;
  -- the hospital's patient days: its own rows, or (none for the period) the departments counted in its total
  def := replace(def,
    'else pp.department_id=p_department_id end)',
    'else pp.department_id=p_department_id end) and (p_department_id is not null or pp.department_id is null or not exists (select 1 from public.departments dx where dx.id=pp.department_id and dx.patient_days_separate))');
  -- surveillance (twice: active, resistant)
  def := replace(def,
    'and (p_department_id is null or s.department_id=p_department_id)',
    'and (p_department_id is null or s.department_id=p_department_id) and (p_department_id is not null or s.department_id is null or not exists (select 1 from public.departments dx where dx.id=s.department_id and dx.patient_days_separate))');
  -- laboratory samples over patient days (MDR bacteraemia, bacteraemia, MDR isolations); the susceptibility and
  -- «microbiology results in period» counts are not rates over patient days and keep every department
  def := replace(def,
    E'and (p_department_id is null or l.department_id=p_department_id)\n    and coalesce(l.subject_type,''patient'')=''patient''',
    E'and (p_department_id is null or l.department_id=p_department_id) and (p_department_id is not null or l.department_id is null or not exists (select 1 from public.departments dx where dx.id=l.department_id and dx.patient_days_separate))\n    and coalesce(l.subject_type,''patient'')=''patient''');
  def := replace(def,
    'and l.collected_at::date between p_from and p_to and (p_department_id is null or l.department_id=p_department_id)
    and m.result_status=''positive'' and m.validation_status in (''validated'',''amended'')
    and not exists(select 1 from public.microbiology_results m2 where m2.organization_id=m.organization_id and m2.amended_from=m.id)
    and not private.mdr_excluded_organism(m.organism)',
    'and l.collected_at::date between p_from and p_to and (p_department_id is null or l.department_id=p_department_id) and (p_department_id is not null or l.department_id is null or not exists (select 1 from public.departments dx where dx.id=l.department_id and dx.patient_days_separate))
    and m.result_status=''positive'' and m.validation_status in (''validated'',''amended'')
    and not exists(select 1 from public.microbiology_results m2 where m2.organization_id=m.organization_id and m2.amended_from=m.id)
    and not private.mdr_excluded_organism(m.organism)');
  execute def;
end $$;
