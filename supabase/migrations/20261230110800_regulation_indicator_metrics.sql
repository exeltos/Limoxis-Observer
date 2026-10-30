-- Οι μετρικές των δεικτών του κανονισμού λοιμώξεων που έλειπαν από τη βάση: CAUTI (ουρολοιμώξεις ασθενών με
-- ουροκαθετήρα και ημέρες ουροκαθετήρα) και λοιμώξεις χειρουργικού πεδίου από την επιτήρηση (καλλιέργειες τραύματος).
-- Ο δείκτης χειρουργικού πεδίου γίνεται αυτόματος: επεισόδια ανά 1.000 ημέρες νοσηλείας.
-- Οι ορισμοί αλλάζουν ως ο γενικός λογαριασμός «Platform Owner» (έλεγχος ιστορικού).

create or replace function private.risk_indicator_metric_snapshot(
  p_organization_id uuid,
  p_from date,
  p_to date,
  p_department_id uuid default null::uuid
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
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

  select count(distinct s.id)
    into v_clabsi
  from public.surveillance_case_infection_types it
  join public.surveillance_cases s
    on s.id=it.surveillance_case_id and s.organization_id=it.organization_id
  where it.organization_id=p_organization_id
    and s.voided_at is null
    and it.infection_type='central_line_bloodstream'
    and coalesce(it.created_at,s.started_at)::date between p_from and p_to
    and (p_department_id is null or s.department_id=p_department_id);

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
    and (p_department_id is null or s.department_id=p_department_id);

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
    count(*) filter(where q.category='fall'),
    count(*) filter(where q.category='medication')
    into v_falls,v_medication_incidents
  from public.quality_incidents q
  where q.organization_id=p_organization_id
    and q.voided_at is null
    and q.occurred_at::date between p_from and p_to
    and (p_department_id is null or q.department_id=p_department_id);

  -- CAUTI: urinary tract infections of patients with a urinary catheter in place (up to 2 days before).
  select count(distinct s.id)
    into v_cauti
  from public.surveillance_case_infection_types it
  join public.surveillance_cases s
    on s.id=it.surveillance_case_id and s.organization_id=it.organization_id
  where it.organization_id=p_organization_id
    and s.voided_at is null
    and it.infection_type='urinary_tract'
    and coalesce(it.created_at,s.started_at)::date between p_from and p_to
    and (p_department_id is null or s.department_id=p_department_id)
    and exists (
      select 1 from public.surveillance_devices d
      where d.organization_id=s.organization_id
        and d.patient_id=s.patient_id
        and (lower(coalesce(d.device_type,'')) like '%ουροκαθετ%' or lower(coalesce(d.device_type,'')) like '%foley%' or lower(coalesce(d.device_type,'')) like '%urinary%')
        and d.inserted_at is not null
        and d.inserted_at::date<=coalesce(it.created_at,s.started_at)::date
        and (d.removed_at is null or d.removed_at::date>=coalesce(it.created_at,s.started_at)::date-2)
    );

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
  );
end;
$function$;

do $$
begin
  perform set_config('request.jwt.claims', '{"sub":"84066ee0-57b7-4cae-9186-09e491d3ea6d","role":"authenticated"}', true);
  update public.indicator_definitions
  set calculation_type = 'auto', numerator_metric = 'ssi_episodes', denominator_metric = 'patient_days', multiplier = 1000,
      unit = 'ανά 1.000 ημέρες νοσηλείας', unit_en = 'per 1,000 patient-days', target_value = 1,
      numerator_definition = jsonb_build_object('description', 'Επεισόδια λοίμωξης χειρουργικού πεδίου στην επιτήρηση (από τις καλλιέργειες)'),
      denominator_definition = jsonb_build_object('description', 'Σύνολο ημερών νοσηλείας')
  where organization_id is null and indicator_key = 'ssi-rate';
end $$;
