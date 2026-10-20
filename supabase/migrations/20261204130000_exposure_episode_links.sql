-- Φόρμες & ερωτηματολόγια, βήμα 6: η έκθεση προσωπικού συνδέεται με την εγγραφή επιτήρησης του
-- εργαζομένου και με το επεισόδιο επιτήρησης του ασθενή-πηγή. Μόνο προσθήκες: δύο nullable
-- στήλες με σύνθετα FK (id, organization_id) και ευρετήρια.
--
-- Απόρρητο: ο πίνακας occupational_exposure_incidents μένει όπως ήταν (μόνο ιατρός εργασίας ή
-- δικαίωμα manage_occupational_health). Στον ασθενή-πηγή φαίνεται ΜΟΝΟ ο αριθμός εργαζομένων,
-- ποτέ ονόματα, μέσω της συνάρτησης surveillance_case_exposure_count που ελέγχει ότι ο χρήστης
-- βλέπει το επεισόδιο (can_view_surveillance_record) και ότι το module Υγείας Εργασίας είναι
-- ανοιχτό.
alter table public.employee_surveillance_records
  add constraint employee_surveillance_records_id_organization_key unique (id, organization_id);

alter table public.occupational_exposure_incidents
  add column if not exists employee_surveillance_record_id uuid,
  add column if not exists source_case_id uuid;

alter table public.occupational_exposure_incidents
  add constraint occupational_exposure_incidents_record_fk foreign key (employee_surveillance_record_id, organization_id)
    references public.employee_surveillance_records (id, organization_id) on delete set null (employee_surveillance_record_id),
  add constraint occupational_exposure_incidents_source_case_fk foreign key (source_case_id, organization_id)
    references public.surveillance_cases (id, organization_id) on delete set null (source_case_id);

create index if not exists occupational_exposure_incidents_record_idx
  on public.occupational_exposure_incidents (employee_surveillance_record_id, organization_id) where employee_surveillance_record_id is not null;
create index if not exists occupational_exposure_incidents_source_case_idx
  on public.occupational_exposure_incidents (source_case_id, organization_id) where source_case_id is not null;

comment on column public.occupational_exposure_incidents.employee_surveillance_record_id is 'Εγγραφή επιτήρησης του εργαζομένου από την οποία καταγράφηκε η έκθεση (null όταν καταγράφεται από την Υγεία Εργασίας).';
comment on column public.occupational_exposure_incidents.source_case_id is 'Επεισόδιο επιτήρησης του ασθενή-πηγή της έκθεσης (null όταν η πηγή δεν είναι γνωστή ή δεν συνδέεται).';

-- Πόσοι εργαζόμενοι έχουν εκτεθεί σε αυτόν τον ασθενή-πηγή: μόνο αριθμός.
create or replace function public.surveillance_case_exposure_count(p_case_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_org uuid;
  v_department uuid;
begin
  if auth.uid() is null then
    return null;
  end if;
  select sc.organization_id, sc.department_id into v_org, v_department
  from public.surveillance_cases sc where sc.id = p_case_id;
  if v_org is null or not public.can_view_surveillance_record(v_org, v_department) then
    return null;
  end if;
  if 'occupational_health' = any (private.org_disabled_modules(v_org)) then
    return 0;
  end if;
  return (
    select count(distinct o.employee_id)::integer
    from public.occupational_exposure_incidents o
    where o.organization_id = v_org and o.source_case_id = p_case_id
  );
end;
$function$;
comment on function public.surveillance_case_exposure_count(uuid) is 'Αριθμός εργαζομένων που εκτέθηκαν στον ασθενή-πηγή ενός επεισοδίου επιτήρησης. Μόνο αριθμός, για όποιον βλέπει το επεισόδιο.';
