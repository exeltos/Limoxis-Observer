-- Δύο διορθώσεις στην ανάθεση σε τμήματα (Codex, PR #683):
-- 1. public.training_program_organizers(p_organization_id): το τμήμα διοργάνωσης κάθε προγράμματος, υπολογισμένο στον
--    server (organizer_department_id, αλλιώς το τμήμα του εργαζομένου που είναι «Υπεύθυνος / διοργανωτής», αλλιώς το
--    κείμενο του υπευθύνου), ώστε το «Του τμήματός μου» να μην εξαρτάται από το ποιους εργαζομένους βλέπει ο χρήστης.
--    Επιστρέφει μόνο κωδικό προγράμματος και όνομα τμήματος· για όσους βλέπουν ή διαχειρίζονται την εκπαίδευση.
-- 2. private.training_follow_department_targets: κλειδώνει τη γραμμή του προγράμματος (for update) πριν προσθέσει τον
--    εργαζόμενο, όπως η training_assign_departments, ώστε δύο ταυτόχρονες προσθήκες να μη δίνουν διπλή ανάθεση.
-- Μόνο create or replace και grant.

create or replace function private.training_program_organizers(p_organization_id uuid)
returns table (program_key text, department_name text)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if p_organization_id is null or private.password_change_pending() then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organization_members om
                  where om.user_id = auth.uid() and om.organization_id = p_organization_id and om.status = 'active') then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if not (public.current_user_has_capability(p_organization_id, 'view_training')
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

create or replace function public.training_program_organizers(p_organization_id uuid)
returns table (program_key text, department_name text)
language sql
stable
security invoker
set search_path to ''
as $function$
  select * from private.training_program_organizers(p_organization_id)
$function$;

grant execute on function public.training_program_organizers(uuid) to authenticated;

create or replace function private.training_follow_department_targets()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_program record;
begin
  if current_setting('limoxis.bin', true) = 'on' then return new; end if;
  if coalesce(new.employment_status, 'active') <> 'active' then return new; end if;
  if tg_op = 'UPDATE' and new.department_id is not distinct from old.department_id
     and coalesce(old.employment_status, 'active') = 'active' then
    return new;
  end if;
  if 'training' = any (coalesce(private.org_disabled_modules(new.organization_id), '{}'::text[])) then return new; end if;
  for v_program in
    select distinct p.id, p.due_date
      from public.training_program_department_targets t
      join public.training_programs p on p.id = t.program_id and p.organization_id = t.organization_id
     where t.organization_id = new.organization_id and t.active
       and p.status not in ('completed', 'cancelled')
       and (t.department_id is null or t.department_id = new.department_id)
  loop
    -- Το ίδιο κλείδωμα με την training_assign_departments: η μία προσθήκη περιμένει την άλλη.
    perform 1 from public.training_programs p where p.id = v_program.id for update;
    perform private.training_add_program_employees(new.organization_id, v_program.id, v_program.due_date, array[new.id]);
  end loop;
  return new;
end
$function$;
