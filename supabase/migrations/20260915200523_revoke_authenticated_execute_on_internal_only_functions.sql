-- Full audit of the 52 authenticated-executable SECURITY DEFINER functions
-- (per Supabase advisor). Verified every direct RPC caller across:
-- frontend (.rpc( calls), all 9 deployed Edge Functions, and internal
-- Postgres function-to-function calls (prosrc). 35 genuinely need
-- authenticated EXECUTE: 21 are RLS-policy boolean helpers (Postgres
-- requires the querying role to hold EXECUTE on any function an RLS
-- policy expression calls) and 14 are RPCs actually called by the
-- frontend or an Edge Function. These 17 are reachable only through an
-- internal SECURITY DEFINER call chain (a trigger, or another
-- SECURITY DEFINER function calling them internally, which runs under
-- the definer's identity regardless of the outer caller's own grants) -
-- no legitimate direct-RPC use, so authenticated does not need EXECUTE.
-- Revoking from both PUBLIC and authenticated/anon explicitly since this
-- session already hit both grant patterns.

-- Trigger-only (RETURNS trigger):
revoke execute on function public.archive_previous_committee_minutes_approval() from public, anon, authenticated;
revoke execute on function public.autolink_committee_member_user() from public, anon, authenticated;
revoke execute on function public.create_employee_surveillance_laboratory_item() from public, anon, authenticated;
revoke execute on function public.ensure_hospital_admin_employee() from public, anon, authenticated;
revoke execute on function public.finalize_committee_meeting_after_approvals() from public, anon, authenticated;
revoke execute on function public.link_committee_member_account() from public, anon, authenticated;
revoke execute on function public.prevent_self_member_capability_change() from public, anon, authenticated;
revoke execute on function public.prevent_self_membership_privilege_change() from public, anon, authenticated;
revoke execute on function public.project_training_assignment_identity() from public, anon, authenticated;
revoke execute on function public.queue_committee_minutes_approval_notification() from public, anon, authenticated;
revoke execute on function public.return_committee_minutes_for_revision() from public, anon, authenticated;
revoke execute on function public.sync_committee_approval_notification_outbox() from public, anon, authenticated;
revoke execute on function public.sync_committee_member_addon_trigger() from public, anon, authenticated;

-- Internal-only non-trigger helpers, each verified reachable only via a
-- SECURITY DEFINER caller:
-- generate_username <- handle_new_user (auth.users signup trigger)
-- resolve_committee_member_user_id <- link_committee_member_account
-- sync_committee_member_addon <- sync_committee_member_addon_trigger
-- current_user_profile_bootstrap: no caller found anywhere (frontend,
-- edge functions, or other Postgres functions) - looks fully superseded,
-- left in place (not dropped) in case something outside this repo still
-- depends on it, but no reason for it to be directly callable.
revoke execute on function public.generate_username(text) from public, anon, authenticated;
revoke execute on function public.resolve_committee_member_user_id(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.sync_committee_member_addon(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.current_user_profile_bootstrap() from public, anon, authenticated;
