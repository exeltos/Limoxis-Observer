alter table public.laboratory_samples drop constraint if exists laboratory_samples_status_check;
alter table public.laboratory_samples add constraint laboratory_samples_status_check check (status = any (array['requested'::text,'collected'::text,'received'::text,'processing'::text,'completed'::text,'rejected'::text,'cancelled'::text]));

alter table public.laboratory_samples drop constraint if exists laboratory_samples_requested_collection_check;
alter table public.laboratory_samples add constraint laboratory_samples_requested_collection_check check (status in ('requested','rejected','cancelled') or collected_at is not null);

alter table public.laboratory_samples drop constraint if exists laboratory_samples_rejection_reason_check;
alter table public.laboratory_samples add constraint laboratory_samples_rejection_reason_check check ((status <> 'rejected') or (rejected_at is not null and nullif(btrim(rejection_reason),'') is not null));
