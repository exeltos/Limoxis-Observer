-- FileMaker migration, step 4: the files kept in FileMaker container fields.
-- The function filemaker-import (task 'files') reads each container field below
-- through OData (the content comes inline as base64), stores the file in the
-- private bucket filemaker-staging (no storage policies: only the service role
-- reaches it, so staff health files stay closed) and lists it in fm_stage_files.
-- The task 'files_attach' later copies a listed file into the app's attachments
-- bucket and creates its attachment row, once its record exists in Limoxis.
-- Closed to browser roles like the other staging tables.

insert into storage.buckets (id, name, public)
values ('filemaker-staging', 'filemaker-staging', false)
on conflict (id) do nothing;

-- Which container fields are read, in which order, and how far each has got.
create table if not exists public.fm_stage_file_sources (
  base_table text not null references public.fm_stage_tables(base_table) on delete cascade,
  field text not null,
  position integer not null,
  title_field text,
  extra_filter text,
  filter_mode text not null default 'container' check (filter_mode in ('container', 'plain')),
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'error')),
  next_skip integer not null default 0,
  inflight_skip integer,
  records_seen integer not null default 0,
  files integer not null default 0,
  bytes bigint not null default 0,
  failures integer not null default 0,
  last_error text,
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (base_table, field)
);
comment on table public.fm_stage_file_sources is 'FileMaker migration: container fields to read and the progress of each.';

create table if not exists public.fm_stage_files (
  base_table text not null,
  field text not null,
  record_id text not null,
  fm_rowid text,
  storage_path text not null,
  mime_type text,
  size_bytes bigint not null,
  sha256 text not null,
  file_name text not null,
  duplicate_of text,
  fetched_at timestamptz not null default now(),
  attach_entity_type text,
  attach_entity_id text,
  attach_category text,
  organization_id uuid,
  attachment_id uuid,
  attached_at timestamptz,
  attach_error text,
  primary key (base_table, field, record_id),
  foreign key (base_table, field) references public.fm_stage_file_sources(base_table, field) on delete cascade
);
create index if not exists fm_stage_files_record_idx on public.fm_stage_files (base_table, record_id);
comment on table public.fm_stage_files is 'FileMaker migration: one file read from a container field, kept in the filemaker-staging bucket.';
comment on column public.fm_stage_files.duplicate_of is 'Another field of the same record holding the same file (same sha256): not stored or attached twice.';

alter table public.fm_stage_file_sources enable row level security;
alter table public.fm_stage_files enable row level security;
revoke all on public.fm_stage_file_sources, public.fm_stage_files from public, anon, authenticated;

-- Staff health files and patient forms get no title in their file name.
insert into public.fm_stage_file_sources (base_table, field, position, title_field, extra_filter)
select v.base_table, v.field, v.position, v.title_field, v.extra_filter
from (values
  ('Training Material', 'TrMat_Attach', 10, 'TrMat_Material', null),
  ('Training', 'Train_Eval_attach', 20, 'Training_Name', null),
  ('Training', 'Training_Material', 21, 'Training_Name', null),
  ('Documentation', 'Documentation Attachment', 30, 'Documentation Title', null),
  ('Documentation', 'Documentation Editable Attachment', 31, 'Documentation Title', null),
  ('Forms', 'Attachement', 40, 'Title', null),
  ('RequiredDocuments', 'Attachment 1', 50, 'Document Title', null),
  ('RequiredDocuments', 'Attachment 2', 51, 'Document Title', null),
  ('RequiredDocuments', 'Attachment 3', 52, 'Document Title', null),
  ('ANNOUNCESMENTS', 'ANNOUNCEMENT ATTACH', 60, 'ANNOUNCEMENT TITLE', null),
  ('Contacts Documents', 'Contact Doc Attach', 70, 'Contact Doc Title', null),
  ('Deviations', 'Dev attach', 80, 'Dev Title', null),
  ('Deviations', 'Dev attach 2', 81, 'Dev Title', null),
  ('Deviations', 'Dev attach 3', 82, 'Dev Title', null),
  ('Commitees_REVIEWS', 'Attached', 90, null, null),
  ('Meeting_REVIEWS', 'Attached 1', 100, null, null),
  ('Meeting_REVIEWS', 'Attached 2', 101, null, null),
  ('Controls', 'Control Atach', 110, 'ControlName', null),
  ('SubProcesses_Control', 'Control_GuideAttach', 120, 'Control Name', null),
  ('PerformedControls', 'Control Atach', 130, null, 'ControlDate ge 2023-10-19'),
  ('PerformedControls', 'Control Editable Attachment', 131, null, 'ControlDate ge 2023-10-19'),
  ('People Attachments', 'People Attachement Attach', 140, 'People Attachement Title', null),
  ('People_CertificatesCMEs', 'Attachment', 150, 'Document Type', null),
  ('People_HealthSafety', 'Attachment', 160, null, null),
  ('People_HealthRecord', 'Attachments', 170, null, null),
  ('People', 'People_Photo', 180, null, null),
  ('T14_ Dhloumena noshmata', 'epishnapsi', 190, null, null),
  ('QC Criteria Questions', 'Question Supporing Documentation', 200, 'QCCriteria Name', null),
  ('Water Analysis', 'Attach', 210, 'Title', null),
  ('Maintenance Performed', 'Image1', 220, null, null),
  ('Maintenance Performed', 'Image2', 221, null, null),
  ('Maintenance Performed', 'Image3', 222, null, null),
  ('Asset Data', 'Attach', 230, null, null),
  ('Paralaves', 'attach', 240, null, null)
) as v(base_table, field, position, title_field, extra_filter)
where exists (select 1 from public.fm_stage_tables t where t.base_table = v.base_table)
on conflict (base_table, field) do nothing;
