-- Έλεγχοι: «οι παλιές να μετράνε στην ώρα τους» (απόφαση ιδιοκτήτη 2/11/2026). Κάθε νοσοκομείο μπορεί να έχει ημερομηνία
-- από την οποία κρίνεται η ώρα των εκτελέσεων (organizations.controls_on_time_from)· όσες έγιναν πριν από αυτήν μετρούν
-- «στην ώρα τους» όποια ώρα κι αν έγιναν. Από εκεί και πέρα ισχύουν οι ώρες του προγράμματος με το περιθώριό τους (1 ώρα πριν
-- έως 2 ώρες μετά μία φορά την ημέρα, ±1 ώρα συχνότερα). ΙΑΣΩ: από 3/11/2026. Οι εκτελέσεις και οι μετρήσεις «έγιναν» δεν αλλάζουν.
alter table public.organizations add column if not exists controls_on_time_from date;

create or replace function public.control_adherence_counts(p_organization_id uuid, p_from timestamp with time zone, p_to timestamp with time zone)
 returns table(assignment_id uuid, performed bigint, on_time bigint)
 language plpgsql
 stable
 set search_path to ''
 set plan_cache_mode to 'force_custom_plan'
as $function$
#variable_conflict use_column
declare
  v_judged_from timestamptz;
begin
  select (o.controls_on_time_from::timestamp at time zone 'Europe/Athens') into v_judged_from
    from public.organizations o where o.id = p_organization_id;
  return query
  select m.assignment_id, count(*) filter (where m.counted),
         count(*) filter (where m.counted and (m.on_time or (v_judged_from is not null and m.performed_at < v_judged_from)))
  from private.control_execution_marks(p_organization_id, p_from, p_to) m
  group by m.assignment_id;
end;
$function$;

update public.organizations set controls_on_time_from = date '2026-11-03'
 where id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd' and controls_on_time_from is null;
