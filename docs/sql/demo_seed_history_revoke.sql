-- Για τον ιδιοκτήτη (SQL Editor): οι δύο νέες συναρτήσεις του Demo (20261231636000) να μην εκτελούνται από χρήστες,
-- όπως όλες οι υπόλοιπες demo_seed_*. Τις καλεί μόνο η «Επαναφορά δεδομένων» του Demo.
revoke all on function private.demo_seed_incidents_history(uuid, uuid) from public, anon, authenticated;
revoke all on function private.demo_seed_surveillance_history(uuid, uuid) from public, anon, authenticated;
