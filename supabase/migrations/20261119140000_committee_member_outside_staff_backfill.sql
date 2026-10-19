-- Committee members who were added before committee_members.is_external existed
-- and are not linked to an employee are outside the staff (the app marks a member
-- typed by hand the same way), so they get the «Εκτός προσωπικού» badge too.
update public.committee_members
set is_external = true
where not is_external
  and employee_id is null;
