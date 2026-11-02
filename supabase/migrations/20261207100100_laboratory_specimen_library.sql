-- Patient laboratory samples retain their stable technical sample_type for
-- indicators, while specimen_type_id points to the exact central Sample types
-- library item shown to users.
alter table public.laboratory_samples
  add column if not exists specimen_type_id uuid null
  references public.master_library_items(id) on delete set null;

create index if not exists laboratory_samples_org_specimen_type_idx
  on public.laboratory_samples(organization_id, specimen_type_id);

-- The fast laboratory list returns the exact specimen library item alongside
-- the technical sample type. SECURITY INVOKER keeps every read under caller RLS.
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
    select l.*,
      p.id as p_id, p.patient_code, p.first_name, p.last_name,
      d.id as d_id, d.name as d_name,
      st.id as st_id, st.code as st_code, st.name_el as st_name_el, st.name_en as st_name_en,
      m.rows as result_rows
    from samples l
    left join public.patients p on p.id = l.patient_id
    left join public.departments d on d.id = l.department_id
    left join public.master_library_items st on st.id = l.specimen_type_id
      and st.organization_id = l.organization_id
      and st.library_key = 'sampleTypes'
      and st.is_active = true
    left join results m on m.sample_id = l.id
  )
  select coalesce(json_agg(json_build_object(
      'id', l.id, 'organization_id', l.organization_id, 'patient_id', l.patient_id, 'department_id', l.department_id,
      'surveillance_case_id', l.surveillance_case_id, 'sample_code', l.sample_code, 'sample_type', l.sample_type,
      'specimen_type_id', l.specimen_type_id,
      'specimen_type', case when l.st_id is null then null else json_build_object('id', l.st_id, 'code', l.st_code, 'name_el', l.st_name_el, 'name_en', l.st_name_en) end,
      'source_site', l.source_site, 'clinical_context', l.clinical_context,
      'collected_at', l.collected_at, 'requested_at', l.requested_at, 'received_at', l.received_at,
      'rejected_at', l.rejected_at, 'status', l.status, 'priority', l.priority, 'specimen_condition', l.specimen_condition,
      'rejection_reason', l.rejection_reason, 'subject_type', l.subject_type, 'subject_name', l.subject_name, 'subject_code', l.subject_code,
      'employee_surveillance_id', l.employee_surveillance_id, 'employee_surveillance_batch_id', l.employee_surveillance_batch_id,
      'environmental_method', l.environmental_method, 'location', l.location, 'point', l.point, 'environmental_batch_id', l.environmental_batch_id,
      'documents_reviewed_at', l.documents_reviewed_at, 'documents_reviewed_by', l.documents_reviewed_by,
      'finalized_at', l.finalized_at, 'finalized_by', l.finalized_by, 'correction_reason', l.correction_reason,
      'surveillance_review_status', l.surveillance_review_status, 'surveillance_review_reason', l.surveillance_review_reason,
      'surveillance_review_note', l.surveillance_review_note, 'surveillance_reviewed_by', l.surveillance_reviewed_by,
      'surveillance_reviewed_at', l.surveillance_reviewed_at,
      'patient', case when l.p_id is null then null else json_build_object('id', l.p_id, 'patient_code', l.patient_code, 'first_name', l.first_name, 'last_name', l.last_name) end,
      'department', case when l.d_id is null then null else json_build_object('id', l.d_id, 'name', l.d_name) end,
      'results', coalesce(l.result_rows, '[]'::json)
    ) order by l.created_at desc, l.id), '[]'::json)
  from ordered l
$$;

grant execute on function public.laboratory_sample_list(uuid, boolean) to authenticated;
