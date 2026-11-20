-- Η σελίδα του εκπαιδευόμενου σε βήματα (ιδιοκτήτης, 20/11/2026): μετά την υποβολή ο ίδιος σύνδεσμος δείχνει το
-- αποτέλεσμα και το πιστοποιητικό, και από την εφαρμογή ο χρήστης ανοίγει τη δική του εκπαίδευση («Έναρξη» /
-- «Συνέχεια» στις «Οι δικές μου») χωρίς το email της πρόσκλησης.
--
-- 1. public.training_access_certificate(p_token): το πιστοποιητικό της ανάθεσης του προσωπικού συνδέσμου (αριθμός,
--    τίτλος, έκδοση, λήξη, εκδότης, ημερομηνία ολοκλήρωσης) και το όνομα / λογότυπο του νοσοκομείου για την εκτύπωσή
--    του. Όπως οι training_email_access / training_access_files: ο τυχαίος κωδικός του συνδέσμου ταυτοποιεί την
--    ανάθεση, τίποτε άλλο δεν επιστρέφεται. Χωρίς πιστοποιητικό (ή ακυρωμένη ανάθεση): null.
--
-- 2. public.training_my_access(p_organization_id, p_assignment_key): ο κωδικός του προσωπικού συνδέσμου της ΔΙΚΗΣ ΣΟΥ
--    ανάθεσης. Μόνο για συνδεδεμένο, ενεργό μέλος του οργανισμού που έχει αλλάξει τον προσωρινό κωδικό, με ενεργή
--    την ενότητα Εκπαίδευση, και μόνο όταν η ανάθεση είναι του ίδιου (employee_user_id = auth.uid(), ή ο
--    εργαζόμενος της ανάθεσης είναι συνδεδεμένος με τον λογαριασμό του). Για ανάθεση άλλου απαντά ότι δεν βρέθηκε.
--    Αν η ανάθεση δεν έχει ακόμη κωδικό (δεν στάλθηκε πρόσκληση), δημιουργείται με τον ίδιο τρόπο που τον δημιουργεί
--    η queue_training_invitation. Η λογική είναι σε SECURITY DEFINER συνάρτηση του σχήματος private (δεν εκτίθεται
--    στο API)· το API καλεί τη public.training_my_access, SECURITY INVOKER, που απλώς την καλεί (όπως η
--    department_isolation_count).
--
-- Μόνο create or replace και grant.

create or replace function public.training_access_certificate(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_assignment public.training_assignments%rowtype;
  v_certificate public.training_certificates%rowtype;
begin
  if nullif(btrim(coalesce(p_token, '')), '') is null then raise exception 'TRAINING_ACCESS_NOT_AVAILABLE'; end if;
  select * into v_assignment from public.training_assignments a where a.access_token = p_token limit 1;
  if not found then raise exception 'TRAINING_ACCESS_NOT_AVAILABLE'; end if;
  if v_assignment.status = 'cancelled' then return null; end if;
  select * into v_certificate from public.training_certificates c
   where c.assignment_id = v_assignment.id and c.organization_id = v_assignment.organization_id;
  if not found then return null; end if;
  return jsonb_build_object(
    'certificate', jsonb_build_object(
      'id', v_certificate.certificate_key, 'assignmentId', v_assignment.assignment_key, 'title', coalesce(v_certificate.title, ''),
      'issuedDate', v_certificate.issued_date, 'validUntil', v_certificate.valid_until, 'issuer', coalesce(v_certificate.issuer, ''),
      'completedDate', v_assignment.completed_date),
    'organization', (select jsonb_build_object('name', o.name, 'logo', coalesce(o.branding ->> 'logo', ''), 'reportHeader', coalesce(o.branding ->> 'reportHeader', ''))
                       from public.organizations o where o.id = v_assignment.organization_id));
end
$function$;

grant execute on function public.training_access_certificate(text) to anon, authenticated;

create or replace function private.training_my_access(p_organization_id uuid, p_assignment_key text)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_assignment public.training_assignments%rowtype;
  v_token text;
begin
  if auth.uid() is null then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if p_organization_id is null or nullif(btrim(coalesce(p_assignment_key, '')), '') is null then
    raise exception 'TRAINING_ASSIGNMENT_NOT_FOUND' using errcode = '22023';
  end if;
  if private.password_change_pending() then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organization_members om
                  where om.user_id = auth.uid() and om.organization_id = p_organization_id and om.status = 'active') then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if 'training' = any (coalesce(private.org_disabled_modules(p_organization_id), '{}'::text[])) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  select * into v_assignment from public.training_assignments a
   where a.organization_id = p_organization_id and a.assignment_key = p_assignment_key
     and (a.employee_user_id = auth.uid()
          or exists (select 1 from public.employees e
                      where e.id = a.employee_id and e.organization_id = a.organization_id and e.user_id = auth.uid()))
   for update;
  -- Ανάθεση άλλου: η ίδια απάντηση με την ανύπαρκτη.
  if not found then raise exception 'TRAINING_ASSIGNMENT_NOT_FOUND'; end if;
  if v_assignment.status = 'cancelled'
     or exists (select 1 from public.training_programs p where p.id = v_assignment.program_id and p.status = 'cancelled') then
    raise exception 'TRAINING_ACCESS_NOT_AVAILABLE';
  end if;

  v_token := nullif(v_assignment.access_token, '');
  if v_token is null then
    v_token := 'TRN-ACCESS-' || replace(gen_random_uuid()::text, '-', '');
    update public.training_assignments a set access_token = v_token where a.id = v_assignment.id;
  end if;
  return v_token;
end
$function$;

create or replace function public.training_my_access(p_organization_id uuid, p_assignment_key text)
returns text
language sql
security invoker
set search_path to ''
as $function$
  select private.training_my_access(p_organization_id, p_assignment_key)
$function$;

grant execute on function public.training_my_access(uuid, text) to authenticated;
