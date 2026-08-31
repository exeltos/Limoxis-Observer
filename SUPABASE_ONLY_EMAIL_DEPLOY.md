# Limoxis Observer v0.27.31 — Supabase-only Auth Email Flow

This full project package removes the Resend dependency from account invitations and password recovery.

Deploy/update these Edge Functions from `supabase/functions/`:

- create-organization-user
- manage-organization-user
- request-account-recovery
- accept-account-invitation
- create-demo-access
- username-login

Keep `APP_BASE_URL` (or `APP_URL`) configured with the production application URL. `RESEND_API_KEY` and `INVITE_FROM_EMAIL` are not required.

Supabase Authentication must have the production Site URL / redirect URLs configured for `/activate` and `/reset-password`, and the Invite/Recovery Email Templates should be configured in Authentication > Email Templates.
