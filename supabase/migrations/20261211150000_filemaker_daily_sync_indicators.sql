-- FileMaker → Limoxis: the sync runs once a day instead of every hour (owner,
-- 27/10/2026), at 03:05 / 03:35 Athens (01:05 / 01:35 UTC in winter time), and
-- adds the departments' monthly indicators: the daily counts FileMaker keeps
-- for the emergency department (per shift), the delivery room, endoscopy and
-- the ophthalmology theatre are added to the month's entry of their register,
-- as the first transfer summed them. Only the days entered in FileMaker after
-- the first transfer (record ids above its last one) are added, each once
-- (fm_stage_links).

select cron.schedule('limoxis-filemaker-requeue', '5 1 * * *', 'select private.fm_sync_requeue();');
select cron.schedule('limoxis-filemaker-sync', '35 1 * * *', 'select private.fm_sync_all();');

-- One register of daily counts: p_columns maps register columns to FileMaker
-- fields (for the emergency department, «column@shift» picks one shift).
create or replace function private.fm_sync_counts(p_base_table text, p_register regclass, p_after bigint, p_columns jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_register uuid; v_department uuid; v_version integer;
  v_month date; v_row uuid; v_count integer := 0;
  r record; c record; v_set text; v_value numeric;
begin
  execute format('select register_id, department_id, definition_version from %s order by period_start desc limit 1', p_register)
    into v_register, v_department, v_version;
  if v_register is null then return 0; end if;
  for r in
    select s.record_id, s.data
    from public.fm_stage_records s
    where s.base_table = p_base_table and s.record_id ~ '^\d+$' and s.record_id::bigint > p_after
      and nullif(s.data->>'Ημερομηνία', '') is not null
      and (p_base_table <> 'Indicators TEP' or s.data->>'ΒΑΡΔΙΑ' in ('07:00-15:00', '15:00-23:00', '23:00-07:00'))
      and not exists (select 1 from public.fm_stage_links l where l.base_table = p_base_table and l.record_id = s.record_id)
    order by s.record_id::bigint
  loop
    v_month := date_trunc('month', (r.data->>'Ημερομηνία')::date)::date;
    execute format('select id from %s where register_id = $1 and department_id = $2 and period_start = $3 limit 1', p_register)
      into v_row using v_register, v_department, v_month;
    if v_row is null then
      v_row := md5('fm-' || p_base_table || '-' || v_month)::uuid;
      execute format('insert into %s (id, organization_id, department_id, register_id, entry_date, period_start, status, locked, definition_version, created_by, updated_by) values ($1, $2, $3, $4, $5, $5, ''complete'', false, $6, $7, $7)', p_register)
        using v_row, private.fm_org(), v_department, v_register, v_month, v_version, private.fm_importer();
    end if;
    v_set := '';
    for c in select key, value #>> '{}' as field from jsonb_each(p_columns) loop
      if position('@' in c.key) > 0 then
        if split_part(c.key, '@', 2) <> r.data->>'ΒΑΡΔΙΑ' then continue; end if;
      end if;
      v_value := case when r.data->>c.field ~ '^-?[0-9]+(\.[0-9]+)?$' then (r.data->>c.field)::numeric else 0 end;
      if v_value <> 0 then
        v_set := v_set || format('%I = coalesce(%I, 0) + %s, ', split_part(c.key, '@', 1), split_part(c.key, '@', 1), v_value);
      end if;
    end loop;
    if v_set <> '' then
      execute format('update %s set %s updated_at = now() where id = $1', p_register, v_set) using v_row;
    end if;
    insert into public.fm_stage_links (base_table, record_id, target_table, target_id, how, note, linked_at)
    values (p_base_table, r.record_id, split_part(p_register::text, '.', 2), v_row, 'matched', 'daily sync', now())
    on conflict do nothing;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function private.fm_sync_indicators()
returns integer language plpgsql security definer set search_path = '' as $$
begin
  return private.fm_sync_counts('Indicators TEP', 'public.register_emergency_f6ceb2a5', 1678, '{
      "admissions__morning@07:00-15:00": "ΕΙΣΑΓΩΓΕΣ", "admissions__afternoon@15:00-23:00": "ΕΙΣΑΓΩΓΕΣ", "admissions__night@23:00-07:00": "ΕΙΣΑΓΩΓΕΣ",
      "assessments__morning@07:00-15:00": "ΕΚΤΙΜΗΣΕΙΣ", "assessments__afternoon@15:00-23:00": "ΕΚΤΙΜΗΣΕΙΣ", "assessments__night@23:00-07:00": "ΕΚΤΙΜΗΣΕΙΣ",
      "checkup__morning@07:00-15:00": "CHECK UP", "checkup__afternoon@15:00-23:00": "CHECK UP", "checkup__night@23:00-07:00": "CHECK UP",
      "dressings__morning@07:00-15:00": "ΑΛΛΑΓΕΣ", "dressings__afternoon@15:00-23:00": "ΑΛΛΑΓΕΣ", "dressings__night@23:00-07:00": "ΑΛΛΑΓΕΣ",
      "preop__morning@07:00-15:00": "ΠΡΟΕΓΧΕΙΡΗΤΙΚΟΣ", "preop__afternoon@15:00-23:00": "ΠΡΟΕΓΧΕΙΡΗΤΙΚΟΣ", "preop__night@23:00-07:00": "ΠΡΟΕΓΧΕΙΡΗΤΙΚΟΣ",
      "septic__morning@07:00-15:00": "ΣΗΠΤΙΚΑ", "septic__afternoon@15:00-23:00": "ΣΗΠΤΙΚΑ", "septic__night@23:00-07:00": "ΣΗΠΤΙΚΑ",
      "surgical__morning@07:00-15:00": "ΧΕΙΡΟΥΡΓΕΙΑ", "surgical__afternoon@15:00-23:00": "ΧΕΙΡΟΥΡΓΕΙΑ", "surgical__night@23:00-07:00": "ΧΕΙΡΟΥΡΓΕΙΑ",
      "urgent__morning@07:00-15:00": "ΕΚΤΑΚΤΑ", "urgent__afternoon@15:00-23:00": "ΕΚΤΑΚΤΑ", "urgent__night@23:00-07:00": "ΕΚΤΑΚΤΑ"}'::jsonb)
  + private.fm_sync_counts('Indicators Α.Τ', 'public.register_deliveryroom_c1b3757d', 1013, '{
      "cs__count": "Κ.Τ", "vaginal__count": "Φ.Τ", "vbac__count": "Vbac", "septic__count": "Σηπτικά", "hysteroscopy__count": "Υστεροσκοπήσεις",
      "multiple_cs__count": "Πολυδ κύηση με κτ", "multiple_vaginal__count": "Πολυδ κύηση με φτ", "pregnancy_monitoring__count": "Παρακολούθηση κύησης",
      "cerclage__count": "Περίδεση", "born_before_arrival__count": "Τεκετοί εν τη πόλη"}'::jsonb)
  + private.fm_sync_counts('Indicators Ενδοσκοπικό', 'public.register_endoscopy_da85fba4', 777, '{
      "bronchoscopy__count": "Βρογχοσκοπήσεις", "colonoscopy__count": "Κολονοσκοπήσεις", "cystoscopy__count": "Κυστεοσκοπήσεις", "ebus__count": "EBUS",
      "ercp__count": "ERCP", "eus__count": "EUS", "gastroscopy__count": "Γαστροσκοπήσεις", "gastrostomy__count": "Γαστροστομίες"}'::jsonb)
  + private.fm_sync_counts('Indicators eyelab', 'public.register_ophthalmology_bbea9bde', 400, '{
      "cataract__count": "Καταράκτες", "intravitreal__count": "Ενδοϋαλικές εγχύσεις", "other_local__count": "Διάφορα με τοπική", "vitrectomy__count": "Βιτρεκτομές"}'::jsonb);
end;
$$;

create or replace function private.fm_sync_tables()
returns text[] language sql immutable set search_path = '' as $$
  select array['PerformedControls', 'People', 'Departments', 'Controls', 'Training', 'Training Participants', 'Meeting_REVIEWS', 'Μeeting_Decisions',
               'Commitees', 'Commitees_REVIEWS', 'Commitees_Decisions', 'IncidentManagement', 'Death',
               'Indicators TEP', 'Indicators Α.Τ', 'Indicators Ενδοσκοπικό', 'Indicators eyelab']
$$;

create or replace function private.fm_sync_all()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not coalesce((select s.enabled from public.fm_stage_settings s where s.id), false) then return null; end if;
  v_result := jsonb_build_object('task', 'daily_sync', 'at', now(), 'people', private.fm_sync_people());
  v_result := v_result || jsonb_build_object('controls', private.fm_sync_controls(), 'training', private.fm_sync_training(),
    'department_meetings', private.fm_sync_department_meetings(), 'committees', private.fm_sync_committees(), 'incidents', private.fm_sync_incidents(),
    'indicators', private.fm_sync_indicators());
  update public.fm_stage_settings set last_result = v_result where id;
  return v_result;
end;
$$;
