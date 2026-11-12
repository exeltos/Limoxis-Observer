-- Άδειος πίνακας του χειροκίνητου μητρώου ΜΕΝΝ του «Γενικό Νοσοκομείο Demo»,
-- που έμεινε ορφανός μετά την επαναφορά (12/11/2026). Έλεγχος πριν:
--   select * from private.register_orphan_tables();  -- πρέπει να δείχνει μόνο αυτόν
drop table if exists public.register_nicu_6c8688ab_identity;
drop table if exists public.register_nicu_6c8688ab;
