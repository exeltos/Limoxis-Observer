alter table public.surveillance_events drop constraint if exists surveillance_events_event_type_check;
alter table public.surveillance_events add constraint surveillance_events_event_type_check check (event_type = any (array['surveillance_start'::text,'surveillance_reopen'::text,'surveillance_close'::text,'clinical_assessment'::text,'sample'::text,'resistance_classification'::text,'antimicrobial_therapy'::text,'isolation'::text,'reassessment'::text,'outcome'::text]));

drop policy if exists employee_surveillance_platform_owner_all on public.employee_surveillance_records;
create policy employee_surveillance_platform_owner_all on public.employee_surveillance_records for all to authenticated using (public.current_user_is_platform_owner()) with check (public.current_user_is_platform_owner());

drop policy if exists employee_surveillance_batches_platform_owner_all on public.employee_surveillance_batches;
create policy employee_surveillance_batches_platform_owner_all on public.employee_surveillance_batches for all to authenticated using (public.current_user_is_platform_owner()) with check (public.current_user_is_platform_owner());
