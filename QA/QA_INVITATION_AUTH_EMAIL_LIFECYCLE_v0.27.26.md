# QA — Invitation & Auth Email Lifecycle v0.27.26

## Expected organization admin lifecycle
1. New organization: primary action is **Αποθήκευση & αποστολή πρόσκλησης**.
2. Account is created with `organization_members.status = invited`.
3. UI renders **Εκκρεμής**.
4. Subsequent organization edits use **Αποθήκευση** only and never send an email.
5. While status is `invited`, a separate **Επαναποστολή πρόσκλησης** action is available.
6. Resend revokes previous pending invitation tokens and creates a new 72-hour token.
7. `accept-account-invitation` sets the password, marks the member `active`, and stamps `accepted_at`.
8. UI renders **Ενεργός** after reload.
9. Suspension sets member status `disabled` and UI renders **Σε παύση**.
10. Active users use password reset, not activation invitation.

## Email coverage
- Edge Function branded mail: initial invitation, resend invitation, password recovery, username reminder, Demo access.
- Supabase Auth templates included in `supabase/email-templates/`: Confirm signup, Invite user, Magic link/OTP, Change email, Reset password, Reauthentication.

## Deployment
Redeploy:
- `create-organization-user`
- `manage-organization-user`
- `request-account-recovery`
- `create-demo-access`
- `accept-account-invitation` (if the deployed copy is older)

Required secrets:
- `RESEND_API_KEY`
- `INVITE_FROM_EMAIL`
- `APP_URL`

## Static checks run
- navigation smoke: PASS
- React hooks smoke: PASS
- Observer UI pattern audit: PASS
- merge-conflict scan: PASS
