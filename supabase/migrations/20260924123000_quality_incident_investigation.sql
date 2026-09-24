-- Quality Center incident investigation fields
alter table if exists public.quality_incidents
  add column if not exists category text not null default 'clinical',
  add column if not exists event_time time,
  add column if not exists impact text not null default 'none',
  add column if not exists immediate_actions text,
  add column if not exists root_cause text,
  add column if not exists contributing_factors text;

comment on column public.quality_incidents.category is 'Incident classification used by the Quality Center workflow.';
comment on column public.quality_incidents.impact is 'Actual or potential impact classification.';
comment on column public.quality_incidents.immediate_actions is 'Containment and immediate response actions.';
comment on column public.quality_incidents.root_cause is 'Documented root cause after investigation.';
comment on column public.quality_incidents.contributing_factors is 'Contributing factors identified during investigation.';
