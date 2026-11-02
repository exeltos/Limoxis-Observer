-- Δείκτης SMR (θνησιμότητα προς προβλεπόμενη) στα μητρώα: νέος τύπος υπολογισμού 'smr'.
-- ΓΙΑ ΤΟΝ ΙΔΙΟΚΤΗΤΗ: τρέχει στο SQL Editor (περιέχει drop constraint, δεν εκτελείται από τον agent).
-- Μέχρι να τρέξει, ένα μητρώο με τον δείκτη SMR δεν αποθηκεύεται στη βάση (το demo δουλεύει κανονικά).
-- Επαλήθευση μετά: select pg_get_constraintdef(oid) from pg_constraint where conname = 'department_register_indicators_aggregation_check';
begin;
alter table public.department_register_indicators drop constraint if exists department_register_indicators_aggregation_check;
alter table public.department_register_indicators add constraint department_register_indicators_aggregation_check
  check (aggregation in ('count','percent','mean','median','sum','rate','smr'));
commit;
