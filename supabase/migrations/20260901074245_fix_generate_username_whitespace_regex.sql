-- Fixes a live bug found while backfilling migration history for v0.27.15
-- (202608310020_v02715_username_policy.sql): that migration's regex literal
-- was '\\s+' (a plain, non-escape-string single-quoted literal, so Postgres
-- passes the regex engine two literal backslash characters followed by
-- 's+') instead of '\s+' (one backslash, the POSIX whitespace shorthand).
-- Verified live: regexp_split_to_array('Γιώργος Παπαδόπουλος','\\s+') returns
-- the whole name as a single element — it never splits on whitespace at all.
--
-- Effect on generate_username(): for every real "first last" name, parts
-- has length 1, so first_token becomes the ENTIRE name (not just the first
-- name) and last_token always falls back to the literal string 'x' (the
-- array_length(parts,1) > 1 branch is never taken). The surname initial is
-- therefore always 'X', regardless of the person's actual surname — e.g.
-- "Γιώργος Παπαδόπουλος" was generating usernames like GX48217 instead of
-- the intended GP48217.
--
-- No later migration (checked 202608310023_v0281_username_conflict_safety.sql,
-- the only other file that still touches this function) redefines
-- generate_username itself — it only calls it — so this bug is live and
-- unaddressed until this fix.
create or replace function public.generate_username(source_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  parts text[];
  first_token text;
  last_token text;
  first_latin text;
  last_latin text;
  prefix text;
  candidate text;
  attempts int := 0;
begin
  parts := regexp_split_to_array(trim(coalesce(source_name,'')), '\s+');
  first_token := coalesce(parts[1], 'x');
  last_token := case when array_length(parts,1) > 1 then parts[array_length(parts,1)] else 'x' end;
  first_latin := upper(substr(public.greek_to_latin(first_token),1,1));
  last_latin := upper(substr(public.greek_to_latin(last_token),1,1));
  prefix := coalesce(nullif(first_latin,''),'X') || coalesce(nullif(last_latin,''),'X');
  loop
    attempts := attempts + 1;
    candidate := prefix || lpad((10000 + floor(random()*90000))::int::text,5,'0');
    exit when not exists(select 1 from public.profiles where username=candidate);
    if attempts >= 100 then raise exception 'Could not allocate unique username'; end if;
  end loop;
  return candidate;
end;
$$;
