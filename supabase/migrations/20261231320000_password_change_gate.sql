-- Όσο ένας χρήστης δεν έχει αλλάξει τον προσωρινό κωδικό (profiles.must_change_password), η ΒΑΣΗ δεν του δίνει
-- πρόσβαση σε δεδομένα νοσοκομείου: ούτε από την εφαρμογή ούτε με απευθείας κλήση του API. Διαβάζει μόνο το
-- προφίλ του και αλλάζει κωδικό. Όπως στο SurgiTrack.
-- Τρέξτε ΟΛΟ το αρχείο στο SQL Editor του Limoxis-Observer. Αλλάζει 4 συναρτήσεις (create or replace) από τις οποίες
-- περνούν οι πολιτικές ασφαλείας, και προσθέτει μία νέα. Ο Ιδιοκτήτης Πλατφόρμας δεν επηρεάζεται.

create or replace function private.password_change_pending() returns boolean
language sql stable security definer set search_path to '' as $f$
  select coalesce((select p.must_change_password from public.profiles p where p.id = auth.uid()), false)
$f$;

revoke all on function private.password_change_pending() from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_org_member(target_org uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select (exists (
    select 1 from public.organization_members om
    where om.user_id = auth.uid()
      and om.organization_id = target_org
      and om.status = 'active'
  ) and not private.password_change_pending()) or public.current_user_is_platform_owner();
$function$;

CREATE OR REPLACE FUNCTION public.has_org_role(target_org uuid, allowed_roles app_role[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.current_user_is_platform_owner() or (not private.password_change_pending() and exists(
    select 1 from public.organization_members
    where organization_id = target_org and user_id = auth.uid() and status = 'active' and role = any(allowed_roles)
  ));
$function$;

CREATE OR REPLACE FUNCTION public.current_user_has_department_scope(target_org uuid, target_department uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select not private.password_change_pending() and exists (
    select 1
    from public.organization_members om
    join public.organization_member_scopes oms on oms.membership_id = om.id
    where om.user_id = auth.uid() and om.organization_id = target_org and om.status = 'active' and oms.department_id = target_department
  );
$function$;

CREATE OR REPLACE FUNCTION public.current_user_has_capability(target_org uuid, capability_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  and not (capability_key = any (private.org_disabled_capabilities(target_org)))));
$function$;

-- Έλεγχος (μόνο ανάγνωση): πρέπει να δείξει 4 συναρτήσεις με τον νέο έλεγχο.
select p.proname, position('password_change_pending' in pg_get_functiondef(p.oid)) > 0 as has_check
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('is_org_member', 'has_org_role', 'current_user_has_department_scope', 'current_user_has_capability')
order by 1;
