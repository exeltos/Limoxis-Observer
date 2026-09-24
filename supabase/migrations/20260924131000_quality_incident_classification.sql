-- WHO-compatible patient safety incident classification
alter table if exists public.quality_incidents
  add column if not exists incident_class text not null default 'nearMiss',
  add column if not exists reached_patient boolean not null default false,
  add column if not exists harm_occurred boolean not null default false;

comment on column public.quality_incidents.incident_class is 'WHO-aligned classification: nearMiss, noHarm, harmful.';
comment on column public.quality_incidents.reached_patient is 'Whether the incident reached the patient.';
comment on column public.quality_incidents.harm_occurred is 'Whether discernible harm occurred.';
