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
