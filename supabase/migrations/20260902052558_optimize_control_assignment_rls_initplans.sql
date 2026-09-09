-- Optimize frequently evaluated assignment/control-draft RLS policies without changing
-- authorization semantics. auth.uid() is materialized once per statement.

drop policy if exists assignments_manage_authorized on public.work_assignments;
create policy assignments_manage_authorized
on public.work_assignments
for all
using (
  public.is_org_admin(organization_id)
  or exists (
    select 1
    from public.organization_members om
    where om.user_id = (select auth.uid())
      and om.organization_id = work_assignments.organization_id
      and om.status = 'active'::public.member_status
      and om.role = any (array['infection_control_lead'::public.app_role,'quality_manager'::public.app_role])
  )
)
with check (
  public.is_org_admin(organization_id)
  or exists (
    select 1
    from public.organization_members om
    where om.user_id = (select auth.uid())
      and om.organization_id = work_assignments.organization_id
      and om.status = 'active'::public.member_status
      and om.role = any (array['infection_control_lead'::public.app_role,'quality_manager'::public.app_role])
  )
);

drop policy if exists assignments_read_assignee_or_admin on public.work_assignments;
create policy assignments_read_assignee_or_admin
on public.work_assignments
for select
using (
  membership_id in (select public.current_membership_ids())
  or public.is_org_admin(organization_id)
  or exists (
    select 1
    from public.organization_members om
    where om.user_id = (select auth.uid())
      and om.organization_id = work_assignments.organization_id
      and om.status = 'active'::public.member_status
      and om.role = any (array['infection_control_lead'::public.app_role,'quality_manager'::public.app_role])
  )
);

drop policy if exists control_drafts_read on public.control_drafts;
create policy control_drafts_read
on public.control_drafts
for select
using (
  created_by = (select auth.uid())
  or public.current_user_has_capability(organization_id,'manage_controls')
  or (
    department_id is not null
    and public.current_user_has_org_role(organization_id,array['department_manager'::public.app_role])
    and public.current_user_has_department_scope(organization_id,department_id)
  )
);

drop policy if exists control_drafts_insert on public.control_drafts;
create policy control_drafts_insert
on public.control_drafts
for insert
with check (
  public.is_org_member(organization_id)
  and created_by = (select auth.uid())
  and (
    department_id is null
    or public.current_user_has_capability(organization_id,'manage_controls')
    or public.current_user_has_department_scope(organization_id,department_id)
  )
);

drop policy if exists control_drafts_update on public.control_drafts;
create policy control_drafts_update
on public.control_drafts
for update
using (
  created_by = (select auth.uid())
  or public.current_user_has_capability(organization_id,'manage_controls')
)
with check (
  created_by = (select auth.uid())
  or public.current_user_has_capability(organization_id,'manage_controls')
);

drop policy if exists control_drafts_delete on public.control_drafts;
create policy control_drafts_delete
on public.control_drafts
for delete
using (
  created_by = (select auth.uid())
  or public.current_user_has_capability(organization_id,'manage_controls')
);
