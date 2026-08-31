# Supabase Dashboard deploy — v0.27.27

The email rendering helpers are embedded directly inside each Edge Function that needs them.
No function imports `../_shared/emailTemplates.ts`, so deploying a single `index.ts` from the Supabase Dashboard will bundle successfully.

Redeploy these functions:
- create-organization-user
- manage-organization-user
- request-account-recovery
- create-demo-access

`accept-account-invitation` does not depend on the shared email helper and does not require this hotfix unless you also want to redeploy the current version.
