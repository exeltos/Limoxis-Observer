-- Συνεντεύξεις: τη θέση, τον χώρο (κατηγορία) και το είδος απασχόλησης τα διαλέγει το Γραφείο Προσωπικού
-- πριν δώσει το tablet· ο υποψήφιος δεν τα συμπληρώνει. Οι τιμές μένουν στον σύνδεσμο.
alter table public.hr_application_links add column if not exists professional_category text
  check (professional_category is null or professional_category in ('nursing','medical','paramedical','administrative','technical','support','other'));
alter table public.hr_application_links add column if not exists employment_type text
  check (employment_type is null or employment_type in ('full_time','part_time','seasonal','internship','other'));

-- Ορίζει τον χώρο και το είδος απασχόλησης ενός συνδέσμου που μόλις δημιουργήθηκε.
create or replace function public.hr_application_link_set(p_link_id uuid, p_category text, p_employment text)
returns void language plpgsql volatile security definer set search_path = ''
as $function$
declare
  v_org uuid;
begin
  select l.organization_id into v_org from public.hr_application_links l where l.id = p_link_id and l.used_at is null and l.cancelled_at is null;
  if v_org is null or not public.current_user_has_capability(v_org, 'manage_interviews') then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  update public.hr_application_links set
    professional_category = nullif(btrim(coalesce(p_category, '')), ''),
    employment_type = nullif(btrim(coalesce(p_employment, '')), '')
  where id = p_link_id;
end;
$function$;
revoke all on function public.hr_application_link_set(uuid, text, text) from public, anon;
grant execute on function public.hr_application_link_set(uuid, text, text) to authenticated;

-- Το tablet παίρνει τις τιμές του συνδέσμου· η υποβολή προτιμά τις τιμές του συνδέσμου από όσα έστειλε το tablet.
do $migration$
declare
  v_def text; v_new text;
begin
  v_def := pg_get_functiondef('public.hr_application_public(text)'::regprocedure);
  if position('professionalCategory' in v_def) = 0 then
    v_new := replace(v_def, '''position'', v_link.requested_position,', '''position'', v_link.requested_position, ''professionalCategory'', v_link.professional_category, ''employmentType'', v_link.employment_type,');
    if v_new = v_def then raise exception 'hr_application_public: the expected text was not found'; end if;
    execute v_new;
  end if;

  v_def := pg_get_functiondef('public.hr_application_submit(text, jsonb)'::regprocedure);
  if position('v_link.professional_category' in v_def) = 0 then
    v_new := replace(v_def,
      'case when v_p ->> ''professionalCategory'' in (''nursing'',''medical'',''paramedical'',''administrative'',''technical'',''support'',''other'') then v_p ->> ''professionalCategory'' end,',
      'coalesce(v_link.professional_category, case when v_p ->> ''professionalCategory'' in (''nursing'',''medical'',''paramedical'',''administrative'',''technical'',''support'',''other'') then v_p ->> ''professionalCategory'' end),');
    v_new := replace(v_new,
      'case when v_p ->> ''employmentType'' in (''full_time'',''part_time'',''seasonal'',''internship'',''other'') then v_p ->> ''employmentType'' end,',
      'coalesce(v_link.employment_type, case when v_p ->> ''employmentType'' in (''full_time'',''part_time'',''seasonal'',''internship'',''other'') then v_p ->> ''employmentType'' end),');
    if position('v_link.professional_category' in v_new) = 0 or position('v_link.employment_type' in v_new) = 0 then raise exception 'hr_application_submit: the expected text was not found'; end if;
    execute v_new;
  end if;
end;
$migration$;
