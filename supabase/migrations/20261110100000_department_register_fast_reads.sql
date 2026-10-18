-- Department registers: reading a register's data checks access once per
-- query instead of once per row. A register's rows all belong to the
-- register's organization and department (private.register_row_scope sets
-- them), so asking about the register is the same as asking about each row;
-- in a scalar subquery the database asks once. With 3,500 cases a read went
-- from about half a second of policy checks to next to nothing.
--
-- private.register_can_read(id)           Quality, the administration, the infection
--                                         control lead, view_quality, or the register's department.
-- private.register_can_read_identity(id)  the register's department (and the platform owner):
--                                         who the cases are, as before.
-- private.register_fast_policies(id)      points the read policies of a register's
--                                         tables at the two checks.
-- public.department_register_fast_reads(id) the same, for the app to call after
--                                         department_register_sync creates or extends a register.
-- Writing keeps its row-by-row checks.

create or replace function private.register_can_read(p_register_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.department_registers r where r.id = p_register_id and (
    public.current_user_is_platform_owner()
    or public.current_user_has_org_role(r.organization_id, array['hospital_admin'::public.app_role,'quality_manager'::public.app_role,'infection_control_lead'::public.app_role])
    or public.current_user_has_capability(r.organization_id, 'view_quality')
    or (r.department_id is not null and public.current_user_has_department_scope(r.organization_id, r.department_id))));
$$;
revoke all on function private.register_can_read(uuid) from public, anon;
grant execute on function private.register_can_read(uuid) to authenticated;

create or replace function private.register_can_read_identity(p_register_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.department_registers r where r.id = p_register_id and (
    public.current_user_is_platform_owner()
    or (r.department_id is not null and public.current_user_has_department_scope(r.organization_id, r.department_id))));
$$;
revoke all on function private.register_can_read_identity(uuid) from public, anon;
grant execute on function private.register_can_read_identity(uuid) to authenticated;

create or replace function private.register_fast_policies(p_register_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare r record;
begin
  select id, table_name, kind into r from public.department_registers where id = p_register_id;
  if r.table_name is null then return; end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = r.table_name and policyname = 'register_read') then
    execute format('alter policy register_read on public.%I using ((select private.register_can_read(%L::uuid)))', r.table_name, r.id);
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = r.table_name || '_identity' and policyname = 'register_identity_department') then
    execute format('alter policy register_identity_department on public.%I using ((select private.register_can_read_identity(%L::uuid)))', r.table_name || '_identity', r.id);
  end if;
end;
$$;
revoke all on function private.register_fast_policies(uuid) from public, anon, authenticated;

-- Called by the app right after department_register_sync, by whoever may define
-- registers (the same check as department_register_sync).
create or replace function public.department_register_fast_reads(p_register_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.department_registers where id = p_register_id;
  if v_org is null then raise exception 'Unknown register'; end if;
  if not (public.current_user_is_platform_owner()
    or public.current_user_has_org_role(v_org, array['hospital_admin'::public.app_role,'quality_manager'::public.app_role])
    or public.current_user_has_capability(v_org, 'manage_quality')) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  perform private.register_fast_policies(p_register_id);
end;
$$;
revoke all on function public.department_register_fast_reads(uuid) from public, anon;
grant execute on function public.department_register_fast_reads(uuid) to authenticated;

-- The registers that exist already.
do $$
declare r record;
begin
  for r in select id from public.department_registers where table_name is not null loop
    perform private.register_fast_policies(r.id);
  end loop;
end
$$;
