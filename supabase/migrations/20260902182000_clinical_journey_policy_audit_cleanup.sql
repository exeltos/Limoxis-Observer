-- Tighten Data API grants, separate read/write policies and complete audit coverage.

revoke all on table public.clinical_assessments, public.laboratory_samples, public.microbiology_results, public.antimicrobial_therapies, public.isolation_episodes, public.surveillance_devices, public.hai_classifications, public.amr_classifications, public.antimicrobial_susceptibility_results, public.critical_result_communications from anon;

revoke all on table public.clinical_assessments from authenticated; grant select,insert,update,delete on table public.clinical_assessments to authenticated;
revoke all on table public.laboratory_samples from authenticated; grant select,insert,update,delete on table public.laboratory_samples to authenticated;
revoke all on table public.microbiology_results from authenticated; grant select,insert,update,delete on table public.microbiology_results to authenticated;
revoke all on table public.antimicrobial_therapies from authenticated; grant select,insert,update,delete on table public.antimicrobial_therapies to authenticated;
revoke all on table public.isolation_episodes from authenticated; grant select,insert,update,delete on table public.isolation_episodes to authenticated;
revoke all on table public.surveillance_devices from authenticated; grant select,insert,update,delete on table public.surveillance_devices to authenticated;
revoke all on table public.hai_classifications from authenticated; grant select,insert,update,delete on table public.hai_classifications to authenticated;
revoke all on table public.amr_classifications from authenticated; grant select,insert,update,delete on table public.amr_classifications to authenticated;
revoke all on table public.antimicrobial_susceptibility_results from authenticated; grant select,insert,update,delete on table public.antimicrobial_susceptibility_results to authenticated;
revoke all on table public.critical_result_communications from authenticated; grant select,insert on table public.critical_result_communications to authenticated;

-- Clinical assessments.
drop policy if exists clinical_assessments_write on public.clinical_assessments;
create policy clinical_assessments_insert on public.clinical_assessments for insert to authenticated with check (public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]));
create policy clinical_assessments_update on public.clinical_assessments for update to authenticated using (public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[])) with check (public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]));
create policy clinical_assessments_delete on public.clinical_assessments for delete to authenticated using (public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]));

-- Laboratory request and lifecycle.
drop policy if exists laboratory_samples_lab_manage on public.laboratory_samples;
drop policy if exists laboratory_samples_clinical_request on public.laboratory_samples;
create policy laboratory_samples_insert on public.laboratory_samples for insert to authenticated with check (public.current_user_has_org_role(organization_id,array['laboratory']::public.app_role[]) or (status='requested' and requested_by=(select auth.uid()) and created_by=(select auth.uid()) and public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[])));
create policy laboratory_samples_update on public.laboratory_samples for update to authenticated using (public.current_user_has_org_role(organization_id,array['laboratory']::public.app_role[])) with check (public.current_user_has_org_role(organization_id,array['laboratory']::public.app_role[]));
create policy laboratory_samples_delete on public.laboratory_samples for delete to authenticated using (public.current_user_has_org_role(organization_id,array['laboratory']::public.app_role[]));

drop policy if exists microbiology_results_write on public.microbiology_results;
create policy microbiology_results_insert on public.microbiology_results for insert to authenticated with check (public.current_user_has_org_role(organization_id,array['laboratory']::public.app_role[]));
create policy microbiology_results_update on public.microbiology_results for update to authenticated using (public.current_user_has_org_role(organization_id,array['laboratory']::public.app_role[])) with check (public.current_user_has_org_role(organization_id,array['laboratory']::public.app_role[]));
create policy microbiology_results_delete on public.microbiology_results for delete to authenticated using (public.current_user_has_org_role(organization_id,array['laboratory']::public.app_role[]));

-- Therapy and isolation.
drop policy if exists antimicrobial_therapies_write on public.antimicrobial_therapies;
create policy antimicrobial_therapies_insert on public.antimicrobial_therapies for insert to authenticated with check (public.current_user_has_org_role(organization_id,array['infection_control_lead','doctor_reviewer','pharmacy']::public.app_role[]));
create policy antimicrobial_therapies_update on public.antimicrobial_therapies for update to authenticated using (public.current_user_has_org_role(organization_id,array['infection_control_lead','doctor_reviewer','pharmacy']::public.app_role[])) with check (public.current_user_has_org_role(organization_id,array['infection_control_lead','doctor_reviewer','pharmacy']::public.app_role[]));
create policy antimicrobial_therapies_delete on public.antimicrobial_therapies for delete to authenticated using (public.current_user_has_org_role(organization_id,array['infection_control_lead','doctor_reviewer','pharmacy']::public.app_role[]));

drop policy if exists isolation_episodes_write on public.isolation_episodes;
create policy isolation_episodes_insert on public.isolation_episodes for insert to authenticated with check (public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member']::public.app_role[]));
create policy isolation_episodes_update on public.isolation_episodes for update to authenticated using (public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member']::public.app_role[])) with check (public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member']::public.app_role[]));
create policy isolation_episodes_delete on public.isolation_episodes for delete to authenticated using (public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member']::public.app_role[]));

-- HAI classification.
drop policy if exists hai_classification_read on public.hai_classifications;
drop policy if exists hai_classification_write on public.hai_classifications;
create policy hai_classification_read on public.hai_classifications for select to authenticated using (exists (select 1 from public.surveillance_cases sc where sc.id=surveillance_case_id and public.can_view_surveillance_record(sc.organization_id,sc.department_id)));
create policy hai_classification_insert on public.hai_classifications for insert to authenticated with check (public.current_user_is_platform_owner() or public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]));
create policy hai_classification_update on public.hai_classifications for update to authenticated using (public.current_user_is_platform_owner() or public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[])) with check (public.current_user_is_platform_owner() or public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]));
create policy hai_classification_delete on public.hai_classifications for delete to authenticated using (public.current_user_is_platform_owner() or public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]));

-- AMR / AST / critical communication.
drop policy if exists amr_authorized_read on public.amr_classifications;
drop policy if exists amr_lab_ipc_write on public.amr_classifications;
create policy amr_authorized_read on public.amr_classifications for select to authenticated using (public.current_user_is_platform_owner() or public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member','laboratory','pharmacy','doctor_reviewer']::public.app_role[]));
create policy amr_insert on public.amr_classifications for insert to authenticated with check (public.current_user_has_org_role(organization_id,array['laboratory','infection_control_lead','infection_control_member']::public.app_role[]));
create policy amr_update on public.amr_classifications for update to authenticated using (public.current_user_has_org_role(organization_id,array['laboratory','infection_control_lead','infection_control_member']::public.app_role[])) with check (public.current_user_has_org_role(organization_id,array['laboratory','infection_control_lead','infection_control_member']::public.app_role[]));
create policy amr_delete on public.amr_classifications for delete to authenticated using (public.current_user_has_org_role(organization_id,array['laboratory','infection_control_lead','infection_control_member']::public.app_role[]));

drop policy if exists ast_authorized_read on public.antimicrobial_susceptibility_results;
drop policy if exists ast_lab_write on public.antimicrobial_susceptibility_results;
create policy ast_authorized_read on public.antimicrobial_susceptibility_results for select to authenticated using (public.current_user_is_platform_owner() or public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member','laboratory','pharmacy','doctor_reviewer']::public.app_role[]));
create policy ast_insert on public.antimicrobial_susceptibility_results for insert to authenticated with check (public.current_user_has_org_role(organization_id,array['laboratory']::public.app_role[]));
create policy ast_update on public.antimicrobial_susceptibility_results for update to authenticated using (public.current_user_has_org_role(organization_id,array['laboratory']::public.app_role[])) with check (public.current_user_has_org_role(organization_id,array['laboratory']::public.app_role[]));
create policy ast_delete on public.antimicrobial_susceptibility_results for delete to authenticated using (public.current_user_has_org_role(organization_id,array['laboratory']::public.app_role[]));

drop policy if exists critical_comm_authorized_read on public.critical_result_communications;
drop policy if exists critical_comm_lab_write on public.critical_result_communications;
create policy critical_comm_authorized_read on public.critical_result_communications for select to authenticated using (public.current_user_is_platform_owner() or public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member','laboratory','doctor_reviewer']::public.app_role[]));
create policy critical_comm_lab_write on public.critical_result_communications for insert to authenticated with check (public.current_user_has_org_role(organization_id,array['laboratory']::public.app_role[]) and communicated_by=(select auth.uid()));

-- Complete audit coverage on canonical clinical domains.
drop trigger if exists audit_surveillance_devices on public.surveillance_devices;
create trigger audit_surveillance_devices after insert or update or delete on public.surveillance_devices for each row execute function public.capture_clinical_audit();
drop trigger if exists audit_hai_classifications on public.hai_classifications;
create trigger audit_hai_classifications after insert or update or delete on public.hai_classifications for each row execute function public.capture_clinical_audit();
drop trigger if exists audit_amr_classifications on public.amr_classifications;
create trigger audit_amr_classifications after insert or update or delete on public.amr_classifications for each row execute function public.capture_clinical_audit();
drop trigger if exists audit_antimicrobial_susceptibility_results on public.antimicrobial_susceptibility_results;
create trigger audit_antimicrobial_susceptibility_results after insert or update or delete on public.antimicrobial_susceptibility_results for each row execute function public.capture_clinical_audit();
drop trigger if exists audit_critical_result_communications on public.critical_result_communications;
create trigger audit_critical_result_communications after insert or update or delete on public.critical_result_communications for each row execute function public.capture_clinical_audit();