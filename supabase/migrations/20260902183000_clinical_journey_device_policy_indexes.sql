-- Align device writes with authenticated clinical roles and index clinical journey hot paths.

drop policy if exists surveillance_devices_write on public.surveillance_devices;
create policy surveillance_devices_insert on public.surveillance_devices for insert to authenticated
with check (public.current_user_has_org_role(organization_id,array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]));
create policy surveillance_devices_update on public.surveillance_devices for update to authenticated
using (public.current_user_has_org_role(organization_id,array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]))
with check (public.current_user_has_org_role(organization_id,array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]));
create policy surveillance_devices_delete on public.surveillance_devices for delete to authenticated
using (public.current_user_has_org_role(organization_id,array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]));

create index if not exists clinical_assessments_org_case_idx on public.clinical_assessments(organization_id,surveillance_case_id,assessed_at desc);
create index if not exists laboratory_samples_org_case_status_idx on public.laboratory_samples(organization_id,surveillance_case_id,status,requested_at desc);
create index if not exists antimicrobial_therapies_org_case_status_idx on public.antimicrobial_therapies(organization_id,surveillance_case_id,status,started_at desc);
create index if not exists isolation_episodes_org_case_status_idx on public.isolation_episodes(organization_id,surveillance_case_id,status,started_at desc);
create index if not exists surveillance_devices_org_case_status_idx on public.surveillance_devices(organization_id,surveillance_case_id,status,inserted_at desc);
create index if not exists hai_classifications_org_case_idx on public.hai_classifications(organization_id,surveillance_case_id,classified_at desc);
create index if not exists amr_classifications_org_result_idx on public.amr_classifications(organization_id,microbiology_result_id,classified_at desc);
create index if not exists microbiology_results_org_sample_idx on public.microbiology_results(organization_id,sample_id,resulted_at desc);
create index if not exists ast_org_result_idx on public.antimicrobial_susceptibility_results(organization_id,microbiology_result_id);
create index if not exists critical_comm_org_result_idx on public.critical_result_communications(organization_id,microbiology_result_id,communicated_at desc);