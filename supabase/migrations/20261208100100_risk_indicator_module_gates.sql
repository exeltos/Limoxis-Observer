-- Keep the selected Risk 2025 indicator aggregates behind the same module gates
-- used by the rest of the SECURITY DEFINER analytics surface.
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
  v_surveillance_locked boolean := false;
  v_quality_locked boolean := false;
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

  v_surveillance_locked := private.org_modules_locked(p_organization_id,array['surveillance']);
  v_quality_locked := private.org_modules_locked(p_organization_id,array['quality']);

  if not v_surveillance_locked then
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
  end if;

  if not v_quality_locked then
    select
      count(*) filter(where q.category='fall'),
      count(*) filter(where q.category='medication')
      into v_falls,v_medication_incidents
    from public.quality_incidents q
    where q.organization_id=p_organization_id
      and q.voided_at is null
      and q.occurred_at::date between p_from and p_to
      and (p_department_id is null or q.department_id=p_department_id);
  end if;

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
