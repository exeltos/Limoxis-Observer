-- LIRA Phase 5L: outbreak investigation actions linked to Quality/CAPA.
alter table public.quality_capa_actions drop constraint if exists quality_capa_actions_source_type_check;
alter table public.quality_capa_actions add constraint quality_capa_actions_source_type_check check (source_type in ('incident','finding','audit','control','other','outbreak_investigation'));

create policy quality_capa_outbreak_ipc_insert on public.quality_capa_actions for insert to authenticated
with check (
  public.current_user_has_org_role(organization_id,array['infection_control_lead']::public.app_role[])
  and source_type='outbreak_investigation'
  and exists(select 1 from public.lira_outbreak_investigations i where i.id::text=source_id and i.organization_id=quality_capa_actions.organization_id and i.status='active')
);

create policy quality_capa_outbreak_ipc_update on public.quality_capa_actions for update to authenticated
using (
  public.current_user_has_org_role(organization_id,array['infection_control_lead']::public.app_role[])
  and source_type='outbreak_investigation'
  and exists(select 1 from public.lira_outbreak_investigations i where i.id::text=source_id and i.organization_id=quality_capa_actions.organization_id)
)
with check (
  public.current_user_has_org_role(organization_id,array['infection_control_lead']::public.app_role[])
  and source_type='outbreak_investigation'
  and exists(select 1 from public.lira_outbreak_investigations i where i.id::text=source_id and i.organization_id=quality_capa_actions.organization_id)
);
create index if not exists quality_capa_outbreak_source_idx on public.quality_capa_actions(organization_id,source_type,source_id,status);
