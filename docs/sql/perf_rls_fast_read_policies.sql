-- Ταχύτητα: δύο κανόνες ανάγνωσης (RLS) υπολογίζονταν για ΚΑΘΕ γραμμή.
-- Να το τρέξει ο ιδιοκτήτης στο SQL Editor (ο agent δεν εκτελεί drop/alter policy).
--
-- Ίδια δικαιώματα, ίδια αποτελέσματα· οι έλεγχοι ρόλου και τμήματος υπολογίζονται μία φορά ανά ερώτημα
-- (private.fast_orgs_role / fast_orgs_capability / current_user_department_scopes, όπως ήδη οι υπόλοιποι κανόνες).
-- Μέτρηση στο ΙΑΣΩ (διαχειριστής νοσοκομείου, συναλλαγή που ακυρώθηκε):
--   laboratory_samples (κανόνας τμήματος):  950 ms -> 5 ms   (το ίδιο κερδίζουν και τα microbiology_results, που διαβάζονται μέσω των δειγμάτων)
--   training_assignments:                   423 ms -> 3 ms   (3.624 γραμμές και στις δύο περιπτώσεις)

begin;

drop policy if exists laboratory_samples_read_department on public.laboratory_samples;
create policy laboratory_samples_read_department on public.laboratory_samples
  for select to authenticated
  using (
    (subject_type is distinct from 'employee')
    and department_id is not null
    and coalesce(organization_id = any ((select private.fast_orgs_role(array['department_manager','department_user','link_nurse']::public.app_role[]))::uuid[]), false)
    and coalesce(((organization_id::text || ':' || department_id::text) = any ((select private.current_user_department_scopes())::text[])), false)
  );

drop policy if exists training_assignments_read on public.training_assignments;
create policy training_assignments_read on public.training_assignments
  for select to authenticated
  using (
    coalesce(organization_id = any ((select private.fast_orgs_role(array['hospital_admin','infection_control_lead','infection_control_member','hr_office']::public.app_role[]))::uuid[]), false)
    or (
      department_id is not null
      and coalesce(organization_id = any ((select private.fast_orgs_role(array['department_manager','department_user']::public.app_role[]))::uuid[]), false)
      and coalesce(((organization_id::text || ':' || department_id::text) = any ((select private.current_user_department_scopes())::text[])), false)
    )
    or employee_user_id = (select auth.uid())
    or coalesce(organization_id = any ((select private.fast_orgs_capability('manage_training'))::uuid[]), false)
  );

commit;

-- Έλεγχος μετά (μόνο ανάγνωση): οι δύο κανόνες με το νέο κείμενο.
-- select tablename, policyname, qual from pg_policies where policyname in ('laboratory_samples_read_department','training_assignments_read');
