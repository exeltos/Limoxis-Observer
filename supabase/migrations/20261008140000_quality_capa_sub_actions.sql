-- CAPA sub-actions and bundle-sourced CAPAs.
--
-- A corrective action usually breaks down into steps with their own owner and
-- due date (move stock, retrain staff, revise the protocol...). They are kept
-- with the CAPA itself as a jsonb array, written by the same quality managers
-- who may already write the CAPA (existing RLS), so no new table or policy.
--
-- CAPAs can now also come from a non-compliant prevention bundle assessment,
-- next to controls, incidents, findings, audits and outbreak investigations.

alter table public.quality_capa_actions
  add column if not exists sub_actions jsonb not null default '[]'::jsonb;

alter table public.quality_capa_actions drop constraint if exists quality_capa_actions_source_type_check;
alter table public.quality_capa_actions add constraint quality_capa_actions_source_type_check
  check (source_type in ('incident','finding','audit','control','bundle','other','outbreak_investigation'));
