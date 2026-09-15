-- Consolidates the multiple_permissive_policies overlap between the
-- uniform `platform_owner_preview_write` (ALL, current_user_is_platform_owner())
-- policy and each table's own domain write policy, across the 11 tables
-- that had it. Pure performance change: every SELECT policy on these
-- tables already routes through can_view_surveillance_record(), which
-- itself includes `current_user_is_platform_owner() OR ...` internally,
-- so SELECT access for platform owner is unaffected. Where a table's
-- write-side domain policy didn't already include the platform-owner
-- check, folded it in with OR so dropping platform_owner_preview_write
-- causes zero capability loss. surveillance_reassessments had no
-- UPDATE/DELETE domain policy at all (so platform_owner_preview_write's
-- UPDATE/DELETE coverage was NOT an overlap, and dropping it outright
-- would have removed the only UPDATE/DELETE path platform owner had) -
-- given narrower UPDATE-only and DELETE-only replacements instead of a
-- plain drop (Postgres CREATE POLICY does not accept a FOR UPDATE, DELETE
-- command list).

-- hai_classifications: every domain write policy already includes the
-- platform-owner check - pure drop, no other change needed.
drop policy if exists platform_owner_preview_write on public.hai_classifications;

-- antimicrobial_therapies
alter policy antimicrobial_therapies_delete on public.antimicrobial_therapies
  using (current_user_is_platform_owner() OR current_user_has_org_role(organization_id, ARRAY['infection_control_lead'::app_role, 'doctor_reviewer'::app_role, 'pharmacy'::app_role]));
alter policy antimicrobial_therapies_insert on public.antimicrobial_therapies
  with check (current_user_is_platform_owner() OR current_user_has_org_role(organization_id, ARRAY['infection_control_lead'::app_role, 'doctor_reviewer'::app_role, 'pharmacy'::app_role, 'laboratory'::app_role]));
alter policy antimicrobial_therapies_update on public.antimicrobial_therapies
  using (current_user_is_platform_owner() OR current_user_has_org_role(organization_id, ARRAY['infection_control_lead'::app_role, 'doctor_reviewer'::app_role, 'pharmacy'::app_role]))
  with check (current_user_is_platform_owner() OR current_user_has_org_role(organization_id, ARRAY['infection_control_lead'::app_role, 'doctor_reviewer'::app_role, 'pharmacy'::app_role]));
drop policy if exists platform_owner_preview_write on public.antimicrobial_therapies;

-- clinical_assessments
alter policy clinical_assessments_delete on public.clinical_assessments
  using (current_user_is_platform_owner() OR current_user_has_org_role(organization_id, ARRAY['infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role]));
alter policy clinical_assessments_insert on public.clinical_assessments
  with check (current_user_is_platform_owner() OR current_user_has_org_role(organization_id, ARRAY['infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role]));
alter policy clinical_assessments_update on public.clinical_assessments
  using (current_user_is_platform_owner() OR current_user_has_org_role(organization_id, ARRAY['infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role]))
  with check (current_user_is_platform_owner() OR current_user_has_org_role(organization_id, ARRAY['infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role]));
drop policy if exists platform_owner_preview_write on public.clinical_assessments;

-- isolation_episodes
alter policy isolation_episodes_delete on public.isolation_episodes
  using (current_user_is_platform_owner() OR current_user_has_org_role(organization_id, ARRAY['infection_control_lead'::app_role, 'infection_control_member'::app_role]));
alter policy isolation_episodes_insert on public.isolation_episodes
  with check (current_user_is_platform_owner() OR current_user_has_org_role(organization_id, ARRAY['infection_control_lead'::app_role, 'infection_control_member'::app_role]));
alter policy isolation_episodes_update on public.isolation_episodes
  using (current_user_is_platform_owner() OR current_user_has_org_role(organization_id, ARRAY['infection_control_lead'::app_role, 'infection_control_member'::app_role]))
  with check (current_user_is_platform_owner() OR current_user_has_org_role(organization_id, ARRAY['infection_control_lead'::app_role, 'infection_control_member'::app_role]));
drop policy if exists platform_owner_preview_write on public.isolation_episodes;

-- patient_admissions
alter policy patient_admissions_write on public.patient_admissions
  using (current_user_is_platform_owner() OR current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role]))
  with check (current_user_is_platform_owner() OR current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role]));
drop policy if exists platform_owner_preview_write on public.patient_admissions;

-- patients
alter policy patients_clinical_write on public.patients
  using (current_user_is_platform_owner() OR current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role]))
  with check (current_user_is_platform_owner() OR current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role]));
drop policy if exists platform_owner_preview_write on public.patients;

-- surveillance_cases
alter policy surveillance_cases_write on public.surveillance_cases
  using (current_user_is_platform_owner() OR current_user_has_org_role(organization_id, ARRAY['infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role]))
  with check (current_user_is_platform_owner() OR current_user_has_org_role(organization_id, ARRAY['infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role]));
drop policy if exists platform_owner_preview_write on public.surveillance_cases;

-- surveillance_devices
alter policy surveillance_devices_delete on public.surveillance_devices
  using (current_user_is_platform_owner() OR current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role]));
alter policy surveillance_devices_insert on public.surveillance_devices
  with check (current_user_is_platform_owner() OR current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role]));
alter policy surveillance_devices_update on public.surveillance_devices
  using (current_user_is_platform_owner() OR current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role]))
  with check (current_user_is_platform_owner() OR current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role]));
drop policy if exists platform_owner_preview_write on public.surveillance_devices;

-- surveillance_events
alter policy surveillance_events_write on public.surveillance_events
  using (current_user_is_platform_owner() OR (EXISTS ( SELECT 1
   FROM surveillance_cases sc
  WHERE ((sc.id = surveillance_events.surveillance_case_id) AND current_user_has_org_role(sc.organization_id, ARRAY['infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role])))))
  with check (current_user_is_platform_owner() OR (EXISTS ( SELECT 1
   FROM surveillance_cases sc
  WHERE ((sc.id = surveillance_events.surveillance_case_id) AND current_user_has_org_role(sc.organization_id, ARRAY['infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role])))));
drop policy if exists platform_owner_preview_write on public.surveillance_events;

-- surveillance_outcomes
alter policy outcomes_write on public.surveillance_outcomes
  using (current_user_is_platform_owner() OR current_user_has_org_role(organization_id, ARRAY['infection_control_lead'::app_role, 'doctor_reviewer'::app_role]))
  with check (current_user_is_platform_owner() OR current_user_has_org_role(organization_id, ARRAY['infection_control_lead'::app_role, 'doctor_reviewer'::app_role]));
drop policy if exists platform_owner_preview_write on public.surveillance_outcomes;

-- surveillance_reassessments
alter policy reassessments_write on public.surveillance_reassessments
  with check (current_user_is_platform_owner() OR current_user_has_org_role(organization_id, ARRAY['infection_control_lead'::app_role, 'infection_control_member'::app_role]));
drop policy if exists platform_owner_preview_write on public.surveillance_reassessments;
create policy platform_owner_update_reassessments on public.surveillance_reassessments
  for update
  to authenticated
  using (current_user_is_platform_owner())
  with check (current_user_is_platform_owner());
create policy platform_owner_delete_reassessments on public.surveillance_reassessments
  for delete
  to authenticated
  using (current_user_is_platform_owner());
