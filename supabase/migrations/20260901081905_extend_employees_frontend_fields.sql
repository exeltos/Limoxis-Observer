-- Wiring the Employees frontend to the real employees table surfaced a gap:
-- the live table (v0.9.0) only ever modeled first_name/last_name plus FK-based
-- department_id/professional_category_id. The frontend UI (EmployeeCreatePage.jsx)
-- collects father_name, bilingual (EL/EN) first/last names, and birth_date —
-- none of which exist on the live table.
--
-- department_id/professional_category_id are deliberately NOT being populated by
-- this pass: the live departments/master_library_items tables have zero rows for
-- any organization today, and the frontend's department/profession pickers
-- currently source from a local demo library, not those real tables. Properly
-- wiring the picker to real, org-managed department/library rows is a separate,
-- larger follow-up (seeding + a management UI for it) — forcing it now would
-- leave the Employees create form with empty, unusable dropdowns. Storing the
-- picked label as plain text preserves 100% of current frontend behavior while
-- still being real, persisted, per-organization data.
alter table public.employees
  add column if not exists father_name text,
  add column if not exists first_name_en text,
  add column if not exists last_name_en text,
  add column if not exists birth_date date,
  add column if not exists department_name text,
  add column if not exists department_name_en text,
  add column if not exists profession_name text,
  add column if not exists profession_name_en text;
