-- ΜΕΝΝ Ν6 (ιδιοκτήτης 17/11/2026): πιθανές όψιμες λοιμώξεις από το εργαστήριο. Στο ΙΑΣΩ 2020–2026: 89 θετικές αιμοκαλλιέργειες
-- νεογνών της ΜΕΝΝ, 85 από αυτές ≥ 72 ώρες μετά την εισαγωγή (43 νεογνά), ενώ το μητρώο είχε σημειωμένες μόνο 2.
-- 1. register_infection_reviews: η απόφαση της ΜΕΝΝ ανά δείγμα (επιβεβαίωση / απόρριψη), ώστε μια απορριφθείσα να μην
--    ξαναπροτείνεται. Η επιβεβαίωση γράφει και late_infection = true στην καρτέλα του νεογνού (από την εφαρμογή).
-- 2. register_late_infection_candidates(p_register_id): για μητρώο ΜΕΝΝ, οι θετικές αιμοκαλλιέργειες του τμήματος του
--    μητρώου που λήφθηκαν ≥ 72 ώρες μετά την εισαγωγή νεογνού με το ίδιο επώνυμο, μέσα στη νοσηλεία του (έως την έξοδο,
--    ή 120 ημέρες αν δεν έχει βγει), με την απόφαση αν υπάρχει. Ταίριασμα με επώνυμο και ημερομηνίες: πρόταση, όχι
--    απόφαση· την επιβεβαιώνει η ΜΕΝΝ. Το ταίριασμα (με το επώνυμο) γίνεται μέσα στη βάση και δεν επιστρέφει όνομα: μόνο
--    την καρτέλα, την ημερομηνία του δείγματος, το μικρόβιο και τις ώρες· τα ονόματα δεν φεύγουν από το τμήμα. Μόνο
--    για όποιον διαβάζει το μητρώο (private.register_can_read)· τίποτα όταν το εργαστήριο είναι κλειδωμένο.
create table if not exists public.register_infection_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  register_id uuid not null references public.department_registers(id) on delete cascade,
  entry_id uuid not null,
  sample_id uuid not null references public.laboratory_samples(id) on delete cascade,
  decision text not null check (decision in ('confirmed', 'rejected')),
  decided_by uuid default auth.uid() references auth.users(id) on delete set null,
  decided_at timestamptz not null default now(),
  unique (register_id, entry_id, sample_id)
);
create index if not exists register_infection_reviews_register_idx on public.register_infection_reviews (register_id, entry_id);
alter table public.register_infection_reviews enable row level security;
grant select, insert, update on public.register_infection_reviews to authenticated;

create policy register_infection_reviews_read on public.register_infection_reviews for select to authenticated
  using ((select private.register_can_read(register_id)));
create policy register_infection_reviews_write on public.register_infection_reviews for insert to authenticated
  with check (
    (select private.register_can_read(register_id))
    and (public.current_user_is_platform_owner()
      or public.current_user_has_org_role(organization_id, array['hospital_admin'::public.app_role, 'quality_manager'::public.app_role])
      or public.current_user_has_capability(organization_id, 'manage_quality')
      or exists (select 1 from public.department_registers r where r.id = register_id and r.organization_id = organization_id
        and r.department_id is not null and public.current_user_has_department_scope(r.organization_id, r.department_id)))
  );
create policy register_infection_reviews_change on public.register_infection_reviews for update to authenticated
  using (
    (select private.register_can_read(register_id))
    and (public.current_user_is_platform_owner()
      or public.current_user_has_org_role(organization_id, array['hospital_admin'::public.app_role, 'quality_manager'::public.app_role])
      or public.current_user_has_capability(organization_id, 'manage_quality')
      or exists (select 1 from public.department_registers r where r.id = register_id and r.organization_id = organization_id
        and r.department_id is not null and public.current_user_has_department_scope(r.organization_id, r.department_id)))
  );

create or replace function public.register_late_infection_candidates(p_register_id uuid)
returns table (entry_id uuid, sample_id uuid, collected_at timestamptz, organism text, hours_after numeric, decision text)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  r public.department_registers;
begin
  if auth.uid() is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  select * into r from public.department_registers where id = p_register_id;
  if not found then raise exception 'Unknown register'; end if;
  if not private.register_can_read(p_register_id) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if r.template_key is distinct from 'nicu' or r.table_name is null or r.department_id is null then return; end if;
  if private.org_modules_locked(r.organization_id, array['laboratory']) then return; end if;
  return query execute format($q$
    select e.id, l.id, l.collected_at, m.organism,
      round((extract(epoch from (l.collected_at - (e.admission_date + coalesce((to_jsonb(e)->>'admission_time')::time, time '00:00'))::timestamp at time zone 'Europe/Athens')) / 3600)::numeric, 1),
      v.decision
    from public.%I e
    join public.%I i on i.entry_id = e.id
    join public.laboratory_samples l on l.organization_id = $1 and l.department_id = $2 and l.sample_type = 'bloodCulture'
      and coalesce(l.status, '') not in ('rejected', 'cancelled')
      and (l.collected_at at time zone 'Europe/Athens')::date between e.admission_date and coalesce(e.discharge_date, e.admission_date + 120)
    join public.patients p on p.id = l.patient_id and length(btrim(p.last_name)) >= 3
      and upper(i.patient_name) like '%%' || upper(btrim(p.last_name)) || '%%'
    join public.microbiology_results m on m.sample_id = l.id and m.result_status = 'positive'
    left join public.register_infection_reviews v on v.register_id = $3 and v.entry_id = e.id and v.sample_id = l.id
    where e.admission_date is not null
      and l.collected_at >= (e.admission_date + coalesce((to_jsonb(e)->>'admission_time')::time, time '00:00'))::timestamp at time zone 'Europe/Athens' + interval '72 hours'
    order by l.collected_at desc
  $q$, r.table_name, r.table_name || '_identity')
  using r.organization_id, r.department_id, p_register_id;
end;
$function$;
revoke execute on function public.register_late_infection_candidates(uuid) from public, anon;
grant execute on function public.register_late_infection_candidates(uuid) to authenticated;
