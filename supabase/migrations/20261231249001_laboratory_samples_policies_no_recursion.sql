-- Τρέχει ο ιδιοκτήτης στο SQL Editor (drop/create policy). Ίδιες πολιτικές με πριν· μόνο ο έλεγχος
-- «χωρίς αποτέλεσμα» περνά από την private.laboratory_sample_has_result, που δεν ξαναδιαβάζει το laboratory_samples.
begin;
drop policy if exists laboratory_samples_update on public.laboratory_samples;
create policy laboratory_samples_update on public.laboratory_samples for update to authenticated
using (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(organization_id, array['hospital_admin','laboratory']::public.app_role[])
  or (requested_by = (select auth.uid()) and status = 'requested' and received_at is null
      and public.is_org_member(organization_id) and not private.laboratory_sample_has_result(id))
)
with check (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(organization_id, array['hospital_admin','laboratory']::public.app_role[])
  or (requested_by = (select auth.uid()) and status = 'requested' and received_at is null
      and public.is_org_member(organization_id) and not private.laboratory_sample_has_result(id))
);
drop policy if exists laboratory_samples_delete on public.laboratory_samples;
create policy laboratory_samples_delete on public.laboratory_samples for delete to authenticated
using (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(organization_id, array['hospital_admin','laboratory']::public.app_role[])
  or (requested_by = (select auth.uid()) and status = 'requested' and received_at is null
      and public.is_org_member(organization_id) and not private.laboratory_sample_has_result(id))
);
commit;
