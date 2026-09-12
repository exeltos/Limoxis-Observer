-- delete_patient_for_testing / delete_surveillance_case_for_testing are named
-- "for_testing" but had no actual restriction to test/demo organizations: any
-- hospital_admin (or, for the case function, infection_control_lead) of their
-- own real organization could permanently wipe a patient's entire clinical
-- history with no confirmation, reason, or undo. There are currently two
-- organizations in this database and neither is a demo organization, so this
-- closes the hole immediately without removing the functions (they stay
-- usable once/if a demo organization exists).

create or replace function public.delete_patient_for_testing(p_organization_id uuid, p_patient_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_exists boolean; v_is_demo boolean;
begin
  if not (public.current_user_is_platform_owner() or public.current_user_has_org_role(p_organization_id, array['hospital_admin'::public.app_role])) then
    raise exception 'not authorized';
  end if;

  select is_demo into v_is_demo from public.organizations where id=p_organization_id;
  if not coalesce(v_is_demo,false) then
    raise exception 'TEST_RESET_DEMO_ORG_ONLY';
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
$function$;

create or replace function public.delete_surveillance_case_for_testing(p_organization_id uuid, p_case_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_exists boolean; v_is_demo boolean;
begin
  if not (public.current_user_is_platform_owner() or public.current_user_has_org_role(p_organization_id, array['hospital_admin'::public.app_role,'infection_control_lead'::public.app_role])) then
    raise exception 'not authorized';
  end if;

  select is_demo into v_is_demo from public.organizations where id=p_organization_id;
  if not coalesce(v_is_demo,false) then
    raise exception 'TEST_RESET_DEMO_ORG_ONLY';
  end if;

  select exists(select 1 from public.surveillance_cases where id=p_case_id and organization_id=p_organization_id) into v_exists;
  if not v_exists then return false; end if;

  perform set_config('limoxis.test_reset','on',true);

  delete from public.antimicrobial_therapies where organization_id=p_organization_id and surveillance_case_id=p_case_id;
  delete from public.laboratory_samples where organization_id=p_organization_id and surveillance_case_id=p_case_id;
  delete from public.surveillance_cases where id=p_case_id and organization_id=p_organization_id;
  return true;
end;
$function$;

-- Pure trigger helpers (only ever invoked internally by trigger firing, which
-- does not require the firing role to hold EXECUTE) should not additionally be
-- directly callable via /rest/v1/rpc/... by any signed-in user. Deliberately
-- NOT touching functions used inside RLS USING/WITH CHECK expressions
-- (current_user_has_org_role, is_org_admin, is_org_member,
-- can_view_surveillance_record, current_user_has_capability, etc.) - revoking
-- EXECUTE from authenticated on those would break RLS authorization for every
-- signed-in user, which is exactly what happened and was reverted live before
-- (see 20260901231707 followed by the 202609022032xx "restore" migrations).
revoke execute on function public.capture_clinical_audit() from authenticated;
revoke execute on function public.handle_new_user() from authenticated;

-- reopen_surveillance_episode is legacy/dead: it references
-- clinical_audit_log columns (entity_type/entity_id/metadata) that don't
-- exist in this database's actual clinical_audit_log shape, so any call to it
-- fails at runtime. Nothing in the application calls it. Remove the ability
-- for a signed-in user to invoke it at all rather than leaving a broken but
-- reachable endpoint.
revoke execute on function public.reopen_surveillance_episode(text, text) from authenticated;
