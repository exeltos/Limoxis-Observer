-- Αιτήσεις συμμετοχής σε εκπαίδευση (ιδιοκτήτης, 20/11/2026): η «Εκπαίδευση» των τμημάτων δείχνει μόνο προγράμματα,
-- και ένας εργαζόμενος που δεν συμμετέχει σε ένα πρόγραμμα που δεν έχει ολοκληρωθεί κάνει «Αίτηση συμμετοχής». Όσοι
-- διαχειρίζονται την εκπαίδευση (manage_training) την αποδέχονται (δημιουργείται η ανάθεση) ή την απορρίπτουν με
-- αιτιολογία.
--
-- 1. public.training_participation_requests: μία αίτηση ανά πρόγραμμα και αιτούντα (μία σε αναμονή κάθε φορά). Ο
--    αιτών βλέπει τις δικές του, όσοι έχουν manage_training όλες του νοσοκομείου. Καμία πολιτική εισαγωγής ή αλλαγής:
--    γράφεται μόνο από τις συναρτήσεις παρακάτω. Κλείνει με την ενότητα Εκπαίδευση (<πίνακας>_module_gate).
-- 2. public.training_request_participation(p_organization_id, p_program_key, p_note): η αίτηση του χρήστη.
-- 3. public.training_decide_participation(p_request_id, p_accept, p_reason): αποδοχή (η ανάθεση φτιάχνεται με τις
--    στήλες που γράφει η training_save_assignment όταν ο διαχειριστής προσθέτει συμμετέχοντα) ή απόρριψη με αιτιολογία.
-- 4. public.training_cancel_participation_request(p_request_id): ο αιτών αποσύρει τη δική του αίτηση σε αναμονή.
-- 5. public.training_program_participation(p_organization_id): μόνο αριθμοί, ανά πρόγραμμα και τμήμα (πόσοι
--    ανατέθηκαν, πόσοι ολοκλήρωσαν), για τη στήλη «Συμμετοχή τμήματος». Κανένα όνομα.
--
-- Κάθε λογική είναι σε SECURITY DEFINER συνάρτηση του σχήματος private (δεν εκτίθεται στο API)· το API καλεί τη
-- συνάρτηση public με το ίδιο όνομα, SECURITY INVOKER, που απλώς την καλεί (όπως η training_my_access).
-- Μόνο create (if not exists), create or replace, create policy στον νέο πίνακα και grant.

-- 1. Ο πίνακας ---------------------------------------------------------------------------------------------------------
create table if not exists public.training_participation_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  program_id uuid not null,
  requester_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  requester_name text,
  department_id uuid references public.departments(id) on delete set null,
  department_name text,
  note text check (note is null or length(note) <= 1000),
  status text not null default 'pending' check (status in ('pending','accepted','rejected','cancelled')),
  decision_reason text check (decision_reason is null or length(decision_reason) <= 1000),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  assignment_id uuid references public.training_assignments(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (program_id, organization_id) references public.training_programs(id, organization_id) on delete cascade
);
create unique index if not exists training_participation_requests_pending_key
  on public.training_participation_requests (program_id, requester_user_id) where status = 'pending';
create index if not exists training_participation_requests_org_status_idx on public.training_participation_requests (organization_id, status);
create index if not exists training_participation_requests_requester_idx on public.training_participation_requests (requester_user_id);
create index if not exists training_participation_requests_program_idx on public.training_participation_requests (program_id);

alter table public.training_participation_requests enable row level security;

do $policies$
declare
  gate text := '(select not private.current_user_has_locked_modules()) or organization_id is null or not (organization_id = any ((select private.current_user_locked_module_orgs(''{training}''::text[]))::uuid[]))';
begin
  -- Ανάγνωση: οι δικές μου αιτήσεις, ή όλες του νοσοκομείου για όσους διαχειρίζονται την εκπαίδευση.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'training_participation_requests' and policyname = 'training_participation_requests_read') then
    create policy training_participation_requests_read on public.training_participation_requests for select to authenticated using (
      requester_user_id = (select auth.uid())
      or (select public.current_user_is_platform_owner())
      or coalesce(organization_id = any ((select private.fast_orgs_capability('manage_training'))::uuid[]), false));
  end if;
  -- Κλείνει με την ενότητα Εκπαίδευση, όπως οι άλλοι πίνακες της εκπαίδευσης.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'training_participation_requests' and policyname = 'training_participation_requests_module_gate') then
    execute format('create policy training_participation_requests_module_gate on public.training_participation_requests as restrictive for all to authenticated using (%s) with check (%s)', gate, gate);
  end if;
end
$policies$;

grant select on public.training_participation_requests to authenticated;

-- 2. Η αίτηση ---------------------------------------------------------------------------------------------------------
create or replace function private.training_request_participation(p_organization_id uuid, p_program_key text, p_note text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_program public.training_programs%rowtype;
  v_employee public.employees%rowtype;
  v_department uuid;
  v_department_name text;
  v_name text;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if p_organization_id is null or nullif(btrim(coalesce(p_program_key, '')), '') is null then
    raise exception 'TRAINING_PROGRAM_NOT_FOUND' using errcode = '22023';
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

  select * into v_program from public.training_programs p
   where p.organization_id = p_organization_id and p.program_key = p_program_key;
  if not found then raise exception 'TRAINING_PROGRAM_NOT_FOUND' using errcode = '22023'; end if;
  if v_program.status in ('cancelled', 'completed') then
    raise exception 'TRAINING_REQUEST_NOT_AVAILABLE' using errcode = '22023';
  end if;

  -- Ο εργαζόμενος του λογαριασμού (όταν είναι συνδεδεμένος) και το τμήμα του· αλλιώς το τμήμα της πρόσβασης.
  select * into v_employee from public.employees e
   where e.organization_id = p_organization_id and e.user_id = auth.uid()
   order by (e.employment_status = 'active') desc nulls last, e.updated_at desc nulls last
   limit 1;
  v_department := v_employee.department_id;
  if v_department is null then
    select s.department_id into v_department
      from public.organization_member_scopes s
      join public.organization_members m on m.id = s.membership_id
     where m.user_id = auth.uid() and m.organization_id = p_organization_id and m.status = 'active' and s.department_id is not null
     order by s.created_at
     limit 1;
  end if;
  select d.name into v_department_name from public.departments d where d.id = v_department and d.organization_id = p_organization_id;
  v_department_name := coalesce(v_department_name, nullif(btrim(coalesce(v_employee.department_name, '')), ''));
  v_name := coalesce(nullif(btrim(concat_ws(' ', v_employee.first_name, v_employee.last_name)), ''),
    (select nullif(btrim(pr.full_name), '') from public.profiles pr where pr.id = auth.uid()),
    (select nullif(btrim(u.email), '') from auth.users u where u.id = auth.uid()));

  -- Ήδη συμμετέχει (η ίδια ανάθεση που ανοίγει η training_my_access): δεν χρειάζεται αίτηση.
  if exists (select 1 from public.training_assignments a
              where a.organization_id = p_organization_id and a.program_id = v_program.id and a.status <> 'cancelled'
                and (a.employee_user_id = auth.uid() or (v_employee.id is not null and a.employee_id = v_employee.id))) then
    raise exception 'TRAINING_ALREADY_ASSIGNED' using errcode = '22023';
  end if;
  if exists (select 1 from public.training_participation_requests r
              where r.program_id = v_program.id and r.requester_user_id = auth.uid() and r.status = 'pending') then
    raise exception 'TRAINING_REQUEST_PENDING' using errcode = '22023';
  end if;

  insert into public.training_participation_requests (organization_id, program_id, requester_user_id, employee_id, requester_name,
    department_id, department_name, note)
  values (p_organization_id, v_program.id, auth.uid(), v_employee.id, v_name, v_department, v_department_name,
    nullif(left(btrim(coalesce(p_note, '')), 1000), ''))
  returning id into v_id;
  return v_id;
end
$function$;

create or replace function public.training_request_participation(p_organization_id uuid, p_program_key text, p_note text)
returns uuid
language sql
security invoker
set search_path to ''
as $function$
  select private.training_request_participation(p_organization_id, p_program_key, p_note)
$function$;

grant execute on function public.training_request_participation(uuid, text, text) to authenticated;

-- 3. Αποδοχή ή απόρριψη -------------------------------------------------------------------------------------------------
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

  if not p_accept then
    if nullif(btrim(coalesce(p_reason, '')), '') is null then
      raise exception 'TRAINING_REQUEST_REASON_REQUIRED' using errcode = '22023';
    end if;
    update public.training_participation_requests r
       set status = 'rejected', decision_reason = left(btrim(p_reason), 1000), decided_by = auth.uid(), decided_at = now()
     where r.id = v_request.id;
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
  return v_request.id;
end
$function$;

create or replace function public.training_decide_participation(p_request_id uuid, p_accept boolean, p_reason text)
returns uuid
language sql
security invoker
set search_path to ''
as $function$
  select private.training_decide_participation(p_request_id, p_accept, p_reason)
$function$;

grant execute on function public.training_decide_participation(uuid, boolean, text) to authenticated;

-- 4. Απόσυρση από τον αιτούντα ------------------------------------------------------------------------------------------
create or replace function private.training_cancel_participation_request(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_request public.training_participation_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if private.password_change_pending() then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  -- Μόνο η δική σου αίτηση· η αίτηση άλλου απαντά ότι δεν βρέθηκε.
  select * into v_request from public.training_participation_requests r
   where r.id = p_request_id and r.requester_user_id = auth.uid()
   for update;
  if not found then raise exception 'TRAINING_REQUEST_NOT_FOUND' using errcode = '22023'; end if;
  if not exists (select 1 from public.organization_members om
                  where om.user_id = auth.uid() and om.organization_id = v_request.organization_id and om.status = 'active') then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if 'training' = any (coalesce(private.org_disabled_modules(v_request.organization_id), '{}'::text[])) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'TRAINING_REQUEST_ALREADY_DECIDED' using errcode = '22023';
  end if;
  update public.training_participation_requests r set status = 'cancelled', decided_by = auth.uid(), decided_at = now()
   where r.id = v_request.id;
  return v_request.id;
end
$function$;

create or replace function public.training_cancel_participation_request(p_request_id uuid)
returns uuid
language sql
security invoker
set search_path to ''
as $function$
  select private.training_cancel_participation_request(p_request_id)
$function$;

grant execute on function public.training_cancel_participation_request(uuid) to authenticated;

-- 5. Η συμμετοχή ανά πρόγραμμα και τμήμα (μόνο αριθμοί) -----------------------------------------------------------------
create or replace function private.training_program_participation(p_organization_id uuid)
returns table (program_key text, department_id uuid, department_name text, assigned integer, completed integer)
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
    select p.program_key, a.department_id, coalesce(d.name, nullif(btrim(a.department_name), ''))::text,
           count(*)::integer, (count(*) filter (where a.status = 'completed'))::integer
      from public.training_assignments a
      join public.training_programs p on p.id = a.program_id and p.organization_id = a.organization_id
      left join public.departments d on d.id = a.department_id
     where a.organization_id = p_organization_id and a.status <> 'cancelled' and p.status <> 'cancelled'
     group by p.program_key, a.department_id, coalesce(d.name, nullif(btrim(a.department_name), ''));
end
$function$;

create or replace function public.training_program_participation(p_organization_id uuid)
returns table (program_key text, department_id uuid, department_name text, assigned integer, completed integer)
language sql
stable
security invoker
set search_path to ''
as $function$
  select * from private.training_program_participation(p_organization_id)
$function$;

grant execute on function public.training_program_participation(uuid) to authenticated;
