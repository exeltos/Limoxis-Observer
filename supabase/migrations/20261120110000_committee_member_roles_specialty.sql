-- Committee members: the official committee roster gives each person a role
-- (chair, vice-chair, deputy chair, coordinator, secretary, member), a specialty
-- or job title, and responsibilities. Responsibilities already have a column and
-- the free Greek title stays in `title`; the structured roles and the specialty
-- get their own columns here. Additive only.
alter table public.committee_members
  add column if not exists member_roles text[] not null default '{}'::text[],
  add column if not exists specialty text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.committee_members'::regclass
      and conname = 'committee_members_member_roles_check'
  ) then
    alter table public.committee_members
      add constraint committee_members_member_roles_check
      check (member_roles <@ array['chair','vice_chair','deputy_chair','coordinator','secretary','member']::text[]);
  end if;
end $$;

comment on column public.committee_members.member_roles is
  'Structured roles in the committee: chair, vice_chair, deputy_chair (αναπληρωτής προέδρου/προεδρεύοντος), coordinator, secretary, member. A person can hold more than one (e.g. chair and coordinator). The Greek title as written in the roster stays in title.';
comment on column public.committee_members.specialty is
  'Specialty or job title of the member as given in the committee roster (Ειδικότητα).';
