-- voidClinicalCase() (clinicalCloudService.js) only ever updates
-- surveillance_cases.status to 'cancelled'; it never touches
-- isolation_episodes. This left a real orphaned row: isolation_episodes
-- a05cfa9c-e4ca-442a-ae51-b7763208afc7 (patient b1dd49f2...) stayed
-- 'active' after its owning surveillance_case (6ea68829...) was voided -
-- clinically misleading, since staff could read that as a genuinely
-- active isolation. Auto-close active isolation episodes when their
-- owning case is voided, and backfill the one existing bad row.

create or replace function public.close_isolation_on_case_void()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    update public.isolation_episodes
    set status = 'ended',
        ended_at = coalesce(ended_at, now()),
        end_reason = coalesce(end_reason, 'Surveillance case voided: ' || coalesce(new.void_reason, '')),
        ended_by = coalesce(ended_by, new.voided_by),
        updated_at = now()
    where surveillance_case_id = new.id
      and status = 'active';
  end if;
  return new;
end;
$$;

revoke execute on function public.close_isolation_on_case_void() from public;

drop trigger if exists close_isolation_on_case_void on public.surveillance_cases;
create trigger close_isolation_on_case_void
  after update on public.surveillance_cases
  for each row
  execute function public.close_isolation_on_case_void();

-- Backfill the one existing orphaned row.
update public.isolation_episodes
set status='ended',
    ended_at=now(),
    end_reason='Surveillance case voided (data-integrity backfill): ' || coalesce((select void_reason from public.surveillance_cases where id=isolation_episodes.surveillance_case_id),''),
    ended_by=(select voided_by from public.surveillance_cases where id=isolation_episodes.surveillance_case_id),
    updated_at=now()
where id='a05cfa9c-e4ca-442a-ae51-b7763208afc7' and status='active';
