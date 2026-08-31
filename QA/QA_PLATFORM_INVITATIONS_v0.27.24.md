# Limoxis Observer v0.27.24 — Platform invitation reliability

- Platform organization member loading no longer depends on an implicit PostgREST FK from `organization_members` to `profiles`; members and profiles are loaded separately and joined by `user_id`.
- Organization edit includes Hospital Admin invitation controls.
- Existing invited Hospital Admin: resend creates a fresh 72-hour token, revokes earlier unaccepted invitations, and sends the Limoxis invitation email.
- No Hospital Admin: owner can enter admin name/email and create the initial invitation from organization edit.
- Invited user management also exposes resend invitation.
- Active admins are not sent activation invitations; use password reset instead.
- Email delivery errors from Resend are surfaced to the UI rather than silently reported as success.

Deployment requirement: redeploy `manage-organization-user` and keep `create-organization-user` deployed. Required Edge secrets: `RESEND_API_KEY`, `INVITE_FROM_EMAIL`, `APP_URL`, plus standard Supabase function secrets.
