-- Επαναφορά Demo από τον ίδιο τον αξιολογητή: κάθε ενεργό μέλος ενός Demo
-- νοσοκομείου (με ενεργή, μη ληγμένη πρόσβαση) μπορεί να σβήσει τα δεδομένα
-- του δικού του Demo και να ξαναγράψει το πακέτο δεδομένων Demo. Τα άλλα Demo
-- και τα νοσοκομεία παραγωγής δεν αγγίζονται (η demo_wipe_data αρνείται κάθε
-- οργανισμό που δεν είναι Demo).

-- Ο αξιολογητής είναι ο ίδιος μέλος επιτροπών του Demo· το σβήσιμο των δικών
-- του θέσεων κατά την επαναφορά δεν είναι αλλαγή δικαιωμάτων. Επιτρέπεται μόνο
-- μέσα στην επαναφορά (limoxis.test_reset) και μόνο σε Demo οργανισμό.
create or replace function public.prevent_self_member_capability_change()
returns trigger language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare
  target_membership_id uuid;
  target_user_id uuid;
  target_organization_id uuid;
begin
  target_membership_id := coalesce(new.membership_id, old.membership_id);
  select om.user_id, om.organization_id into target_user_id, target_organization_id
  from public.organization_members om
  where om.id = target_membership_id;

  if auth.uid() is not null and target_user_id = auth.uid() then
    if coalesce(current_setting('limoxis.test_reset', true), '') = 'on'
       and exists (select 1 from public.organizations o where o.id = target_organization_id and o.is_demo) then
      return coalesce(new, old);
    end if;
    raise exception 'SELF_PRIVILEGE_CHANGE_FORBIDDEN'
      using errcode = '42501';
  end if;

  return coalesce(new, old);
end;
$function$;
create or replace function public.demo_reset_my_organization(p_organization_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  v_result jsonb;
  v_member record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations o where o.id = p_organization_id and o.is_demo) then
    raise exception 'Only Demo organizations can be reset' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_platform_owner, false)
  ) then
    if not exists (
      select 1 from public.organization_members om
      where om.organization_id = p_organization_id and om.user_id = auth.uid() and om.status = 'active'
    ) then
      raise exception 'Not a member of this Demo' using errcode = '42501';
    end if;
    if exists (
      select 1 from public.platform_demo_entitlements e
      where e.organization_id = p_organization_id
        and (e.status <> 'active' or (e.valid_until is not null and e.valid_until < current_date))
    ) then
      raise exception 'The Demo is not active' using errcode = '42501';
    end if;
  end if;
  -- Μία επαναφορά τη φορά για κάθε Demo.
  perform pg_advisory_xact_lock(hashtext('demo_reset:' || p_organization_id::text));
  perform private.demo_wipe_data(p_organization_id);
  v_result := private.demo_seed_data(p_organization_id, auth.uid());
  perform set_config('limoxis.test_reset', 'on', true);
  for v_member in
    select om.user_id from public.organization_members om
    where om.organization_id = p_organization_id and om.status = 'active' and om.user_id is not null
  loop
    perform private.demo_seed_governance_member(p_organization_id, v_member.user_id);
  end loop;
  return v_result;
end;
$function$;
revoke all on function public.demo_reset_my_organization(uuid) from public, anon;
grant execute on function public.demo_reset_my_organization(uuid) to authenticated;
