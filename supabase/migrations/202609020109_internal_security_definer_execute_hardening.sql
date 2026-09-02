-- Harden SECURITY DEFINER exposure.
-- Internal authorization helpers are invoked by RLS/functions and must not be exposed as RPCs.

revoke execute on function public.can_view_surveillance_record(uuid,uuid) from public, anon, authenticated;
revoke execute on function public.current_membership_ids() from public, anon, authenticated;
revoke execute on function public.current_user_can_access_control_department(uuid,uuid) from public, anon, authenticated;
revoke execute on function public.current_user_can_manage_committee(uuid,uuid,text) from public, anon, authenticated;
revoke execute on function public.current_user_can_view_committee(uuid,uuid) from public, anon, authenticated;
revoke execute on function public.current_user_has_capability(uuid,text) from public, anon, authenticated;
revoke execute on function public.current_user_has_department_scope(uuid,uuid) from public, anon, authenticated;
revoke execute on function public.current_user_has_governance_capability(uuid,text) from public, anon, authenticated;
revoke execute on function public.current_user_has_org_role(uuid,public.app_role[]) from public, anon, authenticated;
revoke execute on function public.current_user_is_platform_owner() from public, anon, authenticated;
revoke execute on function public.has_org_role(uuid,public.app_role[]) from public, anon, authenticated;
revoke execute on function public.is_org_admin(uuid) from public, anon, authenticated;
revoke execute on function public.is_org_member(uuid) from public, anon, authenticated;

-- Trigger-only / internal helpers.
revoke execute on function public.archive_previous_committee_minutes_approval() from public, anon, authenticated;
revoke execute on function public.autolink_committee_member_user() from public, anon, authenticated;
revoke execute on function public.capture_clinical_audit() from public, anon, authenticated;
revoke execute on function public.finalize_committee_meeting_after_approvals() from public, anon, authenticated;
revoke execute on function public.generate_username(text) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.link_committee_member_account() from public, anon, authenticated;
revoke execute on function public.project_training_assignment_identity() from public, anon, authenticated;
revoke execute on function public.queue_committee_minutes_approval_notification() from public, anon, authenticated;
revoke execute on function public.resolve_committee_member_user_id(uuid,uuid) from public, anon, authenticated;
revoke execute on function public.return_committee_minutes_for_revision() from public, anon, authenticated;
revoke execute on function public.sync_committee_approval_notification_outbox() from public, anon, authenticated;
revoke execute on function public.sync_committee_member_addon(uuid,uuid) from public, anon, authenticated;
revoke execute on function public.sync_committee_member_addon_trigger() from public, anon, authenticated;

-- Explicit client-facing RPC allowlist. Each function performs its own authorization checks.
revoke execute on function public.answer_committee_membership(uuid,text) from public, anon;
grant execute on function public.answer_committee_membership(uuid,text) to authenticated;
revoke execute on function public.platform_report_summary(uuid,date,date) from public, anon;
grant execute on function public.platform_report_summary(uuid,date,date) to authenticated;
revoke execute on function public.queue_training_invitation(text,text) from public, anon;
grant execute on function public.queue_training_invitation(text,text) to authenticated;
revoke execute on function public.record_runtime_event(uuid,text,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.record_runtime_event(uuid,text,text,text,text,text,text,text,text) to authenticated;
revoke execute on function public.reopen_surveillance_episode(text,text) from public, anon;
grant execute on function public.reopen_surveillance_episode(text,text) to authenticated;
revoke execute on function public.training_confirm_attendance(text) from public, anon;
grant execute on function public.training_confirm_attendance(text) to authenticated;
revoke execute on function public.training_email_access(text) from public, anon;
grant execute on function public.training_email_access(text) to authenticated;
revoke execute on function public.training_submit_evaluation(text,jsonb,jsonb,text) from public, anon;
grant execute on function public.training_submit_evaluation(text,jsonb,jsonb,text) to authenticated;
revoke execute on function public.update_organization_profile(uuid,text,text,text,text,text,text,text,integer) from public, anon;
grant execute on function public.update_organization_profile(uuid,text,text,text,text,text,text,text,integer) to authenticated;
