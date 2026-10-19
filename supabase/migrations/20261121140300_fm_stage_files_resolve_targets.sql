-- FileMaker migration: where each staged file is attached, derived from
-- fm_stage_links instead of ad-hoc SQL.
--
-- The task 'files_attach' of filemaker-import copies only the rows of
-- fm_stage_files whose attach_entity_type / attach_entity_id / organization_id
-- are set; until now they were filled by hand. public.fm_stage_files_resolve_targets()
-- fills them for the container fields whose records already live in Limoxis,
-- with the same mapping the files attached so far used:
--   Deviations              quality_findings (else quality_incidents); photo when an image
--   Documentation, Forms,
--   RequiredDocuments       controlled_document (controlled_documents)
--   Training                training_program (training_programs)
--   Training Material       training_program of its material (training_program_materials.program_id)
--   People_CertificatesCMEs employee-certificate of the employee (employee_certificates.employee_id), certification
-- category generalDocument otherwise. A row whose target record no longer exists
-- stays unresolved. Only rows not resolved and not attached are touched, so
-- nothing attached is moved or attached again; running it again changes nothing.
-- files_attach calls it first. Other fields (announcements, contacts, controls,
-- People Attachments without links, ...) stay unresolved until a mapping is added.
-- Service role only, like the staging tables.

create or replace function public.fm_stage_files_resolve_targets()
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  v_count integer;
begin
  update public.fm_stage_files s
  set attach_entity_type = r.entity_type, attach_entity_id = r.entity_id, organization_id = r.organization_id, attach_category = r.category
  from (
    select distinct on (f.base_table, f.field, f.record_id)
           f.base_table, f.field, f.record_id, t.entity_type, t.entity_id, t.organization_id,
           case when t.category is not null then t.category when f.base_table = 'Deviations' and f.mime_type like 'image/%' then 'photo' else 'generalDocument' end as category
    from public.fm_stage_files f
    join public.fm_stage_links l on l.base_table = f.base_table and l.record_id = f.record_id
    cross join lateral (
      select 'quality_findings'::text, q.id::text, q.organization_id, null::text, 1 from public.quality_findings q where l.base_table = 'Deviations' and l.target_table = 'quality_findings' and q.id = l.target_id
      union all
      select 'quality_incidents', q.id::text, q.organization_id, null, 2 from public.quality_incidents q where l.base_table = 'Deviations' and l.target_table = 'quality_incidents' and q.id = l.target_id
      union all
      select 'controlled_document', d.id::text, d.organization_id, null, 1 from public.controlled_documents d where l.base_table in ('Documentation', 'Forms', 'RequiredDocuments') and l.target_table = 'controlled_documents' and d.id = l.target_id
      union all
      select 'training_program', p.id::text, p.organization_id, null, 1 from public.training_programs p where l.base_table = 'Training' and l.target_table = 'training_programs' and p.id = l.target_id
      union all
      select 'training_program', m.program_id::text, m.organization_id, null, 1 from public.training_program_materials m where l.base_table = 'Training Material' and l.target_table = 'training_program_materials' and m.id = l.target_id and m.program_id is not null
      union all
      select 'employee-certificate', c.employee_id::text, c.organization_id, 'certification', 1 from public.employee_certificates c where l.base_table = 'People_CertificatesCMEs' and l.target_table = 'employee_certificates' and c.id = l.target_id and c.employee_id is not null
    ) as t(entity_type, entity_id, organization_id, category, rank)
    where f.duplicate_of is null and f.attach_entity_type is null and f.attachment_id is null
    order by f.base_table, f.field, f.record_id, t.rank
  ) r
  where s.base_table = r.base_table and s.field = r.field and s.record_id = r.record_id
    and s.attach_entity_type is null and s.attachment_id is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.fm_stage_files_resolve_targets() is 'FileMaker migration: fills fm_stage_files.attach_* from fm_stage_links for rows not resolved or attached yet; returns how many rows it resolved. Called by filemaker-import files_attach.';
revoke all on function public.fm_stage_files_resolve_targets() from public, anon, authenticated;
grant execute on function public.fm_stage_files_resolve_targets() to service_role;
