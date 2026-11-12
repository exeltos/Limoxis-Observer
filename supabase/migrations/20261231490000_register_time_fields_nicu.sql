-- Μητρώα: πεδίο τύπου «Ώρα» και, στη ΜΕΝΝ, ώρα γέννησης και ώρα εισαγωγής
-- (εγκρίθηκε από τον ιδιοκτήτη 12/11/2026). Με τις δύο ώρες η «Ηλικία εισαγωγής
-- σε ώρες» υπολογίζεται στην εφαρμογή (ρολόι Αθήνας)· χωρίς αυτές γράφεται με το
-- χέρι, όπως στο FileMaker. Οι ώρες που ήρθαν από το FileMaker δεν αλλάζουν.
-- Προϋπόθεση: docs/sql/register_time_field_type.sql (νέος τύπος στον έλεγχο).

create or replace function private.register_column_sql(f public.department_register_fields)
returns text
language plpgsql
immutable
set search_path to ''
as $function$
begin
  case f.field_type
    when 'number' then return 'numeric';
    when 'date' then return 'date';
    when 'time' then return 'time';
    when 'yes_no' then return 'boolean';
    when 'choice' then return 'text';
    when 'multi_choice' then return 'text[]';
    when 'gestation' then return 'integer check (' || quote_ident(f.key) || ' between 0 and 400)';
    when 'text' then return 'text';
    when 'computed' then
      if f.computed_kind = 'age_years' then
        return format('integer generated always as (case when %2$I >= %1$I then date_part(''year'', age(%2$I::timestamp, %1$I::timestamp))::integer end) stored', f.computed_from, f.computed_to);
      end if;
      if f.computed_kind = 'apache_ii' then
        return format('integer generated always as (case when %1$I is null or %2$I is null then null
          when %2$I then (array[1,3,7,12,30,35,73,88])[least(8, greatest(1, floor(%1$I / 5)::integer + 1))]
          else (array[4,8,15,25,40,55,75,85])[least(8, greatest(1, floor(%1$I / 5)::integer + 1))] end) stored', f.computed_from, f.computed_to);
      end if;
      return format('integer generated always as (case when %2$I >= %1$I then %2$I - %1$I end) stored', f.computed_from, f.computed_to);
    else raise exception 'Unknown field type %', f.field_type;
  end case;
end;
$function$;
revoke all on function private.register_column_sql(public.department_register_fields) from public, anon, authenticated;

-- Ένα πεδίο αμέσως μετά από ένα άλλο: τα επόμενα μετακινούνται μία θέση. Αν
-- υπάρχει ήδη, μένει ως έχει. Η στήλη του πίνακα προστίθεται αν λείπει.
create or replace function private.register_add_field_after(p_register_id uuid, p_after text, p_field jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  r public.department_registers;
  v_pos integer;
  f public.department_register_fields;
begin
  select * into r from public.department_registers where id = p_register_id;
  if r.id is null then raise exception 'Unknown register'; end if;
  if exists (select 1 from public.department_register_fields where register_id = p_register_id and key = p_field ->> 'key') then return; end if;
  select position, section_key into v_pos from public.department_register_fields where register_id = p_register_id and key = p_after;
  if v_pos is null then raise exception 'Unknown field %', p_after; end if;
  update public.department_register_fields set position = position + 1 where register_id = p_register_id and position > v_pos;
  insert into public.department_register_fields (organization_id, register_id, key, section_key, position, field_type, label_el, label_en, unit_el, unit_en, min_value, max_value, help_el, help_en, aliases, archived)
  select r.organization_id, p_register_id, p_field ->> 'key', a.section_key, v_pos + 1, p_field ->> 'field_type', p_field ->> 'label_el', p_field ->> 'label_en',
    p_field ->> 'unit_el', p_field ->> 'unit_en', (p_field ->> 'min_value')::numeric, (p_field ->> 'max_value')::numeric, p_field ->> 'help_el', p_field ->> 'help_en',
    coalesce(array(select jsonb_array_elements_text(p_field -> 'aliases')), '{}'), false
  from public.department_register_fields a where a.register_id = p_register_id and a.key = p_after
  returning * into f;
  if r.table_name is not null and not exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = r.table_name and c.column_name = f.key) then
    execute format('alter table public.%I add column %I %s', r.table_name, f.key, private.register_column_sql(f));
  end if;
  if r.table_name is not null then
    execute format('comment on column public.%I.%I is %L', r.table_name, f.key, f.label_el || coalesce(' (' || f.unit_el || ')', ''));
  end if;
end;
$function$;
revoke all on function private.register_add_field_after(uuid, text, jsonb) from public, anon, authenticated;

-- ΜΕΝΝ: ώρα εισαγωγής μετά την ημερομηνία εισαγωγής, ώρα γέννησης μετά την
-- ημερομηνία γέννησης, ηλικία σε ώρες μετά την ηλικία σε ημέρες.
create or replace function private.register_add_neonatal_times(p_register_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.register_add_field_after(p_register_id, 'admission_date', jsonb_build_object('key', 'admission_time', 'field_type', 'time', 'label_el', 'Ώρα εισαγωγής', 'label_en', 'Time of admission'));
  perform private.register_add_field_after(p_register_id, 'birth_date', jsonb_build_object('key', 'birth_time', 'field_type', 'time', 'label_el', 'Ώρα γέννησης', 'label_en', 'Time of birth',
    'help_el', 'Με την ώρα εισαγωγής, η ηλικία υπολογίζεται σε ώρες.', 'help_en', 'With the admission time, the age is calculated in hours.'));
  perform private.register_add_field_after(p_register_id, 'age_on_admission', jsonb_build_object('key', 'admission_age_hours', 'field_type', 'number', 'label_el', 'Ηλικία εισαγωγής σε ώρες', 'label_en', 'Age on admission in hours',
    'unit_el', 'ώρες', 'unit_en', 'hours', 'min_value', 0, 'max_value', 8760, 'aliases', jsonb_build_array('ΗΛΙΚΙΑ ΕΙΣΑΓΩΓΗΣ ΣΕ ΩΡΕΣ'),
    'help_el', 'Όταν δεν είναι γνωστές οι ώρες γέννησης και εισαγωγής.', 'help_en', 'When the birth and admission times are not known.'));
end;
$function$;
revoke all on function private.register_add_neonatal_times(uuid) from public, anon, authenticated;

-- Demo: τα νεογνά που γεννήθηκαν εδώ έχουν ώρες γέννησης και εισαγωγής.
create or replace function private.demo_seed_register_nicu(p_register_id uuid, p_actor uuid, d0 date)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  n constant integer := 66;
  v_rows jsonb := '[]'::jsonb;
  i integer;
  v_adm date; v_birth date; v_dis date; v_reason text; v_origin text; v_gest integer; v_weight integer; v_preterm boolean;
  v_apgar1 integer; v_vent integer; v_cpap integer; v_umb text; v_umb_days integer; v_picc integer; v_central integer;
  v_los integer; v_outcome text; v_ptype text; v_female boolean;
  v_birth_time time; v_adm_time time; v_hours numeric;
  r double precision[];
begin
  perform private.register_add_neonatal_times(p_register_id);
  for i in 1..n loop
    r := array(select private.demo_register_rand(i, 2000 + k) from generate_series(1, 32) k);
    v_adm := d0 - (floor((i - 1) * 182.0 / n) + floor(r[1] * 3))::integer;
    v_reason := case when r[2] < 0.30 then 'prematurity' when r[2] < 0.55 then 'respiratory' when r[2] < 0.70 then 'jaundice'
      when r[2] < 0.80 then 'infection' when r[2] < 0.88 then 'low_weight' when r[2] < 0.95 then 'observation'
      when r[2] < 0.98 then 'congenital' else 'other' end;
    v_gest := case when v_reason = 'prematurity' then 196 + floor(r[3] * 60)
      when v_reason = 'low_weight' then 245 + floor(r[3] * 21)
      when v_reason = 'respiratory' and r[4] < 0.33 then 231 + floor(r[3] * 28)
      else 259 + floor(r[3] * 32) end;
    v_preterm := v_gest < 259;
    -- Γεννημένα εδώ (Αίθουσα Τοκετών / Μαιευτική) ή από το σπίτι και άλλο νοσοκομείο.
    if v_preterm or r[5] < 0.75 then
      v_origin := case when v_reason = 'jaundice' or r[6] >= 0.75 then 'maternity' else 'delivery_room' end;
      v_birth := case when v_origin = 'maternity' then v_adm - (1 + floor(r[7] * 3))::integer else v_adm end;
    else
      v_origin := case when r[6] < 0.6 then 'home' else 'other_hospital' end;
      v_birth := v_adm - (3 + floor(r[7] * 18))::integer;
    end if;
    -- Ώρες γέννησης και εισαγωγής μόνο για όσα γεννήθηκαν εδώ (μέσα σε 3 ημέρες)· η ηλικία σε ώρες βγαίνει από αυτές.
    v_birth_time := null; v_adm_time := null; v_hours := null;
    if v_adm - v_birth < 3 then
      v_birth_time := make_time(floor(r[30] * 21)::integer, floor(r[29] * 60)::integer, 0);
      v_adm_time := case when v_adm = v_birth then v_birth_time + make_interval(mins => 30 + floor(r[28] * 150)::integer)
        else make_time(7 + floor(r[27] * 14)::integer, floor(r[26] * 60)::integer, 0) end;
      v_hours := round(extract(epoch from ((v_adm + v_adm_time) - (v_birth + v_birth_time))) / 360) / 10;
    end if;
    v_weight := least(4800, greatest(600, (3400 - (280 - v_gest) * 27 + (r[8] - 0.5) * 500)::integer));
    if v_reason = 'low_weight' then v_weight := least(v_weight, 2300); end if;
    v_apgar1 := case when v_gest < 224 then 4 + floor(r[9] * 4) else 7 + floor(r[9] * 3) end;
    v_vent := case when v_gest < 224 and r[10] < 0.6 then 1 + floor(r[11] * 10)
      when v_reason = 'respiratory' and r[10] < 0.2 then 1 + floor(r[11] * 3) else 0 end;
    v_cpap := case when (v_gest < 245 or v_reason = 'respiratory') and r[12] < 0.8 then 1 + floor(r[13] * 8) else 0 end;
    v_umb := case when v_gest < 224 then case when r[14] < 0.5 then 'venous' else 'both' end
      when v_gest < 245 and r[14] < 0.3 then 'venous' else 'none' end;
    v_umb_days := case when v_umb = 'none' then 0 else 3 + floor(r[15] * 5) end;
    v_picc := case when v_gest < 210 then 8 + floor(r[16] * 14) else 0 end;
    v_central := v_umb_days + v_picc;
    v_los := case when v_preterm then 7 + floor((259 - v_gest) * 0.75 + r[17] * 6) else 2 + floor(r[17] * 6) end;
    v_dis := case when v_adm + v_los <= d0 then v_adm + v_los end;
    v_outcome := case when v_dis is null then null
      when v_gest < 210 and r[18] < 0.12 then 'death'
      when r[18] < 0.04 then 'transfer_hospital' when r[18] < 0.08 then 'transfer_ward' else 'home' end;
    v_ptype := case when r[19] < 0.84 then 'single' when r[19] < 0.98 then 'twin' else 'multiple' end;
    v_female := r[20] < 0.48;
    v_rows := v_rows || jsonb_build_object(
      'id', gen_random_uuid(), 'status', 'complete',
      'admission_date', v_adm, 'birth_date', v_birth,
      'birth_time', to_char(v_birth_time, 'HH24:MI'), 'admission_time', to_char(v_adm_time, 'HH24:MI'), 'admission_age_hours', v_hours,
      'readmission', v_origin = 'home' and r[21] < 0.35,
      'admission_reason', v_reason, 'admission_origin', v_origin,
      'gestation', v_gest, 'pregnancy_type', v_ptype,
      'delivery', case when r[22] < 0.55 or v_ptype <> 'single' then 'cs' else 'vaginal' end,
      'ivf', case when v_ptype <> 'single' then r[23] < 0.6 else r[23] < 0.12 end,
      'prom_24h', case when v_reason = 'infection' then r[24] < 0.4 else r[24] < 0.06 end,
      'birth_weight', v_weight, 'apgar_1', v_apgar1, 'apgar_5', least(10, v_apgar1 + 1 + floor(r[25] * 2)::integer),
      'resuscitation', case when v_gest < 224 then case when r[26] < 0.5 then 'bag_mask' else 'intubation' end
        when v_reason = 'respiratory' then case when r[26] < 0.6 then 'oxygen' else 'bag_mask' end
        when r[26] < 0.85 then 'none' else 'oxygen' end,
      'congenital_anomalies', v_reason = 'congenital' or r[27] < 0.02,
      'ventilator_days', v_vent, 'hfov', case when v_vent > 0 then v_vent >= 6 and r[28] < 0.35 end,
      'cpap_days', v_cpap,
      'oxygen_days', case when v_vent + v_cpap > 0 then v_vent + v_cpap + floor(r[29] * 5)::integer when r[29] < 0.1 then 1 else 0 end,
      'oxygen_after_36w', v_gest < 210 and v_vent >= 5,
      'umbilical_catheter', v_umb, 'central_line_days', v_central,
      'arterial_line_days', case when v_umb = 'both' then 2 + floor(r[30] * 5)::integer else 0 end,
      'tpn_days', case when v_gest < 238 then 4 + floor(r[30] * 12)::integer else 0 end,
      'picc_days', v_picc,
      'nasogastric', v_gest < 245 or r[31] < 0.1,
      'bottle_feeding', r[31] >= 0.75,
      'breast_milk', case when v_dis is null then null when r[32] < 0.45 then 'exclusive' when r[32] < 0.85 then 'mixed' else 'none' end,
      'early_infection', v_reason = 'infection' and r[24] < 0.35,
      'late_infection', v_central >= 10 and r[11] < 0.18,
      'discharge_date', v_dis,
      'discharge_weight', case when v_dis is not null and v_outcome <> 'death' then case when v_preterm then v_weight + v_los * 18 else v_weight - 80 + v_los * 10 end end,
      'outcome', v_outcome,
      '_case', 'ΜΕΝΝ-' || to_char(v_adm, 'YY') || '-' || lpad((n + 1 - i)::text, 4, '0'),
      '_name', 'Νεογνό ' || split_part(private.demo_register_name(i, 2100, true), ' ', 1));
  end loop;
  return private.demo_register_insert(p_register_id, p_actor, v_rows);
end;
$function$;
revoke all on function private.demo_seed_register_nicu(uuid, uuid, date) from public, anon, authenticated;

-- Τα υπάρχοντα μητρώα ΜΕΝΝ (ΙΑΣΩ και Demo) παίρνουν τα νέα πεδία.
do $$
declare v_id uuid;
begin
  for v_id in select id from public.department_registers where template_key = 'nicu' loop
    perform private.register_add_neonatal_times(v_id);
  end loop;
end $$;
