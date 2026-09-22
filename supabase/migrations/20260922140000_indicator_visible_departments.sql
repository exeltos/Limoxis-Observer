-- Lets an org admin curate which departments see a given indicator, instead
-- of every indicator being shown to every department-scoped viewer. An
-- empty array (the default) means "visible to every department", matching
-- today's behavior for all existing rows.
alter table public.indicator_definitions
  add column if not exists visible_department_ids jsonb not null default '[]'::jsonb;
