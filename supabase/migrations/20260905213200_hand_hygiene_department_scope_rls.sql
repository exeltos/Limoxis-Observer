create or replace function public.current_user_can_read_hand_hygiene(target_org uuid,target_department uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.current_user_is_platform_owner()
    or public.is_org_admin(target_org)
    or public.current_user_has_org_role(target_org,array['infection_control_lead','infection_control_member']::public.app_role[])
    or (target_department is not null and public.current_user_has_department_scope(target_org,target_department) and (public.current_user_has_capability(target_org,'view_prevention') or public.current_user_has_capability(target_org,'record_hand_hygiene') or public.current_user_has_capability(target_org,'hand_hygiene_observer')));
$$;
create or replace function public.current_user_can_write_hand_hygiene(target_org uuid,target_department uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.current_user_is_platform_owner()
    or public.is_org_admin(target_org)
    or public.current_user_has_org_role(target_org,array['infection_control_lead','infection_control_member']::public.app_role[])
    or (target_department is not null and public.current_user_has_department_scope(target_org,target_department) and (public.current_user_has_capability(target_org,'record_hand_hygiene') or public.current_user_has_capability(target_org,'hand_hygiene_observer')));
$$;
drop policy if exists hand_hygiene_read on public.hand_hygiene_sessions;
create policy hand_hygiene_read on public.hand_hygiene_sessions for select using (public.current_user_can_read_hand_hygiene(organization_id,department_id));
drop policy if exists hand_hygiene_write on public.hand_hygiene_sessions;
create policy hand_hygiene_write on public.hand_hygiene_sessions for all using (public.current_user_can_write_hand_hygiene(organization_id,department_id)) with check (public.current_user_can_write_hand_hygiene(organization_id,department_id));
drop policy if exists hand_hygiene_observations_read on public.hand_hygiene_observations;
create policy hand_hygiene_observations_read on public.hand_hygiene_observations for select using (exists (select 1 from public.hand_hygiene_sessions s where s.id=session_id and s.organization_id=organization_id and public.current_user_can_read_hand_hygiene(s.organization_id,s.department_id)));
drop policy if exists hand_hygiene_observations_write on public.hand_hygiene_observations;
create policy hand_hygiene_observations_write on public.hand_hygiene_observations for all using (exists (select 1 from public.hand_hygiene_sessions s where s.id=session_id and s.organization_id=organization_id and public.current_user_can_write_hand_hygiene(s.organization_id,s.department_id))) with check (exists (select 1 from public.hand_hygiene_sessions s where s.id=session_id and s.organization_id=organization_id and public.current_user_can_write_hand_hygiene(s.organization_id,s.department_id)));
