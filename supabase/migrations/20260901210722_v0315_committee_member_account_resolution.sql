create or replace function public.resolve_committee_member_user_id(p_organization_id uuid,p_employee_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_email text;
  v_user_id uuid;
  v_count integer;
begin
  if p_organization_id is null or p_employee_id is null then return null; end if;

  select nullif(lower(trim(e.email)),'') into v_email
  from public.employees e
  where e.id=p_employee_id and e.organization_id=p_organization_id;

  if v_email is null then return null; end if;

  select count(distinct om.user_id), (array_agg(distinct om.user_id))[1]
    into v_count,v_user_id
  from public.organization_members om
  left join public.profiles p on p.id=om.user_id
  left join auth.users u on u.id=om.user_id
  where om.organization_id=p_organization_id
    and om.status='active'
    and lower(trim(coalesce(nullif(p.contact_email,''),u.email,'')))=v_email;

  if v_count=1 then return v_user_id; end if;
  return null;
end;
$$;

revoke all on function public.resolve_committee_member_user_id(uuid,uuid) from public,anon,authenticated;
grant execute on function public.resolve_committee_member_user_id(uuid,uuid) to service_role;

create or replace function public.link_committee_member_account()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.user_id is null and new.employee_id is not null then
    new.user_id:=public.resolve_committee_member_user_id(new.organization_id,new.employee_id);
  end if;

  if new.approval_status='pending' and new.user_id is null then
    raise exception 'COMMITTEE_MEMBER_ACCOUNT_REQUIRED_FOR_PARTICIPATION_APPROVAL';
  end if;

  return new;
end;
$$;

revoke all on function public.link_committee_member_account() from public,anon,authenticated;
grant execute on function public.link_committee_member_account() to service_role;

drop trigger if exists trg_link_committee_member_account on public.committee_members;
create trigger trg_link_committee_member_account
before insert or update of organization_id,employee_id,user_id,approval_status
on public.committee_members
for each row execute function public.link_committee_member_account();

update public.committee_members cm
set user_id=public.resolve_committee_member_user_id(cm.organization_id,cm.employee_id)
where cm.user_id is null
  and cm.employee_id is not null
  and public.resolve_committee_member_user_id(cm.organization_id,cm.employee_id) is not null;
