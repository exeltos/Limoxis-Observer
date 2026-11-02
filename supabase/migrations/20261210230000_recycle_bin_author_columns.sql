-- Recycle bin: who «entered» a record. A person who is not the Platform Owner, the Hospital
-- Admin or the Infection Control Lead deletes only records they entered; most tables keep
-- that in created_by, a few in a column of their own (who classified, answered, started or
-- last updated it). bin_delete reads the right column for the table.
create or replace function private.bin_author_column(p_table text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select case p_table
    when 'hai_classifications' then 'classified_by'
    when 'surveillance_case_questionnaires' then 'answered_by'
    when 'clinical_protocol_runs' then 'started_by'
    when 'notifiable_disease_reports' then 'updated_by'
    else 'created_by'
  end;
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
  v_author text := private.bin_author_column(p_table);
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
    if (v_root ->> v_author) is distinct from v_uid::text or exists (
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
