alter table public.committees add column if not exists committee_role text;
alter table public.committee_members add column if not exists user_id uuid references auth.users(id) on delete set null;
create index if not exists committee_members_user_id_idx on public.committee_members(user_id) where user_id is not null;
