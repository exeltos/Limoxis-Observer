# Limoxis Observer — Supabase Auth email templates

Copy the subject and HTML of each file into **Supabase → Authentication → Email Templates**.

These templates cover the native Supabase Auth flows. Hospital/organization invitations created inside Limoxis Observer are sent by the Edge Functions through Resend because they include organization, username and role metadata.

Required production settings:
- Site URL / redirect URLs must point to the production Limoxis Observer domain.
- Keep recovery and confirmation redirects allow-listed in Supabase Auth URL Configuration.
- Edge Function mail requires `RESEND_API_KEY`, `INVITE_FROM_EMAIL`, `APP_URL`.

Template files use Supabase Go-template variables such as `{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .Email }}`, and `{{ .NewEmail }}`.
