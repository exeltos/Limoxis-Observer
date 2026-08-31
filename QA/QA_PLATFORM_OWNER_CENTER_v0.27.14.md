# Limoxis Observer v0.27.14 — Platform Owner Center

Implemented:
- Platform Owner landing page is now a real dashboard with organization/user/demo KPIs.
- Active demos area includes remaining-days progress bars and <=14-day warning state.
- Platform sidebar reduced to Dashboard / Organizations / Demo / Analytics.
- Organization creation now includes Greek Region, Health Region (YPE), city, country, contact details and bed capacity.
- Organization is persisted independently; a failed Admin invitation no longer rolls back the organization.
- Organization lifecycle UI: enter, pause/resume, delete confirmation.
- Organization drill-down shows user count, UPE, bed capacity and report shortcut.
- Analytics foundation includes organization/region/period filters and report category cards.
- Login password show/hide control.
- Invitation foundation: auto username using organization prefix (e.g. HOSPITAL1-0001), 72h token, branded email, activation page and strong password policy.

Supabase required:
1. Apply migration: supabase/migrations/202608310019_v02714_platform_owner_center.sql
2. Deploy Edge Functions:
   - create-organization-user
   - accept-account-invitation
3. Configure create-organization-user secrets:
   - RESEND_API_KEY
   - APP_URL (production URL, e.g. https://your-domain.example)
   - INVITE_FROM_EMAIL (verified sender, optional; default is noreply@limoxis.com)

Build note:
- Source conflict-marker and plain-JS syntax checks were completed.
- A production Vite build could not be completed in the artifact environment because npm dependency installation timed out and the partial node_modules did not contain the vite binary.
