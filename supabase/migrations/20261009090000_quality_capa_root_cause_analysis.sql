-- Root cause analysis on a CAPA: 5 Whys and an Ishikawa (fishbone) diagram.
--
-- Stored as one jsonb document: { problem, whys: [text], causes: { people,
-- methods, equipment, materials, environment, communication: [text] },
-- rootCause, method, updatedAt, updatedBy }. Read and written with the CAPA
-- under its existing row-level security; nothing else changes.

alter table public.quality_capa_actions
  add column if not exists root_cause_analysis jsonb;

comment on column public.quality_capa_actions.root_cause_analysis is
  'Root cause analysis of the CAPA (5 Whys and Ishikawa categories), as a jsonb document.';
