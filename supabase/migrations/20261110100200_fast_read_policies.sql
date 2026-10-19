-- Every read policy checks access once per query instead of once per row.
--
-- The access checks (is_org_member, current_user_has_org_role,
-- current_user_has_capability, current_user_has_department_scope, …) are
-- SECURITY DEFINER functions of the row's organization and department, so a
-- policy called them for every row: 1–2.7 s per page of 1,000 survey responses.
-- Here each check gets a twin that returns, once per query, the organizations
-- (or organization:department pairs) the check holds for, asking the check
-- itself for each organization the user could be allowed in (all of them for
-- the platform owner, otherwise those of an active membership, which every
-- check requires). The policies compare the row with that array in a scalar
-- subquery, which the database evaluates once.
--
-- private.rls_fast_text(policy) rewrites a policy that way: composite checks
-- (surveillance, hand hygiene, waste, pharmacy, prevalence, prevention bundles,
-- control departments) are written out as their definitions, then each check of
-- an organization becomes «organization = ANY (its array)», the department scope
-- «organization:department = ANY (the user's scopes)», and checks without
-- arguments (platform owner, auth.uid()) a scalar subquery. With no
-- organization a check holds only for the platform owner, as before. Committee
-- checks (per committee) are left as they are.
--
-- Checked before applying, in a transaction rolled back: 36 users (each role in
-- a hospital with a department and in a demo hospital without one, a
-- department user with Quality and laboratory access, someone outside, the
-- platform owner, a hospital administrator) read every one of the 153 tables
-- with read policies before and after the change: the same rows (count and
-- hash of row ids) in all 5,508 cases. Reading the 12 largest tables for all
-- of them took 220 s before and 1.5 s after.

-- The organizations a check holds for, worked out once per query. Each check
-- is asked for the organizations it can hold for (all of them for the platform
-- owner; otherwise those the user is an active member of, since every check
-- needs an active membership), so the array is exactly the set the check
-- would answer yes for, row by row.
create or replace function private.fast_candidate_orgs()
returns setof uuid language sql stable security definer set search_path = ''
as $$
  select o.id from public.organizations o where public.current_user_is_platform_owner()
  union
  select om.organization_id from public.organization_members om where om.user_id = auth.uid() and om.status = 'active';
$$;
revoke all on function private.fast_candidate_orgs() from public, anon;
grant execute on function private.fast_candidate_orgs() to authenticated;

-- is_org_member
create or replace function private.fast_orgs_member()
returns uuid[] language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(o.id), '{}') from private.fast_candidate_orgs() as o(id) where public.is_org_member(o.id);
$$;
revoke all on function private.fast_orgs_member() from public, anon;
grant execute on function private.fast_orgs_member() to authenticated;

-- is_org_admin
create or replace function private.fast_orgs_admin()
returns uuid[] language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(o.id), '{}') from private.fast_candidate_orgs() as o(id) where public.is_org_admin(o.id);
$$;
revoke all on function private.fast_orgs_admin() from public, anon;
grant execute on function private.fast_orgs_admin() to authenticated;

-- current_user_has_org_role (and has_org_role, the same check)
create or replace function private.fast_orgs_role(p_roles public.app_role[])
returns uuid[] language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(o.id), '{}') from private.fast_candidate_orgs() as o(id) where public.current_user_has_org_role(o.id, p_roles);
$$;
revoke all on function private.fast_orgs_role(public.app_role[]) from public, anon;
grant execute on function private.fast_orgs_role(public.app_role[]) to authenticated;

-- current_user_has_capability
create or replace function private.fast_orgs_capability(p_capability text)
returns uuid[] language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(o.id), '{}') from private.fast_candidate_orgs() as o(id) where public.current_user_has_capability(o.id, p_capability);
$$;
revoke all on function private.fast_orgs_capability(text) from public, anon;
grant execute on function private.fast_orgs_capability(text) to authenticated;

-- current_user_has_governance_capability
create or replace function private.fast_orgs_governance(p_capability text)
returns uuid[] language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(o.id), '{}') from private.fast_candidate_orgs() as o(id) where public.current_user_has_governance_capability(o.id, p_capability);
$$;
revoke all on function private.fast_orgs_governance(text) from public, anon;
grant execute on function private.fast_orgs_governance(text) to authenticated;

-- current_user_is_demo_admin
create or replace function private.fast_orgs_demo_admin()
returns uuid[] language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(o.id), '{}') from private.fast_candidate_orgs() as o(id) where public.current_user_is_demo_admin(o.id);
$$;
revoke all on function private.fast_orgs_demo_admin() from public, anon;
grant execute on function private.fast_orgs_demo_admin() to authenticated;

-- current_user_can_use_recycle_bin
create or replace function private.fast_orgs_recycle_bin(p_module text)
returns uuid[] language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(o.id), '{}') from private.fast_candidate_orgs() as o(id) where public.current_user_can_use_recycle_bin(o.id, p_module);
$$;
revoke all on function private.fast_orgs_recycle_bin(text) from public, anon;
grant execute on function private.fast_orgs_recycle_bin(text) to authenticated;

-- private.can_manage_regulations
create or replace function private.fast_orgs_regulation_managers()
returns uuid[] language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(o.id), '{}') from private.fast_candidate_orgs() as o(id) where private.can_manage_regulations(o.id);
$$;
revoke all on function private.fast_orgs_regulation_managers() from public, anon;
grant execute on function private.fast_orgs_regulation_managers() to authenticated;

-- private.next_is_active_org_member
create or replace function private.fast_orgs_active_member()
returns uuid[] language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(o.id), '{}') from private.fast_candidate_orgs() as o(id) where private.next_is_active_org_member(o.id);
$$;
revoke all on function private.fast_orgs_active_member() from public, anon;
grant execute on function private.fast_orgs_active_member() to authenticated;

-- The rewrite of a read policy (see above).
create or replace function private.rls_fast_text(q text)
returns text language sql immutable set search_path = ''
as $f$ select regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(q, $p$(?<![\w.])(?:public\.)?can_view_surveillance_record\(([\w.]+), ([\w.]+)\)$p$, $r$(current_user_is_platform_owner() OR current_user_has_org_role(\1, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role]) OR (current_user_has_org_role(\1, ARRAY['department_manager'::app_role]) AND (\2) IS NOT NULL AND current_user_has_department_scope(\1, \2)))$r$, 'g'), $p$(?<![\w.])(?:public\.)?current_user_can_access_control_department\(([\w.]+), ([\w.]+)\)$p$, $r$(current_user_is_platform_owner() OR (current_user_has_org_role(\1, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'laboratory'::app_role, 'quality_manager'::app_role]) OR ((\2) IS NOT NULL AND current_user_has_department_scope(\1, \2))))$r$, 'g'), $p$(?<![\w.])(?:public\.)?current_user_can_read_hand_hygiene\(([\w.]+), ([\w.]+)\)$p$, $r$(current_user_is_platform_owner() OR is_org_admin(\1) OR current_user_has_org_role(\1, ARRAY['infection_control_lead'::app_role, 'infection_control_member'::app_role]) OR ((\2) IS NOT NULL AND current_user_has_department_scope(\1, \2) AND (current_user_has_capability(\1, 'record_hand_hygiene'::text) OR current_user_has_capability(\1, 'hand_hygiene_observer'::text))))$r$, 'g'), $p$(?<![\w.])(?:public\.)?current_user_can_read_waste\(([\w.]+), ([\w.]+)\)$p$, $r$(current_user_is_platform_owner() OR is_org_admin(\1) OR current_user_has_org_role(\1, ARRAY['infection_control_lead'::app_role, 'infection_control_member'::app_role]) OR ((\2) IS NOT NULL AND current_user_has_department_scope(\1, \2) AND (current_user_has_capability(\1, 'record_waste'::text) OR current_user_has_capability(\1, 'waste_management'::text))))$r$, 'g'), $p$(?<![\w.])(?:public\.)?current_user_can_read_antiseptic\(([\w.]+), ([\w.]+)\)$p$, $r$(current_user_is_platform_owner() OR is_org_admin(\1) OR current_user_has_org_role(\1, ARRAY['infection_control_lead'::app_role, 'infection_control_member'::app_role]) OR ((\2) IS NOT NULL AND current_user_has_department_scope(\1, \2) AND current_user_has_capability(\1, 'record_antiseptic'::text)))$r$, 'g'), $p$(?<![\w.])(?:public\.)?current_user_can_read_pharmacy_consumption\(([\w.]+), ([\w.]+)\)$p$, $r$(current_user_is_platform_owner() OR is_org_admin(\1) OR current_user_has_org_role(\1, ARRAY['infection_control_lead'::app_role, 'infection_control_member'::app_role]) OR ((\2) IS NOT NULL AND current_user_has_department_scope(\1, \2) AND current_user_has_capability(\1, 'record_pharmacy'::text)))$r$, 'g'), $p$(?<![\w.])(?:public\.)?current_user_can_read_prevalence_survey\(([\w.]+), ([\w.]+)\)$p$, $r$(current_user_is_platform_owner() OR is_org_admin(\1) OR current_user_has_org_role(\1, ARRAY['infection_control_lead'::app_role, 'infection_control_member'::app_role]) OR ((\2) IS NOT NULL AND current_user_has_department_scope(\1, \2) AND current_user_has_capability(\1, 'record_prevalence_survey'::text)))$r$, 'g'), $p$(?<![\w.])(?:public\.)?current_user_can_read_prevention_bundle\(([\w.]+), ([\w.]+)\)$p$, $r$(current_user_is_platform_owner() OR is_org_admin(\1) OR current_user_has_org_role(\1, ARRAY['infection_control_lead'::app_role, 'infection_control_member'::app_role]) OR ((\2) IS NOT NULL AND current_user_has_department_scope(\1, \2) AND current_user_has_capability(\1, 'record_prevention_bundle'::text)))$r$, 'g'), $p$(?<![\w.])(?:public\.)?current_user_has_department_scope\(([\w.]+), ([\w.]+)\)$p$, $r$COALESCE((((\1)::text || ':'::text) || (\2)::text) = ANY ((SELECT private.current_user_department_scopes())::text[]), false)$r$, 'g'), $p$(?<![\w.])(?:public\.)?is_org_member\(([\w.]+)\)$p$, $r$((SELECT current_user_is_platform_owner()) OR COALESCE((\1) = ANY ((SELECT private.fast_orgs_member())::uuid[]), false))$r$, 'g'), $p$(?<![\w.])(?:public\.)?is_org_admin\(([\w.]+)\)$p$, $r$((SELECT current_user_is_platform_owner()) OR COALESCE((\1) = ANY ((SELECT private.fast_orgs_admin())::uuid[]), false))$r$, 'g'), $p$(?<![\w.])(?:public\.)?current_user_has_org_role\(([\w.]+), (ARRAY\[[^]]*\])\)$p$, $r$((SELECT current_user_is_platform_owner()) OR COALESCE((\1) = ANY ((SELECT private.fast_orgs_role(\2))::uuid[]), false))$r$, 'g'), $p$(?<![\w.])(?:public\.)?has_org_role\(([\w.]+), (ARRAY\[[^]]*\])\)$p$, $r$((SELECT current_user_is_platform_owner()) OR COALESCE((\1) = ANY ((SELECT private.fast_orgs_role(\2))::uuid[]), false))$r$, 'g'), $p$(?<![\w.])(?:public\.)?current_user_has_capability\(([\w.]+), ('[^']*'::text)\)$p$, $r$((SELECT current_user_is_platform_owner()) OR COALESCE((\1) = ANY ((SELECT private.fast_orgs_capability(\2))::uuid[]), false))$r$, 'g'), $p$(?<![\w.])(?:public\.)?current_user_has_governance_capability\(([\w.]+), ('[^']*'::text)\)$p$, $r$((SELECT current_user_is_platform_owner()) OR COALESCE((\1) = ANY ((SELECT private.fast_orgs_governance(\2))::uuid[]), false))$r$, 'g'), $p$(?<![\w.])(?:public\.)?current_user_is_demo_admin\(([\w.]+)\)$p$, $r$COALESCE((\1) = ANY ((SELECT private.fast_orgs_demo_admin())::uuid[]), false)$r$, 'g'), $p$(?<![\w.])private\.can_manage_regulations\(([\w.]+)\)$p$, $r$((SELECT current_user_is_platform_owner()) OR COALESCE((\1) = ANY ((SELECT private.fast_orgs_regulation_managers())::uuid[]), false))$r$, 'g'), $p$(?<![\w.])private\.next_is_active_org_member\(([\w.]+)\)$p$, $r$COALESCE((\1) = ANY ((SELECT private.fast_orgs_active_member())::uuid[]), false)$r$, 'g'), $p$(?<!SELECT )(?<![\w.])current_user_is_platform_owner\(\)$p$, $r$(SELECT current_user_is_platform_owner())$r$, 'g'), $p$(?<!SELECT )(?<![\w.])private\.next_is_platform_owner\(\)$p$, $r$(SELECT private.next_is_platform_owner())$r$, 'g'), $p$(?<!SELECT )(?<![\w.])auth\.uid\(\)$p$, $r$(SELECT auth.uid())$r$, 'g') $f$;
revoke all on function private.rls_fast_text(text) from public, anon, authenticated;


-- The read policies, rewritten.
do $$
declare pol record;
begin
  for pol in select tablename, policyname, qual from pg_policies where schemaname = 'public' and cmd in ('SELECT','ALL') and qual is not null and private.rls_fast_text(qual) <> qual loop
    execute format('alter policy %I on public.%I using (%s)', pol.policyname, pol.tablename, private.rls_fast_text(pol.qual));
  end loop;
end
$$;
