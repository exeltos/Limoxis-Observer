-- ΕΦΑΡΜΟΣΤΗΚΕ 31/10/2026 στον ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ (με ρητό ΟΚ του ιδιοκτήτη, «δεν βλέπω οθόνη μιας ημέρας»).
-- 1) Migration `register_daily_from` (supabase/migrations/20261231110000_register_daily_from.sql): στήλη department_registers.daily_from date.
--    Η ημέρα από την οποία ένα φύλλο καταχωρείται ανά ημέρα· πριν από αυτήν κάθε μήνας έχει ένα σύνολο (στην 1η του μήνα). Κενό = 1/11/2026.
-- 2) ΤΕΠ (REG-007): daily_from = 2026-10-31 (έκδοση 3). Τα υπόλοιπα φύλλα του ΙΑΣΩ μένουν στο προεπιλεγμένο 1/11/2026.
--    Το σύνολο Οκτωβρίου που έχει ήδη καταχωριστεί μένει ως έχει· από 31/10 μπαίνουν ημέρες και ο μήνας μετράει και τα δύο.
-- Αλλαγή: Ορισμός › Μητρώο › «Ημερήσια καταχώριση από» (ή update του daily_from).
update public.department_registers set daily_from = date '2026-10-31'
where code = 'REG-007' and organization_id = (select id from public.organizations where name = 'ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ') and kind = 'sheet';
