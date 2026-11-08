-- Έλεγχος αποθήκευσης ανά ρόλο (8/11/2026): η βάση συμφωνεί με ό,τι δείχνει η εφαρμογή.
-- 1. Αναφορά συμβάντος από κάθε μέλος, και από τον Διευθυντή νοσοκομείου και τον Διευθυντή τομέα (η πολιτική quality_incident_report
--    δέχεται current_user_has_capability(…, 'report_incident')).
-- 2. Η Γραμματεία επιτροπών αποθηκεύει συνεδριάσεις, πρακτικά, αποφάσεις, μέλη και έγγραφα επιτροπών, όπως της δείχνει
--    η εφαρμογή· δεν δημιουργεί ούτε αρχειοθετεί επιτροπές.
create or replace function public.current_user_has_capability(target_org uuid, capability_key text)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select public.current_user_is_platform_owner()
  or ((
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
            when 'view_training' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','link_nurse','department_manager','department_user','hr_office')
            when 'manage_training' then om.role in ('hospital_admin','infection_control_lead')
            when 'view_prevention' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','link_nurse')
            when 'view_lab' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','laboratory','doctor_reviewer')
            when 'manage_libraries' then om.role in ('hospital_admin','infection_control_lead')
            when 'view_controls' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','link_nurse','department_manager','department_user','laboratory','quality_manager')
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
  and not (capability_key = any (private.org_disabled_capabilities(target_org))));
$function$;

create or replace function public.current_user_has_governance_capability(target_org uuid, requested_capability text)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select public.current_user_is_platform_owner() or (
    public.current_user_has_capability(target_org,requested_capability)
    or exists (
      select 1
      from public.organization_members om
      where om.organization_id=target_org
        and om.user_id=auth.uid()
        and om.status='active'
        and case requested_capability
          when 'view_committees' then om.role in ('hospital_admin','infection_control_lead','quality_manager','committee_secretariat')
          when 'manage_committees' then om.role in ('hospital_admin','infection_control_lead')
          when 'create_committee' then om.role in ('hospital_admin','infection_control_lead')
          when 'manage_committee_members' then om.role in ('hospital_admin','infection_control_lead','committee_secretariat')
          when 'create_committee_meeting' then om.role in ('hospital_admin','infection_control_lead','committee_secretariat')
          when 'edit_committee_minutes' then om.role in ('hospital_admin','infection_control_lead','committee_secretariat')
          when 'finalize_committee_minutes' then om.role in ('hospital_admin','infection_control_lead','committee_secretariat')
          when 'manage_committee_decisions' then om.role in ('hospital_admin','infection_control_lead','committee_secretariat')
          when 'manage_committee_documents' then om.role in ('hospital_admin','infection_control_lead','committee_secretariat')
          when 'archive_committee' then om.role in ('hospital_admin','infection_control_lead')
          when 'view_documents' then true
          when 'manage_documents' then om.role in ('hospital_admin','quality_manager')
          when 'submit_document_review' then om.role in ('hospital_admin','quality_manager')
          when 'approve_document' then om.role in ('hospital_admin','quality_manager')
          when 'publish_document' then om.role in ('hospital_admin','quality_manager')
          when 'supersede_document' then om.role in ('hospital_admin','quality_manager')
          when 'archive_document' then om.role in ('hospital_admin','quality_manager')
          when 'delete_document_draft' then om.role in ('hospital_admin','quality_manager')
          when 'execute_control' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','link_nurse','department_manager','department_user','laboratory','quality_manager')
          when 'edit_control_definition' then om.role in ('hospital_admin','infection_control_lead','department_manager','quality_manager')
          when 'edit_control_execution' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','link_nurse','department_manager','department_user','laboratory','quality_manager')
          when 'void_control_execution' then om.role in ('hospital_admin','infection_control_lead','department_manager','quality_manager')
          when 'archive_control_definition' then om.role in ('hospital_admin','infection_control_lead','quality_manager')
          when 'delete_control_draft' then om.role in ('hospital_admin','infection_control_lead','quality_manager')
          else false
        end
    )
  );
$function$;
