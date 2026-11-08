-- Κλινοημέρες (owner, 8/11/2026): only the departments that keep patient days (the wards) are listed in the form, not
-- every department of the hospital (e.g. not the transport office). The overview compares these departments.
alter table public.departments add column if not exists patient_days_tracked boolean not null default false;
comment on column public.departments.patient_days_tracked is 'The department keeps patient days (a ward): listed in Κλινοημέρες and compared in the hospital overview.';
-- A department counted apart from the hospital total, or with patient days already entered, keeps them.
update public.departments d set patient_days_tracked = true
where not d.patient_days_tracked and (d.patient_days_separate or exists (select 1 from public.patient_day_periods p where p.department_id = d.id));
