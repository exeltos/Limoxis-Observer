-- Recycle bin on the server: «Delete» of any clinical record keeps the record and
-- everything that hangs from it (samples, results, therapies, assessments, …) in the
-- recycle bin for 30 days, and «Restore» puts it all back as it was, in one transaction.
--   bin_delete    the Platform Owner, the Hospital Admin and the Infection Control Lead
--                 delete any record of the hospital; anyone else only what they entered.
--   bin_restore   only the person who deleted it, while the entry has not expired.
--   bin_list_mine / bin_purge_mine   each person sees and empties only their own deletions.
-- While the bin deletes or restores (limoxis.bin = on) the guard triggers that would
-- refuse or alter the rows (finalized AST, initial admission, audit fields, …) stand aside:
-- the rows go back exactly as they were deleted. The clinical audit still records both.

-- The single-column primary key of a table.
create or replace function private.bin_pk(p_table text)
returns text
language sql
stable
set search_path to ''
as $function$
  select a.attname::text
  from pg_catalog.pg_index i
  join pg_catalog.pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
  where i.indrelid = ('public.' || quote_ident(p_table))::regclass and i.indisprimary and i.indnatts = 1;
$function$;

-- The records that can be deleted to the bin, with their module.
create or replace function private.bin_module(p_table text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select case when p_table = any(array[
    'patients', 'patient_admissions', 'surveillance_cases', 'clinical_assessments',
    'surveillance_reassessments', 'hai_classifications', 'isolation_episodes',
    'antimicrobial_therapies', 'antimicrobial_therapy_administrations', 'laboratory_samples',
    'surveillance_devices', 'surveillance_outcomes', 'surveillance_events',
    'patient_clinical_scale_assessments', 'prevention_bundle_assessments',
    'surveillance_case_questionnaires', 'surveillance_surgical_procedures',
    'clinical_protocol_runs', 'notifiable_disease_reports'
  ]) then 'clinical' end;
$function$;

create or replace function public.bin_delete(
  p_table text,
  p_id uuid,
  p_label text,
  p_detail text default null,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_module text := private.bin_module(p_table);
  v_root jsonb;
  v_org uuid;
  v_rows jsonb;
  v_links jsonb := '[]'::jsonb;
  v_seen text[];
  v_i integer := 0;
  v_cur jsonb;
  v_fk record;
  v_child jsonb;
  v_pk text;
  v_key text;
  v_entry uuid;
  v_pending jsonb;
  v_next jsonb;
  v_item jsonb;
  v_progress boolean;
begin
  if v_uid is null then
    raise exception 'BIN_NOT_SIGNED_IN' using errcode = '42501';
  end if;
  if v_module is null then
    raise exception 'BIN_TABLE_NOT_ALLOWED' using errcode = '42501';
  end if;
  execute format('select to_jsonb(x) from public.%I x where x.id = $1', p_table) into v_root using p_id;
  if v_root is null then
    raise exception 'BIN_NOT_FOUND' using errcode = 'P0002';
  end if;
  v_org := (v_root ->> 'organization_id')::uuid;
  if not exists (
    select 1 from public.organization_members m
    where m.organization_id = v_org and m.user_id = v_uid and m.status = 'active'
  ) and not public.current_user_is_platform_owner() then
    raise exception 'BIN_NOT_ALLOWED' using errcode = '42501';
  end if;

  -- The record and, recursively, every row that would go (or be refused) with it.
  -- A row that only points to it (ON DELETE SET NULL) stays, and its link is kept to restore.
  v_rows := jsonb_build_array(jsonb_build_object('t', p_table, 'k', 'id', 'v', p_id::text, 'row', v_root));
  v_seen := array[p_table || ':' || p_id::text];
  while v_i < jsonb_array_length(v_rows) loop
    v_cur := v_rows -> v_i;
    for v_fk in
      select c.conrelid::regclass as child_reg, cl.relname::text as child, c.confdeltype as action,
             ca.attname::text as child_col, pa.attname::text as parent_col,
             format_type(ca.atttypid, ca.atttypmod) as col_type
      from pg_catalog.pg_constraint c
      join pg_catalog.pg_class cl on cl.oid = c.conrelid
      cross join lateral unnest(c.conkey, c.confkey) as u(ck, pk)
      join pg_catalog.pg_attribute ca on ca.attrelid = c.conrelid and ca.attnum = u.ck
      join pg_catalog.pg_attribute pa on pa.attrelid = c.confrelid and pa.attnum = u.pk
      where c.contype = 'f'
        and c.confrelid = ('public.' || quote_ident(v_cur ->> 't'))::regclass
        and cl.relnamespace = 'public'::regnamespace
        and cl.relname <> 'recycle_bin'
        and not (ca.attname = 'organization_id' and pa.attname = 'organization_id')
    loop
      continue when v_cur -> 'row' ->> v_fk.parent_col is null;
      v_pk := private.bin_pk(v_fk.child);
      if v_pk is null then
        raise exception 'BIN_UNSUPPORTED_TABLE %', v_fk.child;
      end if;
      for v_child in execute format(
        'select to_jsonb(x) from public.%I x where x.%I = $1::%s and x.organization_id = $2',
        v_fk.child, v_fk.child_col, v_fk.col_type
      ) using v_cur -> 'row' ->> v_fk.parent_col, v_org
      loop
        v_key := v_fk.child || ':' || (v_child ->> v_pk);
        if v_fk.action in ('n', 'd') then
          v_links := v_links || jsonb_build_object(
            't', v_fk.child, 'k', v_pk, 'v', v_child ->> v_pk,
            'c', v_fk.child_col, 'value', v_cur -> 'row' ->> v_fk.parent_col);
        elsif not v_key = any(v_seen) then
          v_seen := v_seen || v_key;
          v_rows := v_rows || jsonb_build_object('t', v_fk.child, 'k', v_pk, 'v', v_child ->> v_pk, 'row', v_child);
        end if;
      end loop;
    end loop;
    v_i := v_i + 1;
    if v_i > 5000 then
      raise exception 'BIN_TOO_LARGE';
    end if;
  end loop;
  -- Links between rows that go together need no restoring.
  select coalesce(jsonb_agg(l), '[]'::jsonb) into v_links
  from jsonb_array_elements(v_links) l
  where not ((l ->> 't') || ':' || (l ->> 'v')) = any(v_seen);

  -- Who may: the Platform Owner, the Hospital Admin and the Infection Control Lead any
  -- record; anyone else only a record that they entered, with everything under it.
  if not (public.current_user_is_platform_owner()
    or public.current_user_has_org_role(v_org, array['hospital_admin', 'infection_control_lead']::public.app_role[])) then
    if (v_root ->> 'created_by') is distinct from v_uid::text or exists (
      select 1 from jsonb_array_elements(v_rows) r
      where r -> 'row' ? 'created_by' and (r -> 'row' ->> 'created_by') is distinct from v_uid::text
    ) then
      raise exception 'BIN_NOT_OWN_RECORD' using errcode = '42501';
    end if;
  end if;

  insert into public.recycle_bin (organization_id, module, kind, label, detail, payload, deleted_by, deleted_by_name)
  values (
    v_org, v_module, p_table,
    left(coalesce(nullif(p_label, ''), p_table), 300),
    left(nullif(p_detail, ''), 300),
    jsonb_build_object('db', jsonb_build_object(
      'table', p_table, 'id', p_id, 'reason', nullif(p_reason, ''),
      'rows', v_rows, 'links', v_links)),
    v_uid,
    (select p.full_name from public.profiles p where p.id = v_uid)
  ) returning id into v_entry;

  -- Children first; a row still referenced waits for the next pass.
  perform set_config('limoxis.bin', 'on', true);
  select coalesce(jsonb_agg(r order by o desc), '[]'::jsonb) into v_pending
  from jsonb_array_elements(v_rows) with ordinality as e(r, o);
  loop
    v_next := '[]'::jsonb;
    v_progress := false;
    for v_item in select value from jsonb_array_elements(v_pending) loop
      begin
        execute format('delete from public.%I where %I::text = $1', v_item ->> 't', v_item ->> 'k') using v_item ->> 'v';
        v_progress := true;
      exception when foreign_key_violation or restrict_violation then
        v_next := v_next || v_item;
      end;
    end loop;
    exit when jsonb_array_length(v_next) = 0;
    if not v_progress then
      raise exception 'BIN_DELETE_BLOCKED %', v_next -> 0 ->> 't';
    end if;
    v_pending := v_next;
  end loop;
  perform set_config('limoxis.bin', 'off', true);
  return v_entry;
end;
$function$;

create or replace function public.bin_restore(p_entry uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_entry public.recycle_bin;
  v_db jsonb;
  v_pending jsonb;
  v_next jsonb;
  v_item jsonb;
  v_progress boolean;
  v_type text;
begin
  select * into v_entry from public.recycle_bin where id = p_entry for update;
  if v_entry.id is null then
    raise exception 'BIN_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_uid is null or v_entry.deleted_by is distinct from v_uid then
    raise exception 'BIN_NOT_YOURS' using errcode = '42501';
  end if;
  if v_entry.expires_at < now() then
    raise exception 'BIN_EXPIRED';
  end if;
  if not exists (
    select 1 from public.organization_members m
    where m.organization_id = v_entry.organization_id and m.user_id = v_uid and m.status = 'active'
  ) and not public.current_user_is_platform_owner() then
    raise exception 'BIN_NOT_ALLOWED' using errcode = '42501';
  end if;
  v_db := v_entry.payload -> 'db';
  if v_db is null then
    raise exception 'BIN_NOT_SERVER_ENTRY';
  end if;

  perform set_config('limoxis.bin', 'on', true);
  -- Parents first; a row whose parent is not back yet waits for the next pass.
  v_pending := v_db -> 'rows';
  loop
    v_next := '[]'::jsonb;
    v_progress := false;
    for v_item in select value from jsonb_array_elements(v_pending) loop
      begin
        execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I, $1)', v_item ->> 't', v_item ->> 't')
          using v_item -> 'row';
        v_progress := true;
      exception
        when foreign_key_violation then
          v_next := v_next || v_item;
        when unique_violation then
          raise exception 'BIN_RESTORE_CONFLICT %', v_item ->> 't' using errcode = '23505';
      end;
    end loop;
    exit when jsonb_array_length(v_next) = 0;
    if not v_progress then
      raise exception 'BIN_RESTORE_MISSING_PARENT %', v_next -> 0 ->> 't' using errcode = '23503';
    end if;
    v_pending := v_next;
  end loop;
  -- The rows that only pointed to it point to it again (unless re-linked meanwhile).
  for v_item in select value from jsonb_array_elements(coalesce(v_db -> 'links', '[]'::jsonb)) loop
    select format_type(a.atttypid, a.atttypmod) into v_type
    from pg_catalog.pg_attribute a
    where a.attrelid = ('public.' || quote_ident(v_item ->> 't'))::regclass and a.attname = v_item ->> 'c';
    execute format('update public.%I set %I = $1::%s where %I::text = $2 and %I is null',
      v_item ->> 't', v_item ->> 'c', v_type, v_item ->> 'k', v_item ->> 'c')
      using v_item ->> 'value', v_item ->> 'v';
  end loop;
  perform set_config('limoxis.bin', 'off', true);

  delete from public.recycle_bin where id = v_entry.id;
  return jsonb_build_object('table', v_db ->> 'table', 'id', v_db ->> 'id');
end;
$function$;

-- The caller's own deletions in a hospital, newest first, without the expired ones.
create or replace function public.bin_list_mine(p_organization_id uuid)
returns table(id uuid, module text, kind text, label text, detail text, deleted_at timestamptz, deleted_by_name text, expires_at timestamptz, server boolean, payload jsonb)
language sql
stable
security definer
set search_path to ''
as $function$
  select b.id, b.module, b.kind, b.label, b.detail, b.deleted_at, b.deleted_by_name, b.expires_at,
         b.payload ? 'db',
         case when b.payload ? 'db' then null else b.payload end
  from public.recycle_bin b
  where b.organization_id = p_organization_id
    and b.deleted_by = auth.uid()
    and b.expires_at > now()
  order by b.deleted_at desc;
$function$;

-- Deletes one of the caller's own entries for good.
create or replace function public.bin_purge_mine(p_entry uuid)
returns void
language sql
security definer
set search_path to ''
as $function$
  delete from public.recycle_bin b where b.id = p_entry and b.deleted_by = auth.uid();
$function$;

revoke all on function public.bin_delete(text, uuid, text, text, text) from public, anon;
revoke all on function public.bin_restore(uuid) from public, anon;
revoke all on function public.bin_list_mine(uuid) from public, anon;
revoke all on function public.bin_purge_mine(uuid) from public, anon;
grant execute on function public.bin_delete(text, uuid, text, text, text) to authenticated;
grant execute on function public.bin_restore(uuid) to authenticated;
grant execute on function public.bin_list_mine(uuid) to authenticated;
grant execute on function public.bin_purge_mine(uuid) to authenticated;

-- The guard triggers stand aside while the bin deletes or restores rows.
create or replace trigger close_isolation_on_case_void after update on public.surveillance_cases for each row
  when (current_setting('limoxis.bin', true) is distinct from 'on') execute function public.close_isolation_on_case_void();
create or replace trigger enforce_surveillance_governance_reason before update on public.surveillance_cases for each row
  when (current_setting('limoxis.bin', true) is distinct from 'on') execute function public.enforce_surveillance_governance_reason();
create or replace trigger guard_finalized_ast_mutation before insert or delete or update on public.antimicrobial_susceptibility_results for each row
  when (current_setting('limoxis.bin', true) is distinct from 'on') execute function public.guard_finalized_ast_mutation();
create or replace trigger patients_create_initial_admission after insert on public.patients for each row
  when (new.admission_date is not null and current_setting('limoxis.bin', true) is distinct from 'on') execute function public.create_initial_patient_admission();
create or replace trigger surveillance_case_questionnaires_before_write before insert or update on public.surveillance_case_questionnaires for each row
  when (current_setting('limoxis.bin', true) is distinct from 'on') execute function private.epi_questionnaire_before_write();
create or replace trigger trg_amr_classification_categories_audit_fields before insert or update on public.amr_classification_categories for each row
  when (current_setting('limoxis.bin', true) is distinct from 'on') execute function public.set_repository_audit_fields();
create or replace trigger trg_clinical_assessment_findings_audit_fields before insert or update on public.clinical_assessment_findings for each row
  when (current_setting('limoxis.bin', true) is distinct from 'on') execute function public.set_repository_audit_fields();
create or replace trigger trg_enforce_no_surveillance_link_from_negative_sample before update of surveillance_case_id on public.laboratory_samples for each row
  when (current_setting('limoxis.bin', true) is distinct from 'on') execute function public.enforce_no_surveillance_link_from_negative_sample();
create or replace trigger trg_enforce_repeat_sample_terminal_parent before insert or update of parent_sample_id on public.laboratory_samples for each row
  when (current_setting('limoxis.bin', true) is distinct from 'on') execute function public.enforce_repeat_sample_terminal_parent();
create or replace trigger trg_enforce_restricted_antimicrobial_approval before insert or update of antimicrobial, approval_status on public.antimicrobial_therapies for each row
  when (current_setting('limoxis.bin', true) is distinct from 'on') execute function public.enforce_restricted_antimicrobial_approval();
create or replace trigger trg_enforce_therapy_approved_before_administration before insert on public.antimicrobial_therapy_administrations for each row
  when (current_setting('limoxis.bin', true) is distinct from 'on') execute function public.enforce_therapy_approved_before_administration();
create or replace trigger trg_hai_classification_criteria_audit_fields before insert or update on public.hai_classification_criteria for each row
  when (current_setting('limoxis.bin', true) is distinct from 'on') execute function public.set_repository_audit_fields();
create or replace trigger trg_isolation_episode_precautions_audit_fields before insert or update on public.isolation_episode_precautions for each row
  when (current_setting('limoxis.bin', true) is distinct from 'on') execute function public.set_repository_audit_fields();
create or replace trigger trg_microbiology_result_immutability before update on public.microbiology_results for each row
  when (current_setting('limoxis.bin', true) is distinct from 'on') execute function public.enforce_microbiology_result_immutability();
create or replace trigger trg_microbiology_result_organisms_audit_fields before insert or update on public.microbiology_result_organisms for each row
  when (current_setting('limoxis.bin', true) is distinct from 'on') execute function public.set_repository_audit_fields();
create or replace trigger trg_microbiology_result_organisms_sync after insert or update of organism on public.microbiology_results for each row
  when (current_setting('limoxis.bin', true) is distinct from 'on') execute function private.microbiology_result_organisms_sync();
create or replace trigger trg_surveillance_case_infection_types_audit_fields before insert or update on public.surveillance_case_infection_types for each row
  when (current_setting('limoxis.bin', true) is distinct from 'on') execute function public.set_repository_audit_fields();
create or replace trigger trg_surveillance_neonatal_details_audit_fields before insert or update on public.surveillance_neonatal_details for each row
  when (current_setting('limoxis.bin', true) is distinct from 'on') execute function public.set_repository_audit_fields();
create or replace trigger trg_surveillance_surgical_procedures_audit_fields before insert or update on public.surveillance_surgical_procedures for each row
  when (current_setting('limoxis.bin', true) is distinct from 'on') execute function public.set_repository_audit_fields();
