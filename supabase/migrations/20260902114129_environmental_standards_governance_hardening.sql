revoke all privileges on table public.environmental_standards from anon;
revoke all privileges on table public.environmental_standards from authenticated;
grant select, insert, update, delete on table public.environmental_standards to authenticated;

drop policy if exists environmental_standards_manage on public.environmental_standards;
drop policy if exists environmental_standards_read on public.environmental_standards;
drop policy if exists environmental_standards_manage_hospital on public.environmental_standards;
drop policy if exists environmental_standards_manage_system_owner on public.environmental_standards;

create policy environmental_standards_read on public.environmental_standards
for select to authenticated
using (public.is_org_member(organization_id) or public.current_user_is_platform_owner());

create policy environmental_standards_manage_hospital on public.environmental_standards
for all to authenticated
using (
  public.current_user_has_capability(organization_id,'manage_libraries')
  and coalesce((payload->>'system')::boolean,false)=false
)
with check (
  public.current_user_has_capability(organization_id,'manage_libraries')
  and coalesce((payload->>'system')::boolean,false)=false
);

create policy environmental_standards_manage_system_owner on public.environmental_standards
for all to authenticated
using (
  coalesce((payload->>'system')::boolean,false)=true
  and public.current_user_is_platform_owner()
)
with check (
  coalesce((payload->>'system')::boolean,false)=true
  and public.current_user_is_platform_owner()
);

drop trigger if exists trg_audit_environmental_standards on public.environmental_standards;
create trigger trg_audit_environmental_standards
after insert or update or delete on public.environmental_standards
for each row execute function private.audit_management_change();
