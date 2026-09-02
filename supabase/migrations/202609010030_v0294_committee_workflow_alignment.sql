-- Committee workflow alignment for the Supabase-backed Committee workspace.
-- This migration is intentionally idempotent because the live project received
-- the same hardening in staged migrations during the production audit.

alter table public.committees add column if not exists committee_role text;

alter table public.committee_members
  add column if not exists client_key text,
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

alter table public.committee_meetings
  add column if not exists client_key text,
  add column if not exists meeting_type text not null default 'regular',
  add column if not exists location text;

alter table public.committee_meeting_attendance add column if not exists client_key text;

alter table public.committee_decisions
  add column if not exists client_key text,
  add column if not exists topic_key text,
  add column if not exists owner_label text;

alter table public.committee_plan_items
  add column if not exists client_key text,
  add column if not exists owner_label text;

create unique index if not exists committee_members_committee_client_key_uq
  on public.committee_members(committee_id,client_key) where client_key is not null;
create index if not exists committee_members_user_id_idx
  on public.committee_members(user_id) where user_id is not null;
create unique index if not exists committee_meetings_committee_client_key_uq
  on public.committee_meetings(committee_id,client_key) where client_key is not null;
create unique index if not exists committee_attendance_meeting_client_key_uq
  on public.committee_meeting_attendance(meeting_id,client_key) where client_key is not null;
create unique index if not exists committee_decisions_committee_client_key_uq
  on public.committee_decisions(committee_id,client_key) where client_key is not null;
create unique index if not exists committee_plan_items_committee_client_key_uq
  on public.committee_plan_items(committee_id,client_key) where client_key is not null;

do $$ begin
  alter table public.committee_meetings add constraint committee_meetings_meeting_type_check
    check (meeting_type in ('regular','extraordinary'));
exception when duplicate_object then null; end $$;

create or replace function public.autolink_committee_member_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  employee_email text;
  matched_user uuid;
begin
  if new.user_id is not null then
    if not exists (
      select 1 from public.organization_members om
      where om.organization_id=new.organization_id
        and om.user_id=new.user_id
        and om.status='active'
    ) then
      raise exception 'COMMITTEE_MEMBER_USER_NOT_IN_ORGANIZATION';
    end if;
    return new;
  end if;

  if new.employee_id is null then return new; end if;
  select e.email into employee_email
  from public.employees e
  where e.id=new.employee_id and e.organization_id=new.organization_id;
  if employee_email is null or btrim(employee_email)='' then return new; end if;

  select u.id into matched_user
  from auth.users u
  join public.organization_members om
    on om.user_id=u.id
   and om.organization_id=new.organization_id
   and om.status='active'
  where lower(u.email)=lower(employee_email)
  order by om.created_at asc
  limit 1;

  new.user_id:=matched_user;
  return new;
end;
$$;

drop trigger if exists committee_member_user_autolink on public.committee_members;
create trigger committee_member_user_autolink
before insert or update of employee_id,user_id,organization_id
on public.committee_members
for each row execute function public.autolink_committee_member_user();

create or replace function public.answer_committee_membership(p_member_id uuid,p_status text)
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
  where id=p_member_id
    and user_id=auth.uid()
    and approval_status='pending'
    and ended_at is null
  for update;
  if not found then raise exception 'COMMITTEE_MEMBERSHIP_APPROVAL_NOT_AVAILABLE'; end if;

  update public.committee_members
  set approval_status=p_status,updated_at=now()
  where id=p_member_id
  returning * into v_member;

  insert into public.committee_history(organization_id,committee_id,action,reason,event_data,actor_id)
  values(v_member.organization_id,v_member.committee_id,
    case when p_status='approved' then 'Έγκριση συμμετοχής μέλους' else 'Απόρριψη συμμετοχής μέλους' end,
    v_member.member_name,jsonb_build_object('member_id',v_member.id,'status',p_status),auth.uid());
  return v_member;
end;
$$;
revoke all on function public.answer_committee_membership(uuid,text) from public,anon;
grant execute on function public.answer_committee_membership(uuid,text) to authenticated;

create or replace function public.finalize_committee_meeting_after_approvals()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status='approved' and old.status is distinct from new.status then
    if not exists (
      select 1 from public.committee_minutes_approvals a
      where a.meeting_id=new.meeting_id and a.status not in ('approved','cancelled')
    ) and exists (
      select 1 from public.committee_minutes_approvals a
      where a.meeting_id=new.meeting_id and a.status='approved'
    ) then
      update public.committee_meetings
      set status='finalized',finalized_at=coalesce(finalized_at,now()),
          finalized_by=coalesce(finalized_by,new.approver_id),updated_at=now()
      where id=new.meeting_id and committee_id=new.committee_id
        and organization_id=new.organization_id and status='approval_pending';
      if found then
        insert into public.committee_history(committee_id,organization_id,action,reason,event_data,actor_id)
        values(new.committee_id,new.organization_id,'Οριστικοποίηση πρακτικών',
          'Όλες οι απαιτούμενες εγκρίσεις ολοκληρώθηκαν',
          jsonb_build_object('meeting_id',new.meeting_id,'auto_finalized',true),new.approver_id);
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists committee_minutes_auto_finalize on public.committee_minutes_approvals;
create trigger committee_minutes_auto_finalize
after update of status on public.committee_minutes_approvals
for each row execute function public.finalize_committee_meeting_after_approvals();

-- Restrictive policies keep the legacy generic attachment service from bypassing
-- committee-specific authorization. Existing permissive policies still govern
-- every other attachment entity type.
drop policy if exists attachments_committee_read_guard on public.attachments;
create policy attachments_committee_read_guard on public.attachments as restrictive
for select to authenticated using (
  entity_type <> 'committee_document' or (
    entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and public.current_user_can_view_committee(organization_id,entity_id::uuid)
  )
);

drop policy if exists attachments_committee_insert_guard on public.attachments;
create policy attachments_committee_insert_guard on public.attachments as restrictive
for insert to authenticated with check (
  entity_type <> 'committee_document' or (
    entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and public.current_user_can_manage_committee(organization_id,entity_id::uuid,'manage_committee_documents')
  )
);

drop policy if exists attachments_committee_update_guard on public.attachments;
create policy attachments_committee_update_guard on public.attachments as restrictive
for update to authenticated
using (
  entity_type <> 'committee_document' or (
    entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and public.current_user_can_manage_committee(organization_id,entity_id::uuid,'manage_committee_documents')
  )
)
with check (
  entity_type <> 'committee_document' or (
    entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and public.current_user_can_manage_committee(organization_id,entity_id::uuid,'manage_committee_documents')
  )
);

drop policy if exists attachments_storage_committee_read_guard on storage.objects;
create policy attachments_storage_committee_read_guard on storage.objects as restrictive
for select to authenticated using (
  bucket_id <> 'attachments' or coalesce((storage.foldername(name))[2],'') <> 'committee_document' or (
    coalesce((storage.foldername(name))[3],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and public.current_user_can_view_committee(((storage.foldername(name))[1])::uuid,((storage.foldername(name))[3])::uuid)
  )
);

drop policy if exists attachments_storage_committee_insert_guard on storage.objects;
create policy attachments_storage_committee_insert_guard on storage.objects as restrictive
for insert to authenticated with check (
  bucket_id <> 'attachments' or coalesce((storage.foldername(name))[2],'') <> 'committee_document' or (
    coalesce((storage.foldername(name))[3],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and public.current_user_can_manage_committee(((storage.foldername(name))[1])::uuid,((storage.foldername(name))[3])::uuid,'manage_committee_documents')
  )
);

drop policy if exists attachments_storage_committee_delete_guard on storage.objects;
create policy attachments_storage_committee_delete_guard on storage.objects as restrictive
for delete to authenticated using (
  bucket_id <> 'attachments' or coalesce((storage.foldername(name))[2],'') <> 'committee_document' or (
    coalesce((storage.foldername(name))[3],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and public.current_user_can_manage_committee(((storage.foldername(name))[1])::uuid,((storage.foldername(name))[3])::uuid,'manage_committee_documents')
  )
);