-- Limoxis Observer v0.27.15 — account username policy
-- New organization users are provisioned by the Edge Function with a username:
-- [first-name initial][surname initial][5 random digits], e.g. AF48217.
-- Initials are emitted in Latin uppercase characters. The five digits are random
-- and the Edge Function verifies uniqueness against public.profiles before creation.
--
-- Keep the database helper aligned for any non-Edge backfill/fallback path.
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
  parts := regexp_split_to_array(trim(coalesce(source_name,'')), '\\s+');
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
