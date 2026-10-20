-- FOR THE OWNER (SQL Editor): the agent does not run revoke. Closes the two new tables to PUBLIC/anon
-- (RLS already refuses anon: every policy is `to authenticated`); keeps the grants signed-in users need.
revoke all on table public.surveillance_case_questionnaires from public, anon;
revoke all on table public.epi_questionnaire_question_settings from public, anon;
grant select, insert, update, delete on table public.surveillance_case_questionnaires to authenticated;
grant select, insert, update on table public.epi_questionnaire_question_settings to authenticated;
grant all on table public.surveillance_case_questionnaires to service_role;
grant all on table public.epi_questionnaire_question_settings to service_role;
