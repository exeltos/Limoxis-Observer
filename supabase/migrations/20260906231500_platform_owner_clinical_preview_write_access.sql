-- Platform Owner role preview must remain operational against RLS.
-- The UI still enforces the previewed role's capabilities, while the authenticated
-- database identity remains the Platform Owner. These policies provide the
-- backend override required for preview/testing without weakening normal roles.

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'patients',
    'patient_admissions',
    'surveillance_cases',
    'surveillance_events',
    'clinical_assessments',
    'hai_classifications',
    'isolation_episodes',
    'surveillance_reassessments',
    'surveillance_outcomes',
    'surveillance_devices',
    'antimicrobial_therapies'
  ]
  loop
    if to_regclass('public.' || tbl) is not null then
      execute format('drop policy if exists platform_owner_preview_write on public.%I', tbl);
      execute format(
        'create policy platform_owner_preview_write on public.%I for all to authenticated using (public.current_user_is_platform_owner()) with check (public.current_user_is_platform_owner())',
        tbl
      );
    end if;
  end loop;
end $$;
