alter table public.hand_hygiene_observations
  add column if not exists who_moments text[];

update public.hand_hygiene_observations
set who_moments = array[who_moment]
where who_moments is null or cardinality(who_moments)=0;

alter table public.hand_hygiene_observations
  drop constraint if exists hand_hygiene_observations_who_moments_check;

alter table public.hand_hygiene_observations
  add constraint hand_hygiene_observations_who_moments_check
  check (
    who_moments is null
    or (
      cardinality(who_moments) > 0
      and who_moments <@ array['moment1','moment2','moment3','moment4','moment5']::text[]
    )
  );

create index if not exists hand_hygiene_observations_who_moments_gin_idx
  on public.hand_hygiene_observations using gin (who_moments);
