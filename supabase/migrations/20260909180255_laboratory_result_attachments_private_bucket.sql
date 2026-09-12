insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('laboratory-attachments','laboratory-attachments',false,10485760,array['application/pdf','image/jpeg','image/png'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

do $$ declare r record; begin
 for r in select policyname from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'lo_lab_attachments_%' loop
  execute format('drop policy if exists %I on storage.objects',r.policyname);
 end loop;
end $$;

create policy lo_lab_attachments_read on storage.objects
for select to authenticated
using (
 bucket_id='laboratory-attachments'
 and (select private.next_has_capability((storage.foldername(name))[1]::uuid,'laboratory.view'))
);

create policy lo_lab_attachments_insert on storage.objects
for insert to authenticated
with check (
 bucket_id='laboratory-attachments'
 and (select private.next_has_capability((storage.foldername(name))[1]::uuid,'laboratory.manage'))
);
