-- Τρέχει ο ιδιοκτήτης στο SQL Editor (drop/create policy), μετά το 20261231250100.
-- 4. Κλίμακες (NEWS2, Braden, Morse…): τις καταγράφουν και τις βλέπουν και ο Νοσηλευτής τμήματος, ο Νοσηλευτής-σύνδεσμος
--    και το Μέλος Ομάδας Λοιμώξεων.
-- 5. Κρίση κρούσματος στη διερεύνηση επιδημίας: χωρίς αναφορά του πίνακα στον εαυτό του.
begin;
drop policy if exists patient_scale_insert on public.patient_clinical_scale_assessments;
create policy patient_scale_insert on public.patient_clinical_scale_assessments for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (public.current_user_is_platform_owner()
       or public.current_user_has_org_role(organization_id, array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer','department_manager','department_user','link_nurse','staff_user']::public.app_role[]))
);
drop policy if exists patient_scale_read on public.patient_clinical_scale_assessments;
create policy patient_scale_read on public.patient_clinical_scale_assessments for select to public
using (
  (select public.current_user_is_platform_owner())
  or coalesce(organization_id = any ((select private.fast_orgs_role(array['hospital_admin','infection_control_lead','infection_control_member','link_nurse','doctor_reviewer','quality_manager','department_manager','department_user','staff_user']::public.app_role[]))::uuid[]), false)
);
drop policy if exists lira_outbreak_case_reviews_insert on public.lira_outbreak_case_reviews;
create policy lira_outbreak_case_reviews_insert on public.lira_outbreak_case_reviews for insert to authenticated
with check (
  (select auth.uid()) is not null
  and (public.current_user_is_platform_owner()
       or public.current_user_has_org_role(organization_id, array['hospital_admin','infection_control_lead']::public.app_role[]))
  and exists (select 1 from public.lira_outbreak_investigations i
              where i.id = investigation_id and i.organization_id = lira_outbreak_case_reviews.organization_id and i.status = 'active')
  and private.lira_case_review_supersedes_ok(supersedes_review_id, investigation_id, record_key)
);
commit;
