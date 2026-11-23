-- Για τον ιδιοκτήτη (SQL Editor): η νέα συνάρτηση «Πρόσβαση χρηστών» να μην καλείται από μη συνδεδεμένους
-- επισκέπτες. Η συνάρτηση ήδη απορρίπτει όποιον δεν είναι Διαχειριστής ή Ιδιοκτήτης· αυτό κλείνει και την πόρτα.
revoke all on function public.organization_member_access(uuid) from public, anon;
grant execute on function public.organization_member_access(uuid) to authenticated;
