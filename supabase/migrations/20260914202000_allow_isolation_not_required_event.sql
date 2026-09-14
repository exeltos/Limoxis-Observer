alter table public.surveillance_events drop constraint if exists surveillance_events_event_type_check;
alter table public.surveillance_events add constraint surveillance_events_event_type_check check (
  event_type = any (array[
    'surveillance_start'::text,
    'surveillance_reopen'::text,
    'surveillance_close'::text,
    'clinical_assessment'::text,
    'sample'::text,
    'resistance_classification'::text,
    'antimicrobial_therapy'::text,
    'isolation'::text,
    'isolation_not_required'::text,
    'reassessment'::text,
    'outcome'::text
  ])
);
