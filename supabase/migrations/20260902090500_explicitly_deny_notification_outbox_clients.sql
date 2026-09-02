-- notification_outbox is a server-managed queue processed with the service role.
-- Keep RLS enabled and make the client-deny posture explicit so no signed-in client can
-- read, insert, update, or delete queued notification payloads.

drop policy if exists notification_outbox_authenticated_deny on public.notification_outbox;
create policy notification_outbox_authenticated_deny
on public.notification_outbox
for all
to authenticated
using (false)
with check (false);
