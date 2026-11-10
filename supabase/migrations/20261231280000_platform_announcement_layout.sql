-- Announcements (owner, 10/11/2026): the image can sit above, below, left or right of the text, and an announcement can
-- carry an attached file (PDF, Word, PowerPoint, Excel) next to its image. Only new columns; nothing is changed or removed.
-- A file an older announcement kept in attachment_* is read by the application as its attached file.
alter table public.platform_announcements add column if not exists image_position text not null default 'top'
  check (image_position in ('top', 'left', 'right', 'bottom'));
alter table public.platform_announcements add column if not exists document_path text;
alter table public.platform_announcements add column if not exists document_name text;
alter table public.platform_announcements add column if not exists document_type text;
