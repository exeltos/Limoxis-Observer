-- A register field can be required only from a date on: older cases, kept
-- before the hospital recorded that value, stay valid without it.
alter table public.department_register_fields add column if not exists required_from date;
