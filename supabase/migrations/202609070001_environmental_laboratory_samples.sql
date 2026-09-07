-- Allow laboratory samples that belong to environmental surveillance rather than a patient episode.
-- Patient and surveillance-case references remain required for patient samples at application level,
-- while environmental samples can be stored with both references null.

alter table public.laboratory_samples
  alter column patient_id drop not null,
  alter column surveillance_case_id drop not null;

comment on column public.laboratory_samples.patient_id is
  'Patient reference. Null for water, surface and other environmental samples.';

comment on column public.laboratory_samples.surveillance_case_id is
  'Clinical surveillance case reference. Null for standalone environmental samples.';
