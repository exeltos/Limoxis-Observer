-- Η λίστα προσωπικού της «Προσθήκης συμμετεχόντων» (20261231611000), δύο διορθώσεις από τον έλεγχο του PR:
-- 1. Τα αγγλικά ονόματα (first_name_en, last_name_en): η επιλογή συμμετεχόντων ψάχνει και με αυτά, όπως όταν διάβαζε
--    το μητρώο εργαζομένων.
-- 2. Σταθερή σειρά (με το id στο τέλος), ώστε η εφαρμογή να διαβάζει τη λίστα σε σελίδες: μία απάντηση της βάσης
--    έχει όριο γραμμών και σε μεγάλο νοσοκομείο οι υπόλοιποι εργαζόμενοι θα έλειπαν.
-- Οι στήλες που επιστρέφει μια συνάρτηση δεν αλλάζουν με create or replace, οπότε είναι νέα συνάρτηση με νέο όνομα,
-- training_participant_candidate_list· η παλιά training_participant_candidates δεν χρησιμοποιείται πια από την
-- εφαρμογή. Οι ίδιοι έλεγχοι του καλούντα, καμία πολιτική στο public.employees. Μόνο create or replace και grant.

create or replace function private.training_participant_candidate_list(p_organization_id uuid)
returns table (id uuid, employee_code text, first_name text, last_name text, first_name_en text, last_name_en text,
               department_id uuid, department_name text, email text, profession text, "position" text,
               employment_status text, user_id uuid)
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
  if 'training' = any (coalesce(private.org_disabled_modules(p_organization_id), '{}'::text[])) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if not public.current_user_has_capability(p_organization_id, 'manage_training') then
    raise exception 'TRAINING_MANAGE_REQUIRED' using errcode = '42501';
  end if;

  return query
    select e.id,
           e.employee_code::text,
           e.first_name::text,
           e.last_name::text,
           nullif(btrim(e.first_name_en), '')::text,
           nullif(btrim(e.last_name_en), '')::text,
           e.department_id,
           coalesce(nullif(btrim(e.department_name), ''), d.name)::text,
           nullif(btrim(e.email), '')::text,
           nullif(btrim(e.profession_name), '')::text,
           nullif(btrim(e.position_name), '')::text,
           e.employment_status::text,
           e.user_id
      from public.employees e
      left join public.departments d on d.id = e.department_id and d.organization_id = e.organization_id
     where e.organization_id = p_organization_id
     order by e.last_name, e.first_name, e.employee_code, e.id;
end
$function$;

create or replace function public.training_participant_candidate_list(p_organization_id uuid)
returns table (id uuid, employee_code text, first_name text, last_name text, first_name_en text, last_name_en text,
               department_id uuid, department_name text, email text, profession text, "position" text,
               employment_status text, user_id uuid)
language sql
stable
security invoker
set search_path to ''
as $function$
  select * from private.training_participant_candidate_list(p_organization_id)
$function$;

grant execute on function public.training_participant_candidate_list(uuid) to authenticated;
