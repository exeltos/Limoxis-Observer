-- Screen guides: the first time a user opens a screen of a Demo, the excerpt
-- of the Help Center manual for that screen appears in front of it. This
-- table remembers, per user, which guides were already shown. "Show the
-- guides again" (Help Center) sets dismissed = false for the user's rows.

create table if not exists public.user_screen_guides (
  user_id uuid not null references auth.users(id) on delete cascade,
  guide_key text not null check (char_length(guide_key) between 1 and 80),
  dismissed boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, guide_key)
);

alter table public.user_screen_guides enable row level security;

create policy user_screen_guides_select_own on public.user_screen_guides for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_screen_guides_insert_own on public.user_screen_guides for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy user_screen_guides_update_own on public.user_screen_guides for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.user_screen_guides from anon;
grant select, insert, update on public.user_screen_guides to authenticated;
