-- Demo permissions (approved by the platform owner), inside Demo organizations only:
--   1. A Demo's Hospital Admin also has the two Occupational Health capabilities,
--      so the evaluator sees the module they are evaluating. Every person in a
--      Demo is synthetic; outside Demos nothing changes.
--   2. A Demo member may switch their own role (demo_switch_my_role), so the
--      database returns exactly what that role sees. Members still may not
--      change their own role anywhere else.
--   3. Patient names in the Demo data pack vary inside each department.
-- No SELECT/EXECUTE/RETURNING ... INTO (the Supabase SQL editor rewrites those).

-- 1. Occupational Health for a Demo's Hospital Admin ---------------------------
-- Unchanged except for the first branch.
create or replace function public.current_user_has_capability(target_org uuid, capability_key text)
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select public.current_user_is_platform_owner()
  or exists (
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
          when 'view_indicators' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','link_nurse','department_manager','pharmacy','doctor_reviewer','quality_manager')
          when 'manage_indicators' then om.role in ('hospital_admin','infection_control_lead','quality_manager')
          when 'record_pharmacy' then om.role in ('hospital_admin','infection_control_lead','pharmacy')
          when 'record_prevalence_survey' then om.role in ('hospital_admin','infection_control_lead','infection_control_member')
          when 'record_hand_hygiene' then om.role in ('link_nurse')
          when 'record_waste' then om.role in ('link_nurse')
          when 'record_antiseptic' then om.role in ('link_nurse')
          when 'record_prevention_bundle' then om.role in ('link_nurse')
          else false
        end
      )
  );
$function$;

-- 2. Demo members switch their own role ----------------------------------------
-- The guard is unchanged except for one exception: demo_switch_my_role, inside
-- a Demo organization.
create or replace function public.prevent_self_membership_privilege_change()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if auth.uid() is not null and old.user_id = auth.uid() then
    if new.role is distinct from old.role
       or new.custom_role_id is distinct from old.custom_role_id then
      if coalesce(current_setting('limoxis.demo_role_switch', true), '') = 'on'
         and exists (select 1 from public.organizations o where o.id = new.organization_id and o.is_demo) then
        return new;
      end if;
      raise exception 'SELF_PRIVILEGE_CHANGE_FORBIDDEN'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$;

-- Roles a Demo member may take: the previewable system roles (never Platform
-- Owner). Department roles get one department of the Demo as their scope.
create or replace function public.demo_switch_my_role(p_organization_id uuid, p_role text, p_department_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_membership uuid := (select om.id from public.organization_members om
    where om.organization_id = p_organization_id and om.user_id = auth.uid() and om.status = 'active' limit 1);
  v_department uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations o where o.id = p_organization_id and o.is_demo) then
    raise exception 'Roles can be switched only in a Demo organization' using errcode = '42501';
  end if;
  if v_membership is null then
    raise exception 'Not a member of this Demo' using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('hospital_admin', 'infection_control_lead', 'infection_control_member', 'department_manager', 'link_nurse',
      'department_user', 'laboratory', 'committee_secretariat', 'hr_office', 'pharmacy', 'occupational_physician', 'doctor_reviewer', 'quality_manager') then
    raise exception 'This role cannot be chosen in a Demo' using errcode = '22023';
  end if;

  if p_role in ('department_manager', 'link_nurse', 'department_user', 'laboratory') then
    v_department := coalesce(
      (select d.id from public.departments d where d.id = p_department_id and d.organization_id = p_organization_id),
      (select d.id from public.departments d where d.organization_id = p_organization_id order by (d.code = 'ΜΕΘ') desc, d.name limit 1));
  end if;

  perform set_config('limoxis.demo_role_switch', 'on', true);
  update public.organization_members om set role = p_role::public.app_role, custom_role_id = null where om.id = v_membership;
  perform set_config('limoxis.demo_role_switch', 'off', true);

  delete from public.organization_member_scopes s where s.membership_id = v_membership;
  if v_department is not null then
    insert into public.organization_member_scopes(membership_id, department_id) values (v_membership, v_department);
  end if;

  return jsonb_build_object('role', p_role, 'departmentId', v_department);
end;
$function$;

revoke all on function public.demo_switch_my_role(uuid, text, uuid) from public, anon;
grant execute on function public.demo_switch_my_role(uuid, text, uuid) to authenticated;

-- 3. Patient names ----------------------------------------------------------------
-- Same patients; first names, surnames and sex now vary inside each department
-- (before, a department had one sex and two first names).
create or replace function private.demo_seed_patients(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := current_date;
  v_now timestamptz := now();
  v_depts uuid[] := array(
    select dep.id from (values ('ΜΕΘ',1),('ΠΑΘ',2),('ΧΕΙΡ',3),('ΚΑΡΔ',4),('ΟΡΘ',5),('ΝΕΦ',6),('ΠΑΙΔ',7),('ΜΕΝΝ',8)) o(code,ord)
    join public.departments dep on dep.organization_id = p_organization_id and dep.code = o.code order by o.ord);
  fm text[] := array['Γιώργος','Νίκος','Δημήτρης','Κώστας','Γιάννης','Παναγιώτης','Βασίλης','Χρήστος','Αντώνης','Σπύρος','Μιχάλης','Θανάσης'];
  ff text[] := array['Μαρία','Ελένη','Κατερίνα','Βασιλική','Σοφία','Αγγελική','Δήμητρα','Ευαγγελία','Ιωάννα','Χριστίνα','Γεωργία','Αναστασία'];
  lm text[] := array['Παπαδόπουλος','Γεωργίου','Νικολάου','Οικονόμου','Αντωνίου','Δημητρίου','Ιωάννου','Κωνσταντίνου','Παπαδάκης','Βασιλείου','Μαυρίδης','Σταθόπουλος'];
  lf text[] := array['Παπαδοπούλου','Γεωργίου','Νικολάου','Οικονόμου','Αντωνίου','Δημητρίου','Ιωάννου','Κωνσταντίνου','Παπαδάκη','Βασιλείου','Μαυρίδου','Σταθοπούλου'];
begin

  -- Patients (the admission is created by the patients trigger)
  insert into public.patients(organization_id, patient_code, first_name, last_name, father_name, sex, date_of_birth,
    hospital_record_number, department_id, admission_date, discharge_date, status, created_by)
  select v_org, 'P-' || to_char(d0,'YY') || lpad(g::text, 4, '0'),
    case when (g + g / 6) % 2 = 0 then ff[1 + (g * 5 + g / 6) % 12] else fm[1 + (g * 5 + g / 6) % 12] end,
    case when (g + g / 6) % 2 = 0 then lf[1 + (g * 7 + g / 3) % 12] else lm[1 + (g * 7 + g / 3) % 12] end,
    fm[1 + (g * 11 + g / 4) % 12],
    case when (g + g / 6) % 2 = 0 then 'female' else 'male' end,
    d0 - ((28 + (g * 37) % 58) * 365 + g * 11),
    'ΑΜ-' || (240000 + g * 137),
    v_depts[1 + g % 6], s.adm,
    case when g % 4 = 0 then least(d0 - 1, s.adm + 3 + g % 9) end,
    case when g % 4 = 0 then 'discharged' else 'active' end,
    p_actor
  from (select g, d0 - (2 + (g * 7) % 55) as adm from generate_series(1, 48) g) s;
end;
$function$;

