-- The Surveillance and Laboratory lists in one read each. The Surveillance
-- list hydrated every episode of the organization (events, assessments with
-- their findings, samples, results, therapies …: about 35 requests and 35 MB
-- for the largest hospital) to show one line per patient; the Laboratory list
-- read samples, results, AMR, AST and communications page by page in four
-- rounds (about 15 requests). Both are now one call that returns the rows
-- already joined. SECURITY INVOKER: every table is read under the caller's own
-- RLS, exactly as the separate reads were.

-- One row per episode with what the list shows: the patient, the department,
-- the isolation in place (else the latest), and the samples that have an
-- organism or a resistance, newest request first (the result of a sample is its
-- first validated result, else its latest; its resistance is the latest AMR
-- classification, else the result's class), as the full read worked them out.
create or replace function public.surveillance_case_summaries(p_organization_id uuid)
returns json
language sql
stable
security invoker
set search_path = ''
as $$
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
      d.id as d_id, d.name as d_name, iso.row as isolation, s.rows as sample_rows
    from public.surveillance_cases c
    left join public.patients p on p.id = c.patient_id
    left join public.departments d on d.id = c.department_id
    left join isolations iso on iso.surveillance_case_id = c.id
    left join samples s on s.surveillance_case_id = c.id
    where c.organization_id = p_organization_id
  )
  select coalesce(json_agg(json_build_object(
      'id', c.id, 'organization_id', c.organization_id, 'patient_id', c.patient_id, 'department_id', c.department_id,
      'status', c.status, 'started_at', c.started_at, 'closed_at', c.closed_at, 'close_reason', c.close_reason,
      'review_due_on', c.review_due_on, 'room', c.room, 'reason', c.reason, 'reason_en', c.reason_en,
      'suspected_source', c.suspected_source, 'isolation_required', c.isolation_required,
      'isolation_decided_at', c.isolation_decided_at, 'isolation_decided_by', c.isolation_decided_by,
      'reopened_at', c.reopened_at, 'reopen_reason', c.reopen_reason,
      'patient', case when c.p_id is null then null else json_build_object('id', c.p_id, 'patient_code', c.patient_code, 'first_name', c.first_name,
        'last_name', c.last_name, 'date_of_birth', c.date_of_birth, 'admission_date', c.admission_date, 'status', c.p_status) end,
      'department', case when c.d_id is null then null else json_build_object('id', c.d_id, 'name', c.d_name) end,
      'isolation', c.isolation,
      'samples', coalesce(c.sample_rows, '[]'::json)
    ) order by c.started_at desc, c.id), '[]'::json)
  from ordered c
$$;

grant execute on function public.surveillance_case_summaries(uuid) to authenticated;

-- Every sample of the organization (or only the environmental ones) with its
-- patient, department and results; each result carries its AMR classifications
-- (with their categories), AST rows and critical-result communications, in the
-- order the separate reads used. The columns are those the list maps.
create or replace function public.laboratory_sample_list(p_organization_id uuid, p_environmental boolean default false)
returns json
language sql
stable
security invoker
set search_path = ''
as $$
  with samples as (
    select l.* from public.laboratory_samples l
    where l.organization_id = p_organization_id
      and (not coalesce(p_environmental, false) or l.subject_type = 'environment'
        or lower(coalesce(l.sample_type, '')) like any (array['%surface%', '%room%', '%air%', '%water%', '%environment%', '%νερό%', '%επιφάνεια%', '%επιφανεια%']))
  ),
  categories as (
    select k.amr_classification_id, json_agg(json_build_object('susceptible', k.susceptible, 'position', k.position, 'category', k.category)) as rows
    from public.amr_classification_categories k
    where k.organization_id = p_organization_id
    group by k.amr_classification_id
  ),
  amr as (
    select a.microbiology_result_id, json_agg((to_jsonb(a) || jsonb_build_object('categories', coalesce(k.rows::jsonb, '[]'::jsonb)))::json order by a.created_at desc, a.id) as rows
    from public.amr_classifications a
    left join categories k on k.amr_classification_id = a.id
    where a.organization_id = p_organization_id
    group by a.microbiology_result_id
  ),
  ast as (
    select x.microbiology_result_id, json_agg(row_to_json(x) order by x.id) as rows
    from public.antimicrobial_susceptibility_results x
    where x.organization_id = p_organization_id
    group by x.microbiology_result_id
  ),
  communications as (
    select c.microbiology_result_id, json_agg(row_to_json(c) order by c.communicated_at desc, c.id) as rows
    from public.critical_result_communications c
    where c.organization_id = p_organization_id
    group by c.microbiology_result_id
  ),
  results as (
    select r.sample_id, json_agg(json_build_object(
        'id', r.id, 'sample_id', r.sample_id, 'result_status', r.result_status, 'validation_status', r.validation_status,
        'amended_from', r.amended_from, 'organism', r.organism, 'resistance_class', r.resistance_class,
        'susceptibility_summary', r.susceptibility_summary, 'is_critical', r.is_critical, 'cfu_count', r.cfu_count,
        'cfu_limit', r.cfu_limit, 'within_limit', r.within_limit, 'resulted_at', r.resulted_at, 'validated_at', r.validated_at,
        'validated_by', r.validated_by, 'method', r.method, 'preliminary', r.preliminary,
        'interpretation_standard', r.interpretation_standard, 'interpretation_version', r.interpretation_version,
        'amr', coalesce(a.rows, '[]'::json), 'ast', coalesce(x.rows, '[]'::json), 'communications', coalesce(c.rows, '[]'::json)
      ) order by r.resulted_at desc, r.id) as rows
    from public.microbiology_results r
    join samples s on s.id = r.sample_id
    left join amr a on a.microbiology_result_id = r.id
    left join ast x on x.microbiology_result_id = r.id
    left join communications c on c.microbiology_result_id = r.id
    group by r.sample_id
  ),
  ordered as (
    select l.*, p.id as p_id, p.patient_code, p.first_name, p.last_name, d.id as d_id, d.name as d_name, m.rows as result_rows
    from samples l
    left join public.patients p on p.id = l.patient_id
    left join public.departments d on d.id = l.department_id
    left join results m on m.sample_id = l.id
  )
  select coalesce(json_agg(json_build_object(
      'id', l.id, 'organization_id', l.organization_id, 'patient_id', l.patient_id, 'department_id', l.department_id,
      'surveillance_case_id', l.surveillance_case_id, 'sample_code', l.sample_code, 'sample_type', l.sample_type,
      'source_site', l.source_site, 'collected_at', l.collected_at, 'requested_at', l.requested_at, 'received_at', l.received_at,
      'rejected_at', l.rejected_at, 'status', l.status, 'priority', l.priority, 'specimen_condition', l.specimen_condition,
      'rejection_reason', l.rejection_reason, 'subject_type', l.subject_type, 'subject_name', l.subject_name, 'subject_code', l.subject_code,
      'employee_surveillance_id', l.employee_surveillance_id, 'employee_surveillance_batch_id', l.employee_surveillance_batch_id,
      'environmental_method', l.environmental_method, 'location', l.location, 'point', l.point, 'environmental_batch_id', l.environmental_batch_id,
      'documents_reviewed_at', l.documents_reviewed_at, 'documents_reviewed_by', l.documents_reviewed_by,
      'finalized_at', l.finalized_at, 'finalized_by', l.finalized_by, 'correction_reason', l.correction_reason,
      'patient', case when l.p_id is null then null else json_build_object('id', l.p_id, 'patient_code', l.patient_code, 'first_name', l.first_name, 'last_name', l.last_name) end,
      'department', case when l.d_id is null then null else json_build_object('id', l.d_id, 'name', l.d_name) end,
      'results', coalesce(l.result_rows, '[]'::json)
    ) order by l.created_at desc, l.id), '[]'::json)
  from ordered l
$$;

grant execute on function public.laboratory_sample_list(uuid, boolean) to authenticated;

-- How many responses each survey has, all and since a day: one read for the
-- Surveys list instead of two counts per survey.
create or replace function public.quality_survey_response_counts(p_organization_id uuid, p_since timestamptz)
returns table(survey_id uuid, total bigint, recent bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select r.survey_id, count(*), count(*) filter (where r.submitted_at >= p_since)
  from public.quality_survey_responses r
  where r.organization_id = p_organization_id
  group by r.survey_id
$$;

grant execute on function public.quality_survey_response_counts(uuid, timestamptz) to authenticated;
