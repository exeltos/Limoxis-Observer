-- Protocol currency review: a failed text extraction is tried again.
--
-- protocol_text_versions.attempts counts the readings of the current
-- attachments. protocol-review retries a failed one (a download or parsing
-- error) on a later run, at most 3 times and not within an hour of the last
-- try; a reading that stopped the worker (error INTERRUPTED: a file too large
-- or one that crashes the parser) stays failed until asked for with
-- retryFailed. New attachments start the count again.

alter table public.protocol_text_versions add column if not exists attempts integer not null default 0;
comment on column public.protocol_text_versions.attempts is 'Readings of the current attachments; a failed reading (not INTERRUPTED) is retried while attempts < 3.';
