-- The completed EODY form is attached to its notifiable disease report
-- (entity_type 'notifiable_disease_report'). The generic attachment policies let
-- any member of the hospital in; these restrictive guards narrow the files to
-- those who can see the report itself (the report's own RLS decides, since the
-- EXISTS runs as the user).

create or replace function private.can_see_notifiable_report(p_org uuid, p_id text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select p_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and exists (select 1 from public.notifiable_disease_reports r where r.id = p_id::uuid and r.organization_id = p_org)
$$;

grant execute on function private.can_see_notifiable_report(uuid, text) to authenticated;

create policy attachments_notifiable_read_guard on public.attachments
  as restrictive for select to authenticated
  using (entity_type <> 'notifiable_disease_report' or private.can_see_notifiable_report(organization_id, entity_id));

create policy attachments_notifiable_insert_guard on public.attachments
  as restrictive for insert to authenticated
  with check (entity_type <> 'notifiable_disease_report' or private.can_see_notifiable_report(organization_id, entity_id));

create policy attachments_notifiable_update_guard on public.attachments
  as restrictive for update to authenticated
  using (entity_type <> 'notifiable_disease_report' or private.can_see_notifiable_report(organization_id, entity_id))
  with check (entity_type <> 'notifiable_disease_report' or private.can_see_notifiable_report(organization_id, entity_id));

create policy attachments_storage_notifiable_read_guard on storage.objects
  as restrictive for select to authenticated
  using (bucket_id <> 'attachments' or coalesce((storage.foldername(name))[2], '') <> 'notifiable_disease_report'
    or private.can_see_notifiable_report(((storage.foldername(name))[1])::uuid, (storage.foldername(name))[3]));

create policy attachments_storage_notifiable_insert_guard on storage.objects
  as restrictive for insert to authenticated
  with check (bucket_id <> 'attachments' or coalesce((storage.foldername(name))[2], '') <> 'notifiable_disease_report'
    or private.can_see_notifiable_report(((storage.foldername(name))[1])::uuid, (storage.foldername(name))[3]));

create policy attachments_storage_notifiable_delete_guard on storage.objects
  as restrictive for delete to authenticated
  using (bucket_id <> 'attachments' or coalesce((storage.foldername(name))[2], '') <> 'notifiable_disease_report'
    or private.can_see_notifiable_report(((storage.foldername(name))[1])::uuid, (storage.foldername(name))[3]));
