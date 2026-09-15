-- Merges only the PERMISSIVE attachments policies per action (OR-fold, zero
-- risk per the empirically-verified combination semantics). The RESTRICTIVE
-- *_guard policies (committee_insert_guard, committee_read_guard,
-- committee_update_guard) are deliberately untouched: RESTRICTIVE policies
-- AND-combine and are not part of the multiple_permissive_policies finding -
-- they are the defense-in-depth gate preventing a committee_document row
-- from slipping through the generic attachments_write/read/soft_delete
-- policy without the committee authorization check.

drop policy if exists attachments_clinical_case_write on public.attachments;
drop policy if exists attachments_committee_insert_allow on public.attachments;
drop policy if exists attachments_laboratory_write on public.attachments;
drop policy if exists attachments_write on public.attachments;
create policy attachments_insert on public.attachments for insert to authenticated
  with check (
    (entity_type = 'clinical_case' and uploaded_by = (select auth.uid()) and entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' and exists (select 1 from surveillance_cases sc where sc.id = (attachments.entity_id)::uuid and sc.organization_id = attachments.organization_id) and (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role])))
    or (entity_type = 'committee_document' and uploaded_by = (select auth.uid()) and entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' and current_user_can_manage_committee(organization_id, (entity_id)::uuid, 'manage_committee_documents'))
    or (entity_type = 'laboratory_sample' and uploaded_by = (select auth.uid()) and entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' and exists (select 1 from laboratory_samples s where s.id = (attachments.entity_id)::uuid and s.organization_id = attachments.organization_id) and (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'laboratory'::app_role])))
    or (entity_type <> ALL (ARRAY['committee_document'::text, 'laboratory_sample'::text, 'clinical_case'::text]) and is_org_member(organization_id) and uploaded_by = (select auth.uid()))
  );

drop policy if exists attachments_clinical_case_read on public.attachments;
drop policy if exists attachments_committee_read_allow on public.attachments;
drop policy if exists attachments_laboratory_read on public.attachments;
drop policy if exists attachments_read on public.attachments;
create policy attachments_read on public.attachments for select to authenticated
  using (
    (entity_type = 'clinical_case' and entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' and exists (select 1 from surveillance_cases sc where sc.id = (attachments.entity_id)::uuid and sc.organization_id = attachments.organization_id))
    or (entity_type = 'committee_document' and entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' and current_user_can_view_committee(organization_id, (entity_id)::uuid))
    or (entity_type = 'laboratory_sample' and entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' and exists (select 1 from laboratory_samples s where s.id = (attachments.entity_id)::uuid and s.organization_id = attachments.organization_id))
    or (entity_type <> ALL (ARRAY['committee_document'::text, 'laboratory_sample'::text, 'clinical_case'::text]) and is_org_member(organization_id))
  );

drop policy if exists attachments_clinical_case_soft_delete on public.attachments;
drop policy if exists attachments_committee_update_allow on public.attachments;
drop policy if exists attachments_laboratory_soft_delete on public.attachments;
drop policy if exists attachments_soft_delete on public.attachments;
create policy attachments_update on public.attachments for update to authenticated
  using (
    (entity_type = 'clinical_case' and (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role])))
    or (entity_type = 'committee_document' and entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' and current_user_can_manage_committee(organization_id, (entity_id)::uuid, 'manage_committee_documents'))
    or (entity_type = 'laboratory_sample' and (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'laboratory'::app_role])))
    or (entity_type <> ALL (ARRAY['committee_document'::text, 'laboratory_sample'::text, 'clinical_case'::text]) and (uploaded_by = (select auth.uid()) or is_org_admin(organization_id)))
  )
  with check (
    (entity_type = 'clinical_case' and (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role])))
    or (entity_type = 'committee_document' and entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' and current_user_can_manage_committee(organization_id, (entity_id)::uuid, 'manage_committee_documents'))
    or (entity_type = 'laboratory_sample' and (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'laboratory'::app_role])))
    or (entity_type <> ALL (ARRAY['committee_document'::text, 'laboratory_sample'::text, 'clinical_case'::text]) and (uploaded_by = (select auth.uid()) or is_org_admin(organization_id)))
  );
