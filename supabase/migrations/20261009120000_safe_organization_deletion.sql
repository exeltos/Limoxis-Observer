-- Limoxis Observer — one safe path for deleting organizations (Demo or real).
--
-- Before: platform_purge_organization_tx(uuid,text) could be called straight
-- from /rest/v1/rpc (skipping the password re-check in the Edge Function), a
-- Platform Owner could also DELETE /rest/v1/organizations directly (no audit,
-- no account or storage cleanup), and the single `delete from organizations`
-- relied on ON DELETE CASCADE, which stops on the patient_id RESTRICT keys and
-- on the finalized-AST guard.
--
-- After:
--   * deleting goes only through the platform-delete-organizations Edge
--     Function: it re-checks the owner's password, then issues a single-use
--     ticket (platform_purge_tickets, service role only) that the purge RPC
--     consumes; a direct RPC call without a ticket is refused;
--   * the DELETE policy and DELETE grant on organizations are removed;
--   * the purge deletes the organization's rows table by table, retrying in
--     passes until the RESTRICT / NO ACTION keys are satisfied, with the AST
--     guard's reset switch on, and returns the storage objects to remove;
--   * a real (non-Demo) organization must be suspended before it is deleted;
--   * platform_organization_deletion_impact() shows what a deletion removes.

-- 1. Single-use deletion tickets ----------------------------------------------
create table if not exists public.platform_purge_tickets (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  consumed_at timestamptz
);
create index if not exists platform_purge_tickets_actor_idx on public.platform_purge_tickets(actor_user_id, created_at desc);

alter table public.platform_purge_tickets enable row level security;
-- No policies: only the service role (Edge Function) reads or writes tickets.
revoke all on table public.platform_purge_tickets from anon, authenticated;
grant select, insert, update, delete on table public.platform_purge_tickets to service_role;

-- Failed password re-checks, so the Edge Function can rate-limit them.
create table if not exists public.platform_reauth_failures (
  id bigint generated always as identity primary key,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists platform_reauth_failures_actor_idx on public.platform_reauth_failures(actor_user_id, created_at desc);
alter table public.platform_reauth_failures enable row level security;
revoke all on table public.platform_reauth_failures from anon, authenticated;
grant select, insert, delete on table public.platform_reauth_failures to service_role;

-- 2. Tables that hold an organization's rows -----------------------------------
create or replace function private.organization_data_tables()
returns setof regclass
language sql
stable
security definer
set search_path = ''
as $function$
  select c.oid::regclass
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  join pg_catalog.pg_attribute a on a.attrelid = c.oid and a.attname = 'organization_id' and not a.attisdropped
  where n.nspname = 'public'
    and c.relkind in ('r','p')
    and c.relname not in ('organizations','system_audit_log','platform_purge_tickets')
  order by c.relname
$function$;

revoke all on function private.organization_data_tables() from public, anon, authenticated;

-- 3. Impact preview ------------------------------------------------------------
create or replace function public.platform_organization_deletion_impact(p_organization_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_org public.organizations%rowtype;
  v_table regclass;
  v_count bigint;
  v_records bigint;
  v_system_records bigint;
  v_result jsonb := '[]'::jsonb;
  v_files bigint;
  v_bytes bigint;
  v_members integer;
  v_accounts_deleted integer;
  v_children integer;
  v_blockers text[];
begin
  if v_actor is null or not exists (
    select 1 from public.profiles p where p.id = v_actor and coalesce(p.is_platform_owner,false)
  ) then
    raise exception 'Platform Owner access required' using errcode = '42501';
  end if;

  for v_org in
    select o.* from public.organizations o where o.id = any(coalesce(p_organization_ids, array[]::uuid[])) order by o.name
  loop
    v_records := 0;
    for v_table in select * from private.organization_data_tables() loop
      execute format('select count(*) from %s where organization_id = $1', v_table) into v_count using v_org.id;
      v_records := v_records + v_count;
    end loop;

    -- System library rows seeded into every new organization, shown apart so
    -- an empty Demo does not look like it holds data.
    select count(*) into v_system_records
    from public.master_library_items m
    where m.organization_id = v_org.id and coalesce(m.metadata->>'system','false') = 'true';

    select count(*), coalesce(sum(coalesce((so.metadata->>'size')::bigint,0)),0)
      into v_files, v_bytes
    from storage.objects so
    where so.bucket_id in ('attachments','laboratory-attachments')
      and so.name like v_org.id::text || '/%';

    select count(distinct om.user_id) into v_members
    from public.organization_members om where om.organization_id = v_org.id;

    -- Same rule the Edge Function applies after the purge: an account is
    -- removed only when it belongs to no other organization and is not a
    -- Platform Owner.
    select count(distinct om.user_id) into v_accounts_deleted
    from public.organization_members om
    left join public.profiles p on p.id = om.user_id
    where om.organization_id = v_org.id
      and om.user_id is not null
      and om.user_id <> v_actor
      and not coalesce(p.is_platform_owner,false)
      and not exists (
        select 1 from public.organization_members other
        where other.user_id = om.user_id and other.organization_id <> v_org.id
          and not (other.organization_id = any(p_organization_ids))
      );

    select count(*) into v_children from public.organizations c where c.parent_id = v_org.id;

    v_blockers := array[]::text[];
    if v_children > 0 then v_blockers := array_append(v_blockers, 'has_children'); end if;
    if not v_org.is_demo and v_org.status <> 'suspended' then v_blockers := array_append(v_blockers, 'not_suspended'); end if;

    v_result := v_result || jsonb_build_object(
      'organizationId', v_org.id,
      'name', v_org.name,
      'code', v_org.code,
      'isDemo', v_org.is_demo,
      'status', v_org.status,
      'records', greatest(v_records - v_system_records, 0),
      'systemRecords', v_system_records,
      'files', v_files,
      'bytes', v_bytes,
      'members', v_members,
      'accountsDeleted', v_accounts_deleted,
      'accountsKept', greatest(v_members - v_accounts_deleted, 0),
      'blockers', to_jsonb(v_blockers)
    );
  end loop;

  return v_result;
end;
$function$;

revoke all on function public.platform_organization_deletion_impact(uuid[]) from public, anon;
grant execute on function public.platform_organization_deletion_impact(uuid[]) to authenticated, service_role;

-- 4. Purge ---------------------------------------------------------------------
drop function if exists public.platform_purge_organization_tx(uuid, text);

create or replace function public.platform_purge_organization_tx(
  p_organization_id uuid,
  p_confirmation text,
  p_ticket uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_org public.organizations%rowtype;
  v_children integer := 0;
  v_user_ids uuid[] := array[]::uuid[];
  v_objects jsonb := '[]'::jsonb;
  v_table regclass;
  v_count bigint;
  v_records bigint := 0;
  v_remaining bigint;
  v_pass integer;
  v_last_error text;
  v_errors jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_actor and coalesce(p.is_platform_owner,false) = true
  ) then
    raise exception 'Platform Owner access required' using errcode = '42501';
  end if;

  -- The ticket is issued by the Edge Function only after the owner's password
  -- has been re-checked, and it can be used once, for this organization only.
  update public.platform_purge_tickets t
     set consumed_at = now()
   where t.id = p_ticket
     and t.actor_user_id = v_actor
     and t.organization_id = p_organization_id
     and t.consumed_at is null
     and t.expires_at > now();
  if not found then
    raise exception 'Deletion ticket invalid or expired' using errcode = '42501';
  end if;

  select * into v_org from public.organizations where id = p_organization_id for update;
  if not found then
    raise exception 'Organization not found' using errcode = 'P0002';
  end if;

  if upper(trim(coalesce(p_confirmation,''))) <> upper(trim(v_org.code)) then
    raise exception 'Confirmation code mismatch' using errcode = '22023';
  end if;

  select count(*) into v_children from public.organizations where parent_id = p_organization_id;
  if v_children > 0 then
    raise exception 'Organization has child organizations' using errcode = '23503';
  end if;

  if not v_org.is_demo and v_org.status <> 'suspended' then
    raise exception 'Organization must be suspended before deletion' using errcode = '55000';
  end if;

  select coalesce(array_agg(distinct om.user_id) filter (where om.user_id is not null), array[]::uuid[])
    into v_user_ids
  from public.organization_members om
  where om.organization_id = p_organization_id;

  select coalesce(jsonb_agg(jsonb_build_object('bucket', so.bucket_id, 'name', so.name)), '[]'::jsonb)
    into v_objects
  from storage.objects so
  where so.bucket_id in ('attachments','laboratory-attachments')
    and so.name like p_organization_id::text || '/%';

  for v_table in select * from private.organization_data_tables() loop
    execute format('select count(*) from %s where organization_id = $1', v_table) into v_count using p_organization_id;
    v_records := v_records + v_count;
  end loop;

  -- Lets the finalized-AST guard step aside for this transaction only.
  perform set_config('limoxis.test_reset', 'on', true);

  -- A superseding outbreak review points at the one it replaces with ON DELETE
  -- RESTRICT, which is checked row by row: remove the newest reviews first.
  if to_regclass('public.lira_outbreak_case_reviews') is not null then
    for v_pass in 1..50 loop
      delete from public.lira_outbreak_case_reviews r
       where r.organization_id = p_organization_id
         and not exists (
           select 1 from public.lira_outbreak_case_reviews s
           where s.supersedes_review_id = r.id
         );
      exit when not found;
    end loop;
  end if;

  -- Delete table by table. A delete that a RESTRICT / NO ACTION key or a
  -- guard trigger refuses is retried in the next pass, once the rows that
  -- referenced it are gone.
  for v_pass in 1..25 loop
    v_remaining := 0;
    v_errors := '{}'::jsonb;
    for v_table in select * from private.organization_data_tables() loop
      begin
        execute format('delete from %s where organization_id = $1', v_table) using p_organization_id;
      exception when others then
        get stacked diagnostics v_last_error = message_text;
        v_errors := v_errors || jsonb_build_object(v_table::text, v_last_error);
      end;
    end loop;
    for v_table in select * from private.organization_data_tables() loop
      execute format('select count(*) from %s where organization_id = $1', v_table) into v_count using p_organization_id;
      v_remaining := v_remaining + v_count;
    end loop;
    exit when v_remaining = 0;
  end loop;

  if v_remaining > 0 then
    raise exception 'Organization data could not be removed completely: %', v_errors::text using errcode = '55000';
  end if;

  delete from public.organizations where id = p_organization_id;

  perform set_config('limoxis.test_reset', 'off', true);

  insert into public.system_audit_log(
    actor_user_id, actor_role, event_type, entity_type, entity_id, metadata
  ) values (
    v_actor, 'platform_owner'::public.app_role, 'platform.organization.purged', 'organization', p_organization_id,
    jsonb_build_object(
      'organization_name', v_org.name,
      'organization_code', v_org.code,
      'is_demo', v_org.is_demo,
      'records', v_records,
      'files', jsonb_array_length(v_objects),
      'members', coalesce(array_length(v_user_ids, 1), 0)
    )
  );

  return jsonb_build_object(
    'ok', true,
    'organizationId', p_organization_id,
    'organizationCode', v_org.code,
    'organizationName', v_org.name,
    'isDemo', v_org.is_demo,
    'records', v_records,
    'userIds', to_jsonb(v_user_ids),
    'storageObjects', v_objects
  );
end;
$function$;

revoke all on function public.platform_purge_organization_tx(uuid, text, uuid) from public, anon;
grant execute on function public.platform_purge_organization_tx(uuid, text, uuid) to authenticated, service_role;

-- 5. Close the direct-delete paths ----------------------------------------------
drop policy if exists organizations_platform_owner_delete on public.organizations;
revoke delete on table public.organizations from anon, authenticated;
