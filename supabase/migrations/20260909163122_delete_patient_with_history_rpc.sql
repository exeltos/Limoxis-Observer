create or replace function public.delete_patient_with_history(target_org uuid, target_patient uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.current_user_is_platform_owner() or public.current_user_has_org_role(target_org, array['hospital_admin'::app_role])) then
    raise exception 'Not authorized to permanently delete a patient with clinical history.';
  end if;

  if not exists(select 1 from public.patients where id=target_patient and organization_id=target_org) then
    raise exception 'Patient not found in organization.';
  end if;

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
  delete from public.antimicrobial_therapies where patient_id=target_patient and organization_id=target_org;
  delete from public.surveillance_reassessments where patient_id=target_patient and organization_id=target_org;
  delete from public.isolation_episodes where patient_id=target_patient and organization_id=target_org;
  delete from public.clinical_assessments where patient_id=target_patient and organization_id=target_org;
  delete from public.surveillance_outcomes where patient_id=target_patient and organization_id=target_org;
  delete from public.laboratory_samples where patient_id=target_patient and organization_id=target_org;
  delete from public.surveillance_cases where patient_id=target_patient and organization_id=target_org;
  delete from public.patients where id=target_patient and organization_id=target_org;
end;
$$;
revoke all on function public.delete_patient_with_history(uuid,uuid) from public;
grant execute on function public.delete_patient_with_history(uuid,uuid) to authenticated;
