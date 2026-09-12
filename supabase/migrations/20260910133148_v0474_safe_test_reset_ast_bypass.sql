create or replace function public.guard_finalized_ast_mutation()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
declare
  target_result uuid;
  target_status text;
  reset_mode text;
begin
  reset_mode := current_setting('limoxis.test_reset', true);
  if reset_mode = 'on' then
    return coalesce(new,old);
  end if;

  target_result := coalesce(new.microbiology_result_id, old.microbiology_result_id);
  select validation_status into target_status from public.microbiology_results where id=target_result;
  if target_status is distinct from 'draft' then
    raise exception 'AST evidence for a finalized microbiology result is immutable; create an amended result version instead.' using errcode='55000';
  end if;
  return coalesce(new,old);
end;
$$;

create or replace function public.delete_surveillance_case_for_testing(p_organization_id uuid, p_case_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_exists boolean;
begin
  if not (public.current_user_is_platform_owner() or public.current_user_has_org_role(p_organization_id, array['hospital_admin'::public.app_role,'infection_control_lead'::public.app_role])) then
    raise exception 'not authorized';
  end if;

  select exists(select 1 from public.surveillance_cases where id=p_case_id and organization_id=p_organization_id) into v_exists;
  if not v_exists then return false; end if;

  perform set_config('limoxis.test_reset','on',true);

  delete from public.antimicrobial_therapies where organization_id=p_organization_id and surveillance_case_id=p_case_id;
  delete from public.laboratory_samples where organization_id=p_organization_id and surveillance_case_id=p_case_id;
  delete from public.surveillance_cases where id=p_case_id and organization_id=p_organization_id;
  return true;
end;
$$;

grant execute on function public.delete_surveillance_case_for_testing(uuid,uuid) to authenticated;

create or replace function public.delete_patient_for_testing(p_organization_id uuid, p_patient_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_exists boolean;
begin
  if not (public.current_user_is_platform_owner() or public.current_user_has_org_role(p_organization_id, array['hospital_admin'::public.app_role])) then
    raise exception 'not authorized';
  end if;

  select exists(select 1 from public.patients where id=p_patient_id and organization_id=p_organization_id) into v_exists;
  if not v_exists then return false; end if;

  perform set_config('limoxis.test_reset','on',true);

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
end;
$$;

grant execute on function public.delete_patient_for_testing(uuid,uuid) to authenticated;
