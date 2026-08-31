# QA — Edge Functions Dashboard Self-contained v0.27.29

- Removed runtime imports from `../_shared/emailTemplates.ts` for Dashboard-deployed functions.
- Embedded branded email helpers directly into:
  - create-organization-user
  - manage-organization-user
  - request-account-recovery
  - create-demo-access
- Purpose: each `index.ts` can be deployed independently from Supabase Dashboard editor.
- `_shared/emailTemplates.ts` is retained for reference/CLI deployments, but none of the four Dashboard-target functions depend on it.
