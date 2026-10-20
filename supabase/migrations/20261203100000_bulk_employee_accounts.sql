-- N1 · Bulk creation of user accounts from a hospital's employee roster
-- (Platform Owner only). The Platform Owner picks employees of one hospital who
-- have no account, gives each a role (and a department for the department
-- roles), and the Edge Function platform-bulk-create-accounts creates the
-- accounts, links them to the employees and e-mails each person a personal
-- «Ορισμός κωδικού» link valid 7 days (own token in account_invitations,
-- SHA-256 only, single use), redeemed by the public redeem-access-token.
--
-- New objects only:
--   account_creation_batches   one row per bulk run; batch_key (from the client)
--                              is unique, so a double click or a network retry
--                              gets the same batch back.
--   account_creation_items     one row per person of a run; at most one
--                              queued/created/linked item per employee
--                              (partial unique index): never two accounts for
--                              the same employee, even from two runs at once.
--   access_token_attempts      what the public redeem endpoint was asked, for
--                              its rate limits (per IP, per token); service role only.
--   platform_employee_accounts(org)        the roster with each employee's
--                              account state (Platform Owner only).
--   platform_account_item_link(...)        links one created account to its
--                              employee in one transaction, under row locks
--                              (service role only).
--   platform_access_token_redeem(...)      spends an activation token once and
--                              activates the membership (service role only).
--   platform_accounts_dispatch_send()      asks the scheduler to send the
--                              outbox now (service role only).

create table if not exists public.account_creation_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  batch_key uuid not null unique,
  created_by uuid references auth.users(id) on delete set null,
  status text not null default 'running' check (status in ('running', 'finished')),
  total integer not null default 0,
  created_count integer not null default 0,
  linked_count integer not null default 0,
  failed_count integer not null default 0,
  summary_sent_at timestamptz,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists account_creation_batches_org_idx on public.account_creation_batches (organization_id, created_at desc);
create index if not exists account_creation_batches_created_by_idx on public.account_creation_batches (created_by, created_at desc);

create table if not exists public.account_creation_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.account_creation_batches(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  role public.app_role not null,
  department_id uuid references public.departments(id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'created', 'linked_existing', 'failed')),
  error_code text,
  user_id uuid references auth.users(id) on delete set null,
  invitation_id uuid references public.account_invitations(id) on delete set null,
  username text,
  send_count integer not null default 0,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, employee_id)
);
-- Never two accounts for the same employee: one live item per employee.
create unique index if not exists account_creation_items_employee_live
  on public.account_creation_items (employee_id) where status in ('queued', 'created', 'linked_existing');
create index if not exists account_creation_items_org_idx on public.account_creation_items (organization_id, created_at desc);
create index if not exists account_creation_items_user_idx on public.account_creation_items (user_id);
create index if not exists account_creation_items_invitation_idx on public.account_creation_items (invitation_id);
create index if not exists account_creation_items_department_idx on public.account_creation_items (department_id);

create table if not exists public.access_token_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  invitation_id uuid references public.account_invitations(id) on delete cascade,
  action text not null check (action in ('inspect', 'activate')),
  success boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists access_token_attempts_ip_idx on public.access_token_attempts (ip_hash, created_at desc);
create index if not exists access_token_attempts_invitation_idx on public.access_token_attempts (invitation_id, created_at desc);

alter table public.account_creation_batches enable row level security;
alter table public.account_creation_items enable row level security;
alter table public.access_token_attempts enable row level security;

-- The Platform Owner reads the runs; writes go through the Edge Function (service role).
create policy account_creation_batches_owner_read on public.account_creation_batches
  for select to authenticated using ((select public.current_user_is_platform_owner()));
create policy account_creation_items_owner_read on public.account_creation_items
  for select to authenticated using ((select public.current_user_is_platform_owner()));
-- access_token_attempts: no policy, service role only.

revoke all on public.account_creation_batches from anon;
revoke all on public.account_creation_items from anon;
revoke all on public.access_token_attempts from anon, authenticated;

-- The roster of one hospital with each active employee's account state, for the
-- Platform Owner's «Εργαζόμενοι χωρίς λογαριασμό». blocked_reason locks a row:
--   missing_email, invalid_email (no address form, or a reserved .invalid one),
--   duplicate_email (the same address on two employees here),
--   email_in_this_org (the address already belongs to a member here, unlinked).
-- existing_* names an account with that address in another organization: no
-- second account is made, the owner confirms each such person.
create or replace function public.platform_employee_accounts(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not public.current_user_is_platform_owner() then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;

  with emp as (
    select e.id, e.user_id, e.department_id,
      btrim(concat_ws(' ', e.first_name, e.last_name)) as full_name,
      coalesce(e.profession_name, e.position_name) as profession_name,
      coalesce(d.name, e.department_name) as department_name,
      nullif(lower(btrim(coalesce(e.email, ''))), '') as email
    from public.employees e
    left join public.departments d on d.id = e.department_id
    where e.organization_id = p_organization_id and e.employment_status = 'active'
  ),
  dup as (
    select email from emp where email is not null group by email having count(*) > 1
  ),
  latest_item as (
    select distinct on (i.employee_id) i.employee_id, i.id, i.batch_id, i.status, i.error_code, i.role, i.department_id, i.send_count, i.last_sent_at, i.created_at
    from public.account_creation_items i
    where i.organization_id = p_organization_id
    order by i.employee_id, i.created_at desc
  ),
  latest_invite as (
    select distinct on (a.user_id) a.user_id, a.id, a.created_at, a.expires_at, a.accepted_at, a.revoked_at
    from public.account_invitations a
    where a.organization_id = p_organization_id
    order by a.user_id, a.created_at desc
  ),
  roster as (
    select jsonb_build_object(
      'employee_id', emp.id,
      'full_name', emp.full_name,
      'profession_name', emp.profession_name,
      'department_id', emp.department_id,
      'department_name', emp.department_name,
      'email', emp.email,
      'user_id', emp.user_id,
      'username', p.username,
      'member_role', m.role,
      'member_status', m.status,
      'account_state', case when emp.user_id is null then 'none' when m.status = 'active' then 'active' when m.status = 'invited' then 'invited' when m.status = 'disabled' then 'disabled' else 'other' end,
      'blocked_reason', case
        when emp.user_id is not null then null
        when emp.email is null then 'missing_email'
        when emp.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or emp.email ~ '\.invalid$' then 'invalid_email'
        when exists (select 1 from dup where dup.email = emp.email) then 'duplicate_email'
        when exists (select 1 from public.profiles xp join public.organization_members xm on xm.user_id = xp.id and xm.organization_id = p_organization_id where lower(xp.contact_email) = emp.email) then 'email_in_this_org'
        else null end,
      'existing_user_id', ex.id,
      'existing_name', ex.full_name,
      'existing_is_demo', ex.is_demo,
      'existing_organizations', ex.organizations,
      'item_id', li.id,
      'item_batch_id', li.batch_id,
      'item_status', li.status,
      'item_error', li.error_code,
      'item_role', li.role,
      'item_created_at', li.created_at,
      'send_count', coalesce(li.send_count, 0),
      'last_sent_at', li.last_sent_at,
      'invitation_id', inv.id,
      'invitation_created_at', inv.created_at,
      'invitation_expires_at', inv.expires_at,
      'invitation_accepted_at', inv.accepted_at,
      'invitation_revoked_at', inv.revoked_at,
      'invitation_opened', case when inv.id is null then false else exists (select 1 from public.access_token_attempts t where t.invitation_id = inv.id and t.success) end,
      'email_status', ob.status,
      'email_error', ob.last_error
    ) as entry
    from emp
    left join public.profiles p on p.id = emp.user_id
    left join public.organization_members m on m.organization_id = p_organization_id and m.user_id = emp.user_id
    left join latest_item li on li.employee_id = emp.id
    left join latest_invite inv on inv.user_id = emp.user_id
    left join lateral (
      select o.status, o.last_error from public.notification_outbox o
      where inv.id is not null and o.entity_id = inv.id and o.notification_type = 'account_created'
      order by o.created_at desc limit 1
    ) ob on true
    left join lateral (
      select xp.id, xp.full_name, xp.is_demo,
        (select jsonb_agg(o.name order by o.name) from public.organization_members xm join public.organizations o on o.id = xm.organization_id where xm.user_id = xp.id) as organizations
      from public.profiles xp
      where emp.user_id is null and emp.email is not null and lower(xp.contact_email) = emp.email
        and not exists (select 1 from public.organization_members xm where xm.user_id = xp.id and xm.organization_id = p_organization_id)
      limit 1
    ) ex on true
  )
  select jsonb_build_object(
    'employees', coalesce((select jsonb_agg(entry order by entry->>'full_name') from roster), '[]'::jsonb),
    'departments', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name) order by d.name) from public.departments d where d.organization_id = p_organization_id and d.is_active), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$function$;
revoke all on function public.platform_employee_accounts(uuid) from public, anon;
grant execute on function public.platform_employee_accounts(uuid) to authenticated;

-- One created (or existing) account becomes a member of the item's hospital with
-- the chosen role and department, and is linked to the employee, in one
-- transaction under row locks: the item and the employee are locked, an employee
-- linked in the meantime is refused (EMPLOYEE_ALREADY_LINKED), and an account
-- already a member here is refused (ALREADY_MEMBER).
create or replace function public.platform_account_item_link(p_item_id uuid, p_user_id uuid, p_member_status public.member_status)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
declare
  v_item public.account_creation_items%rowtype;
  v_employee_user uuid;
  v_membership uuid;
begin
  select * into v_item from public.account_creation_items where id = p_item_id for update;
  if not found then raise exception 'ITEM_NOT_FOUND'; end if;
  select e.user_id into v_employee_user from public.employees e
    where e.id = v_item.employee_id and e.organization_id = v_item.organization_id for update;
  if not found then raise exception 'EMPLOYEE_NOT_FOUND'; end if;
  if v_employee_user is not null and v_employee_user <> p_user_id then raise exception 'EMPLOYEE_ALREADY_LINKED'; end if;
  if exists (select 1 from public.organization_members m where m.organization_id = v_item.organization_id and m.user_id = p_user_id) then
    raise exception 'ALREADY_MEMBER';
  end if;
  insert into public.organization_members (organization_id, user_id, role, status)
    values (v_item.organization_id, p_user_id, v_item.role, p_member_status)
    returning id into v_membership;
  if v_item.department_id is not null and v_item.role in ('department_manager', 'link_nurse', 'department_user') then
    insert into public.organization_member_scopes (membership_id, department_id) values (v_membership, v_item.department_id);
  end if;
  update public.employees set user_id = p_user_id, updated_at = now()
    where id = v_item.employee_id and organization_id = v_item.organization_id;
  update public.account_creation_items set user_id = p_user_id, updated_at = now() where id = p_item_id;
  return v_membership;
end;
$function$;
revoke all on function public.platform_account_item_link(uuid, uuid, public.member_status) from public, anon, authenticated;
grant execute on function public.platform_account_item_link(uuid, uuid, public.member_status) to service_role;

-- Spends an activation token once: only a pending (not accepted, not revoked,
-- not expired) invitation, whose membership is still invited, is accepted; the
-- membership becomes active in the same transaction. Returns false otherwise.
create or replace function public.platform_access_token_redeem(p_invitation_id uuid)
returns boolean
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
declare
  v_invite public.account_invitations%rowtype;
begin
  update public.account_invitations set accepted_at = now()
    where id = p_invitation_id and accepted_at is null and revoked_at is null and expires_at > now()
    returning * into v_invite;
  if not found then return false; end if;
  update public.organization_members set status = 'active', updated_at = now()
    where organization_id = v_invite.organization_id and user_id = v_invite.user_id and status = 'invited';
  -- Older links of the same account in this hospital stop working.
  update public.account_invitations set revoked_at = now()
    where organization_id = v_invite.organization_id and user_id = v_invite.user_id and id <> v_invite.id and accepted_at is null and revoked_at is null;
  return true;
end;
$function$;
revoke all on function public.platform_access_token_redeem(uuid) from public, anon, authenticated;
grant execute on function public.platform_access_token_redeem(uuid) to service_role;

-- The account e-mails go out now, through platform-scheduled-tasks (task send),
-- even when no browser drains the outbox.
create or replace function public.platform_accounts_dispatch_send()
returns bigint
language sql
volatile
security definer
set search_path = ''
as $function$
  select private.platform_dispatch_task('send');
$function$;
revoke all on function public.platform_accounts_dispatch_send() from public, anon, authenticated;
grant execute on function public.platform_accounts_dispatch_send() to service_role;
