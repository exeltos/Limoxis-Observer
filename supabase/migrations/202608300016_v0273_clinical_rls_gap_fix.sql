-- Limoxis Observer v0.27.3 — close documented clinical/laboratory RLS gaps.
--
-- docs/AUTHORIZATION_MODEL.md:
--   - Rule #2: platform_owner never grants an implicit hospital-record RLS
--     bypass.
--   - "Hospital Admin ... receives neither protected clinical content nor
--     Occupational Health by default."
-- Several policies added in v050/v051/v060 still listed hospital_admin in
-- their role arrays, and every one of them resolves that array through
-- current_user_has_org_role(), which bypasses for platform_owner
-- unconditionally. This migration tightens exactly the clinical/laboratory
-- surfaces named in tests/rlsAuthorizationGaps.test.js, without touching the
-- shared current_user_has_org_role()/has_org_role() helpers themselves —
-- those still back non-clinical policies (memberships, training, committees,
-- controls, quality) where the platform_owner bypass is the only existing
-- path to bootstrap a brand new organization's first membership. Removing it
-- there with no replacement mechanism would break onboarding entirely.

begin;

do $$
begin
  if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'laboratory_samples') then
    raise exception 'Refusing to run: public.laboratory_samples not found — apply the v0.2.0-v0.27.2 migrations first.';
  end if;
end $$;

drop policy if exists ast_authorized_read on public.antimicrobial_susceptibility_results;
create policy ast_authorized_read on public.antimicrobial_susceptibility_results for select using (
  not public.current_user_is_platform_owner()
  and public.current_user_has_org_role(organization_id, array['infection_control_lead','infection_control_member','laboratory','pharmacy','doctor_reviewer']::public.app_role[])
);

drop policy if exists amr_authorized_read on public.amr_classifications;
create policy amr_authorized_read on public.amr_classifications for select using (
  not public.current_user_is_platform_owner()
  and public.current_user_has_org_role(organization_id, array['infection_control_lead','infection_control_member','laboratory','pharmacy','doctor_reviewer']::public.app_role[])
);

drop policy if exists critical_comm_authorized_read on public.critical_result_communications;
create policy critical_comm_authorized_read on public.critical_result_communications for select using (
  not public.current_user_is_platform_owner()
  and public.current_user_has_org_role(organization_id, array['infection_control_lead','infection_control_member','laboratory','doctor_reviewer']::public.app_role[])
);

drop policy if exists laboratory_samples_read on public.laboratory_samples;
create policy laboratory_samples_read on public.laboratory_samples for select using (
  (not public.current_user_is_platform_owner() and public.current_user_has_org_role(organization_id, array['infection_control_lead','infection_control_member','laboratory']::public.app_role[]))
  or (public.current_user_has_org_role(organization_id, array['department_manager']::public.app_role[]) and department_id is not null and public.current_user_has_department_scope(organization_id, department_id))
);

drop policy if exists antimicrobial_therapies_read on public.antimicrobial_therapies;
create policy antimicrobial_therapies_read on public.antimicrobial_therapies for select using (
  not public.current_user_is_platform_owner()
  and public.current_user_has_org_role(organization_id, array['infection_control_lead','infection_control_member','pharmacy','doctor_reviewer']::public.app_role[])
);

drop policy if exists clinical_audit_authorized_read on public.clinical_audit_log;
create policy clinical_audit_authorized_read on public.clinical_audit_log for select using (
  not public.current_user_is_platform_owner()
  and public.current_user_has_org_role(organization_id, array['infection_control_lead']::public.app_role[])
);

drop policy if exists hai_classification_write on public.hai_classifications;
create policy hai_classification_write on public.hai_classifications for all using (
  not public.current_user_is_platform_owner()
  and public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[])
) with check (
  not public.current_user_is_platform_owner()
  and public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[])
);

create or replace function public.can_view_surveillance_record(target_org uuid, target_department uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (
    not public.current_user_is_platform_owner()
    and public.current_user_has_org_role(target_org, array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[])
  )
  or (
    public.current_user_has_org_role(target_org, array['department_manager']::public.app_role[])
    and target_department is not null
    and public.current_user_has_department_scope(target_org, target_department)
  );
$$;

select 'policies after fix' as check, policyname, qual
from pg_policies
where schemaname = 'public'
  and tablename in ('antimicrobial_susceptibility_results','amr_classifications','critical_result_communications','laboratory_samples','antimicrobial_therapies','clinical_audit_log','hai_classifications')
order by tablename, policyname;

commit;
