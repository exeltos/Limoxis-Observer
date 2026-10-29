-- Συνέχεια του 20261214130000: το τμήμα καταχωρεί δείγμα που έχει ήδη ληφθεί («collected», όπως το δημιουργεί η φόρμα
-- όταν υπάρχει ώρα λήψης), πάντα πριν την παραλαβή από το Εργαστήριο, και βλέπει τα δείγματα του δικού του τμήματος.
create policy laboratory_samples_insert_department_collected on public.laboratory_samples
  for insert to authenticated
  with check (
    status = 'collected'
    and received_at is null
    and requested_by = (select auth.uid())
    and created_by = (select auth.uid())
    and department_id is not null
    and public.current_user_has_org_role(organization_id, array['department_manager'::public.app_role, 'department_user'::public.app_role, 'link_nurse'::public.app_role])
    and public.current_user_has_department_scope(organization_id, department_id)
  );

create policy laboratory_samples_read_department on public.laboratory_samples
  for select to authenticated
  using (
    subject_type is distinct from 'employee'
    and department_id is not null
    and public.current_user_has_org_role(organization_id, array['department_manager'::public.app_role, 'department_user'::public.app_role, 'link_nurse'::public.app_role])
    and public.current_user_has_department_scope(organization_id, department_id)
  );
