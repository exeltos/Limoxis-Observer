-- Platform Owner review of detected clinical-source changes ("Reviewed" / "Postpone").
-- The history table only had SELECT and INSERT policies, so review updates were
-- silently filtered out by RLS and the buttons appeared to do nothing.
drop policy if exists clinical_source_history_owner_review on public.clinical_content_source_history;
create policy clinical_source_history_owner_review on public.clinical_content_source_history
  for update to authenticated
  using (public.current_user_is_platform_owner())
  with check (public.current_user_is_platform_owner());
