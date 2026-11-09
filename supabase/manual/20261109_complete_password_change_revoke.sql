-- Ενεργοί χρήστες (owner, 9/11/2026): η συνάρτηση complete_password_change() καλείται μόνο από συνδεδεμένους χρήστες.
-- Τρέξτε το μία φορά στο Supabase SQL Editor (ο agent δεν εκτελεί revoke).
revoke all on function public.complete_password_change() from public, anon;
grant execute on function public.complete_password_change() to authenticated;

-- Έλεγχος (μόνο ανάγνωση): πρέπει να εμφανίζεται μόνο authenticated (και οι ρόλοι συστήματος).
select grantee, privilege_type from information_schema.routine_privileges where routine_schema = 'public' and routine_name = 'complete_password_change';
