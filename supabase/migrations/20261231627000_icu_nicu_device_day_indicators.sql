-- ΜΕΘ / ΜΕΝΝ: CLABSI, CAUTI, VAP ανά 1.000 ημέρες συσκευής από τα μητρώα (εγκρίθηκε από τον ιδιοκτήτη 22/11/2026, επιλογή Α).
-- * private.register_unit_device_metrics: όταν ένα τμήμα έχει μητρώο ΜΕΘ ή ΜΕΝΝ και καμία συσκευή στην Επιτήρηση
--   (surveillance_devices) μέσα στην περίοδο, οι ημέρες νοσηλείας και οι ημέρες συσκευής βγαίνουν από τις γραμμές του
--   μητρώου: κάθε νοσηλεία μετρά τις ημέρες της μέσα στην περίοδο (εισαγωγή και έξοδος κομμένες στα όρια της περιόδου,
--   ανοιχτή νοσηλεία έως σήμερα σε ώρα Αθήνας, ημέρα εξόδου εκτός, όπως η «Διάρκεια νοσηλείας») και οι ημέρες συσκευής
--   της νοσηλείας μοιράζονται αναλογικά. Νοσηλεία χωρίς ημερομηνία εξόδου αλλά με έκβαση δεν μετρά (λείπει η έξοδος).
--   ΜΕΘ: ΚΦΚ, ουροκαθετήρας, αναπνευστήρας = ώρες / 24. ΜΕΝΝ: κεντρικός καθετήρας = PICC + ομφαλικός, αναπνευστήρας,
--   και οι ημέρες κεντρικού καθετήρα ανά ομάδα βάρους γέννησης του NHSN. Πεδίο που κανείς δεν συμπλήρωσε στην
--   περίοδο δίνει «δεν μετρήθηκε» (null), όχι 0.
-- * private.risk_indicator_metric_snapshot:
--   - στο τμήμα με μητρώο: οι ημέρες συσκευής του μητρώου, οι ημέρες νοσηλείας του μητρώου στο «device_patient_days»
--     (παρονομαστής των δεικτών χρήσης) και στο «patient_days» μόνο όταν δεν υπάρχουν καταγεγραμμένες κλινοημέρες
--     του τμήματος για την περίοδο· οι αριθμητές (CLABSI, CAUTI, VAP) μετρούν μόνο περιστατικά σημειωμένα ως
--     νοσοκομειακά.
--   - στο σύνολο του νοσοκομείου οι αριθμητές CLABSI, CAUTI, VAP εξαιρούν τα τμήματα που έχουν δικούς τους δείκτες
--     από το μητρώο (απόφαση ιδιοκτήτη 22/11/2026).
--   - CAUTI: και ο νέος τύπος λοίμωξης «catheter_urinary_tract» (ο έλεγχος του τύπου στη βάση αλλάζει με το
--     docs/sql/surveillance_infection_type_cauti.sql, που τρέχει ο ιδιοκτήτης).
-- * Νέοι κοινοί δείκτες: χρήση ΚΦΚ, ουροκαθετήρα, αναπνευστήρα (ημέρες συσκευής / ημέρες νοσηλείας, %) και CLABSI ΜΕΝΝ
--   ανά 1.000 ημέρες κεντρικού καθετήρα στις πέντε ομάδες βάρους γέννησης του NHSN.

create or replace function private.register_unit_device_metrics(p_organization_id uuid, p_from date, p_to date, p_department_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  v_table text;
  v_kind text;
  v_cols text[];
  v_today date := (now() at time zone 'Europe/Athens')::date;
  v_cvc text; v_uc text; v_vent text; v_bw text;
  v_result jsonb;
begin
  -- Μόνο μέσα από τον υπολογισμό των δεικτών (SECURITY DEFINER): ποτέ απευθείας από χρήστη της εφαρμογής.
  if current_user in ('authenticated', 'anon') then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_department_id is null then return null; end if;
  select r.table_name, r.template_key into v_table, v_kind
  from public.department_registers r
  where r.organization_id = p_organization_id and r.department_id = p_department_id and r.template_key in ('icu', 'nicu')
    and r.table_name is not null and r.status = 'active'
  order by r.created_at limit 1;
  if v_table is null then return null; end if;
  -- Με συσκευές στην Επιτήρηση μετρούν εκείνες (ακριβέστερο)· το μητρώο μόνο όταν δεν υπάρχουν.
  if exists (select 1 from public.surveillance_devices d where d.organization_id = p_organization_id and d.department_id = p_department_id
      and d.inserted_at is not null and d.inserted_at::date <= p_to and (d.removed_at is null or d.removed_at::date >= p_from)) then
    return null;
  end if;
  select array_agg(c.column_name::text) into v_cols from information_schema.columns c where c.table_schema = 'public' and c.table_name = v_table;
  if not (v_cols @> array['admission_date', 'discharge_date', 'outcome']) then return null; end if;
  if v_kind = 'icu' then
    v_cvc := case when 'central_line_days' = any(v_cols) then 'central_line_days::numeric' else 'null::numeric' end;
    v_uc := case when 'urinary_catheter_days' = any(v_cols) then 'urinary_catheter_days::numeric' else 'null::numeric' end;
    v_vent := case when 'ventilator_hours' = any(v_cols) then 'ventilator_hours::numeric / 24' else 'null::numeric' end;
    v_bw := 'null::numeric';
  else
    v_cvc := case when v_cols @> array['central_line_days', 'umbilical_days']
      then 'case when central_line_days is null and umbilical_days is null then null else coalesce(central_line_days, 0) + coalesce(umbilical_days, 0) end::numeric'
      else 'null::numeric' end;
    v_uc := 'null::numeric';
    v_vent := case when 'ventilator_days' = any(v_cols) then 'ventilator_days::numeric' else 'null::numeric' end;
    v_bw := case when 'birth_weight' = any(v_cols) then 'birth_weight::numeric' else 'null::numeric' end;
  end if;
  execute format($q$
    with s as (
      select admission_date as a, coalesce(discharge_date, $3) as e, %1$s as cvc, %2$s as uc, %3$s as vent, %4$s as bw
      from public.%5$I
      where admission_date is not null and admission_date <= $2 and coalesce(discharge_date, $3) >= $1
        and (discharge_date is not null or outcome is null) and coalesce(discharge_date, $3) >= admission_date
    ),
    w as (
      select s.*, greatest(0, least(s.e, $2 + 1) - greatest(s.a, $1)) as days,
        case when s.e > s.a then greatest(0, least(s.e, $2 + 1) - greatest(s.a, $1))::numeric / (s.e - s.a)
          when s.a between $1 and $2 then 1 else 0 end as share,
        case when s.bw is null or s.bw <= 0 then null when s.bw <= 750 then 'le750' when s.bw <= 1000 then 'bw751_1000'
          when s.bw <= 1500 then 'bw1001_1500' when s.bw <= 2500 then 'bw1501_2500' else 'gt2500' end as band
      from s
    )
    select jsonb_build_object(
      'unit_patient_days', coalesce(sum(days), 0),
      'cvc_device_days', round(sum(cvc * share) filter (where cvc is not null)),
      'urinary_catheter_days', round(sum(uc * share) filter (where uc is not null)),
      'ventilator_device_days', round(sum(vent * share) filter (where vent is not null))
    ) || case when %6$L = 'nicu' then jsonb_build_object(
      'central_line_days_le750', coalesce(round(sum(cvc * share) filter (where band = 'le750')), 0),
      'central_line_days_bw751_1000', coalesce(round(sum(cvc * share) filter (where band = 'bw751_1000')), 0),
      'central_line_days_bw1001_1500', coalesce(round(sum(cvc * share) filter (where band = 'bw1001_1500')), 0),
      'central_line_days_bw1501_2500', coalesce(round(sum(cvc * share) filter (where band = 'bw1501_2500')), 0),
      'central_line_days_gt2500', coalesce(round(sum(cvc * share) filter (where band = 'gt2500')), 0)) else '{}'::jsonb end
    from w
  $q$, v_cvc, v_uc, v_vent, v_bw, v_table, v_kind) into v_result using p_from, p_to, v_today;
  return v_result || jsonb_build_object('unit_kind', v_kind);
end;
$function$;

create or replace function private.risk_indicator_metric_snapshot(p_organization_id uuid, p_from date, p_to date, p_department_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_clabsi bigint := 0;
  v_cvc_days bigint := 0;
  v_vap bigint := 0;
  v_ventilator_days bigint := 0;
  v_falls bigint := 0;
  v_medication_incidents bigint := 0;
  v_cauti bigint := 0;
  v_urinary_days bigint := 0;
  v_ssi bigint := 0;
  -- Τμήμα με δικούς του δείκτες από το μητρώο ΜΕΘ/ΜΕΝΝ (register_unit_device_metrics) και, στο σύνολο, τα τμήματα αυτά.
  v_unit jsonb;
  v_register_units uuid[] := '{}';
  v_extra jsonb := '{}'::jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_from is null or p_to is null or p_to < p_from then raise exception 'Invalid indicator period'; end if;
  if not (public.current_user_is_platform_owner() or public.current_user_has_capability(p_organization_id,'view_indicators')) then
    raise exception 'Indicator access denied';
  end if;
  if p_department_id is not null
     and not public.current_user_is_platform_owner()
     and not public.current_user_has_department_scope(p_organization_id,p_department_id) then
    raise exception 'Department scope denied';
  end if;

  if p_department_id is not null then
    v_unit := private.register_unit_device_metrics(p_organization_id,p_from,p_to,p_department_id);
  else
    select coalesce(array_agg(u.department_id),'{}') into v_register_units
    from (select distinct r.department_id from public.department_registers r
      where r.organization_id=p_organization_id and r.department_id is not null
        and r.template_key in ('icu','nicu') and r.table_name is not null and r.status='active') u
    where private.register_unit_device_metrics(p_organization_id,p_from,p_to,u.department_id) is not null;
  end if;

  select count(distinct s.id)
    into v_clabsi
  from public.surveillance_case_infection_types it
  join public.surveillance_cases s
    on s.id=it.surveillance_case_id and s.organization_id=it.organization_id
  where it.organization_id=p_organization_id
    and s.voided_at is null
    and it.infection_type='central_line_bloodstream'
    and coalesce(it.created_at,s.started_at)::date between p_from and p_to
    and (p_department_id is null or s.department_id=p_department_id)
    and (v_unit is null or s.hospital_acquired is true)
    and (s.department_id is null or not (s.department_id = any(v_register_units)));

  select count(distinct (d.patient_id,gs.day::date))
    into v_cvc_days
  from public.surveillance_devices d
  cross join lateral generate_series(
    greatest(d.inserted_at::date,p_from),
    least(coalesce(d.removed_at::date,p_to),p_to),
    interval '1 day'
  ) as gs(day)
  where d.organization_id=p_organization_id
    and d.patient_id is not null
    and d.inserted_at is not null
    and d.inserted_at::date<=p_to
    and (d.removed_at is null or d.removed_at::date>=p_from)
    and (p_department_id is null or d.department_id=p_department_id)
    and (
      lower(coalesce(d.device_type,'')) like '%cvc%'
      or lower(coalesce(d.device_type,'')) like '%picc%'
      or lower(coalesce(d.device_type,'')) like '%κεντρικ%καθετ%'
    );

  select count(distinct s.id)
    into v_vap
  from public.surveillance_case_infection_types it
  join public.surveillance_cases s
    on s.id=it.surveillance_case_id and s.organization_id=it.organization_id
  where it.organization_id=p_organization_id
    and s.voided_at is null
    and it.infection_type='ventilator_pneumonia'
    and coalesce(it.created_at,s.started_at)::date between p_from and p_to
    and (p_department_id is null or s.department_id=p_department_id)
    and (v_unit is null or s.hospital_acquired is true)
    and (s.department_id is null or not (s.department_id = any(v_register_units)));

  select count(distinct (d.patient_id,gs.day::date))
    into v_ventilator_days
  from public.surveillance_devices d
  cross join lateral generate_series(
    greatest(d.inserted_at::date,p_from),
    least(coalesce(d.removed_at::date,p_to),p_to),
    interval '1 day'
  ) as gs(day)
  where d.organization_id=p_organization_id
    and d.patient_id is not null
    and d.inserted_at is not null
    and d.inserted_at::date<=p_to
    and (d.removed_at is null or d.removed_at::date>=p_from)
    and (p_department_id is null or d.department_id=p_department_id)
    and (
      lower(coalesce(d.device_type,'')) like '%ventilator%'
      or lower(coalesce(d.device_type,'')) like '%αναπνευσ%'
      or lower(coalesce(d.device_type,'')) like '%μηχανικ%αερισ%'
    );

  select
    count(*) filter(where q.category in ('fall','odipy-fall')),
    count(*) filter(where q.category in ('medication','odipy-medication'))
    into v_falls,v_medication_incidents
  from public.quality_incidents q
  where q.organization_id=p_organization_id
    and q.voided_at is null
    and q.occurred_at::date between p_from and p_to
    and (p_department_id is null or q.department_id=p_department_id);

  -- CAUTI: urinary tract infections of patients with a urinary catheter in place (up to 2 days before), and the
  -- infections classified as catheter-associated (catheter_urinary_tract).
  select count(distinct s.id)
    into v_cauti
  from public.surveillance_case_infection_types it
  join public.surveillance_cases s
    on s.id=it.surveillance_case_id and s.organization_id=it.organization_id
  where it.organization_id=p_organization_id
    and s.voided_at is null
    and it.infection_type in ('urinary_tract','catheter_urinary_tract')
    and coalesce(it.created_at,s.started_at)::date between p_from and p_to
    and (p_department_id is null or s.department_id=p_department_id)
    and (v_unit is null or s.hospital_acquired is true)
    and (s.department_id is null or not (s.department_id = any(v_register_units)))
    and (it.infection_type='catheter_urinary_tract' or exists (
      select 1 from public.surveillance_devices d
      where d.organization_id=s.organization_id
        and d.patient_id=s.patient_id
        and (lower(coalesce(d.device_type,'')) like '%ουροκαθετ%' or lower(coalesce(d.device_type,'')) like '%foley%' or lower(coalesce(d.device_type,'')) like '%urinary%')
        and d.inserted_at is not null
        and d.inserted_at::date<=coalesce(it.created_at,s.started_at)::date
        and (d.removed_at is null or d.removed_at::date>=coalesce(it.created_at,s.started_at)::date-2)
    ));

  select count(distinct (d.patient_id,gs.day::date))
    into v_urinary_days
  from public.surveillance_devices d
  cross join lateral generate_series(
    greatest(d.inserted_at::date,p_from),
    least(coalesce(d.removed_at::date,p_to),p_to),
    interval '1 day'
  ) as gs(day)
  where d.organization_id=p_organization_id
    and d.patient_id is not null
    and d.inserted_at is not null
    and d.inserted_at::date<=p_to
    and (d.removed_at is null or d.removed_at::date>=p_from)
    and (p_department_id is null or d.department_id=p_department_id)
    and (lower(coalesce(d.device_type,'')) like '%ουροκαθετ%' or lower(coalesce(d.device_type,'')) like '%foley%' or lower(coalesce(d.device_type,'')) like '%urinary%');

  -- Surgical site infections recorded in surveillance (from the wound cultures).
  select count(distinct s.id)
    into v_ssi
  from public.surveillance_case_infection_types it
  join public.surveillance_cases s
    on s.id=it.surveillance_case_id and s.organization_id=it.organization_id
  where it.organization_id=p_organization_id
    and s.voided_at is null
    and it.infection_type='surgical_site'
    and coalesce(it.created_at,s.started_at)::date between p_from and p_to
    and (p_department_id is null or s.department_id=p_department_id);

  -- Τμήμα με μητρώο ΜΕΘ/ΜΕΝΝ: ημέρες συσκευής και νοσηλείας από το μητρώο, CLABSI ΜΕΝΝ ανά ομάδα βάρους γέννησης.
  if v_unit is not null then
    v_extra := jsonb_build_object(
      'cvc_device_days',v_unit->'cvc_device_days',
      'urinary_catheter_days',v_unit->'urinary_catheter_days',
      'ventilator_device_days',v_unit->'ventilator_device_days',
      'device_patient_days',v_unit->'unit_patient_days');
    if not exists (select 1 from public.patient_days pd where pd.organization_id=p_organization_id and pd.department_id=p_department_id and pd.census_date between p_from and p_to)
       and not exists (select 1 from public.patient_day_periods pp where pp.organization_id=p_organization_id and pp.department_id=p_department_id and pp.period_start<=p_to and pp.period_end>=p_from) then
      v_extra := v_extra || jsonb_build_object('patient_days',v_unit->'unit_patient_days');
    end if;
    if v_unit->>'unit_kind'='nicu' then
      v_extra := v_extra || (v_unit - array['unit_patient_days','cvc_device_days','urinary_catheter_days','ventilator_device_days','unit_kind'])
        || (select jsonb_build_object(
          'clabsi_events_le750',count(distinct s.id) filter(where p.birth_weight_grams>0 and p.birth_weight_grams<=750),
          'clabsi_events_bw751_1000',count(distinct s.id) filter(where p.birth_weight_grams>750 and p.birth_weight_grams<=1000),
          'clabsi_events_bw1001_1500',count(distinct s.id) filter(where p.birth_weight_grams>1000 and p.birth_weight_grams<=1500),
          'clabsi_events_bw1501_2500',count(distinct s.id) filter(where p.birth_weight_grams>1500 and p.birth_weight_grams<=2500),
          'clabsi_events_gt2500',count(distinct s.id) filter(where p.birth_weight_grams>2500))
          from public.surveillance_case_infection_types it
          join public.surveillance_cases s on s.id=it.surveillance_case_id and s.organization_id=it.organization_id
          left join public.patients p on p.id=s.patient_id and p.organization_id=s.organization_id
          where it.organization_id=p_organization_id and s.voided_at is null and it.infection_type='central_line_bloodstream'
            and coalesce(it.created_at,s.started_at)::date between p_from and p_to
            and s.department_id=p_department_id and s.hospital_acquired is true);
    end if;
  end if;

  return jsonb_build_object(
    'clabsi_episodes',coalesce(v_clabsi,0),
    'cvc_device_days',coalesce(v_cvc_days,0),
    'vap_episodes',coalesce(v_vap,0),
    'ventilator_device_days',coalesce(v_ventilator_days,0),
    'patient_fall_incidents',coalesce(v_falls,0),
    'medication_incidents',coalesce(v_medication_incidents,0),
    'cauti_events',coalesce(v_cauti,0),
    'urinary_catheter_days',coalesce(v_urinary_days,0),
    'ssi_episodes',coalesce(v_ssi,0)
  ) || v_extra;
end;
$function$;

-- Οι νέοι κοινοί δείκτες. Γράφεται στο ιστορικό ως ο γενικός λογαριασμός «Platform Owner». Προσθέτει μόνο γραμμές.
do $$
begin
  perform set_config('request.jwt.claims', '{"sub":"84066ee0-57b7-4cae-9186-09e491d3ea6d","role":"authenticated"}', true);
  insert into public.indicator_definitions
    (organization_id, indicator_key, version, title_el, title_en, category, numerator_definition, denominator_definition, multiplier, unit, unit_en, source_authority, status, calculation_type, numerator_metric, denominator_metric, target_value, direction, approved_at)
  select null, v.indicator_key, '2026.1', v.title_el, v.title_en, 'surveillance', jsonb_build_object('description', v.num), jsonb_build_object('description', v.den), v.multiplier, v.unit, v.unit_en,
         'CDC/NHSN (Device-associated module) · Μητρώα ΜΕΘ/ΜΕΝΝ', 'active', 'auto', v.num_metric, v.den_metric, null, v.direction, now()
  from (values
    ('central-line-utilisation', 'Χρήση κεντρικού φλεβικού καθετήρα', 'Central line utilisation',
     'Ημέρες κεντρικού φλεβικού καθετήρα στην περίοδο', 'Ημέρες νοσηλείας του τμήματος στην περίοδο (μητρώο)', 100::numeric, '%', '%', 'cvc_device_days', 'device_patient_days', 'context'),
    ('urinary-catheter-utilisation', 'Χρήση ουροκαθετήρα', 'Urinary catheter utilisation',
     'Ημέρες ουροκαθετήρα στην περίοδο', 'Ημέρες νοσηλείας του τμήματος στην περίοδο (μητρώο)', 100, '%', '%', 'urinary_catheter_days', 'device_patient_days', 'context'),
    ('ventilator-utilisation', 'Χρήση αναπνευστήρα', 'Ventilator utilisation',
     'Ημέρες μηχανικού αερισμού στην περίοδο', 'Ημέρες νοσηλείας του τμήματος στην περίοδο (μητρώο)', 100, '%', '%', 'ventilator_device_days', 'device_patient_days', 'context'),
    ('clabsi-rate-le750', 'CLABSI ΜΕΝΝ ανά 1.000 ημέρες καθετήρα (βάρος γέννησης ≤750g)', 'NICU CLABSI per 1,000 line-days (birth weight ≤750g)',
     'Νοσοκομειακά επεισόδια CLABSI νεογνών ≤750g', 'Ημέρες κεντρικού καθετήρα (PICC και ομφαλικός) νεογνών ≤750g', 1000, 'ανά 1.000 ημέρες καθετήρα', 'per 1,000 line days', 'clabsi_events_le750', 'central_line_days_le750', 'lower'),
    ('clabsi-rate-bw751-1000', 'CLABSI ΜΕΝΝ ανά 1.000 ημέρες καθετήρα (βάρος γέννησης 751-1000g)', 'NICU CLABSI per 1,000 line-days (birth weight 751-1000g)',
     'Νοσοκομειακά επεισόδια CLABSI νεογνών 751-1000g', 'Ημέρες κεντρικού καθετήρα (PICC και ομφαλικός) νεογνών 751-1000g', 1000, 'ανά 1.000 ημέρες καθετήρα', 'per 1,000 line days', 'clabsi_events_bw751_1000', 'central_line_days_bw751_1000', 'lower'),
    ('clabsi-rate-bw1001-1500', 'CLABSI ΜΕΝΝ ανά 1.000 ημέρες καθετήρα (βάρος γέννησης 1001-1500g)', 'NICU CLABSI per 1,000 line-days (birth weight 1001-1500g)',
     'Νοσοκομειακά επεισόδια CLABSI νεογνών 1001-1500g', 'Ημέρες κεντρικού καθετήρα (PICC και ομφαλικός) νεογνών 1001-1500g', 1000, 'ανά 1.000 ημέρες καθετήρα', 'per 1,000 line days', 'clabsi_events_bw1001_1500', 'central_line_days_bw1001_1500', 'lower'),
    ('clabsi-rate-bw1501-2500', 'CLABSI ΜΕΝΝ ανά 1.000 ημέρες καθετήρα (βάρος γέννησης 1501-2500g)', 'NICU CLABSI per 1,000 line-days (birth weight 1501-2500g)',
     'Νοσοκομειακά επεισόδια CLABSI νεογνών 1501-2500g', 'Ημέρες κεντρικού καθετήρα (PICC και ομφαλικός) νεογνών 1501-2500g', 1000, 'ανά 1.000 ημέρες καθετήρα', 'per 1,000 line days', 'clabsi_events_bw1501_2500', 'central_line_days_bw1501_2500', 'lower'),
    ('clabsi-rate-gt2500', 'CLABSI ΜΕΝΝ ανά 1.000 ημέρες καθετήρα (βάρος γέννησης >2500g)', 'NICU CLABSI per 1,000 line-days (birth weight >2500g)',
     'Νοσοκομειακά επεισόδια CLABSI νεογνών >2500g', 'Ημέρες κεντρικού καθετήρα (PICC και ομφαλικός) νεογνών >2500g', 1000, 'ανά 1.000 ημέρες καθετήρα', 'per 1,000 line days', 'clabsi_events_gt2500', 'central_line_days_gt2500', 'lower')
  ) as v(indicator_key, title_el, title_en, num, den, multiplier, unit, unit_en, num_metric, den_metric, direction)
  where not exists (select 1 from public.indicator_definitions d where d.organization_id is null and d.indicator_key = v.indicator_key);
end $$;
