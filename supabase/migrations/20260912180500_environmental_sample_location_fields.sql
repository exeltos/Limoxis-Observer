alter table public.laboratory_samples
  add column if not exists location text,
  add column if not exists point text,
  add column if not exists environmental_batch_id text;

comment on column public.laboratory_samples.location is 'Environmental surveillance: sampled location/area (e.g. ward, room). Free text, subject_type=environment only.';
comment on column public.laboratory_samples.point is 'Environmental surveillance: specific sampling point within the location (e.g. bed rail, tap). Free text, subject_type=environment only.';
comment on column public.laboratory_samples.environmental_batch_id is 'Client-generated tag grouping environmental samples created together in one bulk submission. Not a foreign key.';
