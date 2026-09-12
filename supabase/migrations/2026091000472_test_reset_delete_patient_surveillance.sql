create or replace function public.delete_surveillance_case_for_testing(p_organization_id uuid, p_case_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_exists boolean;
begin
  if not (public.current_user_is_platform_owner() or public.current_user_has_org_role(p_organization_id, array['hospital_admin'::public.app_role,'infection_control_lead'::public.app_role])) then raise exception 'not authorized'; end if;
  select exists(select 1 from public.surveillance_cases where id=p_case_id and organization_id=p_organization_id) into v_exists;
  if not v_exists then return false; end if;
  delete from public.antimicrobial_therapies where organization_id=p_organization_id and surveillance_case_id=p_case_id;
  delete from public.laboratory_samples where organization_id=p_organization_id and surveillance_case_id=p_case_id;
  delete from public.surveillance_cases where id=p_case_id and organization_id=p_organization_id;
  return true;
end;$$;
grant execute on function public.delete_surveillance_case_for_testing(uuid,uuid) to authenticated;

create or replace function public.delete_patient_for_testing(p_organization_id uuid, p_patient_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_exists boolean;
begin
  if not (public.current_user_is_platform_owner() or public.current_user_has_org_role(p_organization_id, array['hospital_admin'::public.app_role])) then raise exception 'not authorized'; end if;
  select exists(select 1 from public.patients where id=p_patient_id and organization_id=p_organization_id) into v_exists;
  if not v_exists then return false; end if;
  delete from public.antimicrobial_therapies where organization_id=p_organization_id and patient_id=p_patient_id;
  delete from public.laboratory_samples where organization_id=p_organization_id and patient_id=p_patient_id;
  delete from public.clinical_assessments where organization_id=p_organization_id and patient_id=p_patient_id;
  delete from public.hai_classifications where organization_id=p_organization_id and patient_id=p_patient_id;
  delete from public.isolation_episodes where organization_id=p_organization_id and patient_id=p_patient_id;
  delete from public.surveillance_devices where organization_id=p_organization_id and patient_id=p_patient_id;
  delete from public.surveillance_outcomes where organization_id=p_organization_id and patient_id=p_patient_id;
  delete from public.surveillance_reassessments where organization_id=p_organization_id and patient_id=p_patient_id;
  delete from public.surveillance_cases where organization_id=p_organization_id and patient_id=p_patient_id;
  delete from public.patients where id=p_patient_id and organization_id=p_organization_id;
  return true;
end;$$;
grant execute on function public.delete_patient_for_testing(uuid,uuid) to authenticated;
