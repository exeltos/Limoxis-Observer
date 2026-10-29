-- «MDR κατά την εισαγωγή»: ο ασθενής ήρθε ήδη με πολυανθεκτικό μικρόβιο (έλεγχος εισαγωγής).
-- Διαφέρει από το MDR που βγαίνει αργότερα στη νοσηλεία (νοσοκομειακή απόκτηση).
alter table public.patient_admissions
  add column if not exists mdr_on_admission boolean not null default false,
  add column if not exists mdr_on_admission_date date,
  add column if not exists mdr_on_admission_source text;

comment on column public.patient_admissions.mdr_on_admission is 'Ο ασθενής ήρθε με MDR (έλεγχος εισαγωγής).';
comment on column public.patient_admissions.mdr_on_admission_date is 'Ημερομηνία του ελέγχου εισαγωγής.';
comment on column public.patient_admissions.mdr_on_admission_source is 'Πηγή της ένδειξης: filemaker, manual.';
