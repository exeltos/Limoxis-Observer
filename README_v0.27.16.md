# Limoxis Observer v0.27.16

- Shared full-screen Analysis workspace for Platform Owner, Hospital Admin and Infection Control Lead.
- Colored demo charts and demo-only analytics data.
- Hospital Admin user management foundation: invitation, automatic username, role update, suspend/reactivate, password reset email, delete.
- Forgot username/password public recovery flow.
- My Account page for every authenticated user.
- Responsive analytics/account/recovery UI.

Supabase: apply migration 202608310021_v02716_account_lifecycle.sql and deploy Edge Functions request-account-recovery, manage-organization-user, create-organization-user.
