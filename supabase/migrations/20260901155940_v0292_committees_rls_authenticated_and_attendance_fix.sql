-- Limoxis Observer v0.29.2
-- Committee domain RLS hardening and attendance correlation fix.

do $$
declare r record;
begin
  for r in
    select tablename, policyname
    from pg_policies
    where schemaname='public'
      and tablename in ('committees','committee_members','committee_meetings','committee_decisions','committee_meeting_attendance','committee_minutes_approvals','committee_plan_items','committee_documents','committee_history')
  loop
    execute format('alter policy %I on public.%I to authenticated', r.policyname, r.tablename);
  end loop;
end $$;

-- Replace the attendance manage policy because its previous EXISTS predicate
-- compared meeting columns to themselves instead of to the outer attendance row.
drop policy if exists committee_attendance_manage on public.committee_meeting_attendance;
create policy committee_attendance_manage
on public.committee_meeting_attendance
for all
to authenticated
using (
  public.current_user_can_manage_committee(organization_id, committee_id, 'edit_committee_minutes')
  and exists (
    select 1
    from public.committee_meetings m
    where m.id = committee_meeting_attendance.meeting_id
      and m.organization_id = committee_meeting_attendance.organization_id
      and m.committee_id = committee_meeting_attendance.committee_id
      and m.status = any (array['draft'::text,'planned'::text,'in_progress'::text])
  )
)
with check (
  public.current_user_can_manage_committee(organization_id, committee_id, 'edit_committee_minutes')
  and exists (
    select 1
    from public.committee_meetings m
    where m.id = committee_meeting_attendance.meeting_id
      and m.organization_id = committee_meeting_attendance.organization_id
      and m.committee_id = committee_meeting_attendance.committee_id
      and m.status = any (array['draft'::text,'planned'::text,'in_progress'::text])
  )
);
