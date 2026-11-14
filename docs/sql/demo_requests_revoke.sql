-- Προαιρετική σκλήρυνση για τα αιτήματα παρουσίασης (migration 20261231520000_demo_requests.sql).
-- Το τρέχει ο ιδιοκτήτης στο SQL Editor, ΜΕΤΑ το migration (ο agent δεν εκτελεί revoke).
-- Χωρίς αυτό η ασφάλεια ισχύει ήδη: ο πίνακας έχει RLS χωρίς καμία πολιτική για τον ανώνυμο επισκέπτη, και η
-- submit_demo_request() δεν επιστρέφει τίποτα από τα αποθηκευμένα. Εδώ αφαιρούνται απλώς τα προεπιλεγμένα
-- δικαιώματα που δίνει το Supabase σε κάθε νέο πίνακα και συνάρτηση.
revoke all on table public.demo_requests from anon;
revoke insert, delete, truncate, references, trigger on table public.demo_requests from authenticated;
revoke all on function public.submit_demo_request(text, text, text, text, text, text, text, boolean, text) from public;
grant execute on function public.submit_demo_request(text, text, text, text, text, text, text, boolean, text) to anon, authenticated;
revoke all on function public.demo_requests_touch() from public, anon, authenticated;

-- Έλεγχος (μόνο ανάγνωση):
-- select grantee, privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name = 'demo_requests' order by 1, 2;
