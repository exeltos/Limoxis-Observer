-- Εκπαίδευση τμήματος (ιδιοκτήτης, 21/11/2026, επιλογή Α): ο Διευθυντής/Προϊστάμενος Τμήματος (department_manager)
-- δημιουργεί και διαχειρίζεται «Ενδοτμηματική» εκπαίδευση ΜΟΝΟ για το δικό του τμήμα· το γραφείο εκπαίδευσης
-- (manage_training) συνεχίζει να βλέπει και να διορθώνει τα πάντα όπως πριν.
--
-- 1. public.training_programs: δύο νέες στήλες (προσθετικά, nullable / με προεπιλογή)
--      organizer_department_id        το τμήμα που διοργανώνει το πρόγραμμα (departments)
--      created_by_department_manager  true όταν το πρόγραμμα δημιουργήθηκε από Διευθυντή Τμήματος
--    Η training_save_program του γραφείου δεν τις αγγίζει (δεν είναι στη λίστα της): μένουν όπως είναι.
-- 2. private.training_department_guard(p_organization_id): οι κοινοί έλεγχοι του καλούντα (auth.uid, προσωρινός
--    κωδικός, ενεργή συμμετοχή με ρόλο department_manager, ενότητα Εκπαίδευση ανοιχτή). Επιστρέφει τη συμμετοχή.
-- 3. public.training_department_save_program(p_organization_id, p_program): νέο ή αλλαγή. Το τμήμα πρέπει να είναι
--    στα τμήματα (scopes) της συμμετοχής του· το είδος γίνεται πάντα «Ενδοτμηματική», το τμήμα διοργάνωσης και ο
--    «Υπεύθυνος / διοργανωτής» το τμήμα του. Αλλαγή μόνο σε πρόγραμμα τμήματος του ίδιου τμήματος που δεν έχει
--    ολοκληρωθεί ή ακυρωθεί. Χωρίς τεστ γνώσεων (requires_assessment = false).
-- 4. public.training_department_set_participants(p_organization_id, p_program_key, p_employee_ids): οι
--    συμμετέχοντες ΜΟΝΟ από τους εργαζομένους του τμήματος. Νέες αναθέσεις με τις στήλες της training_save_assignment
--    (κωδικός εργαζομένου, όνομα, τμήμα, λογαριασμός, email, προθεσμία του προγράμματος)· όποιος βγει από τη λίστα και
--    δεν έχει ξεκινήσει παίρνει κατάσταση «cancelled» (τα ξεκινημένα και τα ολοκληρωμένα μένουν).
-- 5. public.training_department_cancel_program(p_organization_id, p_program_key): ακύρωση (οι αναθέσεις μένουν).
-- 6. Υλικό: ένα νέο RESTRICTIVE policy στα attachments μόνο για entity_type 'training_program': ανέβασμα αρχείου σε
--    πρόγραμμα μόνο από όσους έχουν manage_training ή από τον Διευθυντή του τμήματος που το διοργανώνει.
--
-- Κάθε λογική είναι σε SECURITY DEFINER συνάρτηση του σχήματος private· το API καλεί τη συνάρτηση public με το ίδιο
-- όνομα, SECURITY INVOKER, που απλώς την καλεί (όπως η training_request_participation). Καμία νέα permissive πολιτική
-- εγγραφής στους πίνακες της εκπαίδευσης: οι εγγραφές του Διευθυντή περνούν μόνο από αυτές τις συναρτήσεις.
-- Μόνο add column if not exists, create index if not exists, create or replace, create policy (με έλεγχο) και grant.

-- 1. Οι στήλες ---------------------------------------------------------------------------------------------------------
alter table public.training_programs
  add column if not exists organizer_department_id uuid references public.departments(id) on delete set null,
  add column if not exists created_by_department_manager boolean not null default false;
create index if not exists training_programs_organizer_department_idx on public.training_programs (organization_id, organizer_department_id);

-- 2. Οι κοινοί έλεγχοι του καλούντα ------------------------------------------------------------------------------------
create or replace function private.training_department_guard(p_organization_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_membership uuid;
begin
  if auth.uid() is null then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if p_organization_id is null or private.password_change_pending() then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  select om.id into v_membership from public.organization_members om
   where om.user_id = auth.uid() and om.organization_id = p_organization_id and om.status = 'active'
     and om.role = 'department_manager'
   limit 1;
  if v_membership is null then
    raise exception 'TRAINING_DEPARTMENT_MANAGER_REQUIRED' using errcode = '42501';
  end if;
  if 'training' = any (coalesce(private.org_disabled_modules(p_organization_id), '{}'::text[])) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  return v_membership;
end
$function$;

-- Το τμήμα είναι στα τμήματα της συμμετοχής (organization_member_scopes) και ανήκει στο νοσοκομείο.
create or replace function private.training_department_in_scope(p_membership_id uuid, p_organization_id uuid, p_department_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select p_membership_id is not null and p_department_id is not null and exists (
    select 1 from public.organization_member_scopes s
      join public.departments d on d.id = s.department_id
     where s.membership_id = p_membership_id and s.department_id = p_department_id and d.organization_id = p_organization_id)
$function$;

-- 3. Νέο ή αλλαγή προγράμματος τμήματος ---------------------------------------------------------------------------------
create or replace function private.training_department_save_program(p_organization_id uuid, p_program jsonb)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_membership uuid;
  v_key text := nullif(btrim(coalesce(p_program->>'id', '')), '');
  v_department uuid := case when p_program->>'organizerDepartmentId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then (p_program->>'organizerDepartmentId')::uuid end;
  v_department_name text;
  v_existing public.training_programs%rowtype;
  v_title text := left(btrim(coalesce(p_program->>'title', '')), 300);
  v_start date := nullif(left(p_program->>'startDate', 10), '')::date;
  v_due date := nullif(left(p_program->>'dueDate', 10), '')::date;
  v_today date := (now() at time zone 'Europe/Athens')::date;
  v_status text;
  v_id uuid;
begin
  v_membership := private.training_department_guard(p_organization_id);
  if p_program is null or jsonb_typeof(p_program) <> 'object' then
    raise exception 'TRAINING_PROGRAM_INVALID' using errcode = '22023';
  end if;
  -- Χωρίς τμήμα στην κλήση: το μοναδικό τμήμα της συμμετοχής· με περισσότερα, το τμήμα δηλώνεται.
  if v_department is null then
    select min(s.department_id::text)::uuid into v_department from public.organization_member_scopes s
     where s.membership_id = v_membership
    having count(*) = 1;
  end if;
  if not private.training_department_in_scope(v_membership, p_organization_id, v_department) then
    raise exception 'TRAINING_DEPARTMENT_SCOPE_DENIED' using errcode = '42501';
  end if;
  select d.name into v_department_name from public.departments d where d.id = v_department and d.organization_id = p_organization_id;

  if v_title = '' or v_due is null or (v_start is not null and v_due < v_start) then
    raise exception 'TRAINING_PROGRAM_INVALID' using errcode = '22023';
  end if;
  if v_key is null then
    v_key := 'TRN-D-' || replace(gen_random_uuid()::text, '-', '');
  elsif v_key !~ '^[A-Za-z0-9_-]{1,80}$' then
    raise exception 'TRAINING_RECORD_KEY_REQUIRED' using errcode = '22023';
  end if;

  select * into v_existing from public.training_programs p
   where p.organization_id = p_organization_id and p.program_key = v_key
   for update;
  if found then
    -- Μόνο πρόγραμμα τμήματος του ίδιου τμήματος, που δεν έχει ολοκληρωθεί ή ακυρωθεί.
    if not v_existing.created_by_department_manager or v_existing.organizer_department_id is distinct from v_department then
      raise exception 'TRAINING_DEPARTMENT_SCOPE_DENIED' using errcode = '42501';
    end if;
    if v_existing.status in ('completed', 'cancelled') then
      raise exception 'TRAINING_PROGRAM_LOCKED' using errcode = '22023';
    end if;
  end if;

  -- Η κατάσταση: νέο πρόγραμμα από την ημερομηνία έναρξης· σε αλλαγή Προγραμματισμένο / Ενεργό / Ολοκληρωμένο. Ποτέ
  -- «Ακυρωμένο» από εδώ (training_department_cancel_program).
  v_status := case when v_existing.id is not null and p_program->>'status' in ('planned', 'active', 'completed') then p_program->>'status'
    when v_start is not null and v_start > v_today then 'planned' else 'active' end;

  if v_existing.id is null then
    insert into public.training_programs (organization_id, program_key, title, category, method, owner, trainer, audience, description,
      start_date, due_date, valid_months, requires_assessment, pass_score, status, department_id, delivery_kind, start_time, duration_hours,
      location, organizer_department_id, created_by_department_manager, feedback_template_key, feedback_title_el, feedback_title_en)
    values (p_organization_id, v_key, v_title, nullif(left(btrim(coalesce(p_program->>'category', '')), 60), ''),
      nullif(left(btrim(coalesce(p_program->>'method', '')), 60), ''), v_department_name,
      nullif(left(btrim(coalesce(p_program->>'trainer', '')), 200), ''),
      coalesce(nullif(left(btrim(coalesce(p_program->>'audience', '')), 300), ''), v_department_name),
      nullif(left(btrim(coalesce(p_program->>'description', '')), 5000), ''), v_start, v_due,
      case when btrim(coalesce(p_program->>'validMonths', '')) ~ '^[0-9]{1,3}$' and (p_program->>'validMonths')::integer between 1 and 600
        then (p_program->>'validMonths')::integer end,
      false, null, v_status, v_department, 'intra_department',
      case when btrim(coalesce(p_program->>'startTime', '')) ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' then btrim(p_program->>'startTime')::time end,
      case when btrim(coalesce(p_program->>'durationHours', '')) ~ '^[0-9]{1,4}([.,][0-9]+)?$' and replace(btrim(p_program->>'durationHours'), ',', '.')::numeric > 0
        then replace(btrim(p_program->>'durationHours'), ',', '.')::numeric end,
      nullif(left(btrim(coalesce(p_program->>'location', '')), 200), ''), v_department, true,
      'TRAINER-FEEDBACK-DEFAULT', null, null)
    returning id into v_id;
    -- Η αξιολόγηση του εκπαιδευτή: οι ερωτήσεις του προτύπου του νοσοκομείου, ή του προτύπου της εφαρμογής που στέλνει ο client.
    insert into public.training_program_feedback_questions (organization_id, program_id, question_key, position, label_el, label_en)
    select p_organization_id, v_id, q.question_key, q.position, q.label_el, q.label_en
      from public.training_feedback_template_questions q
      join public.training_feedback_templates t on t.id = q.template_id
     where t.organization_id = p_organization_id and t.template_key = 'TRAINER-FEEDBACK-DEFAULT';
    if not found and jsonb_typeof(p_program->'trainerFeedbackTemplate'->'questions') = 'array' then
      insert into public.training_program_feedback_questions (organization_id, program_id, question_key, position, label_el, label_en)
      select distinct on (k.key) p_organization_id, v_id, k.key, x.ord::integer, left(coalesce(x.value->>'labelEl', ''), 300), nullif(left(coalesce(x.value->>'labelEn', ''), 300), '')
        from jsonb_array_elements(p_program->'trainerFeedbackTemplate'->'questions') with ordinality x(value, ord)
       cross join lateral (select left(coalesce(nullif(x.value->>'id', ''), 'FQ-' || x.ord), 80) key) k
       where x.ord <= 20
       order by k.key, x.ord;
    end if;
  else
    update public.training_programs p set
      title = v_title, category = nullif(left(btrim(coalesce(p_program->>'category', '')), 60), ''),
      method = nullif(left(btrim(coalesce(p_program->>'method', '')), 60), ''), owner = v_department_name,
      trainer = nullif(left(btrim(coalesce(p_program->>'trainer', '')), 200), ''),
      audience = coalesce(nullif(left(btrim(coalesce(p_program->>'audience', '')), 300), ''), v_department_name),
      description = nullif(left(btrim(coalesce(p_program->>'description', '')), 5000), ''), start_date = v_start, due_date = v_due,
      valid_months = case when btrim(coalesce(p_program->>'validMonths', '')) ~ '^[0-9]{1,3}$' and (p_program->>'validMonths')::integer between 1 and 600
        then (p_program->>'validMonths')::integer end,
      requires_assessment = false, pass_score = null, status = v_status, department_id = v_department, delivery_kind = 'intra_department',
      start_time = case when btrim(coalesce(p_program->>'startTime', '')) ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' then btrim(p_program->>'startTime')::time end,
      duration_hours = case when btrim(coalesce(p_program->>'durationHours', '')) ~ '^[0-9]{1,4}([.,][0-9]+)?$' and replace(btrim(p_program->>'durationHours'), ',', '.')::numeric > 0
        then replace(btrim(p_program->>'durationHours'), ',', '.')::numeric end,
      location = nullif(left(btrim(coalesce(p_program->>'location', '')), 200), ''),
      organizer_department_id = v_department, created_by_department_manager = true,
      updated_by = auth.uid(), updated_at = now()
     where p.id = v_existing.id
    returning p.id into v_id;
    -- Οι αναθέσεις που δεν έχουν ξεκινήσει παίρνουν τη νέα προθεσμία.
    update public.training_assignments a set due_date = v_due, updated_by = auth.uid(), updated_at = now()
     where a.program_id = v_id and a.organization_id = p_organization_id and a.status = 'assigned' and a.due_date is distinct from v_due;
  end if;
  return v_id;
end
$function$;

create or replace function public.training_department_save_program(p_organization_id uuid, p_program jsonb)
returns uuid
language sql
security invoker
set search_path to ''
as $function$
  select private.training_department_save_program(p_organization_id, p_program)
$function$;

grant execute on function public.training_department_save_program(uuid, jsonb) to authenticated;

-- 4. Οι συμμετέχοντες (μόνο εργαζόμενοι του τμήματος) -------------------------------------------------------------------
create or replace function private.training_department_set_participants(p_organization_id uuid, p_program_key text, p_employee_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_membership uuid;
  v_program public.training_programs%rowtype;
  v_ids uuid[] := coalesce((select array_agg(distinct x) from unnest(coalesce(p_employee_ids, '{}'::uuid[])) x where x is not null), '{}'::uuid[]);
  v_today date := (now() at time zone 'Europe/Athens')::date;
  v_added integer := 0;
  v_restored integer := 0;
  v_cancelled integer := 0;
begin
  v_membership := private.training_department_guard(p_organization_id);
  select * into v_program from public.training_programs p
   where p.organization_id = p_organization_id and p.program_key = p_program_key
   for update;
  if not found then raise exception 'TRAINING_PROGRAM_NOT_FOUND' using errcode = '22023'; end if;
  if not v_program.created_by_department_manager
     or not private.training_department_in_scope(v_membership, p_organization_id, v_program.organizer_department_id) then
    raise exception 'TRAINING_DEPARTMENT_SCOPE_DENIED' using errcode = '42501';
  end if;
  if v_program.status in ('completed', 'cancelled') then
    raise exception 'TRAINING_PROGRAM_LOCKED' using errcode = '22023';
  end if;
  if cardinality(v_ids) > 500 then
    raise exception 'TRAINING_PARTICIPANTS_TOO_MANY' using errcode = '22023';
  end if;
  -- Κάθε νέος εργαζόμενος της λίστας (όποιος δεν συμμετέχει ήδη): του νοσοκομείου, του τμήματος του προγράμματος, ενεργός.
  if exists (select 1 from unnest(v_ids) x(id)
              where not exists (select 1 from public.training_assignments a
                                 where a.program_id = v_program.id and a.employee_id = x.id and a.status <> 'cancelled')
                and not exists (select 1 from public.employees e
                                 where e.id = x.id and e.organization_id = p_organization_id
                                   and e.department_id = v_program.organizer_department_id
                                   and coalesce(e.employment_status, 'active') = 'active')) then
    raise exception 'TRAINING_DEPARTMENT_EMPLOYEE_DENIED' using errcode = '42501';
  end if;

  -- Ξανά στη λίστα: η ακυρωμένη ανάθεση επανέρχεται (μία ανά εργαζόμενο).
  with restored as (
    update public.training_assignments a set status = 'assigned', due_date = v_program.due_date, assigned_date = v_today,
           updated_by = auth.uid(), updated_at = now()
     where a.organization_id = p_organization_id and a.program_id = v_program.id and a.status = 'cancelled'
       and a.employee_id = any (v_ids)
       and not exists (select 1 from public.training_assignments b
                        where b.program_id = a.program_id and b.employee_id = a.employee_id and b.status <> 'cancelled')
       and a.id = (select c.id from public.training_assignments c
                    where c.program_id = a.program_id and c.employee_id = a.employee_id and c.status = 'cancelled'
                    order by c.created_at desc limit 1)
    returning 1)
  select count(*) into v_restored from restored;

  -- Νέες αναθέσεις, με τις στήλες της training_save_assignment για συμμετέχοντα από το προσωπικό (ο κωδικός
  -- εργαζομένου συνδέει τον εργαζόμενο μέσω της training_assignment_identity).
  with added as (
    insert into public.training_assignments (organization_id, assignment_key, program_id, employee_id, employee_code, employee_name, department_name,
      department_id, employee_user_id, email, account_linked, manual_entry, assigned_date, due_date, status)
    select p_organization_id, 'TRA-D-' || replace(gen_random_uuid()::text, '-', ''), v_program.id, e.id,
      nullif(btrim(coalesce(e.employee_code, '')), ''), nullif(btrim(concat_ws(' ', e.first_name, e.last_name)), ''),
      coalesce((select d.name from public.departments d where d.id = e.department_id), nullif(btrim(coalesce(e.department_name, '')), '')),
      e.department_id, e.user_id, nullif(btrim(coalesce(e.email, '')), ''), e.user_id is not null, false,
      v_today, v_program.due_date, 'assigned'
      from public.employees e
     where e.id = any (v_ids) and e.organization_id = p_organization_id
       and not exists (select 1 from public.training_assignments a
                        where a.organization_id = p_organization_id and a.program_id = v_program.id and a.employee_id = e.id)
    returning 1)
  select count(*) into v_added from added;

  -- Εκτός λίστας: όποιος του τμήματος δεν έχει ξεκινήσει ακυρώνεται· τα ξεκινημένα και τα ολοκληρωμένα μένουν.
  with cancelled as (
    update public.training_assignments a set status = 'cancelled', updated_by = auth.uid(), updated_at = now()
     where a.organization_id = p_organization_id and a.program_id = v_program.id and a.status = 'assigned'
       and a.department_id = v_program.organizer_department_id
       and a.employee_id is not null and not (a.employee_id = any (v_ids))
       and a.feedback_submitted_at is null and a.completion_confirmed_at is null and a.attendance_response <> 'confirmed'
    returning 1)
  select count(*) into v_cancelled from cancelled;

  return jsonb_build_object('added', v_added + v_restored, 'cancelled', v_cancelled);
end
$function$;

create or replace function public.training_department_set_participants(p_organization_id uuid, p_program_key text, p_employee_ids uuid[])
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select private.training_department_set_participants(p_organization_id, p_program_key, p_employee_ids)
$function$;

grant execute on function public.training_department_set_participants(uuid, text, uuid[]) to authenticated;

-- 5. Ακύρωση προγράμματος τμήματος -------------------------------------------------------------------------------------
create or replace function private.training_department_cancel_program(p_organization_id uuid, p_program_key text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_membership uuid;
  v_program public.training_programs%rowtype;
begin
  v_membership := private.training_department_guard(p_organization_id);
  select * into v_program from public.training_programs p
   where p.organization_id = p_organization_id and p.program_key = p_program_key
   for update;
  if not found then raise exception 'TRAINING_PROGRAM_NOT_FOUND' using errcode = '22023'; end if;
  if not v_program.created_by_department_manager
     or not private.training_department_in_scope(v_membership, p_organization_id, v_program.organizer_department_id) then
    raise exception 'TRAINING_DEPARTMENT_SCOPE_DENIED' using errcode = '42501';
  end if;
  if v_program.status in ('completed', 'cancelled') then
    raise exception 'TRAINING_PROGRAM_LOCKED' using errcode = '22023';
  end if;
  update public.training_programs p set status = 'cancelled', updated_by = auth.uid(), updated_at = now() where p.id = v_program.id;
  return v_program.id;
end
$function$;

create or replace function public.training_department_cancel_program(p_organization_id uuid, p_program_key text)
returns uuid
language sql
security invoker
set search_path to ''
as $function$
  select private.training_department_cancel_program(p_organization_id, p_program_key)
$function$;

grant execute on function public.training_department_cancel_program(uuid, text) to authenticated;

-- 6. Υλικό προγράμματος: ποιος ανεβάζει αρχείο σε πρόγραμμα -----------------------------------------------------------
-- Ο Διευθυντής του τμήματος που διοργανώνει ένα πρόγραμμα τμήματος (ίδιοι έλεγχοι με τις συναρτήσεις, χωρίς εξαίρεση).
create or replace function private.training_department_manages_program(p_organization_id uuid, p_program_id text)
returns boolean
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_membership uuid;
  v_department uuid;
begin
  if auth.uid() is null or p_organization_id is null or private.password_change_pending() then return false; end if;
  if coalesce(p_program_id, '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  if 'training' = any (coalesce(private.org_disabled_modules(p_organization_id), '{}'::text[])) then return false; end if;
  select om.id into v_membership from public.organization_members om
   where om.user_id = auth.uid() and om.organization_id = p_organization_id and om.status = 'active' and om.role = 'department_manager'
   limit 1;
  select p.organizer_department_id into v_department from public.training_programs p
   where p.id = p_program_id::uuid and p.organization_id = p_organization_id and p.created_by_department_manager
     and p.status not in ('completed', 'cancelled');
  return private.training_department_in_scope(v_membership, p_organization_id, v_department);
end
$function$;

grant execute on function private.training_department_manages_program(uuid, text) to authenticated;

-- Νέο RESTRICTIVE policy (δεν αλλάζει κανένα υπάρχον): για κάθε άλλο entity_type είναι πάντα αληθές.
do $policies$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'attachments' and policyname = 'attachments_training_program_insert_scope') then
    create policy attachments_training_program_insert_scope on public.attachments as restrictive for insert to authenticated with check (
      entity_type <> 'training_program'
      or public.current_user_has_capability(organization_id, 'manage_training')
      or private.training_department_manages_program(organization_id, entity_id));
  end if;
end
$policies$;
