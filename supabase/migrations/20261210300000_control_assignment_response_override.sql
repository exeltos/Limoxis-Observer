-- A control that several departments share can have different acceptable limits and different
-- «actions on deviation» in each department (e.g. the same room-temperature check with 18–25 °C in
-- one laboratory and no limit in another). The assignment carries what differs from the control's
-- own response_config; when empty, the control's values apply.
alter table public.control_assignments add column if not exists response_override jsonb;
comment on column public.control_assignments.response_override is 'This department''s own limits and deviation text (min, max, deviationActions); null = the control''s response_config.';
