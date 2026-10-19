-- Isolation is also recorded by the departments: the Department Manager and the
-- Link Nurse start, review and end isolation for patients of their own
-- departments (organization_member_scopes). The Hospital Admin, who the app
-- already lets record isolation, is now allowed by the database too. Deleting
-- stays with the infection control team.

alter policy isolation_episodes_read on public.isolation_episodes using (
  (select public.current_user_is_platform_owner())
  or coalesce(organization_id = any((select private.fast_orgs_role(array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]))::uuid[]), false)
  or (
    coalesce(organization_id = any((select private.fast_orgs_role(array['department_manager','link_nurse']::public.app_role[]))::uuid[]), false)
    and department_id is not null
    and coalesce((organization_id::text || ':' || department_id::text) = any((select private.current_user_department_scopes())::text[]), false)
  )
);

alter policy isolation_episodes_insert on public.isolation_episodes with check (
  (select public.current_user_is_platform_owner())
  or coalesce(organization_id = any((select private.fast_orgs_role(array['hospital_admin','infection_control_lead','infection_control_member']::public.app_role[]))::uuid[]), false)
  or (
    coalesce(organization_id = any((select private.fast_orgs_role(array['department_manager','link_nurse']::public.app_role[]))::uuid[]), false)
    and department_id is not null
    and coalesce((organization_id::text || ':' || department_id::text) = any((select private.current_user_department_scopes())::text[]), false)
  )
);

alter policy isolation_episodes_update on public.isolation_episodes
using (
  (select public.current_user_is_platform_owner())
  or coalesce(organization_id = any((select private.fast_orgs_role(array['hospital_admin','infection_control_lead','infection_control_member']::public.app_role[]))::uuid[]), false)
  or (
    coalesce(organization_id = any((select private.fast_orgs_role(array['department_manager','link_nurse']::public.app_role[]))::uuid[]), false)
    and department_id is not null
    and coalesce((organization_id::text || ':' || department_id::text) = any((select private.current_user_department_scopes())::text[]), false)
  )
)
with check (
  (select public.current_user_is_platform_owner())
  or coalesce(organization_id = any((select private.fast_orgs_role(array['hospital_admin','infection_control_lead','infection_control_member']::public.app_role[]))::uuid[]), false)
  or (
    coalesce(organization_id = any((select private.fast_orgs_role(array['department_manager','link_nurse']::public.app_role[]))::uuid[]), false)
    and department_id is not null
    and coalesce((organization_id::text || ':' || department_id::text) = any((select private.current_user_department_scopes())::text[]), false)
  )
);

-- Precautions follow their isolation episode: whoever may write the episode
-- (row visible to them and in their scope) may write its precautions.
alter policy isolation_episode_precautions_insert on public.isolation_episode_precautions with check (
  (select public.current_user_is_platform_owner())
  or (organization_id = any((select private.fast_orgs_role(array['hospital_admin','infection_control_lead','infection_control_member']::public.app_role[]))::uuid[]))
  or exists (
    select 1 from public.isolation_episodes p
    where p.id = isolation_episode_precautions.isolation_episode_id
      and p.organization_id = isolation_episode_precautions.organization_id
      and coalesce(p.organization_id = any((select private.fast_orgs_role(array['department_manager','link_nurse']::public.app_role[]))::uuid[]), false)
      and p.department_id is not null
      and coalesce((p.organization_id::text || ':' || p.department_id::text) = any((select private.current_user_department_scopes())::text[]), false)
  )
);

alter policy isolation_episode_precautions_update on public.isolation_episode_precautions
using (
  (select public.current_user_is_platform_owner())
  or (organization_id = any((select private.fast_orgs_role(array['hospital_admin','infection_control_lead','infection_control_member']::public.app_role[]))::uuid[]))
  or exists (
    select 1 from public.isolation_episodes p
    where p.id = isolation_episode_precautions.isolation_episode_id
      and p.organization_id = isolation_episode_precautions.organization_id
      and coalesce(p.organization_id = any((select private.fast_orgs_role(array['department_manager','link_nurse']::public.app_role[]))::uuid[]), false)
      and p.department_id is not null
      and coalesce((p.organization_id::text || ':' || p.department_id::text) = any((select private.current_user_department_scopes())::text[]), false)
  )
)
with check (
  (select public.current_user_is_platform_owner())
  or (organization_id = any((select private.fast_orgs_role(array['hospital_admin','infection_control_lead','infection_control_member']::public.app_role[]))::uuid[]))
  or exists (
    select 1 from public.isolation_episodes p
    where p.id = isolation_episode_precautions.isolation_episode_id
      and p.organization_id = isolation_episode_precautions.organization_id
      and coalesce(p.organization_id = any((select private.fast_orgs_role(array['department_manager','link_nurse']::public.app_role[]))::uuid[]), false)
      and p.department_id is not null
      and coalesce((p.organization_id::text || ':' || p.department_id::text) = any((select private.current_user_department_scopes())::text[]), false)
  )
);
