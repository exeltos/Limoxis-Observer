-- Ημερήσια φύλλα FileMaker (ΤΕΠ, Αίθουσα Τοκετών, Ενδοσκοπικό, Οφθαλμολογικό) του ΙΑΣΩ (22/11/2026, εγκρίθηκε από τον ιδιοκτήτη).
-- Αιτία: τα μητρώα έγιναν ημερήσια στις 31/10 (department_registers.daily_from), αλλά ο νυχτερινός συγχρονισμός
-- (fm_sync_counts) έψαχνε ακόμη τη γραμμή του ΜΗΝΑ (period_start = 1η του μήνα). Έτσι όλες οι ημέρες από 31/10 και μετά
-- προστέθηκαν στη γραμμή της 1/10 ή της 1/11 και οι υπόλοιπες ημέρες του Νοεμβρίου έμειναν κενές.
-- Διόρθωση: όταν το μητρώο είναι ημερήσιο από εκείνη την ημερομηνία, η εγγραφή πηγαίνει στη γραμμή της ΗΜΕΡΑΣ.
-- Αποκατάσταση: η 1/10, η 1/11 και οι ημέρες από 31/10 ξαναϋπολογίζονται από το fm_stage_records (μόνο οι στήλες του
-- FileMaker), οι συνδέσεις (fm_stage_links) δείχνουν στη σωστή ημέρα. Δεν διαγράφεται τίποτα· αντίγραφο των γραμμών
-- 1/10 και 1/11 πριν την αλλαγή στο private.bk_fm_daily_rows_20261122.

create or replace function private.fm_sync_counts(p_base_table text, p_register regclass, p_after bigint, p_columns jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_register uuid; v_department uuid; v_version integer; v_daily_from date;
  v_day date; v_month date; v_row uuid; v_count integer := 0;
  r record; c record; v_set text; v_value numeric;
begin
  execute format('select register_id, department_id, definition_version from %s order by period_start desc limit 1', p_register)
    into v_register, v_department, v_version;
  if v_register is null then return 0; end if;
  select d.daily_from into v_daily_from from public.department_registers d where d.id = v_register;
  for r in
    select s.record_id, s.data
    from public.fm_stage_records s
    where s.base_table = p_base_table and s.record_id ~ '^\d+$' and s.record_id::bigint > p_after
      and nullif(s.data->>'Ημερομηνία', '') is not null
      and (p_base_table <> 'Indicators TEP' or s.data->>'ΒΑΡΔΙΑ' in ('07:00-15:00', '15:00-23:00', '23:00-07:00'))
      and not exists (select 1 from public.fm_stage_links l where l.base_table = p_base_table and l.record_id = s.record_id)
    order by s.record_id::bigint
  loop
    v_day := (r.data->>'Ημερομηνία')::date;
    -- ημερήσιο μητρώο: γραμμή της ημέρας· αλλιώς (ή πριν το daily_from) γραμμή του μήνα
    v_month := case when v_daily_from is not null and v_day >= v_daily_from then v_day else date_trunc('month', v_day)::date end;
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

-- Ξαναϋπολογισμός ημερών από το FileMaker: για κάθε ημέρα του p_days οι στήλες του p_columns παίρνουν το άθροισμα των
-- εγγραφών FileMaker εκείνης της ημέρας (κενό όταν 0)· λείπουσα ημέρα δημιουργείται. Οι εγγραφές από p_relink_from
-- συνδέονται με τη γραμμή της ημέρας τους. Επαναλαμβανόμενη εκτέλεση δεν αλλάζει τίποτα.
create or replace function private.fm_resync_daily_counts(p_base_table text, p_register regclass, p_columns jsonb, p_days date[], p_relink_from date)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_register uuid; v_department uuid; v_version integer;
  v_day date; v_row uuid; v_count integer := 0; v_has boolean;
  c record; v_set text; v_value numeric;
begin
  execute format('select register_id, department_id, definition_version from %s order by period_start desc limit 1', p_register)
    into v_register, v_department, v_version;
  if v_register is null then return 0; end if;
  foreach v_day in array p_days loop
    select exists (
      select 1 from public.fm_stage_records s
      where s.base_table = p_base_table and s.record_id ~ '^\d+$' and s.data->>'Ημερομηνία' = v_day::text
        and (p_base_table <> 'Indicators TEP' or s.data->>'ΒΑΡΔΙΑ' in ('07:00-15:00', '15:00-23:00', '23:00-07:00'))
    ) into v_has;
    v_row := null;
    execute format('select id from %s where register_id = $1 and department_id = $2 and period_start = $3 limit 1', p_register)
      into v_row using v_register, v_department, v_day;
    if v_row is null then
      if not v_has then continue; end if;
      v_row := md5('fm-' || p_base_table || '-' || v_day)::uuid;
      execute format('insert into %s (id, organization_id, department_id, register_id, entry_date, period_start, status, locked, definition_version, created_by, updated_by) values ($1, $2, $3, $4, $5, $5, ''complete'', false, $6, $7, $7)', p_register)
        using v_row, private.fm_org(), v_department, v_register, v_day, v_version, private.fm_importer();
    end if;
    v_set := '';
    for c in select key, value #>> '{}' as field from jsonb_each(p_columns) loop
      select coalesce(sum(case when s.data->>c.field ~ '^-?[0-9]+(\.[0-9]+)?$' then (s.data->>c.field)::numeric else 0 end), 0)
        into v_value
      from public.fm_stage_records s
      where s.base_table = p_base_table and s.record_id ~ '^\d+$' and s.data->>'Ημερομηνία' = v_day::text
        and (p_base_table <> 'Indicators TEP' or s.data->>'ΒΑΡΔΙΑ' in ('07:00-15:00', '15:00-23:00', '23:00-07:00'))
        and (position('@' in c.key) = 0 or s.data->>'ΒΑΡΔΙΑ' = split_part(c.key, '@', 2));
      v_set := v_set || format('%I = %s, ', split_part(c.key, '@', 1), coalesce(nullif(v_value, 0)::text, 'null'));
    end loop;
    execute format('update %s set %s updated_at = now() where id = $1 and not coalesce(locked, false)', p_register, v_set) using v_row;
    v_count := v_count + 1;
  end loop;
  execute format($q$
    update public.fm_stage_links l set target_id = t.id, linked_at = now()
    from public.fm_stage_records s, %s t
    where l.base_table = $1 and s.base_table = l.base_table and s.record_id = l.record_id
      and s.data->>'Ημερομηνία' ~ '^\d{4}-\d{2}-\d{2}$' and (s.data->>'Ημερομηνία')::date >= $2
      and t.register_id = $3 and t.department_id = $4 and t.period_start = (s.data->>'Ημερομηνία')::date
      and l.target_id is distinct from t.id$q$, p_register)
    using p_base_table, p_relink_from, v_register, v_department;
  return v_count;
end;
$$;

create table if not exists private.bk_fm_daily_rows_20261122 (register text, row_data jsonb, saved_at timestamptz default now());

-- Οι στήλες ανά φύλλο είναι ίδιες με του private.fm_sync_indicators().
do $$
declare
  v_table text;
  v_days date[] := array['2026-10-01'::date] || array(select d::date from generate_series('2026-10-31'::date, '2026-11-22'::date, interval '1 day') d);
begin
  if to_regclass('public.register_emergency_f6ceb2a5') is null then return; end if;
  if not exists (select 1 from private.bk_fm_daily_rows_20261122) then
    foreach v_table in array array['register_emergency_f6ceb2a5', 'register_deliveryroom_c1b3757d', 'register_endoscopy_da85fba4', 'register_ophthalmology_bbea9bde'] loop
      execute format('insert into private.bk_fm_daily_rows_20261122 (register, row_data) select %L, to_jsonb(t) from public.%I t where period_start in (''2026-10-01'', ''2026-11-01'')', v_table, v_table);
    end loop;
  end if;
  perform private.fm_resync_daily_counts('Indicators TEP', 'public.register_emergency_f6ceb2a5', '{
      "admissions__morning@07:00-15:00": "ΕΙΣΑΓΩΓΕΣ", "admissions__afternoon@15:00-23:00": "ΕΙΣΑΓΩΓΕΣ", "admissions__night@23:00-07:00": "ΕΙΣΑΓΩΓΕΣ",
      "assessments__morning@07:00-15:00": "ΕΚΤΙΜΗΣΕΙΣ", "assessments__afternoon@15:00-23:00": "ΕΚΤΙΜΗΣΕΙΣ", "assessments__night@23:00-07:00": "ΕΚΤΙΜΗΣΕΙΣ",
      "checkup__morning@07:00-15:00": "CHECK UP", "checkup__afternoon@15:00-23:00": "CHECK UP", "checkup__night@23:00-07:00": "CHECK UP",
      "dressings__morning@07:00-15:00": "ΑΛΛΑΓΕΣ", "dressings__afternoon@15:00-23:00": "ΑΛΛΑΓΕΣ", "dressings__night@23:00-07:00": "ΑΛΛΑΓΕΣ",
      "preop__morning@07:00-15:00": "ΠΡΟΕΓΧΕΙΡΗΤΙΚΟΣ", "preop__afternoon@15:00-23:00": "ΠΡΟΕΓΧΕΙΡΗΤΙΚΟΣ", "preop__night@23:00-07:00": "ΠΡΟΕΓΧΕΙΡΗΤΙΚΟΣ",
      "septic__morning@07:00-15:00": "ΣΗΠΤΙΚΑ", "septic__afternoon@15:00-23:00": "ΣΗΠΤΙΚΑ", "septic__night@23:00-07:00": "ΣΗΠΤΙΚΑ",
      "surgical__morning@07:00-15:00": "ΧΕΙΡΟΥΡΓΕΙΑ", "surgical__afternoon@15:00-23:00": "ΧΕΙΡΟΥΡΓΕΙΑ", "surgical__night@23:00-07:00": "ΧΕΙΡΟΥΡΓΕΙΑ",
      "urgent__morning@07:00-15:00": "ΕΚΤΑΚΤΑ", "urgent__afternoon@15:00-23:00": "ΕΚΤΑΚΤΑ", "urgent__night@23:00-07:00": "ΕΚΤΑΚΤΑ"}'::jsonb, v_days, '2026-10-01');
  perform private.fm_resync_daily_counts('Indicators Α.Τ', 'public.register_deliveryroom_c1b3757d', '{
      "cs__count": "Κ.Τ", "vaginal__count": "Φ.Τ", "vbac__count": "Vbac", "septic__count": "Σηπτικά", "hysteroscopy__count": "Υστεροσκοπήσεις",
      "multiple_cs__count": "Πολυδ κύηση με κτ", "multiple_vaginal__count": "Πολυδ κύηση με φτ", "pregnancy_monitoring__count": "Παρακολούθηση κύησης",
      "cerclage__count": "Περίδεση", "born_before_arrival__count": "Τεκετοί εν τη πόλη"}'::jsonb, v_days, '2026-10-01');
  perform private.fm_resync_daily_counts('Indicators Ενδοσκοπικό', 'public.register_endoscopy_da85fba4', '{
      "bronchoscopy__count": "Βρογχοσκοπήσεις", "colonoscopy__count": "Κολονοσκοπήσεις", "cystoscopy__count": "Κυστεοσκοπήσεις", "ebus__count": "EBUS",
      "ercp__count": "ERCP", "eus__count": "EUS", "gastroscopy__count": "Γαστροσκοπήσεις", "gastrostomy__count": "Γαστροστομίες"}'::jsonb, v_days, '2026-10-01');
  perform private.fm_resync_daily_counts('Indicators eyelab', 'public.register_ophthalmology_bbea9bde', '{
      "cataract__count": "Καταράκτες", "intravitreal__count": "Ενδοϋαλικές εγχύσεις", "other_local__count": "Διάφορα με τοπική", "vitrectomy__count": "Βιτρεκτομές"}'::jsonb, v_days, '2026-10-01');
end;
$$;
