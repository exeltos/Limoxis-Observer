-- Ενημέρωση για την απόφαση σε αίτηση συμμετοχής (ιδιοκτήτης, 21/11/2026): όταν ο υπεύθυνος εκπαίδευσης αποδέχεται ή
-- απορρίπτει μια αίτηση, ο αιτών το βλέπει στο καμπανάκι («Ενημερώσεις & ανακοινώσεις»).
--
-- Οι προσωπικές ενημερώσεις της πλατφόρμας είναι ανακοινώσεις προς έναν χρήστη: public.management_announcements με
-- audience_type = 'user', audience_values = [<id χρήστη>] και link_path (όπως οι ειδοποιήσεις των επιτροπών και η
-- διανομή εγγράφων). Ο αιτών τη διαβάζει με την υπάρχουσα πολιτική ανάγνωσης (audience_values ? auth.uid()). Εδώ τη
-- γράφει η ίδια η απόφαση, μέσα στη συναλλαγή της: η private.training_decide_participation ξαναγράφεται (create or
-- replace) με το ίδιο σώμα της 20261231606000 και, πριν επιστρέψει, την εισαγωγή της ενημέρωσης:
--   τίτλος   «Η αίτησή σας για «<πρόγραμμα>» εγκρίθηκε» / «… απορρίφθηκε»
--   μήνυμα   «Η εκπαίδευση εμφανίζεται στις «Οι δικές μου».» / «Αιτιολογία: <λόγος>»
--   σύνδεσμος /training?request=<id>&decision=accepted|rejected (το καμπανάκι ανοίγει την Εκπαίδευση και δείχνει το
--            κείμενο στα αγγλικά όταν η γλώσσα είναι αγγλικά: trainingDecisionNotice.ts)
--   εμφανίζεται 30 ημέρες, χωρίς επιβεβαίωση ανάγνωσης.
-- Καμία αποστολή email: δεν υπάρχει ροή email για τις αιτήσεις εκπαίδευσης.
-- Μόνο create or replace· καμία αλλαγή σε πίνακα, πολιτική ή δικαίωμα (η public.training_decide_participation μένει
-- όπως είναι και καλεί αυτή τη συνάρτηση).

create or replace function private.training_decide_participation(p_request_id uuid, p_accept boolean, p_reason text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_request public.training_participation_requests%rowtype;
  v_program public.training_programs%rowtype;
  v_employee public.employees%rowtype;
  v_assignment uuid;
  v_email text;
  v_title text;
begin
  if auth.uid() is null then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if p_request_id is null or p_accept is null then
    raise exception 'TRAINING_REQUEST_NOT_FOUND' using errcode = '22023';
  end if;
  if private.password_change_pending() then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  select * into v_request from public.training_participation_requests r where r.id = p_request_id for update;
  if not found then raise exception 'TRAINING_REQUEST_NOT_FOUND' using errcode = '22023'; end if;
  -- Μόνο όσοι διαχειρίζονται την εκπαίδευση στο νοσοκομείο της αίτησης (και ενεργά μέλη του).
  if not exists (select 1 from public.organization_members om
                  where om.user_id = auth.uid() and om.organization_id = v_request.organization_id and om.status = 'active')
     and not public.current_user_is_platform_owner() then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if not public.current_user_has_capability(v_request.organization_id, 'manage_training') then
    raise exception 'TRAINING_MANAGE_REQUIRED' using errcode = '42501';
  end if;
  if 'training' = any (coalesce(private.org_disabled_modules(v_request.organization_id), '{}'::text[])) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'TRAINING_REQUEST_ALREADY_DECIDED' using errcode = '22023';
  end if;
  -- Ο τίτλος του προγράμματος για την ενημέρωση του αιτούντα.
  select coalesce(nullif(btrim(p.title), ''), p.program_key) into v_title from public.training_programs p
   where p.id = v_request.program_id and p.organization_id = v_request.organization_id;

  if not p_accept then
    if nullif(btrim(coalesce(p_reason, '')), '') is null then
      raise exception 'TRAINING_REQUEST_REASON_REQUIRED' using errcode = '22023';
    end if;
    update public.training_participation_requests r
       set status = 'rejected', decision_reason = left(btrim(p_reason), 1000), decided_by = auth.uid(), decided_at = now()
     where r.id = v_request.id;
    -- Η ενημέρωση του αιτούντα (μόνο εκείνος τη βλέπει) με την αιτιολογία.
    insert into public.management_announcements (organization_id, title, message, priority, audience_type, audience_values,
      requires_ack, starts_at, ends_at, link_path, created_by, updated_by)
    values (v_request.organization_id, 'Η αίτησή σας για «' || coalesce(v_title, '') || '» απορρίφθηκε',
      'Αιτιολογία: ' || left(btrim(p_reason), 1000), 'normal', 'user', jsonb_build_array(v_request.requester_user_id::text),
      false, now(), now() + interval '30 days', '/training?request=' || v_request.id::text || '&decision=rejected', auth.uid(), auth.uid());
    return v_request.id;
  end if;

  select * into v_program from public.training_programs p
   where p.id = v_request.program_id and p.organization_id = v_request.organization_id;
  if not found or v_program.status in ('cancelled', 'completed') then
    raise exception 'TRAINING_REQUEST_NOT_AVAILABLE' using errcode = '22023';
  end if;
  if v_request.employee_id is not null then
    select * into v_employee from public.employees e
     where e.id = v_request.employee_id and e.organization_id = v_request.organization_id;
  end if;

  -- Αν στο μεταξύ προστέθηκε από τη λίστα συμμετεχόντων, η αίτηση δείχνει εκείνη την ανάθεση.
  select a.id into v_assignment from public.training_assignments a
   where a.organization_id = v_request.organization_id and a.program_id = v_program.id and a.status <> 'cancelled'
     and (a.employee_user_id = v_request.requester_user_id or (v_employee.id is not null and a.employee_id = v_employee.id))
   order by a.created_at desc
   limit 1;

  if v_assignment is null then
    v_email := coalesce(nullif(btrim(v_employee.email), ''),
      (select nullif(btrim(pr.contact_email), '') from public.profiles pr where pr.id = v_request.requester_user_id),
      (select nullif(btrim(u.email), '') from auth.users u where u.id = v_request.requester_user_id));
    -- Οι στήλες της training_save_assignment για συμμετέχοντα από το προσωπικό: κωδικός εργαζομένου (η
    -- training_assignment_identity συνδέει τον εργαζόμενο), όνομα, τμήμα, λογαριασμός, προθεσμία του προγράμματος.
    insert into public.training_assignments (organization_id, assignment_key, program_id, employee_code, employee_name, department_name,
      department_id, employee_user_id, email, account_linked, manual_entry, assigned_date, due_date, status)
    values (v_request.organization_id, 'TRA-REQ-' || replace(v_request.id::text, '-', ''), v_program.id,
      nullif(btrim(coalesce(v_employee.employee_code, '')), ''), v_request.requester_name, v_request.department_name,
      coalesce(v_employee.department_id, v_request.department_id), v_request.requester_user_id, v_email, true, false,
      (now() at time zone 'Europe/Athens')::date, v_program.due_date, 'assigned')
    returning id into v_assignment;
  end if;

  update public.training_participation_requests r
     set status = 'accepted', decision_reason = nullif(left(btrim(coalesce(p_reason, '')), 1000), ''), decided_by = auth.uid(),
         decided_at = now(), assignment_id = v_assignment
   where r.id = v_request.id;
  -- Η ενημέρωση του αιτούντα (μόνο εκείνος τη βλέπει): η εκπαίδευση είναι πλέον στις «Οι δικές μου».
  insert into public.management_announcements (organization_id, title, message, priority, audience_type, audience_values,
    requires_ack, starts_at, ends_at, link_path, created_by, updated_by)
  values (v_request.organization_id, 'Η αίτησή σας για «' || coalesce(v_title, '') || '» εγκρίθηκε',
    'Η εκπαίδευση εμφανίζεται στις «Οι δικές μου».', 'normal', 'user', jsonb_build_array(v_request.requester_user_id::text),
    false, now(), now() + interval '30 days', '/training?request=' || v_request.id::text || '&decision=accepted', auth.uid(), auth.uid());
  return v_request.id;
end
$function$;
