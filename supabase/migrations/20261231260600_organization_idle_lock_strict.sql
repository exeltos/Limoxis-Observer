-- Κλείδωμα οθόνης αυστηρό (Ιδιοκτήτης Πλατφόρμας, 9/11/2026: «στα νοσοκομεία μέχρι 30 λεπτά, χωρίς ανενεργό»).
-- Κάθε οργανισμός κλειδώνει μετά από 5–30 λεπτά αδράνειας· το «ποτέ» (0) και οι τιμές πάνω από 30 δεν επιτρέπονται.
-- Οι τιμές που υπάρχουν ήδη έξω από το εύρος γίνονται 30 (ή 5 αν ήταν μικρότερες), μετά μπαίνει ο έλεγχος.

update public.organizations set idle_lock_minutes = 30 where idle_lock_minutes = 0 or idle_lock_minutes > 30;
update public.organizations set idle_lock_minutes = 5 where idle_lock_minutes between 1 and 4;

alter table public.organizations alter column idle_lock_minutes set default 15;
alter table public.organizations add constraint organizations_idle_lock_minutes_strict
  check (idle_lock_minutes between 5 and 30);

create or replace function public.set_organization_idle_lock(p_organization_id uuid, p_minutes integer)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_before integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not (public.current_user_is_platform_owner() or public.is_org_admin(p_organization_id)) then raise exception 'ORG_ADMIN_REQUIRED'; end if;
  if p_minutes is null or p_minutes < 5 or p_minutes > 30 then raise exception 'INVALID_IDLE_LOCK_MINUTES'; end if;

  select idle_lock_minutes into v_before from public.organizations where id=p_organization_id for update;
  if not found then raise exception 'ORGANIZATION_NOT_FOUND'; end if;

  update public.organizations set idle_lock_minutes=p_minutes, updated_at=now() where id=p_organization_id;

  insert into public.system_audit_log(organization_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_organization_id,auth.uid(),'update','organization',p_organization_id,jsonb_build_object('source','management_center','field','idle_lock_minutes','before',v_before,'after',p_minutes));

  return p_minutes;
end;
$function$;
