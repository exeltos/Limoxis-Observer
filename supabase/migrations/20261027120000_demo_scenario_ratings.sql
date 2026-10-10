-- Demo evaluation: a rating (1-5) and an optional comment for each guide
-- scenario, asked for as soon as the evaluator completes it. The row of the
-- 'guide_opened' step holds the rating of the guide as a whole, asked for after
-- the last scenario. The Platform Owner reads them in the Demo record.
-- No SELECT/EXECUTE/RETURNING ... INTO (the Supabase SQL editor rewrites those).

alter table public.demo_evaluation_progress
  add column if not exists rating smallint check (rating between 1 and 5),
  add column if not exists rating_comment text check (rating_comment is null or char_length(rating_comment) <= 1000),
  add column if not exists rated_at timestamptz;

-- Rates a completed scenario (or, for 'guide_opened', the whole guide) for the
-- signed-in member of a Demo; returns every rating of that member.
create or replace function public.demo_rate_evaluation_step(p_organization_id uuid, p_step text, p_rating integer, p_comment text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.organization_members om join public.organizations o on o.id = om.organization_id
    where om.organization_id = p_organization_id and om.user_id = auth.uid() and om.status = 'active' and o.is_demo
  ) then
    raise exception 'Not a member of this Demo' using errcode = '42501';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'A rating from 1 to 5 is required' using errcode = '22023';
  end if;
  insert into public.demo_evaluation_progress(demo_organization_id, user_id, step_key, completed_at, updated_at, rating, rating_comment, rated_at)
  values (p_organization_id, auth.uid(), p_step, now(), now(), p_rating, left(nullif(btrim(coalesce(p_comment, '')), ''), 1000), now())
  on conflict (demo_organization_id, user_id, step_key)
  do update set rating = excluded.rating, rating_comment = excluded.rating_comment, rated_at = excluded.rated_at,
    completed_at = coalesce(public.demo_evaluation_progress.completed_at, now()), updated_at = now();
  return coalesce((select jsonb_object_agg(p.step_key, jsonb_build_object('rating', p.rating, 'comment', p.rating_comment))
    from public.demo_evaluation_progress p
    where p.demo_organization_id = p_organization_id and p.user_id = auth.uid() and p.rating is not null), '{}'::jsonb);
end;
$function$;

revoke all on function public.demo_rate_evaluation_step(uuid, text, integer, text) from public, anon;
grant execute on function public.demo_rate_evaluation_step(uuid, text, integer, text) to authenticated;
