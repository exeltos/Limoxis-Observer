create or replace function public.surveillance_case_summaries(p_organization_id uuid)
returns json
language sql
stable
set search_path to ''
as $function$
  with results as (
    select distinct on (r.sample_id) r.sample_id, r.id, nullif(r.organism, '') as organism, nullif(r.resistance_class, '') as resistance_class
    from public.microbiology_results r
    where r.organization_id = p_organization_id
    order by r.sample_id, (r.validation_status = 'validated') is true desc, r.resulted_at desc nulls first, r.id
  ),
  amr as (
    select distinct on (a.microbiology_result_id) a.microbiology_result_id, nullif(a.classification, '') as classification
    from public.amr_classifications a
    where a.organization_id = p_organization_id
    order by a.microbiology_result_id, a.classified_at desc nulls last, a.id
  ),
  samples as (
    select l.surveillance_case_id,
      json_agg(json_build_object('id', l.id, 'sample_code', l.sample_code, 'requested_at', l.requested_at, 'organism', m.organism, 'resistance', coalesce(amr.classification, m.resistance_class))
        order by l.requested_at desc nulls last, l.id) as rows
    from public.laboratory_samples l
    join results m on m.sample_id = l.id
    left join amr on amr.microbiology_result_id = m.id
    where l.organization_id = p_organization_id
      and l.surveillance_case_id is not null
      and (m.organism is not null or coalesce(amr.classification, m.resistance_class) is not null)
    group by l.surveillance_case_id
  ),
  patient_counts as (
    select l.patient_id, count(*)::integer as sample_count
    from public.laboratory_samples l
    where l.organization_id = p_organization_id
      and l.patient_id is not null
    group by l.patient_id
  ),
  precautions as (
    select r.isolation_episode_id, json_agg(json_build_object('position', r.position, 'precaution', r.precaution)) as rows
    from public.isolation_episode_precautions r
    where r.organization_id = p_organization_id
    group by r.isolation_episode_id
  ),
  isolations as (
    select distinct on (i.surveillance_case_id) i.surveillance_case_id,
      json_build_object('id', i.id, 'room', i.room, 'reason', i.reason, 'started_at', i.started_at, 'review_due_at', i.review_due_at,
        'ended_at', i.ended_at, 'end_reason', i.end_reason, 'status', i.status, 'created_at', i.created_at, 'created_by', i.created_by,
        'ended_by', i.ended_by, 'precaution_rows', coalesce(p.rows, '[]'::json)) as row
    from public.isolation_episodes i
    left join precautions p on p.isolation_episode_id = i.id
    where i.organization_id = p_organization_id
    order by i.surveillance_case_id, (i.status = 'active' and i.ended_at is null) is true desc, i.started_at desc nulls first, i.id
  ),
  ordered as (
    select c.*, p.id as p_id, p.patient_code, p.first_name, p.last_name, p.date_of_birth, p.admission_date, p.status as p_status,
      d.id as d_id, d.name as d_name, iso.row as isolation, s.rows as sample_rows,
      coalesce(pc.sample_count, 0) as patient_sample_count
    from public.surveillance_cases c
    left join public.patients p on p.id = c.patient_id
    left join public.departments d on d.id = c.department_id
    left join isolations iso on iso.surveillance_case_id = c.id
    left join samples s on s.surveillance_case_id = c.id
    left join patient_counts pc on pc.patient_id = c.patient_id
    where c.organization_id = p_organization_id
  )
  select coalesce(json_agg(json_build_object(
      'id', c.id, 'organization_id', c.organization_id, 'patient_id', c.patient_id, 'department_id', c.department_id,
      'status', c.status, 'started_at', c.started_at, 'closed_at', c.closed_at, 'close_reason', c.close_reason,
      'review_due_on', c.review_due_on, 'room', c.room, 'reason', c.reason, 'reason_en', c.reason_en,
      'suspected_source', c.suspected_source, 'isolation_required', c.isolation_required,
      'isolation_decided_at', c.isolation_decided_at, 'isolation_decided_by', c.isolation_decided_by,
      'reopened_at', c.reopened_at, 'reopen_reason', c.reopen_reason,
      'patient_sample_count', c.patient_sample_count,
      'patient', case when c.p_id is null then null else json_build_object('id', c.p_id, 'patient_code', c.patient_code, 'first_name', c.first_name,
        'last_name', c.last_name, 'date_of_birth', c.date_of_birth, 'admission_date', c.admission_date, 'status', c.p_status) end,
      'department', case when c.d_id is null then null else json_build_object('id', c.d_id, 'name', c.d_name) end,
      'isolation', c.isolation,
      'samples', coalesce(c.sample_rows, '[]'::json)
    ) order by c.started_at desc, c.id), '[]'::json)
  from ordered c
$function$;
