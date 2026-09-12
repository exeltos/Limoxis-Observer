create or replace function public.sync_committee_member_addon(p_organization_id uuid,p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_membership_id uuid;
  v_has_committee_membership boolean;
begin
  if p_organization_id is null or p_user_id is null then return; end if;

  select om.id into v_membership_id
  from public.organization_members om
  where om.organization_id=p_organization_id
    and om.user_id=p_user_id
    and om.status='active'
  order by om.created_at asc
  limit 1;

  if v_membership_id is null then return; end if;

  select exists(
    select 1
    from public.committee_members cm
    where cm.organization_id=p_organization_id
      and cm.user_id=p_user_id
      and cm.ended_at is null
      and cm.approval_status in ('approved','not_required')
  ) into v_has_committee_membership;

  if v_has_committee_membership then
    insert into public.organization_member_capabilities(membership_id,capability,granted_by)
    values(v_membership_id,'committee_member',null)
    on conflict (membership_id,capability) do nothing;
  else
    delete from public.organization_member_capabilities
    where membership_id=v_membership_id
      and capability='committee_member'
      and granted_by is null;
  end if;
end;
$$;

revoke all on function public.sync_committee_member_addon(uuid,uuid) from public,anon,authenticated;
grant execute on function public.sync_committee_member_addon(uuid,uuid) to service_role;

create or replace function public.sync_committee_member_addon_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op='DELETE' then
    perform public.sync_committee_member_addon(old.organization_id,old.user_id);
    return old;
  end if;

  if tg_op='UPDATE' and (old.organization_id is distinct from new.organization_id or old.user_id is distinct from new.user_id) then
    perform public.sync_committee_member_addon(old.organization_id,old.user_id);
  end if;

  perform public.sync_committee_member_addon(new.organization_id,new.user_id);
  return new;
end;
$$;

revoke all on function public.sync_committee_member_addon_trigger() from public,anon,authenticated;
grant execute on function public.sync_committee_member_addon_trigger() to service_role;

drop trigger if exists trg_sync_committee_member_addon on public.committee_members;
create trigger trg_sync_committee_member_addon
after insert or update of user_id,approval_status,ended_at,organization_id or delete
on public.committee_members
for each row execute function public.sync_committee_member_addon_trigger();

do $$
declare r record;
begin
  for r in
    select distinct organization_id,user_id
    from public.committee_members
    where user_id is not null
  loop
    perform public.sync_committee_member_addon(r.organization_id,r.user_id);
  end loop;
end $$;
