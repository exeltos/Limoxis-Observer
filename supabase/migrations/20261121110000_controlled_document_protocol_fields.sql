-- Πρωτόκολλα στα ελεγχόμενα έγγραφα: είδος πρωτοκόλλου και κλινικό πεδίο.
-- Τα έγγραφα τύπου «protocol» (π.χ. τα ιατρικά πρωτόκολλα που μεταφέρθηκαν από
-- το FileMaker) χρειάζονται δύο πεδία που δεν υπήρχαν:
--   protocol_kind  το είδος του πρωτοκόλλου (ιατρικό, νοσηλευτικό, διοικητικό, εγχειρίδιο);
--   clinical_area  το κλινικό/θεματικό πεδίο (π.χ. Μαιευτική, Επείγοντα - ΚΑΡΠΑ),
--                  ανεξάρτητο από το τμήμα-ιδιοκτήτη (department_id).
-- Και τα δύο είναι προαιρετικά και δεν αφορούν άλλους τύπους εγγράφων.

alter table public.controlled_documents
  add column if not exists protocol_kind text,
  add column if not exists clinical_area text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'controlled_documents_protocol_kind_check') then
    alter table public.controlled_documents
      add constraint controlled_documents_protocol_kind_check
      check (protocol_kind is null or protocol_kind in ('medical','nursing','administrative','manual'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'controlled_documents_clinical_area_check') then
    alter table public.controlled_documents
      add constraint controlled_documents_clinical_area_check
      check (clinical_area is null or (length(btrim(clinical_area)) between 1 and 120));
  end if;
end $$;

comment on column public.controlled_documents.protocol_kind is
  'Είδος πρωτοκόλλου όταν document_type = protocol: medical, nursing, administrative, manual.';
comment on column public.controlled_documents.clinical_area is
  'Κλινικό/θεματικό πεδίο του πρωτοκόλλου (π.χ. Μαιευτική), ανεξάρτητο από το τμήμα.';

create index if not exists controlled_documents_org_type_area_idx
  on public.controlled_documents (organization_id, document_type, clinical_area);
