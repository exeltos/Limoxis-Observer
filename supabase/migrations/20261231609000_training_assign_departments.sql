-- Ανάθεση εκπαίδευσης σε τμήματα (ιδιοκτήτης, 21/11/2026, «ναι σε όλα»): όσοι διαχειρίζονται την εκπαίδευση
-- (manage_training) αναθέτουν ένα πρόγραμμα σε ένα ή περισσότερα τμήματα ή σε όλο το νοσοκομείο· προστίθενται όλοι οι
-- ενεργοί εργαζόμενοι των τμημάτων, χωρίς διπλές αναθέσεις. Με την επιλογή «Και όσοι προστεθούν αργότερα στα τμήματα»
-- οι νέοι εργαζόμενοι (ή όσοι μετακινούνται στο τμήμα) προστίθενται αυτόματα.
--
-- 1. public.current_user_has_capability: ο ορισμός της 20261231450000 με δύο αλλαγές, ίδιες με το
--    src/core/permissions/systemRoleMatrix.ts: manage_training και στο Μέλος Ομάδας Λοιμώξεων (infection_control_member)
--    και στον Υπεύθυνο Ποιότητας (quality_manager)· view_training και στον Υπεύθυνο Ποιότητας (για να ανοίγει την ενότητα).
-- 2. public.training_program_department_targets: τα τμήματα που «ακολουθεί» ένα πρόγραμμα (department_id null = όλο το
--    νοσοκομείο), ένα ανά πρόγραμμα και τμήμα. Ανάγνωση για όσους βλέπουν ή διαχειρίζονται την εκπαίδευση· καμία πολιτική
--    εγγραφής (γράφεται μόνο από τις συναρτήσεις)· κλείνει με την ενότητα Εκπαίδευση (<πίνακας>_module_gate).
-- 3. private.training_manage_guard(p_organization_id): οι έλεγχοι του καλούντα (auth.uid, προσωρινός κωδικός, ενεργή
--    συμμετοχή, ενότητα Εκπαίδευση ανοιχτή, manage_training).
-- 4. private.training_add_program_employees(...): οι αναθέσεις για μια λίστα εργαζομένων, με τις στήλες της
--    training_department_set_participants (20261231608000)· όποιος συμμετέχει ήδη δεν προστίθεται ξανά, μια ακυρωμένη
--    ανάθεση επανέρχεται. SECURITY INVOKER: καλείται μόνο από τις SECURITY DEFINER συναρτήσεις παρακάτω.
-- 5. public.training_assign_departments_preview(...): μόνο αριθμοί (πόσοι εργαζόμενοι, πόσοι θα προστεθούν, πόσοι ήδη
--    συμμετέχουν), για το «Θα προστεθούν N εργαζόμενοι» πριν την επιβεβαίωση. Κανένα όνομα.
-- 6. public.training_assign_departments(...): η ανάθεση· επιστρέφει τους αριθμούς.
-- 7. public.training_stop_department_target(p_organization_id, p_target_id): σταματά την αυτόματη προσθήκη (active = false).
-- 8. Trigger στο public.employees (μετά από εισαγωγή, και από αλλαγή τμήματος ή κατάστασης απασχόλησης): ο ενεργός
--    εργαζόμενος παίρνει τα προγράμματα που ακολουθούν το τμήμα του (ή όλο το νοσοκομείο) και δεν έχουν ολοκληρωθεί ή
--    ακυρωθεί. Παραλείπεται όσο δουλεύει ο κάδος ανακύκλωσης (limoxis.bin = on).
--
-- Κάθε λογική είναι σε SECURITY DEFINER συνάρτηση του σχήματος private με set search_path to ''· το API καλεί τη
-- συνάρτηση public με το ίδιο όνομα, SECURITY INVOKER, που απλώς την καλεί (όπως η training_department_set_participants).
-- Μόνο create table / index if not exists, create or replace, create policy (με έλεγχο), create or replace trigger και grant.

-- 1. Ρόλοι: manage_training στο Μέλος Ομάδας Λοιμώξεων και στον Υπεύθυνο Ποιότητας --------------------------------------
create or replace function public.current_user_has_capability(target_org uuid, capability_key text)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select public.current_user_is_platform_owner()
  or (not private.password_change_pending() and ((
    exists (
      select 1
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = target_org
        and om.status = 'active'
        and om.role = 'hospital_admin'
        and capability_key not in ('view_platform','manage_platform')
        and (
          capability_key not in ('view_occupational_health','manage_occupational_health')
          or exists (select 1 from public.organizations o where o.id = target_org and o.is_demo)
        )
    )
    or exists (
      select 1
      from public.organization_members om
      where om.user_id=auth.uid()
        and om.organization_id=target_org
        and om.status='active'
        and (
          exists (
            select 1
            from public.custom_role_capabilities crc
            where crc.custom_role_id=om.custom_role_id
              and crc.capability=capability_key
          )
          or exists (
            select 1
            from public.organization_member_capabilities omc
            where omc.membership_id=om.id
              and (
                (omc.capability='lab_access' and capability_key='view_lab')
                or (omc.capability='quality_access' and capability_key in ('view_quality','view_controls'))
              )
          )
          or case capability_key
            when 'view_training' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','link_nurse','department_manager','department_user','hr_office','division_director','quality_manager')
            when 'manage_training' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','quality_manager')
            when 'view_prevention' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','link_nurse')
            when 'view_lab' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','laboratory','doctor_reviewer')
            when 'manage_libraries' then om.role in ('hospital_admin','infection_control_lead')
            when 'view_controls' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','link_nurse','department_manager','department_user','laboratory','quality_manager','division_director')
            when 'manage_controls' then om.role in ('hospital_admin','infection_control_lead','quality_manager')
            when 'view_indicators' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','link_nurse','department_manager','pharmacy','doctor_reviewer','quality_manager','hospital_director')
            when 'manage_indicators' then om.role in ('hospital_admin','infection_control_lead','quality_manager')
            when 'record_pharmacy' then om.role in ('hospital_admin','infection_control_lead','pharmacy')
            when 'record_prevalence_survey' then om.role in ('hospital_admin','infection_control_lead','infection_control_member')
            when 'record_hand_hygiene' then om.role in ('link_nurse')
            when 'record_waste' then om.role in ('link_nurse')
            when 'record_antiseptic' then om.role in ('link_nurse')
            when 'record_prevention_bundle' then om.role in ('link_nurse')
            when 'view_kitchen' then om.role in ('hospital_admin','infection_control_lead','quality_manager')
            when 'record_kitchen' then om.role in ('hospital_admin','quality_manager')
            when 'manage_kitchen' then om.role in ('hospital_admin','quality_manager')
            when 'view_executive_dashboard' then om.role in ('hospital_admin','hospital_director')
            when 'view_interviews' then om.role in ('hospital_admin','hr_office')
            when 'manage_interviews' then om.role in ('hospital_admin','hr_office')
            when 'report_incident' then true
            else false
          end
        )
    )
  )
  and not (capability_key = any (private.org_disabled_capabilities(target_org)))));
$function$;

-- 2. Τα τμήματα που ακολουθεί ένα πρόγραμμα ------------------------------------------------------------------------------
create table if not exists public.training_program_department_targets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  program_id uuid not null,
  department_id uuid references public.departments(id) on delete cascade,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  active boolean not null default true,
  foreign key (program_id, organization_id) references public.training_programs(id, organization_id) on delete cascade
);
-- Ένα ανά πρόγραμμα και τμήμα· το «όλο το νοσοκομείο» (department_id null) μία φορά.
create unique index if not exists training_program_department_targets_key
  on public.training_program_department_targets (program_id, coalesce(department_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists training_program_department_targets_org_idx on public.training_program_department_targets (organization_id, active);
create index if not exists training_program_department_targets_department_idx on public.training_program_department_targets (department_id);

alter table public.training_program_department_targets enable row level security;

do $policies$
declare
  gate text := '(select not private.current_user_has_locked_modules()) or organization_id is null or not (organization_id = any ((select private.current_user_locked_module_orgs(''{training}''::text[]))::uuid[]))';
begin
  -- Ανάγνωση: όσοι βλέπουν ή διαχειρίζονται την εκπαίδευση του νοσοκομείου.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'training_program_department_targets' and policyname = 'training_program_department_targets_read') then
    create policy training_program_department_targets_read on public.training_program_department_targets for select to authenticated using (
      (select public.current_user_is_platform_owner())
      or coalesce(organization_id = any ((select private.fast_orgs_capability('view_training'))::uuid[]), false)
      or coalesce(organization_id = any ((select private.fast_orgs_capability('manage_training'))::uuid[]), false));
  end if;
  -- Κλείνει με την ενότητα Εκπαίδευση, όπως οι άλλοι πίνακες της εκπαίδευσης.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'training_program_department_targets' and policyname = 'training_program_department_targets_module_gate') then
    execute format('create policy training_program_department_targets_module_gate on public.training_program_department_targets as restrictive for all to authenticated using (%s) with check (%s)', gate, gate);
  end if;
end
$policies$;

grant select on public.training_program_department_targets to authenticated;

-- 3. Οι έλεγχοι του καλούντα -------------------------------------------------------------------------------------------
create or replace function private.training_manage_guard(p_organization_id uuid)
returns void
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
end
$function$;

-- Βοηθητικές, SECURITY INVOKER: τρέχουν με τα δικαιώματα της SECURITY DEFINER συνάρτησης που τις καλεί.
-- Οι ενεργοί εργαζόμενοι των τμημάτων (ή όλου του νοσοκομείου).
create or replace function private.training_department_employees(p_organization_id uuid, p_department_ids uuid[], p_all boolean)
returns uuid[]
language sql
stable
security invoker
set search_path to ''
as $function$
  select coalesce(array_agg(e.id), '{}'::uuid[]) from public.employees e
   where e.organization_id = p_organization_id
     and coalesce(e.employment_status, 'active') = 'active'
     and (coalesce(p_all, false) or e.department_id = any (coalesce(p_department_ids, '{}'::uuid[])))
$function$;

-- Ο εργαζόμενος συμμετέχει ήδη: μια ανάθεση που δεν έχει ακυρωθεί (με τον εργαζόμενο ή με τον κωδικό του).
create or replace function private.training_employee_participates(p_program_id uuid, p_employee_id uuid)
returns boolean
language sql
stable
security invoker
set search_path to ''
as $function$
  select exists (select 1 from public.training_assignments a
                   join public.employees e on e.id = p_employee_id
                  where a.program_id = p_program_id and a.status <> 'cancelled'
                    and (a.employee_id = e.id
                         or (a.employee_id is null and a.organization_id = e.organization_id
                             and nullif(btrim(coalesce(a.employee_code, '')), '') = nullif(btrim(coalesce(e.employee_code, '')), ''))))
$function$;

-- Ο κατάλογος τμημάτων: αφαιρεί τα κενά και τα διπλά· κάθε τμήμα πρέπει να ανήκει στο νοσοκομείο.
create or replace function private.training_checked_departments(p_organization_id uuid, p_department_ids uuid[])
returns uuid[]
language plpgsql
stable
security invoker
set search_path to ''
as $function$
declare
  v_ids uuid[] := coalesce((select array_agg(distinct x) from unnest(coalesce(p_department_ids, '{}'::uuid[])) x where x is not null), '{}'::uuid[]);
begin
  if cardinality(v_ids) > 200 then
    raise exception 'TRAINING_DEPARTMENTS_TOO_MANY' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_ids) x(id)
              where not exists (select 1 from public.departments d where d.id = x.id and d.organization_id = p_organization_id)) then
    raise exception 'TRAINING_DEPARTMENT_NOT_FOUND' using errcode = '22023';
  end if;
  return v_ids;
end
$function$;

-- 4. Οι αναθέσεις για μια λίστα εργαζομένων ------------------------------------------------------------------------------
-- SECURITY INVOKER: τρέχει με τα δικαιώματα της συνάρτησης που την καλεί (training_assign_departments, το trigger).
create or replace function private.training_add_program_employees(p_organization_id uuid, p_program_id uuid, p_due_date date, p_employee_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  v_ids uuid[] := coalesce((select array_agg(distinct x) from unnest(coalesce(p_employee_ids, '{}'::uuid[])) x where x is not null), '{}'::uuid[]);
  v_today date := (now() at time zone 'Europe/Athens')::date;
  v_restored integer := 0;
  v_added integer := 0;
begin
  if cardinality(v_ids) = 0 then return 0; end if;

  -- Ξανά στο πρόγραμμα: η τελευταία ακυρωμένη ανάθεση επανέρχεται (μία ανά εργαζόμενο).
  with restored as (
    update public.training_assignments a set status = 'assigned', due_date = p_due_date, assigned_date = v_today,
           updated_by = auth.uid(), updated_at = now()
     where a.organization_id = p_organization_id and a.program_id = p_program_id and a.status = 'cancelled'
       and a.employee_id = any (v_ids)
       and not private.training_employee_participates(p_program_id, a.employee_id)
       and a.id = (select c.id from public.training_assignments c
                    where c.program_id = a.program_id and c.employee_id = a.employee_id and c.status = 'cancelled'
                    order by c.created_at desc limit 1)
    returning 1)
  select count(*) into v_restored from restored;

  -- Νέες αναθέσεις με τις στήλες της training_department_set_participants (συμμετέχων από το προσωπικό).
  with added as (
    insert into public.training_assignments (organization_id, assignment_key, program_id, employee_id, employee_code, employee_name, department_name,
      department_id, employee_user_id, email, account_linked, manual_entry, assigned_date, due_date, status)
    select p_organization_id, 'TRA-G-' || replace(gen_random_uuid()::text, '-', ''), p_program_id, e.id,
      nullif(btrim(coalesce(e.employee_code, '')), ''), nullif(btrim(concat_ws(' ', e.first_name, e.last_name)), ''),
      coalesce((select d.name from public.departments d where d.id = e.department_id), nullif(btrim(coalesce(e.department_name, '')), '')),
      e.department_id, e.user_id, nullif(btrim(coalesce(e.email, '')), ''), e.user_id is not null, false,
      v_today, p_due_date, 'assigned'
      from public.employees e
     where e.id = any (v_ids) and e.organization_id = p_organization_id
       and coalesce(e.employment_status, 'active') = 'active'
       and not private.training_employee_participates(p_program_id, e.id)
       and not exists (select 1 from public.training_assignments a
                        where a.organization_id = p_organization_id and a.program_id = p_program_id and a.employee_id = e.id)
    returning 1)
  select count(*) into v_added from added;

  return v_restored + v_added;
end
$function$;

-- 5. Πριν την επιβεβαίωση: μόνο αριθμοί -------------------------------------------------------------------------------
create or replace function private.training_assign_departments_preview(p_organization_id uuid, p_program_key text, p_department_ids uuid[], p_all boolean)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_program public.training_programs%rowtype;
  v_departments uuid[];
  v_employees uuid[];
  v_already integer;
begin
  perform private.training_manage_guard(p_organization_id);
  select * into v_program from public.training_programs p
   where p.organization_id = p_organization_id and p.program_key = p_program_key;
  if not found then raise exception 'TRAINING_PROGRAM_NOT_FOUND' using errcode = '22023'; end if;
  v_departments := private.training_checked_departments(p_organization_id, p_department_ids);
  v_employees := private.training_department_employees(p_organization_id, v_departments, p_all);
  select count(*) into v_already from unnest(v_employees) x(id) where private.training_employee_participates(v_program.id, x.id);
  return jsonb_build_object('employees', cardinality(v_employees), 'already', v_already, 'toAdd', cardinality(v_employees) - v_already);
end
$function$;

create or replace function public.training_assign_departments_preview(p_organization_id uuid, p_program_key text, p_department_ids uuid[], p_all boolean)
returns jsonb
language sql
stable
security invoker
set search_path to ''
as $function$
  select private.training_assign_departments_preview(p_organization_id, p_program_key, p_department_ids, p_all)
$function$;

grant execute on function public.training_assign_departments_preview(uuid, text, uuid[], boolean) to authenticated;

-- 6. Η ανάθεση σε τμήματα ----------------------------------------------------------------------------------------------
create or replace function private.training_assign_departments(p_organization_id uuid, p_program_key text, p_department_ids uuid[], p_all boolean, p_follow_new boolean)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_program public.training_programs%rowtype;
  v_all boolean := coalesce(p_all, false);
  v_departments uuid[];
  v_employees uuid[];
  v_already integer;
  v_added integer;
  v_targets uuid[] := '{}'::uuid[];
  v_target uuid;
begin
  perform private.training_manage_guard(p_organization_id);
  select * into v_program from public.training_programs p
   where p.organization_id = p_organization_id and p.program_key = p_program_key
   for update;
  if not found then raise exception 'TRAINING_PROGRAM_NOT_FOUND' using errcode = '22023'; end if;
  if v_program.status in ('completed', 'cancelled') then
    raise exception 'TRAINING_PROGRAM_LOCKED' using errcode = '22023';
  end if;
  v_departments := private.training_checked_departments(p_organization_id, p_department_ids);
  if not v_all and cardinality(v_departments) = 0 then
    raise exception 'TRAINING_DEPARTMENTS_REQUIRED' using errcode = '22023';
  end if;

  v_employees := private.training_department_employees(p_organization_id, v_departments, v_all);
  select count(*) into v_already from unnest(v_employees) x(id) where private.training_employee_participates(v_program.id, x.id);
  v_added := private.training_add_program_employees(p_organization_id, v_program.id, v_program.due_date, v_employees);

  -- «Και όσοι προστεθούν αργότερα στα τμήματα»: ένας στόχος ανά τμήμα (ή ένας για όλο το νοσοκομείο)· ένας σταματημένος
  -- ξαναρχίζει.
  if coalesce(p_follow_new, false) then
    for v_target in select x from unnest(case when v_all then array[null::uuid] else v_departments end) x
    loop
      update public.training_program_department_targets t set active = true
       where t.program_id = v_program.id and t.department_id is not distinct from v_target and not t.active;
      if not exists (select 1 from public.training_program_department_targets t
                      where t.program_id = v_program.id and t.department_id is not distinct from v_target) then
        insert into public.training_program_department_targets (organization_id, program_id, department_id, created_by)
        values (p_organization_id, v_program.id, v_target, auth.uid());
      end if;
      v_targets := v_targets || coalesce(v_target, '00000000-0000-0000-0000-000000000000'::uuid);
    end loop;
  end if;

  return jsonb_build_object('employees', cardinality(v_employees), 'already', v_already, 'added', v_added,
    'following', cardinality(v_targets));
end
$function$;

create or replace function public.training_assign_departments(p_organization_id uuid, p_program_key text, p_department_ids uuid[], p_all boolean, p_follow_new boolean)
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select private.training_assign_departments(p_organization_id, p_program_key, p_department_ids, p_all, p_follow_new)
$function$;

grant execute on function public.training_assign_departments(uuid, text, uuid[], boolean, boolean) to authenticated;

-- 7. Σταμάτημα της αυτόματης προσθήκης ----------------------------------------------------------------------------------
create or replace function private.training_stop_department_target(p_organization_id uuid, p_target_id uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_id uuid;
begin
  perform private.training_manage_guard(p_organization_id);
  update public.training_program_department_targets t set active = false
   where t.id = p_target_id and t.organization_id = p_organization_id
  returning t.id into v_id;
  if v_id is null then raise exception 'TRAINING_TARGET_NOT_FOUND' using errcode = '22023'; end if;
  return v_id;
end
$function$;

create or replace function public.training_stop_department_target(p_organization_id uuid, p_target_id uuid)
returns uuid
language sql
security invoker
set search_path to ''
as $function$
  select private.training_stop_department_target(p_organization_id, p_target_id)
$function$;

grant execute on function public.training_stop_department_target(uuid, uuid) to authenticated;

-- 8. Οι νέοι εργαζόμενοι των τμημάτων -----------------------------------------------------------------------------------
-- Μετά από εισαγωγή εργαζομένου, ή αλλαγή του τμήματος ή της κατάστασης απασχόλησης: ο ενεργός εργαζόμενος παίρνει κάθε
-- πρόγραμμα που ακολουθεί το τμήμα του (ή όλο το νοσοκομείο), δεν έχει ολοκληρωθεί ή ακυρωθεί και δεν τον έχει ήδη.
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
    perform private.training_add_program_employees(new.organization_id, v_program.id, v_program.due_date, array[new.id]);
  end loop;
  return new;
end
$function$;

create or replace trigger trg_employees_training_department_targets
  after insert or update of department_id, employment_status on public.employees
  for each row
  when (current_setting('limoxis.bin', true) is distinct from 'on')
  execute function private.training_follow_department_targets();
