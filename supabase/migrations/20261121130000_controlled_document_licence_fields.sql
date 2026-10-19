-- Άδειες και πιστοποιητικά στα ελεγχόμενα έγγραφα (τύπος «licence»).
-- Οι άδειες, τα πιστοποιητικά και τα υποχρεωτικά έγγραφα του νοσοκομείου
-- (π.χ. άδεια λειτουργίας, πιστοποιητικό πυρασφάλειας, ανελκυστήρων) έχουν
-- ημερομηνία έκδοσης (effective_date) και ημερομηνία λήξης (review_date),
-- ώστε η λήξη να εμφανίζεται όπου η εφαρμογή δείχνει επανεξετάσεις εγγράφων
-- (ημερολόγιο, «Αναθεώρηση ≤30 ημέρες», δείκτες). Χρειάζονται δύο πεδία:
--   renewal_months  κάθε πόσους μήνες ανανεώνεται (π.χ. 12);
--   required_by     από τι απαιτείται: legislation (νομοθεσία), iso9001,
--                   iso15189, accreditation (διαπίστευση), contract, other.
-- Και τα δύο είναι προαιρετικά και δεν αφορούν άλλους τύπους εγγράφων.

alter table public.controlled_documents
  add column if not exists renewal_months integer,
  add column if not exists required_by text[];

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'controlled_documents_renewal_months_check') then
    alter table public.controlled_documents
      add constraint controlled_documents_renewal_months_check
      check (renewal_months is null or renewal_months between 1 and 240);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'controlled_documents_required_by_check') then
    alter table public.controlled_documents
      add constraint controlled_documents_required_by_check
      check (required_by is null or required_by <@ array['legislation','iso9001','iso15189','accreditation','contract','other']::text[]);
  end if;
end $$;

comment on column public.controlled_documents.renewal_months is
  'Συχνότητα ανανέωσης σε μήνες όταν document_type = licence (άδεια / πιστοποιητικό).';
comment on column public.controlled_documents.required_by is
  'Από τι απαιτείται η άδεια / το πιστοποιητικό: legislation, iso9001, iso15189, accreditation, contract, other.';
