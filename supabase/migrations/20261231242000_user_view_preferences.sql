-- Επιλογές προβολής ανά χρήστη και νοσοκομείο (ιδιοκτήτης, 7/11/2026): π.χ. ποια τμήματα κρύβει κάποιος από τους
-- Ελέγχους. Κάθε χρήστης βλέπει και αλλάζει μόνο τις δικές του, και μόνο σε νοσοκομείο όπου είναι μέλος.
create table if not exists public.user_view_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  view_key text not null check (char_length(view_key) between 1 and 80),
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, organization_id, view_key)
);

alter table public.user_view_preferences enable row level security;

create policy user_view_preferences_select_own on public.user_view_preferences for select to authenticated
  using (user_id = (select auth.uid()) and public.is_org_member(organization_id));
create policy user_view_preferences_insert_own on public.user_view_preferences for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_org_member(organization_id));
create policy user_view_preferences_update_own on public.user_view_preferences for update to authenticated
  using (user_id = (select auth.uid()) and public.is_org_member(organization_id))
  with check (user_id = (select auth.uid()) and public.is_org_member(organization_id));

grant select, insert, update on public.user_view_preferences to authenticated;
