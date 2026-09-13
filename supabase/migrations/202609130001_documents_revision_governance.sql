-- Limoxis Observer
-- Controlled-document revision governance metadata.

alter table public.controlled_documents
  add column if not exists revision_reason text,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id) on delete set null;

comment on column public.controlled_documents.revision_reason is
  'Required business reason recorded when a new revision is created.';
comment on column public.controlled_documents.approved_at is
  'Timestamp at which this document version entered approved state.';
comment on column public.controlled_documents.approved_by is
  'User who approved this document version.';
