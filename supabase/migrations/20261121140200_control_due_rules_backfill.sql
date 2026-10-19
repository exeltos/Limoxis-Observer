-- Controls: recompute last_completed_at / next_due_at of every existing
-- assignment with the due rule of 20261121140000_control_due_rules.
--
-- Why: that migration changed the rule and added the trigger that keeps it, but
-- the trigger only runs on a new or voided entry, so assignments kept the
-- next_due_at the browser had set and stayed overdue until their next entry.
-- private.control_refresh_assignment_due updates a row only when a value
-- differs, so running this again changes nothing. Assignments with no regular
-- entry keep the next_due_at they have.

do $$
declare
  v_id uuid;
begin
  for v_id in select a.id from public.control_assignments a order by a.id loop
    perform private.control_refresh_assignment_due(v_id);
  end loop;
end;
$$;
