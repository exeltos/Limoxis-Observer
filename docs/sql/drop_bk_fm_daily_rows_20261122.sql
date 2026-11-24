-- Αντίγραφο ασφαλείας των ημερήσιων γραμμών FileMaker της 22/11/2026 (1/10 και 1/11 πριν τη μετατροπή σε ημερήσια).
-- Χρησιμοποιήθηκε μία φορά από το 20261231628000 (επαναφορά γραμμής Οκτωβρίου, ήδη εφαρμοσμένο) για σύγκριση.
-- Είναι ο μόνος πίνακας της βάσης χωρίς πρωτεύον κλειδί (Supabase advisor «no_primary_key»).
-- Μαζί φεύγει και η βοηθητική συνάρτηση μίας χρήσης που τον διαβάζει.
-- Το τρέχει ο ιδιοκτήτης στο SQL Editor.
drop function if exists private.fm_restore_month_row(text, regclass, jsonb, date, date, date, boolean);
drop table if exists private.bk_fm_daily_rows_20261122;
