-- How many records a FileMaker file read skips while it is in flight (recovery
-- after a timeout). The column is also part of 20261119110000; this keeps the
-- separately recorded migration in step.
alter table public.fm_stage_file_sources add column if not exists inflight_skip integer;
