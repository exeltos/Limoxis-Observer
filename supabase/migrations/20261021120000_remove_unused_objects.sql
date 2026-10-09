-- Cleanup (approved by the platform owner): database objects nothing calls.
-- Checked in production on 2026-10-09: no caller in the application, the Edge
-- Functions or other database functions, and no dependent objects.
--   * superseded: submit_committee_minutes_for_approval (now submit_committee_minutes),
--     delete_patient_with_history, reopen_surveillance_episode,
--     current_user_profile_bootstrap;
--   * LIRA retrieval replaced by search_lira_knowledge_text: get_lira_rag_chunks,
--     match_lira_knowledge, replace_lira_knowledge_chunks;
--   * test-only helpers: delete_patient_for_testing, delete_surveillance_case_for_testing;
--   * training_confirm_attendance (attendance is confirmed by training_submit_evaluation);
--   * document_approvals (never used, 0 rows) and its trigger function.

drop function if exists public.submit_committee_minutes_for_approval(uuid);
drop function if exists public.delete_patient_with_history(uuid, uuid, text);
drop function if exists public.reopen_surveillance_episode(text, text);
drop function if exists public.current_user_profile_bootstrap();
drop function if exists public.get_lira_rag_chunks(uuid, integer);
drop function if exists public.match_lira_knowledge(extensions.vector, uuid, double precision, integer);
drop function if exists public.replace_lira_knowledge_chunks(uuid, jsonb);
drop function if exists public.delete_patient_for_testing(uuid, uuid);
drop function if exists public.delete_surveillance_case_for_testing(uuid, uuid);
drop function if exists public.training_confirm_attendance(text);

drop table if exists public.document_approvals;
drop function if exists public.protect_document_approval_identity();
