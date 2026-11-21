-- Οι εργαζόμενοι στην «Προσθήκη συμμετεχόντων» ενός προγράμματος εκπαίδευσης (ιδιοκτήτης, 21/11/2026, «ναι»): ο
-- Υπεύθυνος Ποιότητας (quality_manager) και το Μέλος Ομάδας Λοιμώξεων (infection_control_member) διαχειρίζονται την
-- εκπαίδευση (manage_training, 20261231609000) αλλά η πολιτική employees_select_authorized δεν τους δείχνει το μητρώο
-- εργαζομένων, οπότε η επιλογή συμμετεχόντων ήταν άδεια. Η πρόσβαση ΔΕΝ ανοίγει στον πίνακα: καμία νέα ή αλλαγμένη
-- πολιτική στο public.employees. Αντί γι' αυτό:
-- 1. private.training_participant_candidates(p_organization_id): SECURITY DEFINER με set search_path to ''· οι έλεγχοι
--    του καλούντα της private.training_manage_guard (auth.uid, προσωρινός κωδικός, ενεργή συμμετοχή, ενότητα Εκπαίδευση
--    ανοιχτή, manage_training), γραμμένοι και εδώ ρητά. Επιστρέφει μόνο τα πεδία που δείχνει ή χρειάζεται η επιλογή
--    (κωδικός, ονοματεπώνυμο, τμήμα, email, ειδικότητα, θέση, κατάσταση απασχόλησης, σύνδεση λογαριασμού για να
--    συνδεθεί η ανάθεση με τον λογαριασμό του εργαζομένου όπως στην ανάθεση σε τμήματα), μόνο για τους εργαζομένους του
--    νοσοκομείου, ενεργούς και ανενεργούς (η οθόνη κρατά τους ενεργούς και σημειώνει όσους ήδη συμμετέχουν).
-- 2. public.training_participant_candidates(p_organization_id): SECURITY INVOKER, απλώς καλεί την private· grant στους
--    authenticated.
-- Μόνο create or replace και grant.

create or replace function private.training_participant_candidates(p_organization_id uuid)
returns table (id uuid, employee_code text, first_name text, last_name text, department_id uuid, department_name text,
               email text, profession text, "position" text, employment_status text, user_id uuid)
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
     order by e.last_name, e.first_name, e.employee_code;
end
$function$;

create or replace function public.training_participant_candidates(p_organization_id uuid)
returns table (id uuid, employee_code text, first_name text, last_name text, department_id uuid, department_name text,
               email text, profession text, "position" text, employment_status text, user_id uuid)
language sql
stable
security invoker
set search_path to ''
as $function$
  select * from private.training_participant_candidates(p_organization_id)
$function$;

grant execute on function public.training_participant_candidates(uuid) to authenticated;
