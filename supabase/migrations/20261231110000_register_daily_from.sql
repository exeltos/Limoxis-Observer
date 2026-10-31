-- Από ποια ημερομηνία ένα φύλλο καταχωρείται ανά ημέρα (πριν: ένα σύνολο τον μήνα). Κενό = 1/11/2026.
alter table public.department_registers add column if not exists daily_from date;
comment on column public.department_registers.daily_from is 'Sheet registers: the day from which entries are one per day; earlier ones are monthly totals on the first day of their month. Empty = 2026-11-01.';
