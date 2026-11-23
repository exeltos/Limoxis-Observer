-- Εκπαίδευση: οι αριθμοί συμμετοχής και η διοργάνωση των προγραμμάτων και για τον Platform Owner (ιδιοκτήτης, 23/11/2026).
-- Στην προεπισκόπηση ρόλου ο Platform Owner δεν είναι μέλος του νοσοκομείου και οι δύο συναρτήσεις τον απέρριπταν, οπότε
-- η «Συμμετοχή τμήματος» έμενε κενή. Δίνουν μόνο αριθμούς ανά πρόγραμμα και τμήμα και το τμήμα που διοργάνωσε, χωρίς
-- ονόματα· οι υπόλοιποι έλεγχοι (δικαίωμα εκπαίδευσης, κλειδωμένη ενότητα) μένουν ίδιοι. Μόνο create or replace.

create or replace function private.training_program_participation(p_organization_id uuid)
 returns table(program_key text, department_id uuid, department_name text, assigned integer, completed integer)
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if p_organization_id is null or private.password_change_pending() then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if not public.current_user_is_platform_owner()
     and not exists (select 1 from public.organization_members om
                      where om.user_id = auth.uid() and om.organization_id = p_organization_id and om.status = 'active') then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if not (public.current_user_is_platform_owner()
          or public.current_user_has_capability(p_organization_id, 'view_training')
          or public.current_user_has_capability(p_organization_id, 'manage_training')) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if 'training' = any (coalesce(private.org_disabled_modules(p_organization_id), '{}'::text[])) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  return query
    select p.program_key, a.department_id, coalesce(d.name, nullif(btrim(a.department_name), ''))::text,
           count(*)::integer, (count(*) filter (where a.status = 'completed'))::integer
      from public.training_assignments a
      join public.training_programs p on p.id = a.program_id and p.organization_id = a.organization_id
      left join public.departments d on d.id = a.department_id
     where a.organization_id = p_organization_id and a.status <> 'cancelled' and p.status <> 'cancelled'
     group by p.program_key, a.department_id, coalesce(d.name, nullif(btrim(a.department_name), ''));
end
$function$;

create or replace function private.training_program_organizers(p_organization_id uuid)
 returns table(program_key text, department_name text)
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if p_organization_id is null or private.password_change_pending() then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if not public.current_user_is_platform_owner()
     and not exists (select 1 from public.organization_members om
                      where om.user_id = auth.uid() and om.organization_id = p_organization_id and om.status = 'active') then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if not (public.current_user_is_platform_owner()
          or public.current_user_has_capability(p_organization_id, 'view_training')
          or public.current_user_has_capability(p_organization_id, 'manage_training')) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if 'training' = any (coalesce(private.org_disabled_modules(p_organization_id), '{}'::text[])) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  return query
    select p.program_key,
           coalesce(
             (select d.name from public.departments d where d.id = p.organizer_department_id),
             (select coalesce(dd.name, nullif(btrim(e.department_name), ''))
                from public.employees e
                left join public.departments dd on dd.id = e.department_id
               where e.organization_id = p.organization_id
                 and nullif(btrim(p.owner), '') is not null
                 and btrim(p.owner) in (btrim(concat_ws(' ', e.first_name, e.last_name)), btrim(concat_ws(' ', e.last_name, e.first_name)))
               order by (e.employment_status = 'active') desc nulls last
               limit 1),
             nullif(btrim(p.owner), ''))::text
      from public.training_programs p
     where p.organization_id = p_organization_id;
end
$function$;
