-- FileMaker, ημερήσια φύλλα: επαναφορά της γραμμής του Οκτωβρίου (1/10) μετά το 20261231624000.
--
-- Πριν γίνουν ημερήσια (31/10), τα μητρώα ΤΕΠ, Αίθουσας Τοκετών, Ενδοσκοπικού και Οφθαλμολογικού κρατούσαν μία
-- γραμμή ανά μήνα· η γραμμή με period_start = 1/10 είχε τα σύνολα 1–30/10 (και, λόγω του σφάλματος, και της 31/10).
-- Το 20261231624000 την ξαναϋπολόγισε σαν ημερήσια, μόνο με τις εγγραφές της 1/10, και χάθηκαν οι 2–30/10.
-- Εδώ η γραμμή 1/10 παίρνει ξανά τα σύνολα όλων των εγγραφών FileMaker 1–30/10 (η 31/10 έχει πλέον δική της
-- γραμμή). Πηγή είναι το FileMaker: η παλιά γραμμή (αντίγραφο private.bk_fm_daily_rows_20261122) είχε περίπου τα
-- μισά από τα σύνολα του FileMaker για 1–30/10, άρα ούτε εκείνη ήταν πλήρης· η αναφορά της συνάρτησης δείχνει και τις
-- τρεις τιμές (τρέχουσα, FileMaker 1–30/10, αντίγραφο μείον 31/10) για κάθε στήλη που αλλάζει.
-- Μόνο update της γραμμής 1/10 (όχι κλειδωμένη)· επαναλαμβανόμενη εκτέλεση δίνει το ίδιο.

create or replace function private.fm_restore_month_row(p_base_table text, p_register regclass, p_columns jsonb, p_row_day date, p_from date, p_to date, p_apply boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_table text := split_part(p_register::text, '.', 2);
  v_col text; v_stage numeric; v_bk numeric; v_31 numeric; v_cur numeric; v_new numeric;
  v_set text := ''; v_report jsonb := '[]'::jsonb; v_row uuid;
begin
  execute format('select id from %s where period_start = $1 and not coalesce(locked, false) limit 1', p_register) into v_row using p_row_day;
  if v_row is null then return jsonb_build_object('table', v_table, 'skipped', 'no unlocked row'); end if;
  for v_col in select distinct split_part(key, '@', 1) from jsonb_each_text(p_columns) loop
    select coalesce(sum(case when s.data->>c.value ~ '^-?[0-9]+(\.[0-9]+)?$' then (s.data->>c.value)::numeric else 0 end), 0)
      into v_stage
    from jsonb_each_text(p_columns) c
    join public.fm_stage_records s on s.base_table = p_base_table and s.record_id ~ '^\d+$'
      and s.data->>'Ημερομηνία' between p_from::text and p_to::text
      and (p_base_table <> 'Indicators TEP' or s.data->>'ΒΑΡΔΙΑ' in ('07:00-15:00', '15:00-23:00', '23:00-07:00'))
      and (position('@' in c.key) = 0 or s.data->>'ΒΑΡΔΙΑ' = split_part(c.key, '@', 2))
    where split_part(c.key, '@', 1) = v_col;
    select (b.row_data->>v_col)::numeric into v_bk from private.bk_fm_daily_rows_20261122 b
      where b.register = v_table and b.row_data->>'period_start' = p_row_day::text limit 1;
    execute format('select (%I)::numeric from %s where period_start = $1 limit 1', v_col, p_register) into v_31 using p_to + 1;
    execute format('select (%I)::numeric from %s where id = $1', v_col, p_register) into v_cur using v_row;
    v_new := v_stage;
    if coalesce(v_cur, 0) <> v_new then
      v_report := v_report || jsonb_build_object('column', v_col, 'current', v_cur, 'filemaker_1_30', v_stage, 'backup_minus_31', v_bk - coalesce(v_31, 0), 'new', v_new);
    end if;
    v_set := v_set || format('%I = %s, ', v_col, coalesce(nullif(v_new, 0)::text, 'null'));
  end loop;
  if p_apply then
    execute format('update %s set %s updated_at = now() where id = $1 and not coalesce(locked, false)', p_register, v_set) using v_row;
  end if;
  return jsonb_build_object('table', v_table, 'changes', v_report);
end;
$$;

do $$
begin
  if to_regclass('public.register_emergency_f6ceb2a5') is null or to_regclass('private.bk_fm_daily_rows_20261122') is null then return; end if;
  perform private.fm_restore_month_row('Indicators TEP', 'public.register_emergency_f6ceb2a5', '{"admissions__morning@07:00-15:00": "ΕΙΣΑΓΩΓΕΣ", "admissions__afternoon@15:00-23:00": "ΕΙΣΑΓΩΓΕΣ", "admissions__night@23:00-07:00": "ΕΙΣΑΓΩΓΕΣ", "assessments__morning@07:00-15:00": "ΕΚΤΙΜΗΣΕΙΣ", "assessments__afternoon@15:00-23:00": "ΕΚΤΙΜΗΣΕΙΣ", "assessments__night@23:00-07:00": "ΕΚΤΙΜΗΣΕΙΣ", "checkup__morning@07:00-15:00": "CHECK UP", "checkup__afternoon@15:00-23:00": "CHECK UP", "checkup__night@23:00-07:00": "CHECK UP", "dressings__morning@07:00-15:00": "ΑΛΛΑΓΕΣ", "dressings__afternoon@15:00-23:00": "ΑΛΛΑΓΕΣ", "dressings__night@23:00-07:00": "ΑΛΛΑΓΕΣ", "preop__morning@07:00-15:00": "ΠΡΟΕΓΧΕΙΡΗΤΙΚΟΣ", "preop__afternoon@15:00-23:00": "ΠΡΟΕΓΧΕΙΡΗΤΙΚΟΣ", "preop__night@23:00-07:00": "ΠΡΟΕΓΧΕΙΡΗΤΙΚΟΣ", "septic__morning@07:00-15:00": "ΣΗΠΤΙΚΑ", "septic__afternoon@15:00-23:00": "ΣΗΠΤΙΚΑ", "septic__night@23:00-07:00": "ΣΗΠΤΙΚΑ", "surgical__morning@07:00-15:00": "ΧΕΙΡΟΥΡΓΕΙΑ", "surgical__afternoon@15:00-23:00": "ΧΕΙΡΟΥΡΓΕΙΑ", "surgical__night@23:00-07:00": "ΧΕΙΡΟΥΡΓΕΙΑ", "urgent__morning@07:00-15:00": "ΕΚΤΑΚΤΑ", "urgent__afternoon@15:00-23:00": "ΕΚΤΑΚΤΑ", "urgent__night@23:00-07:00": "ΕΚΤΑΚΤΑ"}'::jsonb, '2026-10-01', '2026-10-01', '2026-10-30');
  perform private.fm_restore_month_row('Indicators Α.Τ', 'public.register_deliveryroom_c1b3757d', '{"cs__count": "Κ.Τ", "vaginal__count": "Φ.Τ", "vbac__count": "Vbac", "septic__count": "Σηπτικά", "hysteroscopy__count": "Υστεροσκοπήσεις", "multiple_cs__count": "Πολυδ κύηση με κτ", "multiple_vaginal__count": "Πολυδ κύηση με φτ", "pregnancy_monitoring__count": "Παρακολούθηση κύησης", "cerclage__count": "Περίδεση", "born_before_arrival__count": "Τεκετοί εν τη πόλη"}'::jsonb, '2026-10-01', '2026-10-01', '2026-10-30');
  perform private.fm_restore_month_row('Indicators Ενδοσκοπικό', 'public.register_endoscopy_da85fba4', '{"bronchoscopy__count": "Βρογχοσκοπήσεις", "colonoscopy__count": "Κολονοσκοπήσεις", "cystoscopy__count": "Κυστεοσκοπήσεις", "ebus__count": "EBUS", "ercp__count": "ERCP", "eus__count": "EUS", "gastroscopy__count": "Γαστροσκοπήσεις", "gastrostomy__count": "Γαστροστομίες"}'::jsonb, '2026-10-01', '2026-10-01', '2026-10-30');
  perform private.fm_restore_month_row('Indicators eyelab', 'public.register_ophthalmology_bbea9bde', '{"cataract__count": "Καταράκτες", "intravitreal__count": "Ενδοϋαλικές εγχύσεις", "other_local__count": "Διάφορα με τοπική", "vitrectomy__count": "Βιτρεκτομές"}'::jsonb, '2026-10-01', '2026-10-01', '2026-10-30');
end;
$$;
