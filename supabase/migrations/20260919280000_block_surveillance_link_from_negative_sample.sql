-- "Το αρνητικό αποτέλεσμα δεν δημιουργεί ποτέ λοίμωξη" (a negative result
-- never creates an infection) was, until now, only a convention: the
-- Surveillance & Samples UI lets a user click "Start surveillance" on ANY
-- unlinked sample row (src/features/surveillance/PatientClinicalCanonicalPage.jsx
-- SampleTreeRow), and src/features/laboratory/laboratoryLinkService.js's
-- linkLaboratorySampleToSurveillance() plainly UPDATEs
-- laboratory_samples.surveillance_case_id with no check on the sample's
-- own result at all. Nothing technically stopped a surveillance case from
-- being started from, or continued on, a sample whose only validated
-- microbiology result is negative.
--
-- Adds a real technical guard: a sample can only be (re)linked to a
-- surveillance case (laboratory_samples.surveillance_case_id set to a
-- non-null value) if it does NOT have a validated negative result with no
-- validated positive result to accompany it. A sample with no result yet,
-- a draft result, or a positive result (even alongside an unrelated
-- negative one) is unaffected — this only blocks the specific "the only
-- confirmed finding for this sample is negative" case the audit flagged.
-- Mirrors the existing validated/amended-only, exclude-superseded-results
-- pattern used throughout the indicator engine.

create or replace function public.enforce_no_surveillance_link_from_negative_sample()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  has_negative boolean;
  has_positive boolean;
begin
  if new.surveillance_case_id is null then
    return new;
  end if;

  select
    exists(
      select 1 from public.microbiology_results m
      where m.sample_id=new.id and m.organization_id=new.organization_id
        and m.result_status='negative' and m.validation_status in ('validated','amended')
        and not exists(select 1 from public.microbiology_results m2 where m2.organization_id=m.organization_id and m2.amended_from=m.id)
    ),
    exists(
      select 1 from public.microbiology_results m
      where m.sample_id=new.id and m.organization_id=new.organization_id
        and m.result_status='positive' and m.validation_status in ('validated','amended')
        and not exists(select 1 from public.microbiology_results m2 where m2.organization_id=m.organization_id and m2.amended_from=m.id)
    )
  into has_negative, has_positive;

  if has_negative and not has_positive then
    raise exception 'A validated negative laboratory result cannot be linked to start or continue a surveillance case.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_no_surveillance_link_from_negative_sample on public.laboratory_samples;
create trigger trg_enforce_no_surveillance_link_from_negative_sample
before update of surveillance_case_id on public.laboratory_samples
for each row execute function public.enforce_no_surveillance_link_from_negative_sample();
