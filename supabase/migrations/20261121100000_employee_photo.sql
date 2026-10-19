-- Employee photo: one image per employee, kept in the private `attachments`
-- bucket under `<org>/employee_photo/<employee uuid>/<file>` and pointed to by
-- employees.photo_path. Colleagues in the organisation may see it (a staff
-- directory): the existing org-member read policy of the bucket covers it.
-- Uploading or removing a photo needs the same rights as editing the employee
-- (employees_update_authorized), enforced by restrictive guards so the bucket's
-- generic "any member may upload" policy does not apply to this folder.

alter table public.employees add column if not exists photo_path text;

alter table public.employees add constraint employees_photo_path_scope check (
  photo_path is null
  or photo_path like (organization_id::text || '/employee_photo/' || id::text || '/%')
);

comment on column public.employees.photo_path is
  'Storage path of the employee photo in the attachments bucket (<org>/employee_photo/<employee id>/<file>).';

create policy attachments_storage_employee_photo_insert_guard on storage.objects
  as restrictive for insert to authenticated
  with check (
    bucket_id <> 'attachments'
    or coalesce((storage.foldername(name))[2], '') <> 'employee_photo'
    or (
      coalesce((storage.foldername(name))[3], '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and exists (
        select 1 from public.employees e
        where e.id = ((storage.foldername(name))[3])::uuid
          and e.organization_id = ((storage.foldername(name))[1])::uuid
      )
      and (
        public.current_user_is_platform_owner()
        or public.is_org_admin(((storage.foldername(name))[1])::uuid)
        or public.current_user_has_org_role(((storage.foldername(name))[1])::uuid, array['hr_office'::public.app_role])
        or public.current_user_has_capability(((storage.foldername(name))[1])::uuid, 'manage_staff_admin')
      )
    )
  );

create policy attachments_storage_employee_photo_delete_guard on storage.objects
  as restrictive for delete to authenticated
  using (
    bucket_id <> 'attachments'
    or coalesce((storage.foldername(name))[2], '') <> 'employee_photo'
    or public.current_user_is_platform_owner()
    or public.is_org_admin(((storage.foldername(name))[1])::uuid)
    or public.current_user_has_org_role(((storage.foldername(name))[1])::uuid, array['hr_office'::public.app_role])
    or public.current_user_has_capability(((storage.foldername(name))[1])::uuid, 'manage_staff_admin')
  );

-- The bucket's generic delete policy only lets the uploader or an org admin
-- remove a file; whoever may edit employees may also replace or remove a photo
-- another editor uploaded.
create policy attachments_storage_employee_photo_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'attachments'
    and coalesce((storage.foldername(name))[2], '') = 'employee_photo'
    and (
      public.current_user_is_platform_owner()
      or public.is_org_admin(((storage.foldername(name))[1])::uuid)
      or public.current_user_has_org_role(((storage.foldername(name))[1])::uuid, array['hr_office'::public.app_role])
      or public.current_user_has_capability(((storage.foldername(name))[1])::uuid, 'manage_staff_admin')
    )
  );
