-- «Προς έλεγχο»: Laboratory ↔ Surveillance split. A positive/alert sample of a patient
-- that has no episode waits for an infection-control decision: an episode is opened
-- from it, or it is marked «no surveillance needed» with a reason. The decision lives
-- on the sample (additive, nullable columns), so the laboratory list, the worklist and
-- the indicators read one place. Negative samples are never touched: they stay as the
-- denominators of the indicators.
alter table public.laboratory_samples
  add column if not exists surveillance_review_status text,
  add column if not exists surveillance_review_reason text,
  add column if not exists surveillance_review_note text,
  add column if not exists surveillance_reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists surveillance_reviewed_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'laboratory_samples_surveillance_review_check') then
    alter table public.laboratory_samples
      add constraint laboratory_samples_surveillance_review_check check (
        (surveillance_review_status is null and surveillance_review_reason is null)
        or surveillance_review_status = 'episode_opened'
        or (surveillance_review_status = 'no_surveillance_needed'
            and surveillance_review_reason in ('contamination', 'colonization', 'known_case', 'other'))
      );
  end if;
end $$;

-- The worklist reads «no episode, not yet decided».
create index if not exists laboratory_samples_review_pending_idx
  on public.laboratory_samples (organization_id, requested_at desc)
  where surveillance_case_id is null and surveillance_review_status is null;
