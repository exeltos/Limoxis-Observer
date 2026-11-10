-- Ασφάλεια συνδέσεων: τα revoke του migration 20261231260500_platform_login_security.sql
-- (τρέχει ο ιδιοκτήτης στο SQL Editor). Οι συναρτήσεις ελέγχουν ήδη τον καλούντα· αυτό απλώς
-- κλείνει την πρόσβαση σε ανώνυμους επισκέπτες και το trigger σε όλους.
revoke all on function public.platform_track_auth_session() from public, anon, authenticated;
revoke all on function public.touch_login_session() from public, anon;
revoke all on function public.platform_login_sessions_list(integer, integer) from public, anon;
revoke all on function public.platform_end_login_sessions(uuid, uuid) from public, anon;
revoke all on function public.platform_release_login_lock(bigint) from public, anon;
