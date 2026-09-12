create table public.roles (
  key public.app_role primary key,
  label_el text not null,
  label_en text not null,
  landing_path text not null default '/',
  is_system boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.capabilities (
  key text primary key,
  module_key text not null,
  action_key text not null,
  label_el text not null,
  label_en text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint capabilities_key_format check (key ~ '^[a-z0-9_]+\.[a-z0-9_]+$')
);

create table public.role_capabilities (
  role_key public.app_role not null references public.roles(key) on delete cascade,
  capability_key text not null references public.capabilities(key) on delete cascade,
  allowed boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (role_key, capability_key)
);

alter table public.organization_member_capabilities drop constraint if exists organization_member_capabilities_capability_check;
alter table public.organization_member_capabilities add column if not exists effect text not null default 'grant';
alter table public.organization_member_capabilities add constraint organization_member_capabilities_effect_check check (effect in ('grant','deny'));

insert into public.roles(key,label_el,label_en,landing_path) values
('platform_owner','Ιδιοκτήτης Πλατφόρμας','Platform Owner','/platform'),
('hospital_admin','Διαχειριστής Νοσοκομείου','Hospital Admin','/'),
('infection_control_lead','Προϊστάμενος Ελέγχου Λοιμώξεων','Infection Control Lead','/'),
('infection_control_member','Μέλος Ελέγχου Λοιμώξεων','Infection Control Member','/'),
('link_nurse','Σύνδεσμος Λοιμώξεων','Link Nurse','/'),
('doctor_reviewer','Ιατρός Ελεγκτής','Doctor Reviewer','/'),
('department_manager','Προϊστάμενος Τμήματος','Department Manager','/'),
('department_user','Χρήστης Τμήματος','Department User','/'),
('laboratory','Εργαστήριο','Laboratory','/laboratory'),
('pharmacy','Φαρμακείο','Pharmacy','/'),
('hr_office','Ανθρώπινο Δυναμικό','HR','/employees'),
('occupational_physician','Ιατρός Εργασίας','Occupational Doctor','/employees'),
('quality_manager','Υπεύθυνος Ποιότητας','Quality Manager','/quality'),
('committee_secretariat','Γραμματεία Επιτροπών','Committee Secretariat','/committees'),
('staff_user','Προσωπικό','Staff','/training'),
('demo','Demo','Demo','/');

insert into public.capabilities(key,module_key,action_key,label_el,label_en) values
('platform.manage','platform','manage','Διαχείριση πλατφόρμας','Manage platform'),
('organization.manage','organization','manage','Διαχείριση οργανισμού','Manage organization'),
('patients.view','patients','view','Προβολή ασθενών','View patients'),('patients.manage','patients','manage','Διαχείριση ασθενών','Manage patients'),
('laboratory.view','laboratory','view','Προβολή εργαστηρίου','View laboratory'),('laboratory.manage','laboratory','manage','Διαχείριση εργαστηρίου','Manage laboratory'),
('prevention.view','prevention','view','Προβολή πρόληψης','View prevention'),('prevention.manage','prevention','manage','Διαχείριση πρόληψης','Manage prevention'),
('controls.view','controls','view','Προβολή ελέγχων','View controls'),('controls.manage','controls','manage','Διαχείριση ελέγχων','Manage controls'),
('employees.view','employees','view','Προβολή προσωπικού','View employees'),('employees.manage','employees','manage','Διαχείριση προσωπικού','Manage employees'),
('occupational_health.view','occupational_health','view','Προβολή υγείας εργαζομένων','View employee health'),('occupational_health.manage','occupational_health','manage','Διαχείριση υγείας εργαζομένων','Manage employee health'),
('training.view','training','view','Προβολή εκπαίδευσης','View training'),('training.manage','training','manage','Διαχείριση εκπαίδευσης','Manage training'),
('quality.view','quality','view','Προβολή ποιότητας','View quality'),('quality.manage','quality','manage','Διαχείριση ποιότητας','Manage quality'),
('committees.view','committees','view','Προβολή επιτροπών','View committees'),('committees.manage','committees','manage','Διαχείριση επιτροπών','Manage committees'),
('documents.view','documents','view','Προβολή εγγράφων','View documents'),('documents.manage','documents','manage','Διαχείριση εγγράφων','Manage documents'),
('indicators.view','indicators','view','Προβολή δεικτών','View indicators'),('indicators.manage','indicators','manage','Διαχείριση δεικτών','Manage indicators'),
('lira.use','lira','use','Χρήση LIRA','Use LIRA'),
('management.view','management','view','Προβολή κέντρου διαχείρισης','View management center'),('management.manage','management','manage','Διαχείριση κέντρου','Manage management center'),
('notifications.view','notifications','view','Προβολή ειδοποιήσεων','View notifications'),('audit.view','audit','view','Προβολή audit trail','View audit trail');

insert into public.role_capabilities(role_key,capability_key)
select 'platform_owner'::public.app_role,key from public.capabilities;

insert into public.role_capabilities(role_key,capability_key) values
('hospital_admin','organization.manage'),('hospital_admin','patients.view'),('hospital_admin','patients.manage'),('hospital_admin','laboratory.view'),('hospital_admin','prevention.view'),('hospital_admin','prevention.manage'),('hospital_admin','controls.view'),('hospital_admin','controls.manage'),('hospital_admin','employees.view'),('hospital_admin','employees.manage'),('hospital_admin','training.view'),('hospital_admin','training.manage'),('hospital_admin','quality.view'),('hospital_admin','quality.manage'),('hospital_admin','committees.view'),('hospital_admin','committees.manage'),('hospital_admin','documents.view'),('hospital_admin','documents.manage'),('hospital_admin','indicators.view'),('hospital_admin','indicators.manage'),('hospital_admin','management.view'),('hospital_admin','management.manage'),('hospital_admin','notifications.view'),('hospital_admin','audit.view'),
('infection_control_lead','patients.view'),('infection_control_lead','patients.manage'),('infection_control_lead','laboratory.view'),('infection_control_lead','prevention.view'),('infection_control_lead','prevention.manage'),('infection_control_lead','controls.view'),('infection_control_lead','controls.manage'),('infection_control_lead','employees.view'),('infection_control_lead','training.view'),('infection_control_lead','training.manage'),('infection_control_lead','quality.view'),('infection_control_lead','indicators.view'),('infection_control_lead','lira.use'),('infection_control_lead','notifications.view'),
('infection_control_member','patients.view'),('infection_control_member','patients.manage'),('infection_control_member','laboratory.view'),('infection_control_member','prevention.view'),('infection_control_member','prevention.manage'),('infection_control_member','controls.view'),('infection_control_member','employees.view'),('infection_control_member','training.view'),('infection_control_member','indicators.view'),('infection_control_member','notifications.view'),
('link_nurse','patients.view'),('link_nurse','prevention.view'),('link_nurse','prevention.manage'),('link_nurse','controls.view'),('link_nurse','controls.manage'),('link_nurse','training.view'),('link_nurse','notifications.view'),
('doctor_reviewer','patients.view'),('doctor_reviewer','laboratory.view'),('doctor_reviewer','notifications.view'),
('department_manager','patients.view'),('department_manager','controls.view'),('department_manager','controls.manage'),('department_manager','employees.view'),('department_manager','training.view'),('department_manager','notifications.view'),
('department_user','patients.view'),('department_user','controls.view'),('department_user','training.view'),('department_user','notifications.view'),
('laboratory','patients.view'),('laboratory','laboratory.view'),('laboratory','laboratory.manage'),('laboratory','notifications.view'),
('pharmacy','patients.view'),('pharmacy','laboratory.view'),('pharmacy','indicators.view'),('pharmacy','notifications.view'),
('hr_office','employees.view'),('hr_office','employees.manage'),('hr_office','training.view'),('hr_office','training.manage'),('hr_office','notifications.view'),
('occupational_physician','employees.view'),('occupational_physician','occupational_health.view'),('occupational_physician','occupational_health.manage'),('occupational_physician','notifications.view'),
('quality_manager','quality.view'),('quality_manager','quality.manage'),('quality_manager','controls.view'),('quality_manager','documents.view'),('quality_manager','documents.manage'),('quality_manager','indicators.view'),('quality_manager','notifications.view'),('quality_manager','audit.view'),
('committee_secretariat','committees.view'),('committee_secretariat','committees.manage'),('committee_secretariat','documents.view'),('committee_secretariat','notifications.view'),
('staff_user','training.view'),('staff_user','notifications.view');

create index if not exists organization_members_user_status_org_idx on public.organization_members(user_id,status,organization_id);
create index if not exists organization_member_scopes_membership_department_idx on public.organization_member_scopes(membership_id,department_id);
create index if not exists organization_member_capabilities_membership_capability_idx on public.organization_member_capabilities(membership_id,capability);
create index if not exists role_capabilities_capability_role_idx on public.role_capabilities(capability_key,role_key);

create or replace function private.next_is_platform_owner()
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_platform_owner=true)
$$;
create or replace function private.next_is_active_org_member(target_org uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.organization_members m where m.user_id=(select auth.uid()) and m.organization_id=target_org and m.status='active')
$$;
create or replace function private.next_has_capability(target_org uuid, capability_key text)
returns boolean language sql stable security definer set search_path='' as $$
  with membership as (
    select m.id,m.role from public.organization_members m
    where m.user_id=(select auth.uid()) and m.organization_id=target_org and m.status='active' limit 1
  )
  select coalesce((select p.is_platform_owner from public.profiles p where p.id=(select auth.uid())),false)
    or (
      exists(select 1 from membership)
      and not exists(select 1 from public.organization_member_capabilities o join membership m on m.id=o.membership_id where o.capability=capability_key and o.effect='deny')
      and (
        exists(select 1 from public.organization_member_capabilities o join membership m on m.id=o.membership_id where o.capability=capability_key and o.effect='grant')
        or exists(select 1 from public.role_capabilities rc join membership m on m.role=rc.role_key where rc.capability_key=capability_key and rc.allowed)
      )
    )
$$;
revoke all on function private.next_is_platform_owner() from public,anon;
revoke all on function private.next_is_active_org_member(uuid) from public,anon;
revoke all on function private.next_has_capability(uuid,text) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.next_is_platform_owner() to authenticated;
grant execute on function private.next_is_active_org_member(uuid) to authenticated;
grant execute on function private.next_has_capability(uuid,text) to authenticated;

alter table public.roles enable row level security;
alter table public.capabilities enable row level security;
alter table public.role_capabilities enable row level security;

do $$ declare r record; begin
 for r in select schemaname,tablename,policyname from pg_policies where schemaname='public' and tablename in ('profiles','organizations','organization_members','organization_member_scopes','organization_member_capabilities','roles','capabilities','role_capabilities') loop
   execute format('drop policy if exists %I on %I.%I',r.policyname,r.schemaname,r.tablename);
 end loop;
end $$;

create policy profiles_read_self_or_owner on public.profiles for select to authenticated using (id=(select auth.uid()) or (select private.next_is_platform_owner()));
create policy organizations_read_scoped on public.organizations for select to authenticated using ((select private.next_is_platform_owner()) or (select private.next_is_active_org_member(id)));
create policy organization_members_read_scoped on public.organization_members for select to authenticated using ((select private.next_is_platform_owner()) or user_id=(select auth.uid()));
create policy organization_member_scopes_read_scoped on public.organization_member_scopes for select to authenticated using ((select private.next_is_platform_owner()) or exists(select 1 from public.organization_members m where m.id=membership_id and m.user_id=(select auth.uid()) and m.status='active'));
create policy organization_member_capabilities_read_scoped on public.organization_member_capabilities for select to authenticated using ((select private.next_is_platform_owner()) or exists(select 1 from public.organization_members m where m.id=membership_id and m.user_id=(select auth.uid()) and m.status='active'));
create policy roles_read_authenticated on public.roles for select to authenticated using (is_active=true);
create policy capabilities_read_authenticated on public.capabilities for select to authenticated using (is_active=true);
create policy role_capabilities_read_authenticated on public.role_capabilities for select to authenticated using (allowed=true);

revoke all on public.roles,public.capabilities,public.role_capabilities from anon;
grant select on public.roles,public.capabilities,public.role_capabilities to authenticated;
grant select on public.profiles,public.organizations,public.organization_members,public.organization_member_scopes,public.organization_member_capabilities to authenticated;

do $$ declare r record; begin
 for r in select p.oid::regprocedure::text as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef loop
   execute 'grant execute on function '||r.signature||' to authenticated';
   execute 'revoke execute on function '||r.signature||' from public, anon';
 end loop;
end $$;
