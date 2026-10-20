-- Η νέα συνάρτηση surveillance_case_exposure_count καλείται μόνο από συνδεδεμένους χρήστες
-- (όχι anon / public), όπως οι υπόλοιπες rpc της πλατφόρμας. Είναι revoke/grant ΣΕ ΝΕΟ
-- αντικείμενο της ίδιας αλλαγής, όχι σε υπάρχον.
revoke all on function public.surveillance_case_exposure_count(uuid) from public, anon;
grant execute on function public.surveillance_case_exposure_count(uuid) to authenticated;
