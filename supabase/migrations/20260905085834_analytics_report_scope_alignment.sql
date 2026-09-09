-- Align Analytics access with the roles allowed by the frontend.
-- Platform Owner may request platform-wide or organization-scoped summaries.
-- Hospital Admin and Infection Control Lead are restricted to their own organization.
create or replace function public.platform_report_summary(p_organization_id uuid default null,p_from date default null,p_to date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare r jsonb;
begin
  if public.current_user_is_platform_owner() then
    null;
  elsif p_organization_id is null or not public.current_user_has_org_role(
    p_organization_id,
    array['hospital_admin','infection_control_lead']::public.app_role[]
  ) then
    raise exception 'analytics access denied';
  end if;

  select jsonb_build_object(
    'surveillance',(select count(*) from public.surveillance_cases s where (p_organization_id is null or s.organization_id=p_organization_id) and (p_from is null or s.created_at::date>=p_from) and (p_to is null or s.created_at::date<=p_to)),
    'laboratory',(select count(*) from public.laboratory_samples l where (p_organization_id is null or l.organization_id=p_organization_id) and (p_from is null or l.created_at::date>=p_from) and (p_to is null or l.created_at::date<=p_to)),
    'prevention',((select count(*) from public.hand_hygiene_sessions p where (p_organization_id is null or p.organization_id=p_organization_id) and (p_from is null or p.created_at::date>=p_from) and (p_to is null or p.created_at::date<=p_to)) + (select count(*) from public.waste_measurements p where (p_organization_id is null or p.organization_id=p_organization_id) and (p_from is null or p.created_at::date>=p_from) and (p_to is null or p.created_at::date<=p_to)) + (select count(*) from public.prevention_bundle_assessments p where (p_organization_id is null or p.organization_id=p_organization_id) and (p_from is null or p.created_at::date>=p_from) and (p_to is null or p.created_at::date<=p_to))),
    'controls',(select count(*) from public.control_executions c where (p_organization_id is null or c.organization_id=p_organization_id) and (p_from is null or c.created_at::date>=p_from) and (p_to is null or c.created_at::date<=p_to)),
    'quality',((select count(*) from public.quality_incidents q where (p_organization_id is null or q.organization_id=p_organization_id) and (p_from is null or q.created_at::date>=p_from) and (p_to is null or q.created_at::date<=p_to)) + (select count(*) from public.quality_findings q where (p_organization_id is null or q.organization_id=p_organization_id) and (p_from is null or q.created_at::date>=p_from) and (p_to is null or q.created_at::date<=p_to)) + (select count(*) from public.quality_capa_actions q where (p_organization_id is null or q.organization_id=p_organization_id) and (p_from is null or q.created_at::date>=p_from) and (p_to is null or q.created_at::date<=p_to))),
    'training',(select count(*) from public.training_records t where (p_organization_id is null or t.organization_id=p_organization_id) and (p_from is null or t.created_at::date>=p_from) and (p_to is null or t.created_at::date<=p_to)),
    'documents',(select count(*) from public.controlled_documents d where (p_organization_id is null or d.organization_id=p_organization_id) and (p_from is null or d.created_at::date>=p_from) and (p_to is null or d.created_at::date<=p_to)),
    'committees',(select count(*) from public.committees c where (p_organization_id is null or c.organization_id=p_organization_id) and (p_from is null or c.created_at::date>=p_from) and (p_to is null or c.created_at::date<=p_to)),
    'handHygiene',(select count(*) from public.hand_hygiene_sessions p where (p_organization_id is null or p.organization_id=p_organization_id) and (p_from is null or p.created_at::date>=p_from) and (p_to is null or p.created_at::date<=p_to)),
    'waste',(select count(*) from public.waste_measurements p where (p_organization_id is null or p.organization_id=p_organization_id) and (p_from is null or p.created_at::date>=p_from) and (p_to is null or p.created_at::date<=p_to)),
    'antimicrobial',(select count(*) from public.antimicrobial_therapies a where (p_organization_id is null or a.organization_id=p_organization_id) and (p_from is null or a.created_at::date>=p_from) and (p_to is null or a.created_at::date<=p_to)),
    'occupationalHealth',(select count(*) from public.occupational_health_visits o where (p_organization_id is null or o.organization_id=p_organization_id) and (p_from is null or o.created_at::date>=p_from) and (p_to is null or o.created_at::date<=p_to))
  ) into r;
  return r;
end $$;

grant execute on function public.platform_report_summary(uuid,date,date) to authenticated;
