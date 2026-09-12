-- Align canonical clinical journey writes with the application capability model.

alter table public.laboratory_samples alter column collected_at drop not null;
alter table public.laboratory_samples drop constraint if exists laboratory_samples_requested_collection_check;
alter table public.laboratory_samples add constraint laboratory_samples_requested_collection_check
check (status = 'requested' or collected_at is not null);

drop policy if exists clinical_assessments_read on public.clinical_assessments;
drop policy if exists clinical_assessments_write on public.clinical_assessments;
create policy clinical_assessments_read on public.clinical_assessments for select to authenticated
using (public.can_view_surveillance_record(organization_id, department_id));
create policy clinical_assessments_write on public.clinical_assessments for all to authenticated
using (public.current_user_has_org_role(organization_id, array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]))
with check (public.current_user_has_org_role(organization_id, array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]));

drop policy if exists laboratory_samples_write on public.laboratory_samples;
create policy laboratory_samples_lab_manage on public.laboratory_samples for all to authenticated
using (public.current_user_has_org_role(organization_id, array['laboratory']::public.app_role[]))
with check (public.current_user_has_org_role(organization_id, array['laboratory']::public.app_role[]));
create policy laboratory_samples_clinical_request on public.laboratory_samples for insert to authenticated
with check (status='requested' and requested_by=(select auth.uid()) and created_by=(select auth.uid()) and public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]));

drop policy if exists microbiology_results_read on public.microbiology_results;
drop policy if exists microbiology_results_write on public.microbiology_results;
create policy microbiology_results_read on public.microbiology_results for select to authenticated
using (exists (select 1 from public.laboratory_samples s where s.id=sample_id));
create policy microbiology_results_write on public.microbiology_results for all to authenticated
using (public.current_user_has_org_role(organization_id,array['laboratory']::public.app_role[]))
with check (public.current_user_has_org_role(organization_id,array['laboratory']::public.app_role[]));

drop policy if exists antimicrobial_therapies_read on public.antimicrobial_therapies;
drop policy if exists antimicrobial_therapies_write on public.antimicrobial_therapies;
create policy antimicrobial_therapies_read on public.antimicrobial_therapies for select to authenticated
using (public.current_user_is_platform_owner() or public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member','pharmacy','doctor_reviewer']::public.app_role[]));
create policy antimicrobial_therapies_write on public.antimicrobial_therapies for all to authenticated
using (public.current_user_has_org_role(organization_id,array['infection_control_lead','doctor_reviewer','pharmacy']::public.app_role[]))
with check (public.current_user_has_org_role(organization_id,array['infection_control_lead','doctor_reviewer','pharmacy']::public.app_role[]));

drop policy if exists isolation_episodes_read on public.isolation_episodes;
drop policy if exists isolation_episodes_write on public.isolation_episodes;
create policy isolation_episodes_read on public.isolation_episodes for select to authenticated
using (public.can_view_surveillance_record(organization_id,department_id));
create policy isolation_episodes_write on public.isolation_episodes for all to authenticated
using (public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member']::public.app_role[]))
with check (public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member']::public.app_role[]));