revoke all on table public.indicator_definitions from anon;
revoke all on table public.indicator_definitions from authenticated;
grant select,insert,update,delete on table public.indicator_definitions to authenticated;

drop policy if exists indicators_manage on public.indicator_definitions;
drop policy if exists indicators_read on public.indicator_definitions;

create policy indicators_read on public.indicator_definitions for select to authenticated
using (organization_id is null or public.is_org_member(organization_id) or public.current_user_is_platform_owner());

create policy indicators_manage_hospital on public.indicator_definitions for all to authenticated
using (organization_id is not null and public.is_org_admin(organization_id))
with check (organization_id is not null and public.is_org_admin(organization_id));

create policy indicators_manage_system_owner on public.indicator_definitions for all to authenticated
using (organization_id is null and public.current_user_is_platform_owner())
with check (organization_id is null and public.current_user_is_platform_owner());

drop trigger if exists trg_audit_indicator_definitions on public.indicator_definitions;
create trigger trg_audit_indicator_definitions
after insert or update or delete on public.indicator_definitions
for each row execute function private.audit_management_change();
