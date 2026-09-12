-- Laboratory samples: finalization/lock governance (mirrors the demo workflow, which
-- had no production equivalent) and the second axis of the environmental sampling
-- method (category already lives in sample_type, e.g. surface/room/air/water).
alter table public.laboratory_samples
  add column if not exists finalized_at timestamptz,
  add column if not exists finalized_by uuid,
  add column if not exists documents_reviewed_at timestamptz,
  add column if not exists documents_reviewed_by uuid,
  add column if not exists correction_reason text,
  add column if not exists environmental_method text;

-- Environmental CFU evaluation against the configured protocol limit
-- (environmental_standards), matching the microbiology result it belongs to.
alter table public.microbiology_results
  add column if not exists cfu_count numeric,
  add column if not exists cfu_limit numeric,
  add column if not exists within_limit boolean;

-- Once a result is validated/amended, its CFU evaluation is part of the locked
-- result and must go through an amendment like every other result field.
create or replace function public.enforce_microbiology_result_immutability()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if old.validation_status in ('validated','amended') and (
    new.result_status is distinct from old.result_status or
    new.organism is distinct from old.organism or
    new.resistance_class is distinct from old.resistance_class or
    new.susceptibility_summary is distinct from old.susceptibility_summary or
    new.resulted_at is distinct from old.resulted_at or
    new.method is distinct from old.method or
    new.preliminary is distinct from old.preliminary or
    new.validation_status is distinct from old.validation_status or
    new.validated_by is distinct from old.validated_by or
    new.validated_at is distinct from old.validated_at or
    new.amended_from is distinct from old.amended_from or
    new.interpretation_standard is distinct from old.interpretation_standard or
    new.interpretation_version is distinct from old.interpretation_version or
    new.cfu_count is distinct from old.cfu_count or
    new.cfu_limit is distinct from old.cfu_limit or
    new.within_limit is distinct from old.within_limit
  ) then
    raise exception 'Validated microbiology results are immutable; create an amendment instead.' using errcode='23514';
  end if;
  return new;
end;
$$;
