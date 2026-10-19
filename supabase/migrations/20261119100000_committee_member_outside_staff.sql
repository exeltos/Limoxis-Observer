-- Committee members who are not on the hospital's staff ("εκτός προσωπικού"):
-- external experts, representatives of other bodies, or people from imported
-- minutes who match no employee. Additive only.
alter table public.committee_members
  add column if not exists is_external boolean not null default false;

comment on column public.committee_members.is_external is
  'True when the member is outside the organisation''s staff (εκτός προσωπικού). Shown as a badge in the members list.';
