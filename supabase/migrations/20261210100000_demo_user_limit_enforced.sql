-- The Demo user limit (platform_settings.max_demo_users) is enforced by the database:
-- the edge functions counted and then inserted, so parallel invitations could pass it,
-- and the Platform Owner bypassed it in one function but not in another.
-- Every membership of a Demo counts (active, invited, disabled): a seat is freed by
-- removing the user. The account a re-sent invitation replaces (email moved to a
-- stale+…@invalid.limoxis-observer.local placeholder first) does not count.
-- The Owner raises the limit in the Platform settings.

create or replace function private.enforce_demo_user_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_is_demo boolean;
  v_max integer;
  v_count integer;
begin
  select o.is_demo into v_is_demo from public.organizations o where o.id = new.organization_id;
  if not coalesce(v_is_demo, false) then
    return new;
  end if;
  -- One insert at a time per Demo, so two invitations never both see a free seat.
  perform 1 from public.organizations o where o.id = new.organization_id for update;
  select least(20, greatest(1, coalesce(s.max_demo_users, 5))) into v_max
    from public.platform_settings s where s.id = 'global';
  v_max := coalesce(v_max, 5);
  select count(*) into v_count
    from public.organization_members m
    left join auth.users u on u.id = m.user_id
   where m.organization_id = new.organization_id
     and coalesce(u.email, '') not like 'stale+%@invalid.limoxis-observer.local';
  if v_count >= v_max then
    raise exception 'DEMO_USER_LIMIT: Το Demo επιτρέπει έως % χρήστες.', v_max
      using errcode = 'check_violation', hint = 'DEMO_USER_LIMIT';
  end if;
  return new;
end;
$function$;

create or replace trigger trg_demo_user_limit
  before insert on public.organization_members
  for each row execute function private.enforce_demo_user_limit();
