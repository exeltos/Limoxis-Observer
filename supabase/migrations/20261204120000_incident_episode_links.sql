-- Φόρμες & ερωτηματολόγια, βήμα 4: το συμβάν ποιότητας που αναφέρεται από ένα επεισόδιο
-- συνδέεται πραγματικά με τον ασθενή, τη νοσηλεία και την επιτήρηση.
--
-- Οι στήλες linked_patient_id / linked_surveillance_id υπήρχαν χωρίς FK (και χωρίς έλεγχο
-- οργανισμού). Προστίθενται σύνθετα FK (id, organization_id): πρώτα NOT VALID, μετά validate
-- (η ανάγνωση της βάσης έδειξε 0 γραμμές εκτός σχέσης). Αν επιβεβαιωθεί γραμμή εκτός σχέσης στο
-- μέλλον, το validate αποτυγχάνει αντί να αλλοιώσει δεδομένα. Οι πολιτικές RLS του
-- quality_incidents δεν αλλάζουν: η λίστα της καρτέλας δείχνει μόνο όσα ο χρήστης ήδη βλέπει.
alter table public.patient_admissions
  add constraint patient_admissions_id_organization_key unique (id, organization_id);

alter table public.quality_incidents
  add column if not exists linked_admission_id uuid;

alter table public.quality_incidents
  add constraint quality_incidents_patient_fk foreign key (linked_patient_id, organization_id)
    references public.patients (id, organization_id) on delete set null (linked_patient_id) not valid,
  add constraint quality_incidents_case_fk foreign key (linked_surveillance_id, organization_id)
    references public.surveillance_cases (id, organization_id) on delete set null (linked_surveillance_id) not valid,
  add constraint quality_incidents_admission_fk foreign key (linked_admission_id, organization_id)
    references public.patient_admissions (id, organization_id) on delete set null (linked_admission_id) not valid;

alter table public.quality_incidents validate constraint quality_incidents_patient_fk;
alter table public.quality_incidents validate constraint quality_incidents_case_fk;
alter table public.quality_incidents validate constraint quality_incidents_admission_fk;

create index if not exists quality_incidents_linked_case_idx
  on public.quality_incidents (linked_surveillance_id, organization_id) where linked_surveillance_id is not null;
create index if not exists quality_incidents_linked_patient_idx
  on public.quality_incidents (linked_patient_id, organization_id) where linked_patient_id is not null;
create index if not exists quality_incidents_linked_admission_idx
  on public.quality_incidents (linked_admission_id, organization_id) where linked_admission_id is not null;

comment on column public.quality_incidents.linked_admission_id is 'Νοσηλεία του ασθενούς κατά το συμβάν (null όταν δεν συνδέεται).';
