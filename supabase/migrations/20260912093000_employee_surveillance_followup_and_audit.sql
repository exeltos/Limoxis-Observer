alter table public.employee_surveillance_records
  add column if not exists intervention text,
  add column if not exists intervention_type text,
  add column if not exists intervention_start date,
  add column if not exists intervention_end date,
  add column if not exists no_intervention boolean not null default false,
  add column if not exists no_recheck boolean not null default false,
  add column if not exists correction_reason text,
  add column if not exists timeline jsonb not null default '[]'::jsonb;
