-- Quality intake: a staff member submits a neutral report first.
-- Quality later classifies it as a clinical/non-clinical incident, complaint,
-- suggestion, and may create a linked finding (deviation) when applicable.

alter table public.quality_incidents
  drop constraint if exists quality_incidents_report_kind_check;

alter table public.quality_incidents
  add constraint quality_incidents_report_kind_check
  check (report_kind = any (array[
    'report'::text,
    'clinical'::text,
    'nonClinical'::text,
    'complaint'::text,
    'suggestion'::text
  ]));

comment on column public.quality_incidents.report_kind is
  'Intake/classification kind. report = submitted by staff and not yet classified by Quality; classified values are clinical, nonClinical, complaint, suggestion.';
