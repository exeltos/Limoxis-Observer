-- Limoxis Observer v0.28.1 — never let a username collision block account creation
--
-- Symptom: "Database error saving new user" when resending an invitation.
-- Cause: resending an invitation makes Supabase create a brand-new auth.users
-- row for the same person, and handle_new_user() then tries to give that new
-- profile the SAME username as their existing (still-invited) profile — which
-- violates the unique constraint on profiles.username. The trigger's
-- `on conflict (id)` only protects against a conflict on the primary key, not
-- on username, so the whole auth.users insert was failing.
--
-- Fix: if the chosen username is already taken by a different profile, fall
-- back to a disambiguated one instead of raising — profile bookkeeping should
-- never be able to block a real authentication signup.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  computed_name text := coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1));
  is_owner boolean := coalesce((new.raw_user_meta_data ->> 'is_platform_owner')::boolean, false);
  chosen_username text := new.raw_user_meta_data ->> 'username';
begin
  if chosen_username is null or chosen_username = '' then
    if is_owner then
      chosen_username := new.email;
    else
      chosen_username := public.generate_username(computed_name);
    end if;
  end if;

  -- Someone else (or an earlier, still-pending signup for this same person) already
  -- holds this username: disambiguate rather than fail the auth.users insert.
  if exists(select 1 from public.profiles where username = chosen_username and id <> new.id) then
    chosen_username := chosen_username || '-' || substr(new.id::text, 1, 6);
  end if;

  insert into public.profiles (id, full_name, username, is_platform_owner)
  values (new.id, computed_name, chosen_username, is_owner)
  on conflict (id) do update set
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    username = coalesce(public.profiles.username, excluded.username);
  return new;
end;
$$;
