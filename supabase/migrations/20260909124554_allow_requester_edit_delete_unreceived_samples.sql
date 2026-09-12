drop policy if exists laboratory_samples_update on public.laboratory_samples;
create policy laboratory_samples_update on public.laboratory_samples
for update to authenticated
using (
  current_user_is_platform_owner()
  or current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'laboratory'::app_role])
  or (
    requested_by = (select auth.uid())
    and status = 'requested'
    and received_at is null
    and is_org_member(organization_id)
    and not exists (select 1 from public.microbiology_results mr where mr.sample_id = laboratory_samples.id)
  )
)
with check (
  current_user_is_platform_owner()
  or current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'laboratory'::app_role])
  or (
    requested_by = (select auth.uid())
    and status = 'requested'
    and received_at is null
    and is_org_member(organization_id)
    and not exists (select 1 from public.microbiology_results mr where mr.sample_id = laboratory_samples.id)
  )
);

drop policy if exists laboratory_samples_delete on public.laboratory_samples;
create policy laboratory_samples_delete on public.laboratory_samples
for delete to authenticated
using (
  current_user_is_platform_owner()
  or current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'laboratory'::app_role])
  or (
    requested_by = (select auth.uid())
    and status = 'requested'
    and received_at is null
    and is_org_member(organization_id)
    and not exists (select 1 from public.microbiology_results mr where mr.sample_id = laboratory_samples.id)
  )
);
