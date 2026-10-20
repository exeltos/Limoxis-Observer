-- FOR THE OWNER (SQL Editor): the agent does not run revoke. Closes the new function to PUBLIC/anon
-- (it already refuses callers without auth.uid()); required by npm run audit:security-definer.
revoke all on function public.review_laboratory_sample(uuid, uuid, text, text, text, uuid) from public, anon;
grant execute on function public.review_laboratory_sample(uuid, uuid, text, text, text, uuid) to authenticated;
