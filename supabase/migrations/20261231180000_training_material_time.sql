-- Time spent by each participant on the files of a training programme (the programme's
-- «Material»): active seconds per assignment and file, and per page of a PDF.
--
-- Written only by training_track_time(), which the participant's personal link calls
-- every few seconds while the file is open and the tab is visible and in use (the page
-- sends at most 30 seconds per call; the database accepts no more than the time that
-- really passed since the previous call, so a script cannot inflate the figure).
-- Read by the people who may read the assignment (managers, HR, the department scope,
-- the participant) through the assignment's own policy.
--
-- The list of the files of the programme for the personal link is training_access_files();
-- the file itself is served by the training-material-url function after the same check.

create table if not exists public.training_material_views (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assignment_id uuid not null,
  program_id uuid not null,
  attachment_id uuid not null references public.attachments(id) on delete cascade,
  active_seconds integer not null default 0 check (active_seconds >= 0),
  pages jsonb not null default '{}'::jsonb check (jsonb_typeof(pages) = 'object'),
  last_page integer check (last_page is null or last_page >= 1),
  opened_count integer not null default 1 check (opened_count >= 1),
  first_opened_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (assignment_id, attachment_id),
  foreign key (assignment_id, organization_id) references public.training_assignments (id, organization_id) on delete cascade
);
create index if not exists training_material_views_program_idx on public.training_material_views (program_id, organization_id);

alter table public.training_material_views enable row level security;
grant select on table public.training_material_views to authenticated;
grant all on table public.training_material_views to service_role;

do $policy$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'training_material_views' and policyname = 'training_material_views_read') then
    create policy training_material_views_read on public.training_material_views for select to authenticated
      using (exists (select 1 from public.training_assignments a where a.id = assignment_id and a.organization_id = training_material_views.organization_id));
  end if;
end;
$policy$;

-- The files of the programme behind a personal link, with this participant's time on each.
create or replace function public.training_access_files(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth','pg_temp'
as $function$
declare
  v_assignment public.training_assignments%rowtype;
begin
  if nullif(btrim(coalesce(p_token, '')), '') is null then raise exception 'TRAINING_ACCESS_NOT_AVAILABLE'; end if;
  select * into v_assignment from public.training_assignments a where a.access_token = p_token limit 1;
  if not found then raise exception 'TRAINING_ACCESS_NOT_AVAILABLE'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', f.id, 'fileName', f.file_name, 'mimeType', f.mime_type, 'sizeBytes', f.size_bytes,
      'activeSeconds', coalesce(v.active_seconds, 0), 'lastPage', v.last_page
    ) order by f.created_at)
    from public.attachments f
    left join public.training_material_views v on v.attachment_id = f.id and v.assignment_id = v_assignment.id
    where f.organization_id = v_assignment.organization_id and f.entity_type = 'training_program'
      and f.entity_id = v_assignment.program_id::text and f.deleted_at is null
  ), '[]'::jsonb);
end;
$function$;

-- Adds the active time of the participant on one file (and page). Returns the totals.
create or replace function public.training_track_time(p_token text, p_attachment_id uuid, p_seconds integer, p_page integer default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth','pg_temp'
as $function$
declare
  v_assignment public.training_assignments%rowtype;
  v_row public.training_material_views%rowtype;
  v_now timestamptz := now();
  v_asked integer := greatest(0, least(coalesce(p_seconds, 0), 30));
  v_allowed integer;
  v_page text := case when p_page is not null and p_page >= 1 and p_page <= 5000 then p_page::text end;
begin
  if nullif(btrim(coalesce(p_token, '')), '') is null then raise exception 'TRAINING_ACCESS_NOT_AVAILABLE'; end if;
  select * into v_assignment from public.training_assignments a where a.access_token = p_token limit 1;
  if not found then raise exception 'TRAINING_ACCESS_NOT_AVAILABLE'; end if;
  -- A completed or cancelled assignment no longer collects time.
  if v_assignment.status in ('completed', 'cancelled') then
    return jsonb_build_object('activeSeconds', coalesce((select active_seconds from public.training_material_views where assignment_id = v_assignment.id and attachment_id = p_attachment_id), 0), 'counted', 0);
  end if;
  if not exists (
    select 1 from public.attachments f
    where f.id = p_attachment_id and f.organization_id = v_assignment.organization_id and f.entity_type = 'training_program'
      and f.entity_id = v_assignment.program_id::text and f.deleted_at is null
  ) then raise exception 'TRAINING_MATERIAL_NOT_AVAILABLE'; end if;

  select * into v_row from public.training_material_views where assignment_id = v_assignment.id and attachment_id = p_attachment_id for update;
  if not found then
    -- The first call: the file has just been opened (a few seconds at most).
    v_allowed := least(v_asked, 15);
    insert into public.training_material_views (organization_id, assignment_id, program_id, attachment_id, active_seconds, pages, last_page, first_opened_at, last_seen_at)
    values (v_assignment.organization_id, v_assignment.id, v_assignment.program_id, p_attachment_id, v_allowed,
      case when v_page is not null then jsonb_build_object(v_page, v_allowed) else '{}'::jsonb end, p_page, v_now, v_now)
    returning * into v_row;
  else
    -- No more than the time that passed since the previous call (and two seconds of slack).
    v_allowed := least(v_asked, greatest(0, floor(extract(epoch from (v_now - v_row.last_seen_at)))::integer + 2));
    update public.training_material_views set
      active_seconds = active_seconds + v_allowed,
      pages = case when v_page is not null then jsonb_set(pages, array[v_page], to_jsonb(coalesce((pages ->> v_page)::integer, 0) + v_allowed)) else pages end,
      last_page = coalesce(case when v_page is not null then p_page end, last_page),
      opened_count = opened_count + case when v_now - v_row.last_seen_at > interval '10 minutes' then 1 else 0 end,
      last_seen_at = v_now
    where id = v_row.id
    returning * into v_row;
  end if;
  return jsonb_build_object('activeSeconds', v_row.active_seconds, 'counted', v_allowed);
end;
$function$;

grant execute on function public.training_access_files(text) to anon, authenticated;
grant execute on function public.training_track_time(text, uuid, integer, integer) to anon, authenticated;
