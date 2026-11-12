-- Διευθυντής Διεύθυνσης: ανάγνωση στα τμήματα των διευθύνσεών του (12/11/2026).
--
-- Νέες επιτρεπτικές πολιτικές ΜΟΝΟ για SELECT (<πίνακας>_division_director_read), με κλειδιά που υπολογίζονται μία
-- φορά ανά ερώτημα (private.current_user_division_scope_keys / _category_keys). Οι εγγραφές μένουν κλειστές από τις
-- περιοριστικές πολιτικές του 20261231430000_division_director_read_only.sql.
--   Προγράμματα βαρδιών (και πρόχειρα), αιτήματα βαρδιών, εργαζόμενοι (μόνο οι κατηγορίες της διεύθυνσης),
--   εκπαίδευση, υγιεινή χεριών, συμβάντα του τμήματος (η περιοριστική πολιτική απορρήτου μένει: τα ανώνυμα και
--   εμπιστευτικά δεν φαίνονται). Οι έλεγχοι ανοίγουν με το view_controls (οι εκτελέσεις φιλτράρονται ήδη ανά τμήμα).
--   Τα βιβλία τμήματος διαβάζονται ήδη με την πρόσβαση τμήματος.
-- Οι εμβολιασμοί εργαζομένων ΔΕΝ ανοίγουν: ο Διευθυντής βλέπει μόνο ποσοστό ανά τμήμα (public.division_overview).

do $do$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'department_rosters' and policyname = 'department_rosters_division_director_read') then
    create policy department_rosters_division_director_read on public.department_rosters for select to authenticated
      using ((organization_id::text || ':' || department_id::text) = any ((select private.current_user_division_scope_keys())::text[]));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'roster_requests' and policyname = 'roster_requests_division_director_read') then
    create policy roster_requests_division_director_read on public.roster_requests for select to authenticated
      using ((organization_id::text || ':' || department_id::text) = any ((select private.current_user_division_scope_keys())::text[]));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'employees' and policyname = 'employees_division_director_read') then
    create policy employees_division_director_read on public.employees for select to authenticated
      using (
        department_id is not null
        and (organization_id::text || ':' || department_id::text || ':' || coalesce(private.employee_professional_category(profession_name, staff_category), '-'))
          = any ((select private.current_user_division_category_keys())::text[])
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'employee_training_summary' and policyname = 'employee_training_summary_division_director_read') then
    create policy employee_training_summary_division_director_read on public.employee_training_summary for select to authenticated
      using (exists (
        select 1 from public.employees e
         where e.id = employee_training_summary.employee_id
           and e.organization_id = employee_training_summary.organization_id
           and e.department_id is not null
           and (e.organization_id::text || ':' || e.department_id::text || ':' || coalesce(private.employee_professional_category(e.profession_name, e.staff_category), '-'))
             = any ((select private.current_user_division_category_keys())::text[])
      ));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'training_assignments' and policyname = 'training_assignments_division_director_read') then
    create policy training_assignments_division_director_read on public.training_assignments for select to authenticated
      using (department_id is not null and (organization_id::text || ':' || department_id::text) = any ((select private.current_user_division_scope_keys())::text[]));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'training_records' and policyname = 'training_records_division_director_read') then
    create policy training_records_division_director_read on public.training_records for select to authenticated
      using (department_id is not null and (organization_id::text || ':' || department_id::text) = any ((select private.current_user_division_scope_keys())::text[]));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'hand_hygiene_sessions' and policyname = 'hand_hygiene_sessions_division_director_read') then
    create policy hand_hygiene_sessions_division_director_read on public.hand_hygiene_sessions for select to authenticated
      using (department_id is not null and (organization_id::text || ':' || department_id::text) = any ((select private.current_user_division_scope_keys())::text[]));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'hand_hygiene_observations' and policyname = 'hand_hygiene_observations_division_director_read') then
    create policy hand_hygiene_observations_division_director_read on public.hand_hygiene_observations for select to authenticated
      using (exists (
        select 1 from public.hand_hygiene_sessions s
         where s.id = hand_hygiene_observations.session_id
           and s.department_id is not null
           and (s.organization_id::text || ':' || s.department_id::text) = any ((select private.current_user_division_scope_keys())::text[])
      ));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'quality_incidents' and policyname = 'quality_incidents_division_director_read') then
    create policy quality_incidents_division_director_read on public.quality_incidents for select to authenticated
      using (department_id is not null and (organization_id::text || ':' || department_id::text) = any ((select private.current_user_division_scope_keys())::text[]));
  end if;
end
$do$;

-- Έλεγχοι και εκπαίδευση: ο Διευθυντής Διεύθυνσης μπαίνει στις λίστες view_controls και view_training (ίδια με όσα
-- δείχνει η εφαρμογή, src/core/permissions/systemRoleMatrix.js). Κατά τα άλλα ο ορισμός είναι ο τρέχων της βάσης.
create or replace function public.current_user_has_capability(target_org uuid, capability_key text)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select public.current_user_is_platform_owner()
  or (not private.password_change_pending() and ((
    exists (
      select 1
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = target_org
        and om.status = 'active'
        and om.role = 'hospital_admin'
        and capability_key not in ('view_platform','manage_platform')
        and (
          capability_key not in ('view_occupational_health','manage_occupational_health')
          or exists (select 1 from public.organizations o where o.id = target_org and o.is_demo)
        )
    )
    or exists (
      select 1
      from public.organization_members om
      where om.user_id=auth.uid()
        and om.organization_id=target_org
        and om.status='active'
        and (
          exists (
            select 1
            from public.custom_role_capabilities crc
            where crc.custom_role_id=om.custom_role_id
              and crc.capability=capability_key
          )
          or exists (
            select 1
            from public.organization_member_capabilities omc
            where omc.membership_id=om.id
              and (
                (omc.capability='lab_access' and capability_key='view_lab')
                or (omc.capability='quality_access' and capability_key in ('view_quality','view_controls'))
              )
          )
          or case capability_key
            when 'view_training' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','link_nurse','department_manager','department_user','hr_office','division_director')
            when 'manage_training' then om.role in ('hospital_admin','infection_control_lead')
            when 'view_prevention' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','link_nurse')
            when 'view_lab' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','laboratory','doctor_reviewer')
            when 'manage_libraries' then om.role in ('hospital_admin','infection_control_lead')
            when 'view_controls' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','link_nurse','department_manager','department_user','laboratory','quality_manager','division_director')
            when 'manage_controls' then om.role in ('hospital_admin','infection_control_lead','quality_manager')
            when 'view_indicators' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','link_nurse','department_manager','pharmacy','doctor_reviewer','quality_manager','hospital_director')
            when 'manage_indicators' then om.role in ('hospital_admin','infection_control_lead','quality_manager')
            when 'record_pharmacy' then om.role in ('hospital_admin','infection_control_lead','pharmacy')
            when 'record_prevalence_survey' then om.role in ('hospital_admin','infection_control_lead','infection_control_member')
            when 'record_hand_hygiene' then om.role in ('link_nurse')
            when 'record_waste' then om.role in ('link_nurse')
            when 'record_antiseptic' then om.role in ('link_nurse')
            when 'record_prevention_bundle' then om.role in ('link_nurse')
            when 'view_kitchen' then om.role in ('hospital_admin','infection_control_lead','quality_manager')
            when 'record_kitchen' then om.role in ('hospital_admin','quality_manager')
            when 'manage_kitchen' then om.role in ('hospital_admin','quality_manager')
            when 'view_executive_dashboard' then om.role in ('hospital_admin','hospital_director')
            when 'view_interviews' then om.role in ('hospital_admin','hr_office')
            when 'manage_interviews' then om.role in ('hospital_admin','hr_office')
            when 'report_incident' then true
            else false
          end
        )
    )
  )
  and not (capability_key = any (private.org_disabled_capabilities(target_org)))));
$function$;
