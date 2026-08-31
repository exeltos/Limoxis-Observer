# Supabase Authentication email setup — Limoxis Observer

Open **Supabase → Authentication → Email Templates** and copy the HTML from the matching file in `supabase/email-templates/`.

| Supabase template | File |
|---|---|
| Confirm sign up | `confirm-signup.html` |
| Invite user | `invite-user.html` |
| Magic link or OTP | `magic-link.html` |
| Change email address | `change-email.html` |
| Reset password | `reset-password.html` |
| Reauthentication | `reauthentication.html` |

The first line of each HTML file contains the suggested email subject as an HTML comment.

> Organization/Hospital user invitations created inside Limoxis Observer do **not** depend on the native Supabase Invite User template. They are delivered by the Edge Functions through Resend so the message can include Organization, Username and Role.

Also verify **Authentication → URL Configuration** contains the production application URL and the activation/recovery redirect URLs.
