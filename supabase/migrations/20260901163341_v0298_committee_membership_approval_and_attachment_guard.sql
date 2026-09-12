create or replace function public.answer_committee_membership(p_member_id uuid, p_status text)
returns public.committee_members
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.committee_members;
begin
  if p_status not in ('approved','rejected') then
    raise exception 'INVALID_COMMITTEE_MEMBERSHIP_APPROVAL_STATUS';
  end if;

  select * into v_member
  from public.committee_members
  where id = p_member_id
    and user_id = auth.uid()
    and approval_status = 'pending'
    and ended_at is null
  for update;

  if not found then
    raise exception 'COMMITTEE_MEMBERSHIP_APPROVAL_NOT_AVAILABLE';
  end if;

  update public.committee_members
  set approval_status = p_status,
      updated_at = now()
  where id = p_member_id
  returning * into v_member;

  insert into public.committee_history(organization_id, committee_id, action, reason, event_data, actor_id)
  values (
    v_member.organization_id,
    v_member.committee_id,
    case when p_status='approved' then 'Έγκριση συμμετοχής μέλους' else 'Απόρριψη συμμετοχής μέλους' end,
    v_member.member_name,
    jsonb_build_object('member_id',v_member.id,'status',p_status),
    auth.uid()
  );

  return v_member;
end;
$$;

revoke all on function public.answer_committee_membership(uuid,text) from public, anon;
grant execute on function public.answer_committee_membership(uuid,text) to authenticated;

-- Existing generic attachment policies are intentionally broad for legacy modules.
-- Add restrictive guards only for committee_document records so committee RLS
-- cannot be bypassed through the generic attachment service.
create policy attachments_committee_read_guard
on public.attachments
as restrictive
for select
to authenticated
using (
  entity_type <> 'committee_document'
  or (
    entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and public.current_user_can_view_committee(organization_id, entity_id::uuid)
  )
);

create policy attachments_committee_insert_guard
on public.attachments
as restrictive
for insert
to authenticated
with check (
  entity_type <> 'committee_document'
  or (
    entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and public.current_user_can_manage_committee(organization_id, entity_id::uuid, 'manage_committee_documents')
  )
);

create policy attachments_committee_update_guard
on public.attachments
as restrictive
for update
to authenticated
using (
  entity_type <> 'committee_document'
  or (
    entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and public.current_user_can_manage_committee(organization_id, entity_id::uuid, 'manage_committee_documents')
  )
)
with check (
  entity_type <> 'committee_document'
  or (
    entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and public.current_user_can_manage_committee(organization_id, entity_id::uuid, 'manage_committee_documents')
  )
);

create policy attachments_storage_committee_read_guard
on storage.objects
as restrictive
for select
to authenticated
using (
  bucket_id <> 'attachments'
  or coalesce((storage.foldername(name))[2],'') <> 'committee_document'
  or (
    coalesce((storage.foldername(name))[3],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and public.current_user_can_view_committee(
      ((storage.foldername(name))[1])::uuid,
      ((storage.foldername(name))[3])::uuid
    )
  )
);

create policy attachments_storage_committee_insert_guard
on storage.objects
as restrictive
for insert
to authenticated
with check (
  bucket_id <> 'attachments'
  or coalesce((storage.foldername(name))[2],'') <> 'committee_document'
  or (
    coalesce((storage.foldername(name))[3],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and public.current_user_can_manage_committee(
      ((storage.foldername(name))[1])::uuid,
      ((storage.foldername(name))[3])::uuid,
      'manage_committee_documents'
    )
  )
);

create policy attachments_storage_committee_delete_guard
on storage.objects
as restrictive
for delete
to authenticated
using (
  bucket_id <> 'attachments'
  or coalesce((storage.foldername(name))[2],'') <> 'committee_document'
  or (
    coalesce((storage.foldername(name))[3],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and public.current_user_can_manage_committee(
      ((storage.foldername(name))[1])::uuid,
      ((storage.foldername(name))[3])::uuid,
      'manage_committee_documents'
    )
  )
);
