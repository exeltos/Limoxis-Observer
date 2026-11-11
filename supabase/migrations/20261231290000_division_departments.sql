-- Διευθύνσεις με τμήματα (φάση 1, 11/11/2026).
--
-- Μια διεύθυνση (π.χ. Νοσηλευτική Υπηρεσία, Διεύθυνση Λειτουργιών) ομαδοποιεί τμήματα του νοσοκομείου. Ο «Διευθυντής
-- Διεύθυνσης» παίρνει αυτόματα, για κάθε διεύθυνση που διευθύνει, πρόσβαση ανά τμήμα στα τμήματά της
-- (organization_member_scopes, το ίδιο που διαβάζουν οι ρόλοι τμήματος), και τη χάνει όταν αλλάξουν τα τμήματα της
-- διεύθυνσης, όταν φύγει από τη διεύθυνση ή όταν αλλάξει ρόλο. Μόνο προσθήκες: καμία υπάρχουσα πολιτική ή στήλη δεν αλλάζει.
-- Η ανάγνωση δεδομένων (δείκτες, επιτήρηση κ.ά.) ανοίγει ενότητα προς ενότητα στις επόμενες φάσεις.

create table if not exists public.hr_division_departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  division_id uuid not null,
  department_id uuid not null references public.departments(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (division_id, department_id),
  foreign key (division_id, organization_id) references public.hr_divisions (id, organization_id) on delete cascade
);
create index if not exists hr_division_departments_org_division_idx on public.hr_division_departments (organization_id, division_id);
create index if not exists hr_division_departments_department_idx on public.hr_division_departments (department_id);

-- Το τμήμα είναι του ίδιου νοσοκομείου με τη διεύθυνση.
create or replace function private.check_division_department_organization()
returns trigger
language plpgsql
security definer
set search_path to ''
as $fn$
begin
  if not exists (select 1 from public.departments d where d.id = new.department_id and d.organization_id = new.organization_id) then
    raise exception 'The department does not belong to this organization' using errcode = '23514';
  end if;
  return new;
end
$fn$;
drop trigger if exists hr_division_departments_check_organization on public.hr_division_departments;
create trigger hr_division_departments_check_organization before insert or update on public.hr_division_departments
  for each row execute function private.check_division_department_organization();

alter table public.hr_division_departments enable row level security;
revoke all on public.hr_division_departments from anon;
grant select, insert, update, delete on public.hr_division_departments to authenticated;
create policy hr_division_departments_read on public.hr_division_departments for select to authenticated
  using (public.current_user_has_capability(organization_id, 'view_interviews') or public.current_user_has_capability(organization_id, 'manage_interviews'));
create policy hr_division_departments_write on public.hr_division_departments for all to authenticated
  using (public.current_user_has_capability(organization_id, 'manage_interviews'))
  with check (public.current_user_has_capability(organization_id, 'manage_interviews'));

-- Ποια τμήματα προέρχονται από διεύθυνση (και όχι από χειροκίνητη ανάθεση), ώστε ο συγχρονισμός να μην αγγίζει τα δεύτερα.
alter table public.organization_member_scopes add column if not exists granted_by_division boolean not null default false;

-- Τα τμήματα ενός Διευθυντή Διεύθυνσης = τα τμήματα όλων των διευθύνσεων που διευθύνει. Ξαναϋπολογίζεται ολόκληρο.
create or replace function private.sync_division_scopes(p_organization_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_membership uuid;
  v_role public.app_role;
begin
  select om.id, om.role into v_membership, v_role
    from public.organization_members om
   where om.organization_id = p_organization_id and om.user_id = p_user_id
   limit 1;
  if v_membership is null then
    return;
  end if;
  delete from public.organization_member_scopes s
   where s.membership_id = v_membership
     and s.granted_by_division
     and not (
       v_role = 'division_director'
       and exists (
         select 1
           from public.hr_division_members dm
           join public.hr_division_departments dd on dd.division_id = dm.division_id and dd.organization_id = dm.organization_id
          where dm.organization_id = p_organization_id and dm.user_id = p_user_id and dd.department_id = s.department_id
       )
     );
  if v_role = 'division_director' then
    insert into public.organization_member_scopes (membership_id, department_id, granted_by_division)
    select distinct v_membership, dd.department_id, true
      from public.hr_division_members dm
      join public.hr_division_departments dd on dd.division_id = dm.division_id and dd.organization_id = dm.organization_id
     where dm.organization_id = p_organization_id and dm.user_id = p_user_id
    on conflict (membership_id, department_id) do nothing;
  end if;
end
$fn$;

create or replace function private.division_members_sync()
returns trigger
language plpgsql
security definer
set search_path to ''
as $fn$
begin
  if tg_op = 'DELETE' then
    perform private.sync_division_scopes(old.organization_id, old.user_id);
    return old;
  end if;
  perform private.sync_division_scopes(new.organization_id, new.user_id);
  return new;
end
$fn$;
drop trigger if exists hr_division_members_sync_scopes on public.hr_division_members;
create trigger hr_division_members_sync_scopes after insert or delete on public.hr_division_members
  for each row execute function private.division_members_sync();

create or replace function private.division_departments_sync()
returns trigger
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_row record;
  v_division uuid := coalesce(new.division_id, old.division_id);
begin
  for v_row in select dm.organization_id, dm.user_id from public.hr_division_members dm where dm.division_id = v_division loop
    perform private.sync_division_scopes(v_row.organization_id, v_row.user_id);
  end loop;
  return coalesce(new, old);
end
$fn$;
drop trigger if exists hr_division_departments_sync_scopes on public.hr_division_departments;
create trigger hr_division_departments_sync_scopes after insert or delete on public.hr_division_departments
  for each row execute function private.division_departments_sync();

-- Αλλαγή ρόλου: όποιος παύει να είναι Διευθυντής Διεύθυνσης χάνει τα τμήματα που είχε από διεύθυνση.
create or replace function private.division_role_sync()
returns trigger
language plpgsql
security definer
set search_path to ''
as $fn$
begin
  perform private.sync_division_scopes(new.organization_id, new.user_id);
  return new;
end
$fn$;
drop trigger if exists organization_members_sync_division_scopes on public.organization_members;
create trigger organization_members_sync_division_scopes after update of role on public.organization_members
  for each row when (old.role is distinct from new.role) execute function private.division_role_sync();

-- Όσοι είναι ήδη μέλη διευθύνσεων.
select private.sync_division_scopes(organization_id, user_id) from public.hr_division_members;
