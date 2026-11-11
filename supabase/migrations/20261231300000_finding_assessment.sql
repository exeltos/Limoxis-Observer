-- Deviations: the assessment decision. Quality decides whether a corrective action is needed at all
-- (null = not decided yet), why not when it is not, and who assessed the deviation and when.
-- Additive only: nothing already recorded changes.
alter table public.quality_findings
  add column if not exists corrective_action_needed boolean,
  add column if not exists no_action_reason text,
  add column if not exists assessed_at timestamptz,
  add column if not exists assessed_by_label text;

comment on column public.quality_findings.corrective_action_needed is 'Assessment decision: true = a corrective action is needed, false = none is needed, null = not decided.';
comment on column public.quality_findings.no_action_reason is 'Why no corrective action is needed (required when corrective_action_needed is false).';
comment on column public.quality_findings.assessed_at is 'When the deviation was assessed.';
comment on column public.quality_findings.assessed_by_label is 'Who assessed the deviation.';

alter table public.quality_findings
  drop constraint if exists quality_findings_no_action_reason_check;
alter table public.quality_findings
  add constraint quality_findings_no_action_reason_check
  check (corrective_action_needed is distinct from false or length(btrim(coalesce(no_action_reason, ''))) > 0) not valid;
