-- Regulations: each hospital's controlled regulations (infection control,
-- healthcare waste…), written from templates the platform publishes and read
-- by the staff as a book.
--
-- regulation_templates          the platform's templates (no organization): the
--                               current version of each, readable by everyone
--                               signed in, written by the platform owner.
-- regulation_template_versions  every published version of a template, so a
--                               hospital sees what changed since its copy.
-- regulations                   one hospital's regulation: its approved edition
--                               (content), the template it came from and the
--                               template version it has reviewed. Readable by
--                               the whole organization.
-- regulation_drafts             the edition being written: only those who edit
--                               regulations see it. Approving it marks it done
--                               (active = false); the next edit starts it again.
-- regulation_editions           every approved edition, kept unchanged.
--
-- Content is {chapters: [{id, title, sections: [{id, origin, title, html}]}]};
-- `origin` names the template section a section came from.

create table if not exists public.regulation_templates (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  title text not null,
  title_en text,
  category text not null default 'infection' check (category in ('infection','waste','safety','food','other')),
  description text,
  sources text,
  version integer not null default 1 check (version > 0),
  content jsonb not null default '{"chapters":[]}'::jsonb check (jsonb_typeof(content->'chapters') = 'array'),
  change_note text,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.regulation_template_versions (
  template_key text not null references public.regulation_templates(key) on delete cascade,
  version integer not null,
  content jsonb not null,
  change_note text,
  published_at timestamptz not null default now(),
  published_by uuid default auth.uid(),
  primary key (template_key, version)
);

create table if not exists public.regulations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  title text not null,
  category text not null default 'infection' check (category in ('infection','waste','safety','food','other')),
  description text,
  template_key text references public.regulation_templates(key) on delete set null,
  template_version integer,
  edition integer not null default 0 check (edition >= 0),
  issued_on date,
  approved_at timestamptz,
  approved_by uuid,
  approved_by_name text,
  content jsonb not null default '{"chapters":[]}'::jsonb check (jsonb_typeof(content->'chapters') = 'array'),
  archived boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (id, organization_id)
);
create index if not exists regulations_org_idx on public.regulations (organization_id, archived);

create table if not exists public.regulation_drafts (
  regulation_id uuid primary key,
  organization_id uuid not null,
  content jsonb not null check (jsonb_typeof(content->'chapters') = 'array'),
  change_note text,
  active boolean not null default true,
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  foreign key (regulation_id, organization_id) references public.regulations(id, organization_id) on delete cascade
);

create table if not exists public.regulation_editions (
  id uuid primary key default gen_random_uuid(),
  regulation_id uuid not null,
  organization_id uuid not null,
  edition integer not null check (edition > 0),
  content jsonb not null,
  change_note text,
  issued_on date,
  template_version integer,
  approved_at timestamptz not null default now(),
  approved_by uuid default auth.uid(),
  approved_by_name text,
  unique (regulation_id, edition),
  foreign key (regulation_id, organization_id) references public.regulations(id, organization_id) on delete cascade
);

-- Who writes and approves a hospital's regulations.
create or replace function private.can_manage_regulations(p_org uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.current_user_is_platform_owner()
    or public.current_user_has_org_role(p_org, array['hospital_admin'::public.app_role,'quality_manager'::public.app_role,'infection_control_lead'::public.app_role])
    or public.current_user_has_capability(p_org, 'manage_quality')
    or public.current_user_has_governance_capability(p_org, 'manage_documents');
$$;
revoke all on function private.can_manage_regulations(uuid) from public, anon;
grant execute on function private.can_manage_regulations(uuid) to authenticated;

alter table public.regulation_templates enable row level security;
alter table public.regulation_template_versions enable row level security;
alter table public.regulations enable row level security;
alter table public.regulation_drafts enable row level security;
alter table public.regulation_editions enable row level security;

drop policy if exists regulation_templates_read on public.regulation_templates;
create policy regulation_templates_read on public.regulation_templates for select to authenticated using (true);
drop policy if exists regulation_templates_write on public.regulation_templates;
create policy regulation_templates_write on public.regulation_templates for all to authenticated
  using (public.current_user_is_platform_owner()) with check (public.current_user_is_platform_owner());

drop policy if exists regulation_template_versions_read on public.regulation_template_versions;
create policy regulation_template_versions_read on public.regulation_template_versions for select to authenticated using (true);
drop policy if exists regulation_template_versions_write on public.regulation_template_versions;
create policy regulation_template_versions_write on public.regulation_template_versions for insert to authenticated
  with check (public.current_user_is_platform_owner());

drop policy if exists regulations_read on public.regulations;
create policy regulations_read on public.regulations for select to authenticated
  using (public.is_org_member(organization_id) or public.current_user_is_platform_owner());
drop policy if exists regulations_manage on public.regulations;
create policy regulations_manage on public.regulations for all to authenticated
  using (private.can_manage_regulations(organization_id)) with check (private.can_manage_regulations(organization_id));

drop policy if exists regulation_drafts_manage on public.regulation_drafts;
create policy regulation_drafts_manage on public.regulation_drafts for all to authenticated
  using (private.can_manage_regulations(organization_id)) with check (private.can_manage_regulations(organization_id));

drop policy if exists regulation_editions_read on public.regulation_editions;
create policy regulation_editions_read on public.regulation_editions for select to authenticated
  using (public.is_org_member(organization_id) or public.current_user_is_platform_owner());
drop policy if exists regulation_editions_insert on public.regulation_editions;
create policy regulation_editions_insert on public.regulation_editions for insert to authenticated
  with check (private.can_manage_regulations(organization_id));

revoke all on public.regulation_templates, public.regulation_template_versions, public.regulations, public.regulation_drafts, public.regulation_editions from anon;
grant select on public.regulation_templates, public.regulation_template_versions to authenticated;
grant insert, update, delete on public.regulation_templates to authenticated;
grant insert on public.regulation_template_versions to authenticated;
grant select, insert, update, delete on public.regulations, public.regulation_drafts to authenticated;
grant select, insert on public.regulation_editions to authenticated;
-- Editions and template versions are a record: kept, never changed.
revoke update, delete on public.regulation_editions, public.regulation_template_versions from authenticated;

create or replace trigger trg_regulations_touch before update on public.regulations
  for each row execute function private.department_register_touch();
create or replace trigger trg_regulation_templates_touch before update on public.regulation_templates
  for each row execute function private.department_register_touch();

-- Approves the draft as the next edition, in one step: the edition is kept,
-- the regulation shows it, the draft is marked done. Runs as the caller.
create or replace function public.regulation_approve(p_regulation_id uuid, p_change_note text, p_issued_on date, p_approved_by_name text)
returns integer language plpgsql volatile set search_path = ''
as $function$
declare
  v_regulation public.regulations;
  v_draft public.regulation_drafts;
  v_edition integer;
begin
  select * into v_regulation from public.regulations where id = p_regulation_id for update;
  if v_regulation.id is null or not private.can_manage_regulations(v_regulation.organization_id) then raise exception 'REGULATION_NOT_ALLOWED'; end if;
  select * into v_draft from public.regulation_drafts where regulation_id = p_regulation_id and active;
  if v_draft.regulation_id is null then raise exception 'REGULATION_NO_DRAFT'; end if;
  v_edition := v_regulation.edition + 1;
  insert into public.regulation_editions (regulation_id, organization_id, edition, content, change_note, issued_on, template_version, approved_by_name)
    values (v_regulation.id, v_regulation.organization_id, v_edition, v_draft.content, nullif(btrim(coalesce(p_change_note, '')), ''), coalesce(p_issued_on, current_date), v_regulation.template_version, nullif(btrim(coalesce(p_approved_by_name, '')), ''));
  update public.regulations set content = v_draft.content, edition = v_edition, issued_on = coalesce(p_issued_on, current_date),
    approved_at = now(), approved_by = auth.uid(), approved_by_name = nullif(btrim(coalesce(p_approved_by_name, '')), '')
    where id = v_regulation.id;
  update public.regulation_drafts set active = false, change_note = null where regulation_id = v_regulation.id;
  return v_edition;
end;
$function$;
revoke all on function public.regulation_approve(uuid, text, date, text) from public, anon;
grant execute on function public.regulation_approve(uuid, text, date, text) to authenticated;

-- The platform publishes a new version of a template: the version is kept so
-- each hospital can compare it with the one its regulation follows.
create or replace function public.regulation_template_publish(p_key text, p_title text, p_description text, p_sources text, p_content jsonb, p_change_note text)
returns integer language plpgsql volatile set search_path = ''
as $function$
declare
  v_version integer;
begin
  if not public.current_user_is_platform_owner() then raise exception 'REGULATION_NOT_ALLOWED'; end if;
  if jsonb_typeof(p_content->'chapters') <> 'array' then raise exception 'REGULATION_CONTENT_INVALID'; end if;
  update public.regulation_templates set version = version + 1, title = coalesce(nullif(btrim(p_title), ''), title), description = p_description, sources = p_sources,
    content = p_content, change_note = nullif(btrim(coalesce(p_change_note, '')), ''), published_at = now()
    where key = p_key returning version into v_version;
  if v_version is null then raise exception 'REGULATION_TEMPLATE_UNKNOWN'; end if;
  insert into public.regulation_template_versions (template_key, version, content, change_note) values (p_key, v_version, p_content, nullif(btrim(coalesce(p_change_note, '')), ''));
  return v_version;
end;
$function$;
revoke all on function public.regulation_template_publish(text, text, text, text, jsonb, text) from public, anon;
grant execute on function public.regulation_template_publish(text, text, text, text, jsonb, text) to authenticated;
