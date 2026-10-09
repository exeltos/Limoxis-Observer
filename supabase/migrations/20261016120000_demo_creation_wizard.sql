-- New Demo wizard (design §5, §7): a data scenario per Demo and a limit on
-- the evaluators of a Demo.
--   * full: the whole data pack (as before).
--   * surveillance: departments, patients, surveillance, laboratory,
--     microbiology, antibiograms, hand hygiene, staff and patient days.
--   * empty: the eight departments only.
-- "Reset data" refills a Demo with the scenario it was created with.
-- No SELECT/EXECUTE/RETURNING ... INTO (the Supabase SQL editor rewrites those).

alter table public.platform_settings add column if not exists max_demo_users integer not null default 5
  check (max_demo_users between 1 and 20);

alter table public.platform_demo_entitlements add column if not exists seed_profile text not null default 'full'
  check (seed_profile in ('full', 'surveillance', 'empty'));

create or replace function private.demo_seed_profile(p_organization_id uuid, p_actor uuid, p_profile text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  v_profile text := coalesce(p_profile, 'full');
begin
  if p_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations o where o.id = v_org and o.is_demo) then
    raise exception 'Only Demo organizations can be filled with Demo data' using errcode = '42501';
  end if;
  if v_profile not in ('full', 'surveillance', 'empty') then
    raise exception 'Unknown Demo data scenario' using errcode = '22023';
  end if;
  if v_profile = 'full' then
    return private.demo_seed_data(v_org, p_actor);
  end if;

  perform set_config('limoxis.test_reset', 'on', true);
  if v_profile = 'surveillance' then
    perform private.demo_seed_departments_patients(v_org, p_actor);
    perform private.demo_seed_surveillance(v_org, p_actor);
    perform private.demo_seed_laboratory(v_org, p_actor);
    perform private.demo_seed_microbiology(v_org, p_actor);
    perform private.demo_seed_susceptibility(v_org, p_actor);
    perform private.demo_seed_hand_hygiene_employees(v_org, p_actor);
    perform private.demo_seed_patient_days(v_org, p_actor);
  else
    -- Empty: the same departments as the data pack, so department roles work.
    insert into public.departments(organization_id, code, name, department_type, is_active)
    select v_org, d.code, d.name, d.kind, true
    from (values ('ΜΕΘ','Μονάδα Εντατικής Θεραπείας','icu'),('ΠΑΘ','Παθολογική Κλινική','general'),
                 ('ΧΕΙΡ','Χειρουργική Κλινική','general'),('ΚΑΡΔ','Καρδιολογική Κλινική','general'),
                 ('ΟΡΘ','Ορθοπαιδική Κλινική','general'),('ΝΕΦ','Νεφρολογική Κλινική','general'),
                 ('ΠΑΙΔ','Παιδιατρική Κλινική','general'),('ΜΕΝΝ','Μονάδα Εντατικής Νοσηλείας Νεογνών','nicu')) d(code,name,kind)
    on conflict (organization_id, name) do nothing;
  end if;

  return jsonb_build_object(
    'ok', true,
    'profile', v_profile,
    'departments', (select count(*) from public.departments x where x.organization_id = v_org),
    'patients', (select count(*) from public.patients x where x.organization_id = v_org),
    'surveillanceCases', (select count(*) from public.surveillance_cases x where x.organization_id = v_org),
    'laboratorySamples', (select count(*) from public.laboratory_samples x where x.organization_id = v_org),
    'microbiologyResults', (select count(*) from public.microbiology_results x where x.organization_id = v_org),
    'handHygieneSessions', (select count(*) from public.hand_hygiene_sessions x where x.organization_id = v_org),
    'employees', (select count(*) from public.employees x where x.organization_id = v_org)
  );
end;
$function$;
revoke all on function private.demo_seed_profile(uuid, uuid, text) from public, anon, authenticated;

create or replace function public.platform_reset_demo_organization(p_organization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_platform_owner, false)
  ) then
    raise exception 'Platform Owner access required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations o where o.id = p_organization_id and o.is_demo) then
    raise exception 'Only Demo organizations can be reset' using errcode = '42501';
  end if;

  perform private.demo_wipe_data(p_organization_id);
  return private.demo_seed_profile(p_organization_id, auth.uid(),
    coalesce((select e.seed_profile from public.platform_demo_entitlements e where e.organization_id = p_organization_id order by e.created_at desc limit 1), 'full'));
end;
$function$;
