-- A decision of a department meeting belongs to a topic when it came out of one («Απόφαση» on the
-- topic); one without a topic is a decision carried from the previous meeting or an older one.
alter table public.quality_department_meeting_decisions add column if not exists topic_id uuid references public.quality_department_meeting_topics(id) on delete set null;
create index if not exists quality_department_meeting_decisions_topic_idx on public.quality_department_meeting_decisions (topic_id) where topic_id is not null;
