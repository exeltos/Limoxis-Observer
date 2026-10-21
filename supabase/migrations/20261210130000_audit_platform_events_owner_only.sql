-- Το ιστορικό ενεργειών (system_audit_log) δείχνει στον Διαχειριστή Νοσοκομείου τις
-- ενέργειες του νοσοκομείου του, όχι τα γεγονότα πλατφόρμας (δημιουργία/παράταση/διαγραφή
-- Demo, ρυθμίσεις πλατφόρμας κ.λπ.), που αφορούν μόνο τον Platform Owner.
-- Μια περιοριστική (restrictive) πολιτική προστίθεται δίπλα στην audit_read χωρίς να την αλλάζει.
-- Εκτελείται από τον ιδιοκτήτη στο SQL Editor.

create policy audit_read_platform_events_owner_only
  on public.system_audit_log
  as restrictive
  for select
  to authenticated
  using (
    (select public.current_user_is_platform_owner())
    or not (coalesce(event_type, '') like 'platform.%' or coalesce(event_type, '') like 'platform\_%')
  );
