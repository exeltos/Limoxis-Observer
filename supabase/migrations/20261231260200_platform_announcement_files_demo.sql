-- Announcements (owner, 8/11/2026, second round): an uploaded image or file instead of a link, and «show in the
-- demo too» so the owner can present an announcement in the demo hospitals (there is no real administrator there:
-- whoever is in the demo sees it, once per browser session).
alter table public.platform_announcements add column if not exists attachment_path text;
alter table public.platform_announcements add column if not exists attachment_name text;
alter table public.platform_announcements add column if not exists attachment_type text;
alter table public.platform_announcements add column if not exists show_in_demo boolean not null default false;

-- An announcement meant for the demo too is read by any signed-in user while it is active (it is product news, the
-- application shows it only inside a demo hospital).
create policy platform_announcements_demo_read on public.platform_announcements for select to authenticated
  using (show_in_demo and status = 'active' and starts_at <= now() and (ends_at is null or ends_at > now()));

-- The files: a private bucket; only the platform owner writes; signed-in users read (the application asks for a
-- signed link only for an announcement it may show).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('platform-announcements', 'platform-announcements', false, 10485760,
  array['image/jpeg','image/png','image/webp','image/gif','application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy lo_platform_announcement_files_read on storage.objects for select to authenticated
  using (bucket_id = 'platform-announcements');
create policy lo_platform_announcement_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'platform-announcements' and public.current_user_is_platform_owner());
create policy lo_platform_announcement_files_update on storage.objects for update to authenticated
  using (bucket_id = 'platform-announcements' and public.current_user_is_platform_owner())
  with check (bucket_id = 'platform-announcements' and public.current_user_is_platform_owner());
create policy lo_platform_announcement_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'platform-announcements' and public.current_user_is_platform_owner());
