-- The cluster dates came from the whole history of the group (last_event = latest isolate ever), so a "14 day" cluster could show a months-long range.
-- Now count, first_event and last_event all come from the same densest window.

create or replace function private.detect_organism_clusters(p_organization_id uuid, p_window_days integer default 14, p_threshold integer default 3)
returns table(department_id uuid, department_name text, organism text, resistance_class text, case_count bigint, first_event date, last_event date)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (public.current_user_is_platform_owner() or public.current_user_has_org_role(p_organization_id, array['hospital_admin','infection_control_lead','infection_control_member','laboratory','doctor_reviewer']::public.app_role[])) then
    raise exception 'Cluster detection access denied';
  end if;
  if p_window_days is null or p_window_days < 1 then raise exception 'Invalid window'; end if;
  if p_threshold is null or p_threshold < 2 then raise exception 'Invalid threshold'; end if;

  return query
  with isolates as (
    select l.department_id, d.name as department_name, trim(m.organism) as organism,
      upper(coalesce(m.resistance_class, '')) as resistance_class, l.collected_at::date as event_date
    from public.microbiology_results m
    join public.laboratory_samples l on l.id = m.sample_id and l.organization_id = m.organization_id
    join public.departments d on d.id = l.department_id
    where m.organization_id = p_organization_id
      and m.result_status = 'positive'
      and m.validation_status in ('validated', 'amended')
      and m.organism is not null
      and l.collected_at >= now() - interval '2 years'
      and not exists (select 1 from public.microbiology_results m2 where m2.organization_id = m.organization_id and m2.amended_from = m.id)
  ),
  windows as (
    select a.department_id, a.department_name, a.organism, a.event_date as window_start,
      count(*) filter (where b.event_date between a.event_date and a.event_date + (p_window_days || ' days')::interval) as window_count,
      min(b.event_date) filter (where b.event_date between a.event_date and a.event_date + (p_window_days || ' days')::interval) as window_first,
      max(b.event_date) filter (where b.event_date between a.event_date and a.event_date + (p_window_days || ' days')::interval) as window_last
    from isolates a
    join isolates b on b.department_id = a.department_id and lower(b.organism) = lower(a.organism)
    group by a.department_id, a.department_name, a.organism, a.event_date
  ),
  best as (
    -- The single densest window per department+organism (earliest on a tie): count and dates come from the same window.
    select distinct on (w.department_id, w.organism) w.department_id, w.department_name, w.organism,
      w.window_count as case_count, w.window_first, w.window_last
    from windows w
    where w.window_count >= p_threshold
    order by w.department_id, w.organism, w.window_count desc, w.window_start asc
  )
  select b.department_id, b.department_name, b.organism,
    (select string_agg(distinct i.resistance_class, ',') from isolates i where i.department_id = b.department_id and lower(i.organism) = lower(b.organism) and i.resistance_class <> '' and i.event_date between b.window_first and b.window_last) as resistance_class,
    b.case_count,
    b.window_first as first_event,
    b.window_last as last_event
  from best b
  order by b.case_count desc, b.window_last desc;
end;$function$;

