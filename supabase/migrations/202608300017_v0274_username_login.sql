-- Limoxis Observer v0.27.4 — username-based login for created users
--
-- Context: staff created by an admin should not need a personal email to sign in.
-- Every profile gets a unique, auto-generated `username` (transliterated from the
-- full name). The platform owner keeps signing in with their real email; every
-- other account signs in with a username, which the application resolves to a
-- synthetic internal address (`<username>@users.limoxis.local`) before calling
-- Supabase Auth — auth.users still requires an email-shaped identifier, but no
-- real mailbox is implied and nothing is ever sent to it.

create or replace function public.greek_to_latin(input text)
returns text
language plpgsql
immutable
as $$
declare
  mapping jsonb := '{
    "α":"a","ά":"a","β":"v","γ":"g","δ":"d","ε":"e","έ":"e","ζ":"z",
    "η":"i","ή":"i","θ":"th","ι":"i","ί":"i","ϊ":"i","ΐ":"i","κ":"k",
    "λ":"l","μ":"m","ν":"n","ξ":"x","ο":"o","ό":"o","π":"p","ρ":"r",
    "σ":"s","ς":"s","τ":"t","υ":"y","ύ":"y","ϋ":"y","ΰ":"y","φ":"f",
    "χ":"ch","ψ":"ps","ω":"o","ώ":"o"
  }'::jsonb;
  result text := '';
  ch text;
  i int;
  lowered text := lower(coalesce(input,''));
begin
  for i in 1..length(lowered) loop
    ch := substr(lowered, i, 1);
    if mapping ? ch then
      result := result || (mapping ->> ch);
    elsif ch ~ '[a-z0-9]' then
      result := result || ch;
    elsif ch = ' ' or ch = '-' or ch = '''' or ch = '.' then
      result := result || '.';
    end if;
    -- any other character (punctuation, emoji, ...) is silently dropped
  end loop;
  return result;
end;
$$;

alter table public.profiles add column if not exists username text unique;

create or replace function public.generate_username(source_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  candidate text;
  suffix int := 0;
begin
  base := public.greek_to_latin(coalesce(source_name, 'user'));
  base := regexp_replace(base, '\.+', '.', 'g');
  base := trim(both '.' from base);
  if base = '' then base := 'user'; end if;
  candidate := base;
  while exists(select 1 from public.profiles where username = candidate) loop
    suffix := suffix + 1;
    candidate := base || suffix::text;
  end loop;
  return candidate;
end;
$$;

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
  insert into public.profiles (id, full_name, username, is_platform_owner)
  values (new.id, computed_name, chosen_username, is_owner)
  on conflict (id) do update set
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    username = coalesce(public.profiles.username, excluded.username);
  return new;
end;
$$;

-- Backfill any profiles that already exist (owner keeps their real email; everyone else gets a generated username).
update public.profiles p
set username = u.email
from auth.users u
where p.id = u.id and p.is_platform_owner = true and p.username is null;

update public.profiles p
set username = public.generate_username(p.full_name)
where p.username is null and p.is_platform_owner = false;
