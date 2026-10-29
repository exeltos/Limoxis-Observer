-- Τα τμήματα ζητούν καλλιέργειες: Υπεύθυνος τμήματος, Χρήστης τμήματος και Νοσηλευτής Σύνδεσμος
-- καταχωρούν δείγματα με κατάσταση «requested», μόνο για τμήμα που ανήκει στο πεδίο τους (organization_member_scopes).
-- Η αποδοχή, το αποτέλεσμα και η διαγραφή μένουν στο Εργαστήριο.
create policy laboratory_samples_insert_department on public.laboratory_samples
  for insert to authenticated
  with check (
    status = 'requested'
    and requested_by = (select auth.uid())
    and created_by = (select auth.uid())
    and department_id is not null
    and public.current_user_has_org_role(organization_id, array['department_manager'::public.app_role, 'department_user'::public.app_role, 'link_nurse'::public.app_role])
    and public.current_user_has_department_scope(organization_id, department_id)
  );
