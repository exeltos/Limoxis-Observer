-- Shift roster without the HR office (owner, 8/11/2026): only the hospital administrator (and the platform owner
-- through is_org_admin) and the department manager of their own departments write it; the department's people read it.
-- Run once in the Supabase SQL Editor (the agent does not run drop policy).
begin;

drop policy if exists department_rosters_read on public.department_rosters;
drop policy if exists department_rosters_write on public.department_rosters;

create policy department_rosters_read on public.department_rosters for select to authenticated
  using (
    public.is_org_admin(organization_id)
    or public.current_user_has_department_scope(organization_id, department_id)
  );
create policy department_rosters_write on public.department_rosters for all to authenticated
  using (
    public.is_org_admin(organization_id)
    or (public.current_user_has_org_role(organization_id, array['department_manager']::public.app_role[])
        and public.current_user_has_department_scope(organization_id, department_id))
  )
  with check (
    public.is_org_admin(organization_id)
    or (public.current_user_has_org_role(organization_id, array['department_manager']::public.app_role[])
        and public.current_user_has_department_scope(organization_id, department_id))
  );

commit;

-- Check (read only): no policy of the table names hr_office any more.
select policyname, qual, with_check from pg_policies where schemaname = 'public' and tablename = 'department_rosters';
