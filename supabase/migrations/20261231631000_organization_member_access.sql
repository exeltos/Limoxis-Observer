-- Χρήστες οργανισμού: πού βρίσκεται η πρόσβαση κάθε μέλους (προσωρινός ή δικός του κωδικός, κλείδωμα,
-- τελευταία σύνδεση). Ο Διαχειριστής Νοσοκομείου και ο Ιδιοκτήτης Πλατφόρμας μόνο· το RLS των profiles
-- δείχνει στον χρήστη μόνο τη δική του γραμμή. Μόνο προσθήκη.
create or replace function public.organization_member_access(p_organization_id uuid)
returns table(user_id uuid, must_change_password boolean, temporary_password_expires_at timestamptz, temporary_password_locked_at timestamptz, last_sign_in_at timestamptz)
language plpgsql
stable
security definer
set search_path to ''
as $fn$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not (public.current_user_is_platform_owner() or public.is_org_admin(p_organization_id)) then
    raise exception 'ORG_ADMIN_REQUIRED';
  end if;
  return query
    select m.user_id, coalesce(p.must_change_password, false), p.temporary_password_expires_at,
           p.temporary_password_locked_at, u.last_sign_in_at
      from public.organization_members m
      left join public.profiles p on p.id = m.user_id
      left join auth.users u on u.id = m.user_id
     where m.organization_id = p_organization_id;
end
$fn$;

revoke all on function public.organization_member_access(uuid) from public, anon;
grant execute on function public.organization_member_access(uuid) to authenticated;

comment on function public.organization_member_access(uuid) is 'Users of one organization: temporary or own password, lock and last sign-in of each member; its admin or the Platform Owner only.';
