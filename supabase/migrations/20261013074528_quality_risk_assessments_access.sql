-- Access to the risk assessment tables (20261013074512_quality_risk_assessments.sql),
-- mirroring the CAPA register: hospital administrators, quality managers and
-- infection control leads read; hospital administrators and quality managers
-- write. Custom roles and the quality-access add-on go through
-- current_user_has_capability. Nothing is granted to anon.

do $policies$
declare t text;
begin
  foreach t in array array['quality_risk_assessments','quality_risks','quality_risk_opportunities'] loop
    execute format($p$create policy %1$s_read on public.%1$s for select to authenticated using (
      public.current_user_is_platform_owner()
      or public.current_user_has_org_role(organization_id, array['hospital_admin'::app_role,'quality_manager'::app_role,'infection_control_lead'::app_role])
      or public.current_user_has_capability(organization_id, 'view_quality'))$p$, t);
    execute format($p$create policy %1$s_insert on public.%1$s for insert to authenticated with check (
      public.current_user_is_platform_owner()
      or public.current_user_has_org_role(organization_id, array['hospital_admin'::app_role,'quality_manager'::app_role])
      or public.current_user_has_capability(organization_id, 'manage_quality'))$p$, t);
    execute format($p$create policy %1$s_update on public.%1$s for update to authenticated using (
      public.current_user_is_platform_owner()
      or public.current_user_has_org_role(organization_id, array['hospital_admin'::app_role,'quality_manager'::app_role])
      or public.current_user_has_capability(organization_id, 'manage_quality'))
      with check (
      public.current_user_is_platform_owner()
      or public.current_user_has_org_role(organization_id, array['hospital_admin'::app_role,'quality_manager'::app_role])
      or public.current_user_has_capability(organization_id, 'manage_quality'))$p$, t);
    execute format($p$create policy %1$s_delete on public.%1$s for delete to authenticated using (
      public.current_user_is_platform_owner()
      or public.current_user_has_org_role(organization_id, array['hospital_admin'::app_role,'quality_manager'::app_role])
      or public.current_user_has_capability(organization_id, 'manage_quality'))$p$, t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end
$policies$;
