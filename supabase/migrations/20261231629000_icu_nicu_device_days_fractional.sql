-- ΜΕΘ/ΜΕΝΝ: οι ημέρες συσκευής κρατούν τα δεκαδικά (εύρημα Codex, PR #689).
-- Το 20261231627000 στρογγύλευε σε ακέραιο το άθροισμα ωρών/24 (π.χ. 6 ώρες αναπνευστήρα → 0 ημέρες), οπότε η χρήση
-- συσκευής έβγαινε 0% και ο δείκτης ανά 1.000 ημέρες είχε μηδενικό παρονομαστή. Τώρα κρατούνται 2 δεκαδικά· στρογγυλεύεται
-- μόνο ο τελικός δείκτης, όπως και στο computeIndicatorValue του μητρώου. Ίδια υπογραφή, μόνο create or replace.

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
      'cvc_device_days', round(sum(cvc * share) filter (where cvc is not null), 2),
      'urinary_catheter_days', round(sum(uc * share) filter (where uc is not null), 2),
      'ventilator_device_days', round(sum(vent * share) filter (where vent is not null), 2)
    ) || case when %6$L = 'nicu' then jsonb_build_object(
      'central_line_days_le750', coalesce(round(sum(cvc * share) filter (where band = 'le750'), 2), 0),
      'central_line_days_bw751_1000', coalesce(round(sum(cvc * share) filter (where band = 'bw751_1000'), 2), 0),
      'central_line_days_bw1001_1500', coalesce(round(sum(cvc * share) filter (where band = 'bw1001_1500'), 2), 0),
      'central_line_days_bw1501_2500', coalesce(round(sum(cvc * share) filter (where band = 'bw1501_2500'), 2), 0),
      'central_line_days_gt2500', coalesce(round(sum(cvc * share) filter (where band = 'gt2500'), 2), 0)) else '{}'::jsonb end
    from w
  $q$, v_cvc, v_uc, v_vent, v_bw, v_table, v_kind) into v_result using p_from, p_to, v_today;
  return v_result || jsonb_build_object('unit_kind', v_kind);
end;
$function$;
