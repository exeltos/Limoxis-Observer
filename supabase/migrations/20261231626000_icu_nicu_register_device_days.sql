-- ΜΕΘ / ΜΕΝΝ: ημέρες συσκευής από τα μητρώα (εγκρίθηκε από τον ιδιοκτήτη 22/11/2026, επιλογή Α).
-- 1. Μητρώο ΜΕΘ: δύο αριθμητικά πεδία μετά τις ώρες αναπνευστήρα, «Ημέρες κεντρικού φλεβικού καθετήρα» και
--    «Ημέρες ουροκαθετήρα». Το παλιό ιστορικό μένει κενό· η ΜΕΘ το συμπληρώνει η ίδια (2025–2026).
-- 2. Μητρώο ΜΕΝΝ: οδηγία στις «Ημέρες ομφαλικού καθετήρα»: μετρούν μαζί με το PICC στις ημέρες κεντρικού καθετήρα.
-- 3. Καρτέλα «Δείκτες» των δύο μητρώων: ημέρες νοσηλείας (σύνολο) και χρήση ΚΦΚ, ουροκαθετήρα και αναπνευστήρα
--    (ημέρες συσκευής ανά 100 ημέρες νοσηλείας, στον μήνα εξόδου). Ο «ρυθμός» με πεδίο αριθμητή αθροίζει τις ημέρες
--    του πεδίου (το «/24» μετατρέπει τις ώρες αναπνευστήρα σε ημέρες).
-- 4. Η επαναφορά του Demo φτιάχνει τα ίδια πεδία και δείκτες (και τιμές στη ΜΕΘ).
-- Μόνο προσθήκες· καμία τιμή δεν αλλάζει.

create or replace function private.register_add_device_days(p_register_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  r public.department_registers;
  v_pos integer;
begin
  -- Μόνο από τη βάση (migration, επαναφορά Demo): ποτέ από χρήστη της εφαρμογής.
  if current_user in ('authenticated', 'anon') then raise exception 'Not allowed' using errcode = '42501'; end if;
  select * into r from public.department_registers where id = p_register_id;
  if r.id is null or r.template_key not in ('icu', 'nicu') then return; end if;
  if r.template_key = 'icu' and exists (select 1 from public.department_register_fields where register_id = r.id and key = 'ventilator_hours') then
    perform private.register_add_field_after(r.id, 'ventilator_hours', jsonb_build_object('key', 'central_line_days', 'field_type', 'number',
      'label_el', 'Ημέρες κεντρικού φλεβικού καθετήρα', 'label_en', 'Central line days', 'unit_el', 'ημέρες', 'unit_en', 'days', 'min_value', 0, 'max_value', 365,
      'help_el', 'Οι ημέρες με κεντρικό φλεβικό καθετήρα στη ΜΕΘ· 0 αν δεν είχε. Δίνουν τον παρονομαστή του CLABSI.',
      'help_en', 'The days with a central line in the ICU; 0 if none. They are the CLABSI denominator.'));
    perform private.register_add_field_after(r.id, 'central_line_days', jsonb_build_object('key', 'urinary_catheter_days', 'field_type', 'number',
      'label_el', 'Ημέρες ουροκαθετήρα', 'label_en', 'Urinary catheter days', 'unit_el', 'ημέρες', 'unit_en', 'days', 'min_value', 0, 'max_value', 365,
      'help_el', 'Οι ημέρες με ουροκαθετήρα στη ΜΕΘ· 0 αν δεν είχε. Δίνουν τον παρονομαστή του CAUTI.',
      'help_en', 'The days with a urinary catheter in the ICU; 0 if none. They are the CAUTI denominator.'));
  end if;
  if r.template_key = 'nicu' then
    update public.department_register_fields
    set help_el = 'Συμπληρώστε τις ημέρες κάθε φορά που υπάρχει ομφαλικός καθετήρας: μετρούν μαζί με το PICC στις ημέρες κεντρικού καθετήρα (παρονομαστής του CLABSI).',
      help_en = 'Fill in the days whenever there is an umbilical catheter: with the PICC they make the central-line days (the CLABSI denominator).'
    where register_id = r.id and key = 'umbilical_days';
  end if;

  select coalesce(max(position), 0) into v_pos from public.department_register_indicators where register_id = r.id;
  with defs(key, ord, title_el, title_en, aggregation, field_key, denominator_field_key, multiplier, unit_el, unit_en, note_el, note_en) as (
    select * from (values
      ('icu_days_total', 1, 'Ημέρες ΜΕΘ (σύνολο)', 'ICU days (total)', 'sum', 'length_of_stay', null, null::numeric, 'ημέρες', 'days',
        'Οι ημέρες νοσηλείας όσων βγήκαν, στον μήνα εξόδου.', 'The stay days of those discharged, in the month of discharge.'),
      ('central_line_use', 2, 'Χρήση κεντρικού φλεβικού καθετήρα', 'Central line utilisation', 'rate', 'central_line_days', 'length_of_stay', 100, '%', '%',
        'Ημέρες ΚΦΚ ανά 100 ημέρες νοσηλείας, στον μήνα εξόδου.', 'Central line days per 100 patient-days, in the month of discharge.'),
      ('urinary_catheter_use', 3, 'Χρήση ουροκαθετήρα', 'Urinary catheter utilisation', 'rate', 'urinary_catheter_days', 'length_of_stay', 100, '%', '%',
        'Ημέρες ουροκαθετήρα ανά 100 ημέρες νοσηλείας, στον μήνα εξόδου.', 'Urinary catheter days per 100 patient-days, in the month of discharge.'),
      ('ventilator_use', 4, 'Χρήση αναπνευστήρα', 'Ventilator utilisation', 'rate', 'ventilator_hours/24', 'length_of_stay', 100, '%', '%',
        'Ημέρες αναπνευστήρα (ώρες / 24) ανά 100 ημέρες νοσηλείας, στον μήνα εξόδου.', 'Ventilator days (hours / 24) per 100 patient-days, in the month of discharge.')
    ) v where r.template_key = 'icu'
    union all
    select * from (values
      ('patient_days_total', 1, 'Ημέρες νοσηλείας (σύνολο)', 'Patient-days (total)', 'sum', 'length_of_stay', null, null::numeric, 'ημέρες', 'days',
        'Οι ημέρες νοσηλείας όσων βγήκαν, στον μήνα εξόδου.', 'The stay days of those discharged, in the month of discharge.'),
      ('central_line_use', 2, 'Χρήση κεντρικού καθετήρα (PICC και ομφαλικός)', 'Central line utilisation (PICC and umbilical)', 'rate', 'central_line_days+umbilical_days', 'length_of_stay', 100, '%', '%',
        'Ημέρες PICC και ομφαλικού ανά 100 ημέρες νοσηλείας, στον μήνα εξόδου.', 'PICC and umbilical days per 100 patient-days, in the month of discharge.'),
      ('ventilator_use', 3, 'Χρήση αναπνευστήρα', 'Ventilator utilisation', 'rate', 'ventilator_days', 'length_of_stay', 100, '%', '%',
        'Ημέρες αναπνευστήρα ανά 100 ημέρες νοσηλείας, στον μήνα εξόδου.', 'Ventilator days per 100 patient-days, in the month of discharge.')
    ) v where r.template_key = 'nicu'
  ),
  ins as (
    insert into public.department_register_indicators (organization_id, register_id, key, position, title_el, title_en, aggregation, field_key, date_field_key,
      denominator_field_key, multiplier, unit_el, unit_en, direction, note_el, note_en)
    select r.organization_id, r.id, d.key, v_pos + d.ord, d.title_el, d.title_en, d.aggregation, d.field_key, 'discharge_date',
      d.denominator_field_key, d.multiplier, d.unit_el, d.unit_en, 'context', d.note_el, d.note_en
    from defs d
    where not exists (select 1 from public.department_register_indicators i where i.register_id = r.id and i.key = d.key)
    returning id, organization_id, register_id, key
  )
  insert into public.department_register_indicator_filters (organization_id, register_id, indicator_id, part, position, field_key, op, value)
  select ins.organization_id, ins.register_id, ins.id, p.part, 0, 'discharge_date', 'filled', null
  from ins cross join (values ('numerator'), ('denominator')) p(part)
  where ins.key <> 'icu_days_total' and ins.key <> 'patient_days_total' or p.part = 'numerator';
end;
$function$;

-- Demo ΜΕΘ: τα δύο πεδία και τιμές (ΚΦΚ στους διασωληνωμένους, τους σηπτικούς και τους καρδιοχειρουργικούς,
-- ουροκαθετήρας σχεδόν σε όλους). Ίδια με το 20261231360000, με τρεις γραμμές επιπλέον.
create or replace function private.demo_seed_register_icu(p_register_id uuid, p_actor uuid, d0 date)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  n constant integer := 84;
  v_rows jsonb := '[]'::jsonb;
  i integer;
  v_adm date; v_dis date; v_cardiac boolean; v_reason text; v_postop boolean; v_age integer; v_apache integer; v_los integer;
  v_vent integer; v_outcome text; v_transfer text; v_female boolean;
  r double precision[];
begin
  perform private.register_add_device_days(p_register_id);
  for i in 1..n loop
    r := array(select private.demo_register_rand(i, 1000 + k) from generate_series(1, 24) k);
    v_adm := d0 - (floor((i - 1) * 182.0 / n) + floor(r[1] * 2))::integer;
    v_cardiac := r[2] < 0.25;
    v_reason := case when v_cardiac then case when r[3] < 0.85 then 'cardiac_surgery' else 'cardiac' end
      when r[3] < 0.26 then 'respiratory' when r[3] < 0.46 then 'sepsis' when r[3] < 0.72 then 'postop'
      when r[3] < 0.82 then 'cardiac' when r[3] < 0.92 then 'neuro' when r[3] < 0.97 then 'trauma' else 'other' end;
    v_postop := v_reason in ('postop', 'cardiac_surgery');
    v_age := case when v_cardiac then 52 + floor(r[4] * 33) else 28 + floor(r[4] * 62) end;
    v_apache := case when v_cardiac then 6 + floor(r[5] * 14) when v_postop then 8 + floor(r[5] * 16) else 12 + floor(r[5] * 22) end;
    v_los := case when v_cardiac then 1 + floor(r[6] * r[6] * 5) when v_reason = 'postop' then 1 + floor(r[6] * r[6] * 6) else 2 + floor(r[6] * r[6] * 18) end;
    v_dis := case when v_adm + v_los <= d0 then v_adm + v_los end;
    v_vent := case when v_cardiac then 4 + floor(r[7] * 20)
      when v_reason in ('respiratory', 'sepsis', 'neuro', 'trauma') and r[7] < 0.85 then greatest(12, floor(v_los * 24 * (0.4 + 0.5 * r[8])))
      when r[7] < 0.3 then 6 + floor(r[8] * 30) else 0 end;
    v_outcome := case when v_dis is null then null
      when (v_cardiac and r[9] < 0.025) or (not v_cardiac and r[9] < v_apache / 115.0) then 'death'
      when r[10] < 0.05 then 'transfer_hospital' else 'transfer_ward' end;
    v_transfer := case when v_outcome is distinct from 'transfer_ward' then null
      when v_cardiac then case when r[11] < 0.7 then 'cardiac_surgery_ward' else 'cardiology' end
      when v_reason = 'postop' then case when r[11] < 0.75 then 'surgical' else 'orthopaedic' end
      when v_reason = 'respiratory' then case when r[11] < 0.6 then 'pulmonary' else 'internal' end
      when v_reason = 'neuro' then 'neurology' when v_reason = 'cardiac' then 'cardiology'
      when v_reason = 'trauma' then 'orthopaedic' else 'internal' end;
    v_female := r[21] >= 0.62;
    v_rows := v_rows || jsonb_build_object(
      'id', gen_random_uuid(), 'status', 'complete',
      'admission_date', v_adm, 'category', case when v_cardiac then 'cardiac' else 'general' end,
      'age', v_age, 'sex', case when v_female then 'female' else 'male' end, 'admission_reason', v_reason,
      'requisition', r[18] < 0.07, 'readmission_48h', r[19] < 0.03,
      'apache_score', v_apache, 'apache_postop', v_postop,
      'euroscore', case when v_cardiac then round((0.8 + r[20] * r[20] * 11)::numeric, 2) end,
      'ventilator_hours', v_vent,
      'central_line_days', case when v_vent > 0 or v_cardiac or v_reason = 'sepsis' then greatest(1, v_los - floor(r[22] * 2)::integer) else 0 end,
      'urinary_catheter_days', case when r[23] < 0.85 then greatest(1, v_los - floor(r[24] * 2)::integer) else 0 end,
      'pressure_ulcer', (v_los >= 7 and r[12] < 0.15) or r[12] < 0.01,
      'vap', v_vent > 96 and r[13] < 0.12,
      'air_mattress', v_los >= 3 and r[14] < 0.8,
      'daily_cleaning', r[15] < 0.96, 'line_care', r[16] < 0.93,
      'cultures', (not v_cardiac and r[17] < 0.7) or r[17] < 0.2,
      'discharge_date', v_dis, 'outcome', v_outcome, 'transfer_department', v_transfer,
      '_case', 'ΜΕΘ-' || to_char(v_adm, 'YY') || '-' || lpad((n + 1 - i)::text, 4, '0'),
      '_name', private.demo_register_name(i, 1100, v_female));
  end loop;
  return private.demo_register_insert(p_register_id, p_actor, v_rows);
end;
$function$;

-- Demo ΜΕΝΝ: ίδια με το 20261231490000, με τους νέους δείκτες του μητρώου.
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
  perform private.register_add_device_days(p_register_id);
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


-- Τα υπάρχοντα μητρώα ΜΕΘ και ΜΕΝΝ (ΙΑΣΩ και Demo).
do $$
declare v_id uuid;
begin
  for v_id in select id from public.department_registers where template_key in ('icu', 'nicu') and table_name is not null loop
    perform private.register_add_device_days(v_id);
  end loop;
end $$;
