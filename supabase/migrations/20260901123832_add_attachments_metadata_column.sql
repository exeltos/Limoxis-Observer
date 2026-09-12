-- AttachmentField's UI already collects a category and free-text description
-- per file (see src/design-system/AttachmentField.jsx) — public.attachments
-- had no column to hold either.
alter table public.attachments add column if not exists metadata jsonb not null default '{}'::jsonb;
