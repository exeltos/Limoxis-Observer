-- Shift roster (owner, 8/11/2026): the department's people read only the published roster; the department manager
-- (their departments) and the hospital administrator read the drafts too.
-- Run once in the Supabase SQL Editor (the agent does not run drop policy).
begin;

drop policy if exists department_rosters_read on public.department_rosters;

create policy department_rosters_read on public.department_rosters for select to authenticated
  using (
    public.is_org_admin(organization_id)
    or (public.current_user_has_org_role(organization_id, array['department_manager']::public.app_role[])
        and public.current_user_has_department_scope(organization_id, department_id))
    or (status = 'published' and public.current_user_has_department_scope(organization_id, department_id))
  );

commit;

-- Check (read only):
select policyname, qual from pg_policies where schemaname = 'public' and tablename = 'department_rosters' and policyname = 'department_rosters_read';
