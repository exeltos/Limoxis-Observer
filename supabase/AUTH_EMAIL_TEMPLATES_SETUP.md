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

> Organization/Hospital user invitations are sent by the Edge Functions (`create-organization-user`, `manage-organization-user`) through Supabase Auth, so they use the **Invite user** template above. It reads Organization, Username and Role from the invitation data.

## Invitation link on the app's own domain

`invite-user.html` points its button to `{{ .SiteURL }}/activate?token_hash={{ .TokenHash }}&type=invite`, not to `{{ .ConfirmationURL }}` on `supabase.co`. This has two effects:
- The link is on the same domain as the sender. A mismatch between them is a common reason mail filters flag a message as phishing.
- `/activate` verifies the token only when the password is set. A mail scanner that opens the link first (for example Microsoft Defender Safe Links) cannot use it up.

**Site URL** in **Authentication → URL Configuration** must be the production address (for example `https://www.limoxis.com`).

If the email still does not arrive, the Platform Center offers **Σύνδεσμος πρόσκλησης** in the invited user's card. It creates the same kind of link without sending any email, and the admin passes it on through another channel.

## Deliverability

Supabase's built-in mailer is meant for testing; mail from it often lands in spam. For production:
- Set **Authentication → SMTP Settings** to a provider (for example Resend) with a sender on your own domain, such as `no-reply@limoxis.com`.
- Publish that provider's **SPF**, **DKIM** and **DMARC** DNS records for the domain.

Also verify **Authentication → URL Configuration** contains the production application URL and the activation/recovery redirect URLs.
