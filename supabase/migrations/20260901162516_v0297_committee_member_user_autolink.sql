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
      where om.organization_id=new.organization_id and om.user_id=new.user_id and om.status='active'
    ) then
      raise exception 'COMMITTEE_MEMBER_USER_NOT_IN_ORGANIZATION';
    end if;
    return new;
  end if;
  if new.employee_id is null then return new; end if;
  select e.email into employee_email from public.employees e where e.id=new.employee_id and e.organization_id=new.organization_id;
  if employee_email is null or btrim(employee_email)='' then return new; end if;
  select u.id into matched_user
  from auth.users u
  join public.organization_members om on om.user_id=u.id and om.organization_id=new.organization_id and om.status='active'
  where lower(u.email)=lower(employee_email)
  order by om.created_at asc
  limit 1;
  new.user_id:=matched_user;
  return new;
end;
$$;
revoke all on function public.autolink_committee_member_user() from public, anon, authenticated;
drop trigger if exists committee_member_user_autolink on public.committee_members;
create trigger committee_member_user_autolink before insert or update of employee_id,user_id,organization_id on public.committee_members for each row execute function public.autolink_committee_member_user();
