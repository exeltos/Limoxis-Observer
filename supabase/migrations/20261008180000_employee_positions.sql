-- Job position on the employee record.
--
-- Positions are the hospital's own list (master_library_items, library_key
-- 'positions', managed in Management > Libraries like departments). The
-- employee keeps the chosen name, as it already does for the professional
-- category (profession_name), so renaming a library entry does not rewrite
-- history. Training requirements can then target positions as well as
-- categories and departments.

alter table public.employees
  add column if not exists position_name text,
  add column if not exists position_name_en text;
