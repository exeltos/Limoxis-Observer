-- Διευθυντής Διεύθυνσης: μόνο ανάγνωση, βοηθοί, πολιτικές ανάγνωσης και σύνοψη (public.division_overview).
-- Τρέχει ο ιδιοκτήτης στο SQL Editor: οι μεταναστεύσεις 20261231430000–20261231460000 με τη σειρά, σε μία συναλλαγή.

begin;

-- ===== 20261231430000_division_director_read_only.sql =====
-- Διευθυντής Διεύθυνσης: μόνο ανάγνωση (12/11/2026).
--
-- Ο Διευθυντής Διεύθυνσης παίρνει αυτόματα πρόσβαση τμήματος (organization_member_scopes, granted_by_division) στα
-- τμήματα των διευθύνσεών του. Κάποιες πολιτικές εγγραφής εμπιστεύονται την πρόσβαση τμήματος χωρίς έλεγχο ρόλου
-- (βιβλία τμήματος register_*, συναντήσεις τμήματος ποιότητας, συμβάντα εξοπλισμού, ερωτηματολόγια ικανοποίησης,
-- πρόχειρα ελέγχων). Ο ιδιοκτήτης αποφάσισε: ο Διευθυντής Διεύθυνσης μόνο διαβάζει.
--
-- Εδώ: ο βοηθός private.current_user_is_division_director(org) και περιοριστικές (RESTRICTIVE) πολιτικές
-- <πίνακας>_dd_read_only_{insert,update,delete} που κόβουν κάθε εγγραφή του ρόλου σε αυτούς τους πίνακες και σε όσους
-- ανοίγουν για ανάγνωση στις επόμενες μεταναστεύσεις. Για τα δυναμικά βιβλία τμήματος τις προσθέτει ο
-- private.register_fast_policies (που καλείται μετά από κάθε department_register_sync) και ένα μπλοκ για τα υπάρχοντα.
-- Μόνο προσθήκες: καμία υπάρχουσα πολιτική δεν αλλάζει.
-- Εξαίρεση: η αναφορά συμβάντος (quality_incidents insert) μένει ανοιχτή σε κάθε μέλος, όπως ορίστηκε στο
-- 20261231250000_role_capability_alignment.sql· κόβονται μόνο η ενημέρωση και η διαγραφή.

create or replace function private.current_user_is_division_director(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select p_organization_id is not null and exists (
    select 1
      from public.organization_members om
     where om.user_id = auth.uid()
       and om.organization_id = p_organization_id
       and om.status = 'active'
       and om.role = 'division_director'
  );
$function$;
revoke all on function private.current_user_is_division_director(uuid) from public, anon;
grant execute on function private.current_user_is_division_director(uuid) to authenticated;

-- Οι τρεις περιοριστικές πολιτικές σε έναν πίνακα, μόνο όσες λείπουν (ο πίνακας έχει organization_id).
create or replace function private.add_division_director_read_only(p_table text, p_commands text[] default array['insert','update','delete'])
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_command text;
  v_policy text;
begin
  if p_table is null or to_regclass(format('public.%I', p_table)) is null then
    return;
  end if;
  foreach v_command in array p_commands loop
    v_policy := left(p_table, 42) || '_dd_read_only_' || v_command;
    if exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = p_table and p.policyname = v_policy) then
      continue;
    end if;
    if v_command = 'insert' then
      execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (not private.current_user_is_division_director(organization_id))', v_policy, p_table);
    elsif v_command = 'update' then
      execute format('create policy %I on public.%I as restrictive for update to authenticated using (not private.current_user_is_division_director(organization_id)) with check (not private.current_user_is_division_director(organization_id))', v_policy, p_table);
    elsif v_command = 'delete' then
      execute format('create policy %I on public.%I as restrictive for delete to authenticated using (not private.current_user_is_division_director(organization_id))', v_policy, p_table);
    end if;
  end loop;
end
$function$;
revoke all on function private.add_division_director_read_only(text, text[]) from public, anon, authenticated;

-- Πίνακες με πολιτικές εγγραφής που εμπιστεύονται την πρόσβαση τμήματος χωρίς ρόλο, και όσοι ανοίγουν για ανάγνωση.
do $do$
declare
  v_table text;
begin
  foreach v_table in array array[
    -- Τρύπες εγγραφής μέσω πρόσβασης τμήματος.
    'quality_department_meetings',
    'quality_department_meeting_decisions',
    'quality_department_meeting_participants',
    'quality_department_meeting_topics',
    'quality_department_meeting_trainings',
    'quality_equipment_events',
    'quality_survey_responses',
    'control_drafts',
    -- Πίνακες που ανοίγουν για ανάγνωση στον Διευθυντή Διεύθυνσης.
    'department_rosters',
    'roster_requests',
    'employees',
    'employee_training_summary',
    'training_assignments',
    'training_records',
    'hand_hygiene_sessions',
    'hand_hygiene_observations',
    'control_definitions',
    'control_assignments',
    'control_assignment_stats',
    'control_executions',
    'control_execution_revisions'
  ] loop
    perform private.add_division_director_read_only(v_table);
  end loop;
  -- Συμβάντα: η αναφορά μένει ανοιχτή σε όλους· όχι ενημέρωση ή διαγραφή.
  perform private.add_division_director_read_only('quality_incidents', array['update','delete']);
end
$do$;

-- Βιβλία τμήματος: οι πολιτικές του βιβλίου και του πίνακα ταυτοτήτων του. Ίδια συμπεριφορά με πριν,
-- συν τις περιοριστικές πολιτικές του Διευθυντή Διεύθυνσης στο τέλος.
create or replace function private.register_fast_policies(p_register_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare r record;
begin
  select id, table_name, kind into r from public.department_registers where id = p_register_id;
  if r.table_name is null then return; end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = r.table_name and policyname = 'register_read') then
    execute format('alter policy register_read on public.%I using ((select private.register_can_read(%L::uuid)))', r.table_name, r.id);
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = r.table_name || '_identity' and policyname = 'register_identity_department') then
    execute format('alter policy register_identity_department on public.%I using ((select private.register_can_read_identity(%L::uuid)))', r.table_name || '_identity', r.id);
  end if;
  perform private.add_division_director_read_only(r.table_name);
  perform private.add_division_director_read_only(r.table_name || '_identity');
end;
$function$;

-- Τα βιβλία που υπάρχουν ήδη.
do $do$
declare
  v_register record;
begin
  for v_register in select r.table_name from public.department_registers r where r.table_name is not null loop
    perform private.add_division_director_read_only(v_register.table_name);
    perform private.add_division_director_read_only(v_register.table_name || '_identity');
  end loop;
end
$do$;

-- Αυτοαξιολόγηση ποιότητας: αποθηκεύεται μόνο μέσω της public.quality_self_assessment_save (security definer, δέχεται
-- την πρόσβαση τμήματος), άρα οι πολιτικές δεν αρκούν· ένας trigger κόβει κάθε αλλαγή από Διευθυντή Διεύθυνσης.
create or replace function private.division_director_read_only_guard()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if tg_op = 'DELETE' then
    if private.current_user_is_division_director(old.organization_id) then
      raise exception 'DIVISION_DIRECTOR_READ_ONLY' using errcode = '42501';
    end if;
    return old;
  end if;
  if private.current_user_is_division_director(new.organization_id) then
    raise exception 'DIVISION_DIRECTOR_READ_ONLY' using errcode = '42501';
  end if;
  return new;
end
$function$;
revoke all on function private.division_director_read_only_guard() from public, anon, authenticated;

create or replace trigger quality_self_assessments_division_director_read_only
  before insert or update or delete on public.quality_self_assessments
  for each row execute function private.division_director_read_only_guard();

-- ===== 20261231440000_division_director_helpers.sql =====
-- Διευθυντής Διεύθυνσης: βοηθοί ανάγνωσης (12/11/2026).
--
-- private.employee_professional_category(ειδικότητα, κατηγορία προσωπικού)
--     Η επαγγελματική κατηγορία ενός εργαζομένου (nursing, medical, paramedical, administrative, technical, support)
--     από το ελεύθερο κείμενο της ειδικότητας (π.χ. «190 ΝΟΣΗΛΕΥΤΗΣ/ΤΡΙΑ 2ΕΤΟΥΣ», «ΙΑΤΡΟΣ ΑΝΕΙΔΙΚΕΥΤΟΣ») και το
--     staff_category (employee | physician | external). Άγνωστη ειδικότητα → null (δεν τη βλέπει καμία διεύθυνση).
-- private.current_user_division_departments(org) / private.current_user_division_categories(org)
--     Τα τμήματα και οι κατηγορίες των διευθύνσεων που διευθύνει ο χρήστης (μόνο με ρόλο division_director).
-- private.current_user_division_scope_keys() / private.current_user_division_category_keys()
--     Τα ίδια ως κλειδιά «org:τμήμα» και «org:τμήμα:κατηγορία» για όλα τα νοσοκομεία του χρήστη, για τις πολιτικές
--     ανάγνωσης: υπολογίζονται μία φορά ανά ερώτημα (select …), όχι ανά γραμμή.

create or replace function private.employee_professional_category(p_profession_name text, p_staff_category text)
returns text
language sql
immutable
set search_path to ''
as $function$
  with t as (
    select upper(translate(lower(coalesce(p_profession_name, '')), 'άέήίόύώϊϋΐΰ' || chr(769) || chr(776), 'αεηιουωιυιυ')) as v
  )
  select case
    when p_staff_category = 'physician' then 'medical'
    when t.v ~ '(ΝΟΣΗΛΕΥ|ΝΟΣΗΛΕΥΤ|ΜΑΙΑ|ΜΑΙΕΥΤ|ΒΟΗΘ.*ΝΟΣΗΛ|NURS|MIDWI)' then 'nursing'
    when t.v ~ '((^|[^Α-ΩA-Z])ΙΑΤΡ(ΟΣ|ΟΙ|ΟΥ|ΩΝ|ΙΝΑ|ΕΣ)|ΟΔΟΝΤΙΑΤΡ|ΕΠΙΜΕΛΗΤ|ΕΙΔΙΚΕΥΟΜΕΝ|ΕΙΔΙΚΕΥΟΜΕΝΗ|PHYSICIAN|DOCTOR)' then 'medical'
    when t.v ~ '(ΤΕΧΝΟΛΟΓ|ΕΡΓΑΣΤΗΡ|ΦΥΣΙΚΟΘΕΡΑΠ|ΕΡΓΟΘΕΡΑΠ|ΛΟΓΟΘΕΡΑΠ|ΨΥΧΟΛΟΓ|ΚΟΙΝΩΝΙΚ|ΔΙΑΙΤΟΛΟΓ|ΔΙΑΤΡΟΦΟΛΟΓ|ΦΑΡΜΑΚ|ΧΗΜΙΚ|ΒΙΟΛΟΓ|ΑΚΤΙΝΟΛΟΓ|ΡΑΔΙΟΛΟΓ|ΕΠΙΣΚΕΠΤ|ΦΥΣΙΚΟΣ|ΟΠΤΙΚ|ΑΚΟΥΟΛΟΓ|THERAPIST|PHARMAC|TECHNOLOGIST)' then 'paramedical'
    when t.v ~ '(ΤΕΧΝΙΚ|ΗΛΕΚΤΡΟΛΟΓ|ΗΛΕΚΤΡΟΝΙΚ|ΜΗΧΑΝΙΚ|ΜΗΧΑΝΟΤΕΧΝ|ΜΗΧΑΝΟΔΗΓ|ΥΔΡΑΥΛΙΚ|ΨΥΚΤΙΚ|ΘΕΡΜΑΣΤ|ΣΥΝΤΗΡΗΤ|ΠΛΗΡΟΦΟΡΙΚ|ΤΕΧΝΙΤ|ΞΥΛΟΥΡΓ|ΕΛΑΙΟΧΡΩΜΑΤ|ΚΑΥΣΤΗΡ|ENGINEER|TECHNICIAN|MAINTENANCE)' then 'technical'
    when t.v ~ '(ΔΙΟΙΚΗΤ|ΔΙΟΙΚΗΣ|ΓΡΑΜΜΑΤ|ΛΟΓΙΣΤ|ΟΙΚΟΝΟΜ|ΥΠΑΛΛΗΛ|ΝΟΜΙΚ|ΔΙΚΗΓΟΡ|ΓΡΑΦΕΙ|ΑΡΧΕΙΟΘΕΤ|ΑΡΧΕΙΟΥ|ΤΗΛΕΦΩΝ|ΠΡΟΣΩΠΙΚΟΥ|ΔΙΑΧΕΙΡΙΣ|ΠΡΟΜΗΘ|ΜΙΣΘΟΔΟΣ|ΚΙΝΗΣΗΣ|ΓΡΑΦΕΑΣ|ADMIN|SECRETAR|CLERK|ACCOUNT)' then 'administrative'
    when t.v ~ '(ΒΟΗΘ|ΚΑΘΑΡΙ|ΤΡΑΥΜΑΤΙΟΦΟΡ|ΦΥΛΑΚ|ΦΥΛΑΞ|ΜΑΓΕΙΡ|ΤΡΑΠΕΖΟΚΟΜ|ΙΜΑΤΙΟΘΗΚ|ΙΜΑΤΙΣΜ|ΠΛΥΝΤ|ΑΠΟΘΗΚ|ΘΥΡΩΡ|ΚΛΗΤΗΡ|ΣΙΤΙΣ|ΕΣΤΙΑΣ|ΒΑΡΔΙΑΝ|ΥΠΟΣΤΗΡΙΚ|ΟΔΗΓ|ΤΑΧΥΜΕΤΑΦ|ΕΡΓΑΤ|ΚΗΠΟΥΡ|PORTER|CLEAN|SECURITY|DRIVER|COOK|KITCHEN|LAUNDRY)' then 'support'
    else null
  end
  from t;
$function$;
revoke all on function private.employee_professional_category(text, text) from public, anon;
grant execute on function private.employee_professional_category(text, text) to authenticated;

create or replace function private.current_user_division_departments(p_organization_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(array_agg(distinct dd.department_id), '{}'::uuid[])
    from public.organization_members om
    join public.hr_division_members dm on dm.user_id = om.user_id and dm.organization_id = om.organization_id
    join public.hr_division_departments dd on dd.division_id = dm.division_id and dd.organization_id = dm.organization_id
   where om.user_id = auth.uid()
     and om.organization_id = p_organization_id
     and om.status = 'active'
     and om.role = 'division_director';
$function$;
revoke all on function private.current_user_division_departments(uuid) from public, anon;
grant execute on function private.current_user_division_departments(uuid) to authenticated;

create or replace function private.current_user_division_categories(p_organization_id uuid)
returns text[]
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(array_agg(distinct dc.professional_category), '{}'::text[])
    from public.organization_members om
    join public.hr_division_members dm on dm.user_id = om.user_id and dm.organization_id = om.organization_id
    join public.hr_division_categories dc on dc.division_id = dm.division_id and dc.organization_id = dm.organization_id
   where om.user_id = auth.uid()
     and om.organization_id = p_organization_id
     and om.status = 'active'
     and om.role = 'division_director';
$function$;
revoke all on function private.current_user_division_categories(uuid) from public, anon;
grant execute on function private.current_user_division_categories(uuid) to authenticated;

-- «org:τμήμα» για κάθε τμήμα διεύθυνσης που διευθύνει ο χρήστης (σε όλα τα νοσοκομεία του).
create or replace function private.current_user_division_scope_keys()
returns text[]
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(array_agg(distinct om.organization_id::text || ':' || dd.department_id::text), '{}'::text[])
    from public.organization_members om
    join public.hr_division_members dm on dm.user_id = om.user_id and dm.organization_id = om.organization_id
    join public.hr_division_departments dd on dd.division_id = dm.division_id and dd.organization_id = dm.organization_id
   where om.user_id = auth.uid()
     and om.status = 'active'
     and om.role = 'division_director'
     and not private.password_change_pending();
$function$;
revoke all on function private.current_user_division_scope_keys() from public, anon;
grant execute on function private.current_user_division_scope_keys() to authenticated;

-- «org:τμήμα:κατηγορία»: ανά διεύθυνση, τα τμήματά της × οι κατηγορίες προσωπικού της.
create or replace function private.current_user_division_category_keys()
returns text[]
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(array_agg(distinct om.organization_id::text || ':' || dd.department_id::text || ':' || dc.professional_category), '{}'::text[])
    from public.organization_members om
    join public.hr_division_members dm on dm.user_id = om.user_id and dm.organization_id = om.organization_id
    join public.hr_division_departments dd on dd.division_id = dm.division_id and dd.organization_id = dm.organization_id
    join public.hr_division_categories dc on dc.division_id = dm.division_id and dc.organization_id = dm.organization_id
   where om.user_id = auth.uid()
     and om.status = 'active'
     and om.role = 'division_director'
     and not private.password_change_pending();
$function$;
revoke all on function private.current_user_division_category_keys() from public, anon;
grant execute on function private.current_user_division_category_keys() to authenticated;

-- ===== 20261231450000_division_director_read.sql =====
-- Διευθυντής Διεύθυνσης: ανάγνωση στα τμήματα των διευθύνσεών του (12/11/2026).
--
-- Νέες επιτρεπτικές πολιτικές ΜΟΝΟ για SELECT (<πίνακας>_division_director_read), με κλειδιά που υπολογίζονται μία
-- φορά ανά ερώτημα (private.current_user_division_scope_keys / _category_keys). Οι εγγραφές μένουν κλειστές από τις
-- περιοριστικές πολιτικές του 20261231430000_division_director_read_only.sql.
--   Προγράμματα βαρδιών (και πρόχειρα), αιτήματα βαρδιών, εργαζόμενοι (μόνο οι κατηγορίες της διεύθυνσης),
--   εκπαίδευση, υγιεινή χεριών, συμβάντα του τμήματος (η περιοριστική πολιτική απορρήτου μένει: τα ανώνυμα και
--   εμπιστευτικά δεν φαίνονται). Οι έλεγχοι ανοίγουν με το view_controls (οι εκτελέσεις φιλτράρονται ήδη ανά τμήμα).
--   Τα βιβλία τμήματος διαβάζονται ήδη με την πρόσβαση τμήματος.
-- Οι εμβολιασμοί εργαζομένων ΔΕΝ ανοίγουν: ο Διευθυντής βλέπει μόνο ποσοστό ανά τμήμα (public.division_overview).

do $do$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'department_rosters' and policyname = 'department_rosters_division_director_read') then
    create policy department_rosters_division_director_read on public.department_rosters for select to authenticated
      using ((organization_id::text || ':' || department_id::text) = any ((select private.current_user_division_scope_keys())::text[]));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'roster_requests' and policyname = 'roster_requests_division_director_read') then
    create policy roster_requests_division_director_read on public.roster_requests for select to authenticated
      using ((organization_id::text || ':' || department_id::text) = any ((select private.current_user_division_scope_keys())::text[]));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'employees' and policyname = 'employees_division_director_read') then
    create policy employees_division_director_read on public.employees for select to authenticated
      using (
        department_id is not null
        and (organization_id::text || ':' || department_id::text || ':' || coalesce(private.employee_professional_category(profession_name, staff_category), '-'))
          = any ((select private.current_user_division_category_keys())::text[])
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'employee_training_summary' and policyname = 'employee_training_summary_division_director_read') then
    create policy employee_training_summary_division_director_read on public.employee_training_summary for select to authenticated
      using (exists (
        select 1 from public.employees e
         where e.id = employee_training_summary.employee_id
           and e.organization_id = employee_training_summary.organization_id
           and e.department_id is not null
           and (e.organization_id::text || ':' || e.department_id::text || ':' || coalesce(private.employee_professional_category(e.profession_name, e.staff_category), '-'))
             = any ((select private.current_user_division_category_keys())::text[])
      ));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'training_assignments' and policyname = 'training_assignments_division_director_read') then
    create policy training_assignments_division_director_read on public.training_assignments for select to authenticated
      using (department_id is not null and (organization_id::text || ':' || department_id::text) = any ((select private.current_user_division_scope_keys())::text[]));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'training_records' and policyname = 'training_records_division_director_read') then
    create policy training_records_division_director_read on public.training_records for select to authenticated
      using (department_id is not null and (organization_id::text || ':' || department_id::text) = any ((select private.current_user_division_scope_keys())::text[]));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'hand_hygiene_sessions' and policyname = 'hand_hygiene_sessions_division_director_read') then
    create policy hand_hygiene_sessions_division_director_read on public.hand_hygiene_sessions for select to authenticated
      using (department_id is not null and (organization_id::text || ':' || department_id::text) = any ((select private.current_user_division_scope_keys())::text[]));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'hand_hygiene_observations' and policyname = 'hand_hygiene_observations_division_director_read') then
    create policy hand_hygiene_observations_division_director_read on public.hand_hygiene_observations for select to authenticated
      using (exists (
        select 1 from public.hand_hygiene_sessions s
         where s.id = hand_hygiene_observations.session_id
           and s.department_id is not null
           and (s.organization_id::text || ':' || s.department_id::text) = any ((select private.current_user_division_scope_keys())::text[])
      ));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'quality_incidents' and policyname = 'quality_incidents_division_director_read') then
    create policy quality_incidents_division_director_read on public.quality_incidents for select to authenticated
      using (department_id is not null and (organization_id::text || ':' || department_id::text) = any ((select private.current_user_division_scope_keys())::text[]));
  end if;
end
$do$;

-- Έλεγχοι και εκπαίδευση: ο Διευθυντής Διεύθυνσης μπαίνει στις λίστες view_controls και view_training (ίδια με όσα
-- δείχνει η εφαρμογή, src/core/permissions/systemRoleMatrix.js). Κατά τα άλλα ο ορισμός είναι ο τρέχων της βάσης.
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
            when 'view_training' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','link_nurse','department_manager','department_user','hr_office','division_director')
            when 'manage_training' then om.role in ('hospital_admin','infection_control_lead')
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

-- ===== 20261231460000_division_overview.sql =====
-- Αρχική του Διευθυντή Διεύθυνσης: σύνοψη ανά τμήμα της διεύθυνσης (12/11/2026).
--
-- public.division_overview(org, διεύθυνση) επιστρέφει μόνο αριθμούς, ποτέ γραμμές εργαζομένων:
--   προσωπικό των κατηγοριών της διεύθυνσης (σύνολο, σε άδεια, νέοι 30 ημερών), πρόγραμμα βαρδιών της επόμενης
--   περιόδου (21 έως 20, όπως το rosterPeriod της εφαρμογής: δημοσιευμένο / πρόχειρο / λείπει) και νύχτες χωρίς
--   κάλυψη (όπως το checkRoster του rosterEngine.js), αιτήματα σε αναμονή (και πάνω από 3 ημέρες), εκπαίδευση
--   (ολοκληρωμένες αναθέσεις με προθεσμία το τελευταίο 12μηνο, αναθέσεις που λήγουν σε 30 ημέρες), αντιγριπικός
--   εμβολιασμός της τρέχουσας περιόδου (από 1 Σεπτεμβρίου, ποσοστό μόνο), συμμόρφωση υγιεινής χεριών 90 ημερών,
--   πτώσεις και έλκη πίεσης 30 ημερών, ανοιχτά συμβάντα. Ποσοστά 0–100 ή null όταν δεν υπάρχουν δεδομένα ή η
--   ενότητα είναι κλειδωμένη για το νοσοκομείο. Ημερομηνίες σε ώρα Ευρώπης/Αθήνας.
-- Καλούν: ο Διευθυντής Διεύθυνσης (μόνο τις διευθύνσεις του) ή ο Διαχειριστής νοσοκομείου / Ιδιοκτήτης πλατφόρμας
-- (οποιαδήποτε διεύθυνση του νοσοκομείου, για την προεπισκόπηση ρόλου).

-- Νύχτες της περιόδου με λιγότερους στη νύχτα από όσους χρειάζονται (rosterEngine.js: demandFor + checkRoster).
-- null όταν το πρόγραμμα δεν έχει ακόμη καμία βάρδια.
create or replace function private.roster_uncovered_nights(p_demand jsonb, p_members jsonb, p_assignments jsonb, p_start date, p_end date)
returns integer
language sql
immutable
set search_path to ''
as $function$
  with members as (
    select m.value->>'employeeId' as employee_id
      from jsonb_array_elements(case when jsonb_typeof(p_members) = 'array' then p_members else '[]'::jsonb end) m(value)
     where coalesce(m.value->>'active', 'true') <> 'false'
       and m.value->>'employeeId' is not null
  ),
  days as (
    select g::date as day, extract(isodow from g) in (6, 7) as weekend
      from generate_series(p_start, p_end, interval '1 day') g
  ),
  codes as (
    select d.day, m.employee_id,
           case when length(c.code) > 2 and substr(c.code, 2, 1) = ':' then left(c.code, 1) else c.code end as kind
      from days d
     cross join members m
     cross join lateral (select p_assignments -> m.employee_id ->> d.day::text as code) c
  ),
  need as (
    select d.day,
           (case
              when jsonb_typeof(p_demand -> 'overrides' -> d.day::text) = 'object' and (p_demand -> 'overrides' -> d.day::text) ? 'N'
                then case when (p_demand -> 'overrides' -> d.day::text ->> 'N') ~ '^\s*[0-9]+(\.[0-9]+)?\s*$' then (p_demand -> 'overrides' -> d.day::text ->> 'N')::numeric else 0 end
              else case when (p_demand -> case when d.weekend then 'weekend' else 'weekday' end ->> 'N') ~ '^\s*[0-9]+(\.[0-9]+)?\s*$'
                then (p_demand -> case when d.weekend then 'weekend' else 'weekday' end ->> 'N')::numeric else 0 end
            end)
           + coalesce((
               select sum(greatest(0, case when (s.value ->> case when d.weekend then 'weekend' else 'weekday' end) ~ '^\s*[0-9]+(\.[0-9]+)?\s*$'
                 then (s.value ->> case when d.weekend then 'weekend' else 'weekday' end)::numeric else 0 end))
                 from jsonb_array_elements(case when jsonb_typeof(p_demand -> 'custom') = 'array' then p_demand -> 'custom' else '[]'::jsonb end) s(value)
                where s.value ->> 'code' like 'N:%'
             ), 0) as n
      from days d
  )
  select case
    when not exists (select 1 from codes where kind in ('M', 'I', 'A', 'N')) then null
    else (
      select count(*)::integer
        from need
       where need.n > (select count(*) from codes where codes.day = need.day and codes.kind = 'N')
    )
  end;
$function$;
revoke all on function private.roster_uncovered_nights(jsonb, jsonb, jsonb, date, date) from public, anon, authenticated;

create or replace function public.division_overview(p_organization_id uuid, p_division_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_admin boolean;
  v_director boolean;
  v_divisions jsonb;
  v_division_id uuid;
  v_division_name text;
  v_categories text[];
  v_has_categories boolean;
  v_disabled text[];
  v_today date := (now() at time zone 'Europe/Athens')::date;
  v_next_start date;
  v_next_end date;
  v_season date;
  v_rows jsonb;
begin
  if auth.uid() is null then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if p_organization_id is null then
    raise exception 'ORGANIZATION_REQUIRED' using errcode = '22023';
  end if;
  if private.password_change_pending() then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  v_admin := public.current_user_is_platform_owner() or public.is_org_admin(p_organization_id);
  v_director := private.current_user_is_division_director(p_organization_id);
  if not (v_admin or v_director) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  -- Περίοδος βαρδιών: 21 του μήνα έως 20 του επόμενου· η «επόμενη» είναι αυτή μετά την τρέχουσα.
  v_next_start := ((date_trunc('month', v_today - 20) + interval '1 month')::date + 20);
  v_next_end := ((v_next_start + interval '1 month')::date - 1);
  -- Περίοδος αντιγριπικού εμβολιασμού: από 1 Σεπτεμβρίου.
  v_season := make_date(extract(year from v_today)::integer - case when extract(month from v_today) >= 9 then 0 else 1 end, 9, 1);

  select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name) order by d.name, d.id), '[]'::jsonb)
    into v_divisions
    from public.hr_divisions d
   where d.organization_id = p_organization_id
     and (v_admin or d.id in (select private.hr_my_divisions(p_organization_id)));

  if p_division_id is not null then
    if not exists (select 1 from jsonb_array_elements(v_divisions) e where (e ->> 'id')::uuid = p_division_id) then
      raise exception 'PERMISSION_DENIED' using errcode = '42501';
    end if;
    v_division_id := p_division_id;
  else
    v_division_id := (v_divisions -> 0 ->> 'id')::uuid;
  end if;

  if v_division_id is null then
    return jsonb_build_object(
      'divisions', v_divisions, 'division', null, 'nextMonth', to_char(v_next_start, 'YYYY-MM'),
      'nextPeriod', jsonb_build_object('start', v_next_start, 'end', v_next_end),
      'departments', '[]'::jsonb, 'totals', null);
  end if;

  select d.name into v_division_name from public.hr_divisions d where d.id = v_division_id;
  select coalesce(array_agg(distinct c.professional_category order by c.professional_category), '{}'::text[])
    into v_categories
    from public.hr_division_categories c
   where c.division_id = v_division_id and c.organization_id = p_organization_id;
  v_has_categories := cardinality(v_categories) > 0;
  v_disabled := coalesce(private.org_disabled_modules(p_organization_id), '{}'::text[]);

  with dep as (
    select d.id, d.name
      from public.hr_division_departments dd
      join public.departments d on d.id = dd.department_id and d.organization_id = dd.organization_id
     where dd.division_id = v_division_id and dd.organization_id = p_organization_id
  ),
  staff as (
    select e.id, e.department_id, e.employment_status, e.hire_date
      from public.employees e
     where e.organization_id = p_organization_id
       and e.department_id in (select dep.id from dep)
       and e.employment_status in ('active', 'leave')
       and private.employee_professional_category(e.profession_name, e.staff_category) = any (v_categories)
  ),
  per as (
    select dep.id, dep.name,
      (select count(*) from staff s where s.department_id = dep.id) as staff,
      (select count(*) from staff s where s.department_id = dep.id and s.employment_status = 'leave') as on_leave,
      (select count(*) from staff s where s.department_id = dep.id and s.hire_date > v_today - 30 and s.hire_date <= v_today) as new30,
      ro.status as roster_status,
      ro.uncovered,
      rq.pending, rq.pending_old,
      tr.due, tr.done, tr.expiring,
      fl.active_staff, fl.vaccinated,
      hh.obs, hh.ok,
      inc.falls, inc.ulcers, inc.open_count
    from dep
    left join lateral (
      select r.status, private.roster_uncovered_nights(r.demand, r.members, r.assignments, r.period_start, r.period_end) as uncovered
        from public.department_rosters r
       where r.organization_id = p_organization_id and r.department_id = dep.id and r.period_start = v_next_start
       order by (r.status = 'published') desc, r.updated_at desc
       limit 1
    ) ro on true
    left join lateral (
      select count(*) as pending,
             count(*) filter (where q.created_at < now() - interval '3 days') as pending_old
        from public.roster_requests q
       where q.organization_id = p_organization_id and q.department_id = dep.id and q.status = 'pending'
         and exists (select 1 from staff s where s.id = q.employee_id)
    ) rq on true
    left join lateral (
      select count(*) filter (where t.due_date between v_today - 365 and v_today) as due,
             count(*) filter (where t.due_date between v_today - 365 and v_today and (t.status = 'completed' or t.attendance is true)) as done,
             count(*) filter (where t.status in ('assigned', 'in_progress') and t.attendance is not true and t.due_date between v_today and v_today + 30) as expiring
        from public.training_assignments t
       where t.organization_id = p_organization_id and t.department_id = dep.id and t.status <> 'cancelled'
         and exists (select 1 from staff s where s.id = t.employee_id)
    ) tr on true
    left join lateral (
      select count(*) as active_staff,
             count(*) filter (where exists (
               select 1
                 from public.employee_vaccinations v
                 left join public.master_library_items li on li.id = v.vaccine_item_id
                where v.employee_id = s.id and v.organization_id = p_organization_id
                  and v.status in ('complete', 'renew_soon')
                  and v.vaccination_date between v_season and v_today
                  and (li.code = 'VAC-INFLUENZA' or lower(coalesce(v.vaccine_label_snapshot, '')) ~ '(γρίπ|γριπ|influenza|flu)')
             )) as vaccinated
        from staff s
       where s.department_id = dep.id and s.employment_status = 'active'
    ) fl on true
    left join lateral (
      select sum(h.observations) as obs, sum(h.compliant_observations) as ok
        from public.hand_hygiene_sessions h
       where h.organization_id = p_organization_id and h.department_id = dep.id and h.status = 'completed'
         and h.observation_date between v_today - 90 and v_today
    ) hh on true
    left join lateral (
      select count(*) filter (where i.category in ('fall', 'odipy-fall') and (coalesce(i.occurred_at, i.created_at) at time zone 'Europe/Athens')::date > v_today - 30) as falls,
             count(*) filter (where i.category in ('pressureinjury', 'odipy-ulcer') and (coalesce(i.occurred_at, i.created_at) at time zone 'Europe/Athens')::date > v_today - 30) as ulcers,
             count(*) filter (where i.status in ('reported', 'under_review')) as open_count
        from public.quality_incidents i
       where i.organization_id = p_organization_id and i.department_id = dep.id and i.lifecycle_status <> 'voided'
    ) inc on true
  )
  select coalesce(jsonb_agg(to_jsonb(per) order by per.name, per.id), '[]'::jsonb) into v_rows from per;

  return jsonb_build_object(
    'divisions', v_divisions,
    'division', jsonb_build_object('id', v_division_id, 'name', v_division_name, 'categories', to_jsonb(v_categories)),
    'nextMonth', to_char(v_next_start, 'YYYY-MM'),
    'nextPeriod', jsonb_build_object('start', v_next_start, 'end', v_next_end),
    'departments', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', r ->> 'id',
        'name', r ->> 'name',
        'staff', case when v_has_categories then (r ->> 'staff')::integer end,
        'staffOnLeave', case when v_has_categories then (r ->> 'on_leave')::integer end,
        'staffNew30', case when v_has_categories then (r ->> 'new30')::integer end,
        'rosterNextMonth', coalesce(r ->> 'roster_status', 'missing'),
        'uncoveredNights', (r ->> 'uncovered')::integer,
        'pendingRequests', case when v_has_categories then (r ->> 'pending')::integer end,
        'pendingRequestsOver3Days', case when v_has_categories then (r ->> 'pending_old')::integer end,
        'trainingPct', case when 'training' = any (v_disabled) or not v_has_categories or coalesce((r ->> 'due')::integer, 0) = 0 then null
          else round(100.0 * (r ->> 'done')::numeric / (r ->> 'due')::numeric, 1) end,
        'trainingExpiring30', case when 'training' = any (v_disabled) or not v_has_categories then null else (r ->> 'expiring')::integer end,
        'fluPct', case when 'occupational_health' = any (v_disabled) or not v_has_categories or coalesce((r ->> 'active_staff')::integer, 0) = 0 then null
          else round(100.0 * (r ->> 'vaccinated')::numeric / (r ->> 'active_staff')::numeric, 1) end,
        'handHygienePct', case when 'prevention' = any (v_disabled) or coalesce((r ->> 'obs')::numeric, 0) = 0 then null
          else round(100.0 * (r ->> 'ok')::numeric / (r ->> 'obs')::numeric, 1) end,
        'falls30', case when 'quality' = any (v_disabled) then null else (r ->> 'falls')::integer end,
        'pressureUlcers30', case when 'quality' = any (v_disabled) then null else (r ->> 'ulcers')::integer end,
        'incidentsOpen', case when 'quality' = any (v_disabled) then null else (r ->> 'open_count')::integer end
      ) order by ord), '[]'::jsonb)
      from jsonb_array_elements(v_rows) with ordinality as x(r, ord)
    ),
    'totals', (
      select jsonb_build_object(
        'departments', count(*),
        'staff', case when v_has_categories then coalesce(sum((r ->> 'staff')::integer), 0) end,
        'staffOnLeave', case when v_has_categories then coalesce(sum((r ->> 'on_leave')::integer), 0) end,
        'staffNew30', case when v_has_categories then coalesce(sum((r ->> 'new30')::integer), 0) end,
        'rosterPublished', count(*) filter (where r ->> 'roster_status' = 'published'),
        'rosterDraft', count(*) filter (where r ->> 'roster_status' = 'draft'),
        'rosterMissing', count(*) filter (where r ->> 'roster_status' is null),
        'uncoveredNights', sum((r ->> 'uncovered')::integer),
        'pendingRequests', case when v_has_categories then coalesce(sum((r ->> 'pending')::integer), 0) end,
        'pendingRequestsOver3Days', case when v_has_categories then coalesce(sum((r ->> 'pending_old')::integer), 0) end,
        'trainingPct', case when 'training' = any (v_disabled) or not v_has_categories or coalesce(sum((r ->> 'due')::integer), 0) = 0 then null
          else round(100.0 * sum((r ->> 'done')::numeric) / sum((r ->> 'due')::numeric), 1) end,
        'trainingExpiring30', case when 'training' = any (v_disabled) or not v_has_categories then null else coalesce(sum((r ->> 'expiring')::integer), 0) end,
        'fluPct', case when 'occupational_health' = any (v_disabled) or not v_has_categories or coalesce(sum((r ->> 'active_staff')::integer), 0) = 0 then null
          else round(100.0 * sum((r ->> 'vaccinated')::numeric) / sum((r ->> 'active_staff')::numeric), 1) end,
        'handHygienePct', case when 'prevention' = any (v_disabled) or coalesce(sum((r ->> 'obs')::numeric), 0) = 0 then null
          else round(100.0 * sum((r ->> 'ok')::numeric) / sum((r ->> 'obs')::numeric), 1) end,
        'falls30', case when 'quality' = any (v_disabled) then null else coalesce(sum((r ->> 'falls')::integer), 0) end,
        'pressureUlcers30', case when 'quality' = any (v_disabled) then null else coalesce(sum((r ->> 'ulcers')::integer), 0) end,
        'incidentsOpen', case when 'quality' = any (v_disabled) then null else coalesce(sum((r ->> 'open_count')::integer), 0) end
      )
      from jsonb_array_elements(v_rows) as x(r)
    )
  );
end
$function$;
revoke all on function public.division_overview(uuid, uuid) from public, anon;
grant execute on function public.division_overview(uuid, uuid) to authenticated;

commit;
