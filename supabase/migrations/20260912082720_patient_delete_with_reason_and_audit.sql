-- Replace delete_patient_with_history(uuid,uuid) with a version that requires a reason and
-- records the deletion (with a patient snapshot) in system_audit_log before the row is gone.
-- Also fixes two tables the original cascade missed (hai_classifications, surveillance_devices),
-- which are RESTRICT foreign keys to patients and would otherwise make every call fail.
drop function if exists public.delete_patient_with_history(uuid, uuid);

create or replace function public.delete_patient_with_history(target_org uuid, target_patient uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role public.app_role;
  v_patient public.patients%rowtype;
begin
  if not (public.current_user_is_platform_owner() or public.current_user_has_org_role(target_org, array['hospital_admin'::app_role])) then
    raise exception 'Not authorized to permanently delete a patient with clinical history.';
  end if;

  if coalesce(trim(p_reason),'') = '' then
    raise exception 'A reason is required to permanently delete a patient.';
  end if;

  select * into v_patient from public.patients where id=target_patient and organization_id=target_org;
  if not found then
    raise exception 'Patient not found in organization.';
  end if;

  select role into v_actor_role from public.organization_members
   where user_id=v_actor and organization_id=target_org limit 1;

  delete from public.critical_result_communications
   where microbiology_result_id in (
     select mr.id from public.microbiology_results mr
     join public.laboratory_samples s on s.id=mr.sample_id
     where s.patient_id=target_patient and s.organization_id=target_org
   );
  delete from public.antimicrobial_susceptibility_results
   where microbiology_result_id in (
     select mr.id from public.microbiology_results mr
     join public.laboratory_samples s on s.id=mr.sample_id
     where s.patient_id=target_patient and s.organization_id=target_org
   );
  delete from public.microbiology_results
   where sample_id in (select id from public.laboratory_samples where patient_id=target_patient and organization_id=target_org);
  delete from public.hai_classifications where patient_id=target_patient and organization_id=target_org;
  delete from public.surveillance_devices where patient_id=target_patient and organization_id=target_org;
  delete from public.antimicrobial_therapies where patient_id=target_patient and organization_id=target_org;
  delete from public.surveillance_reassessments where patient_id=target_patient and organization_id=target_org;
  delete from public.isolation_episodes where patient_id=target_patient and organization_id=target_org;
  delete from public.clinical_assessments where patient_id=target_patient and organization_id=target_org;
  delete from public.surveillance_outcomes where patient_id=target_patient and organization_id=target_org;
  delete from public.laboratory_samples where patient_id=target_patient and organization_id=target_org;
  delete from public.surveillance_cases where patient_id=target_patient and organization_id=target_org;
  delete from public.patients where id=target_patient and organization_id=target_org;

  insert into public.system_audit_log(actor_user_id,actor_role,event_type,entity_type,entity_id,metadata)
  values (
    v_actor, v_actor_role, 'patient.deleted_with_history', 'patient', target_patient::text,
    jsonb_build_object(
      'organization_id',target_org,
      'patient_code',v_patient.patient_code,
      'first_name',v_patient.first_name,
      'last_name',v_patient.last_name,
      'reason',p_reason
    )
  );
end;
$$;
revoke all on function public.delete_patient_with_history(uuid,uuid,text) from public;
grant execute on function public.delete_patient_with_history(uuid,uuid,text) to authenticated;
