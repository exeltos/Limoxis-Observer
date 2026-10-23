-- Selected Risk 2025 indicators only. System migration is audited explicitly;
-- the management trigger is disabled only while these governed definitions are
-- changed because migrations have no signed-in auth.uid().

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

  return jsonb_build_object(
    'clabsi_episodes',coalesce(v_clabsi,0),
    'cvc_device_days',coalesce(v_cvc_days,0),
    'vap_episodes',coalesce(v_vap,0),
    'ventilator_device_days',coalesce(v_ventilator_days,0),
    'patient_fall_incidents',coalesce(v_falls,0),
    'medication_incidents',coalesce(v_medication_incidents,0)
  );
end;
$function$;

create or replace function public.get_indicator_metric_snapshot(
  p_organization_id uuid,
  p_from date,
  p_to date,
  p_department_id uuid default null::uuid
)
returns jsonb
language sql
set search_path to ''
as $function$
  select private.indicator_metric_snapshot(p_organization_id,p_from,p_to,p_department_id)
      || private.risk_indicator_metric_snapshot(p_organization_id,p_from,p_to,p_department_id);
$function$;

alter table public.indicator_definitions disable trigger trg_audit_indicator_definitions;

update public.indicator_definitions
set calculation_type='auto',
    numerator_metric='clabsi_episodes',
    denominator_metric='cvc_device_days',
    multiplier=1000,
    direction='lower',
    numerator_definition=jsonb_build_object('description','Επεισόδια CLABSI που ταξινομήθηκαν στην περίοδο'),
    denominator_definition=jsonb_build_object('description','Ημέρες ασθενών με κεντρικό φλεβικό καθετήρα στην περίοδο')
where indicator_key='clabsi-per-1000-cvc-days';

update public.indicator_definitions
set calculation_type='auto',
    numerator_metric='vap_episodes',
    denominator_metric='ventilator_device_days',
    multiplier=1000,
    direction='lower',
    numerator_definition=jsonb_build_object('description','Επεισόδια VAP που ταξινομήθηκαν στην περίοδο'),
    denominator_definition=jsonb_build_object('description','Ημέρες ασθενών σε μηχανικό αερισμό στην περίοδο')
where indicator_key='vap-per-1000-ventilator-days';

insert into public.indicator_definitions(
  organization_id,indicator_key,version,title_el,title_en,category,
  numerator_definition,denominator_definition,multiplier,unit,unit_en,
  source_authority,status,calculation_type,numerator_metric,denominator_metric,target_value,direction
)
select null,'clabsi-per-1000-cvc-days','2026.1',
       'CLABSI ανά 1.000 ημέρες κεντρικού φλεβικού καθετήρα','CLABSI per 1,000 central-line days','surveillance',
       jsonb_build_object('description','Επεισόδια CLABSI που ταξινομήθηκαν στην περίοδο'),
       jsonb_build_object('description','Ημέρες ασθενών με κεντρικό φλεβικό καθετήρα στην περίοδο'),
       1000,'ανά 1.000 ημέρες CVC','per 1,000 CVC days','Risk Register 2025 / Limoxis Observer',
       'active','auto','clabsi_episodes','cvc_device_days',null,'lower'
where not exists(
  select 1 from public.indicator_definitions
  where organization_id is null and indicator_key='clabsi-per-1000-cvc-days' and version='2026.1'
);

insert into public.indicator_definitions(
  organization_id,indicator_key,version,title_el,title_en,category,
  numerator_definition,denominator_definition,multiplier,unit,unit_en,
  source_authority,status,calculation_type,numerator_metric,denominator_metric,target_value,direction
)
select null,'vap-per-1000-ventilator-days','2026.1',
       'VAP ανά 1.000 ημέρες μηχανικού αερισμού','VAP per 1,000 ventilator days','surveillance',
       jsonb_build_object('description','Επεισόδια VAP που ταξινομήθηκαν στην περίοδο'),
       jsonb_build_object('description','Ημέρες ασθενών σε μηχανικό αερισμό στην περίοδο'),
       1000,'ανά 1.000 ημέρες αερισμού','per 1,000 ventilator days','Risk Register 2025 / Limoxis Observer',
       'active','auto','vap_episodes','ventilator_device_days',null,'lower'
where not exists(
  select 1 from public.indicator_definitions
  where organization_id is null and indicator_key='vap-per-1000-ventilator-days' and version='2026.1'
);

insert into public.indicator_definitions(
  organization_id,indicator_key,version,title_el,title_en,category,
  numerator_definition,denominator_definition,multiplier,unit,unit_en,
  source_authority,status,calculation_type,numerator_metric,denominator_metric,target_value,direction
)
select null,'patient-falls-per-1000-patient-days','2026.1',
       'Πτώσεις ασθενών ανά 1.000 κλινοημέρες','Patient falls per 1,000 patient-days','quality',
       jsonb_build_object('description','Καταγεγραμμένα μη ακυρωμένα συμβάντα κατηγορίας πτώσης στην περίοδο'),
       jsonb_build_object('description','Κλινοημέρες στην ίδια περίοδο και στο ίδιο scope'),
       1000,'ανά 1.000 κλινοημέρες','per 1,000 patient-days','Risk Register 2025 / Limoxis Observer',
       'active','auto','patient_fall_incidents','patient_days',null,'lower'
where not exists(
  select 1 from public.indicator_definitions
  where organization_id is null and indicator_key='patient-falls-per-1000-patient-days' and version='2026.1'
);

insert into public.indicator_definitions(
  organization_id,indicator_key,version,title_el,title_en,category,
  numerator_definition,denominator_definition,multiplier,unit,unit_en,
  source_authority,status,calculation_type,numerator_metric,denominator_metric,target_value,direction
)
select null,'medication-incidents-per-1000-patient-days','2026.1',
       'Φαρμακευτικά συμβάντα ανά 1.000 κλινοημέρες','Medication incidents per 1,000 patient-days','quality',
       jsonb_build_object('description','Καταγεγραμμένα μη ακυρωμένα συμβάντα κατηγορίας φαρμάκου στην περίοδο'),
       jsonb_build_object('description','Κλινοημέρες στην ίδια περίοδο και στο ίδιο scope'),
       1000,'ανά 1.000 κλινοημέρες','per 1,000 patient-days','Risk Register 2025 / Limoxis Observer',
       'active','auto','medication_incidents','patient_days',null,'lower'
where not exists(
  select 1 from public.indicator_definitions
  where organization_id is null and indicator_key='medication-incidents-per-1000-patient-days' and version='2026.1'
);

alter table public.indicator_definitions enable trigger trg_audit_indicator_definitions;

insert into public.system_audit_log(
  organization_id,actor_user_id,actor_role,event_type,entity_type,entity_id,metadata
)
select d.organization_id,null,null,'system_migration','indicator_definitions',d.id::text,
       jsonb_build_object(
         'source','system_migration',
         'migration','risk_2025_selected_indicator_calculations',
         'indicator_key',d.indicator_key,
         'version',d.version,
         'calculation_type',d.calculation_type,
         'numerator_metric',d.numerator_metric,
         'denominator_metric',d.denominator_metric
       )
from public.indicator_definitions d
where d.indicator_key in(
  'clabsi-per-1000-cvc-days',
  'vap-per-1000-ventilator-days',
  'patient-falls-per-1000-patient-days',
  'medication-incidents-per-1000-patient-days'
);
