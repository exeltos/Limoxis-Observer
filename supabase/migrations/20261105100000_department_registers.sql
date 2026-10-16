-- Quality Center, phase 4: department registers and their indicators.
--
-- Departments keep registers today in FileMaker (docs/quality/
-- DEPARTMENT_REGISTERS_FILEMAKER.md): a form per case (one neonate in the NICU)
-- or a sheet per period (procedures per month in Ophthalmology). Here the
-- Quality team defines a register once and the department records into it.
--
-- The definition is relational, one row per thing:
--   department_registers                   the register (department, kind, its data table)
--   department_register_sections           the sections of the case form
--   department_register_fields             one row per field: type, unit, limits, rules
--   department_register_options            the values of a list field
--   department_register_sheet_axes         the rows, measures and groups of a sheet
--   department_register_indicators         one row per indicator: aggregation, target, limit
--   department_register_indicator_filters  which cases an indicator counts
--
-- The data is a real table per register, one column per field with its own
-- type (date, numeric, boolean, text for a list value, text[] for several),
-- created and extended by department_register_sync() whenever Quality adds a
-- field: public.register_<name>_<id> holds the values (no names), and
-- public.register_<name>_<id>_identity the case number and name, readable only
-- inside the department. Length of stay and age are generated columns, so the
-- database computes them. A field taken out of the form is archived: its
-- column and its data stay.
--
-- Read: Quality (roles, view_quality) and the register's department.
-- Define: hospital administrators, quality managers, manage_quality.
-- Record: the register's department (department scope) and hospital
-- administrators. A closed period (locked) changes only after Quality or a
-- department manager reopens it.

-- --- Definition ----------------------------------------------------------------

create table if not exists public.department_registers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  code text not null,
  name_el text not null,
  name_en text,
  description_el text,
  description_en text,
  kind text not null default 'case' check (kind in ('case','sheet')),
  status text not null default 'active' check (status in ('draft','active','archived')),
  version integer not null default 1,
  template_key text,
  entry_date_field text,
  sheet_period text not null default 'month' check (sheet_period in ('month')),
  identity_case_number boolean not null default true,
  identity_patient_name boolean not null default true,
  table_name text unique,
  history jsonb not null default '[]'::jsonb check (jsonb_typeof(history) = 'array'),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (id, organization_id)
);
create index if not exists department_registers_org_department_idx on public.department_registers (organization_id, department_id);
comment on table public.department_registers is 'A department register defined by Quality. Its data lives in table_name, one column per field.';

create table if not exists public.department_register_sections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  register_id uuid not null,
  key text not null check (key ~ '^[a-z][a-z0-9_]{0,40}$'),
  label_el text not null,
  label_en text,
  position integer not null default 0,
  unique (register_id, key),
  foreign key (register_id, organization_id) references public.department_registers(id, organization_id) on delete cascade
);

-- Keys become column names: lower-case latin, at most 41 characters, never a
-- column the data table already has.
create table if not exists public.department_register_fields (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  register_id uuid not null,
  key text not null check (key ~ '^[a-z][a-z0-9_]{0,40}$' and key not in ('id','organization_id','department_id','register_id','entry_date','period_start','status','locked','definition_version','created_by','created_at','updated_by','updated_at')),
  section_key text,
  position integer not null default 0,
  field_type text not null check (field_type in ('number','date','yes_no','choice','multi_choice','gestation','text','computed')),
  label_el text not null,
  label_en text,
  unit_el text,
  unit_en text,
  min_value numeric,
  max_value numeric,
  usual_min numeric,
  usual_max numeric,
  required boolean not null default false,
  in_list boolean not null default false,
  in_breakdown boolean not null default false,
  provisional boolean not null default false,
  help_el text,
  help_en text,
  not_before_key text,
  show_when_key text,
  show_when_value text,
  computed_kind text check (computed_kind in ('days','age_days','age_years')),
  computed_from text,
  computed_to text,
  aliases text[] not null default '{}',
  archived boolean not null default false,
  unique (register_id, key),
  unique (id, register_id),
  foreign key (register_id, organization_id) references public.department_registers(id, organization_id) on delete cascade,
  check (field_type <> 'computed' or (computed_kind is not null and computed_from is not null and computed_to is not null))
);
comment on table public.department_register_fields is 'One field of a department register; key is its column in the register''s data table.';

create table if not exists public.department_register_options (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  register_id uuid not null,
  field_id uuid not null,
  value text not null check (value ~ '^[a-z0-9][a-z0-9_]{0,40}$'),
  label_el text not null,
  label_en text,
  position integer not null default 0,
  match text[] not null default '{}',
  archived boolean not null default false,
  unique (field_id, value),
  foreign key (field_id, register_id) references public.department_register_fields(id, register_id) on delete cascade,
  foreign key (register_id, organization_id) references public.department_registers(id, organization_id) on delete cascade
);
comment on column public.department_register_options.match is 'Beginnings of the FileMaker values this option takes on import.';

create table if not exists public.department_register_sheet_axes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  register_id uuid not null,
  axis text not null check (axis in ('row','measure','group')),
  key text not null check (key ~ '^[a-z][a-z0-9_]{0,30}$'),
  label_el text not null,
  label_en text,
  help_el text,
  help_en text,
  group_key text,
  position integer not null default 0,
  aliases text[] not null default '{}',
  archived boolean not null default false,
  unique (register_id, axis, key),
  foreign key (register_id, organization_id) references public.department_registers(id, organization_id) on delete cascade
);
comment on table public.department_register_sheet_axes is 'Rows (procedures), measures (number, shift) and row groups of a sheet register; each row × measure is a column <row>__<measure>.';

create table if not exists public.department_register_indicators (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  register_id uuid not null,
  key text not null check (key ~ '^[a-z][a-z0-9_]{0,40}$'),
  position integer not null default 0,
  title_el text not null,
  title_en text,
  aggregation text not null check (aggregation in ('count','percent','mean','median','sum','rate')),
  field_key text,
  date_field_key text,
  denominator_field_key text,
  multiplier numeric,
  sheet_rows text[] not null default '{}',
  sheet_measure text,
  denominator_rows text[] not null default '{}',
  denominator_measure text,
  unit_el text,
  unit_en text,
  target numeric,
  threshold numeric,
  direction text not null default 'context' check (direction in ('higher','lower','context')),
  note_el text,
  note_en text,
  archived boolean not null default false,
  unique (register_id, key),
  unique (id, register_id),
  foreign key (register_id, organization_id) references public.department_registers(id, organization_id) on delete cascade
);

create table if not exists public.department_register_indicator_filters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  register_id uuid not null,
  indicator_id uuid not null,
  part text not null check (part in ('numerator','denominator')),
  position integer not null default 0,
  field_key text not null,
  op text not null check (op in ('yes','no','eq','filled','empty','gt','lt')),
  value text,
  foreign key (indicator_id, register_id) references public.department_register_indicators(id, register_id) on delete cascade,
  foreign key (register_id, organization_id) references public.department_registers(id, organization_id) on delete cascade
);

create or replace function private.department_register_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.department_register_touch() from public, anon, authenticated;
create or replace trigger trg_department_registers_touch before update on public.department_registers
  for each row execute function private.department_register_touch();

-- Definition access: Quality and the department read, Quality defines.
do $policies$
declare t text;
begin
  foreach t in array array['department_registers','department_register_sections','department_register_fields','department_register_options','department_register_sheet_axes','department_register_indicators','department_register_indicator_filters'] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_read') then
    execute format($p$create policy %1$s_read on public.%1$s for select to authenticated using (
      public.current_user_is_platform_owner()
      or public.current_user_has_org_role(organization_id, array['hospital_admin'::public.app_role,'quality_manager'::public.app_role,'infection_control_lead'::public.app_role])
      or public.current_user_has_capability(organization_id, 'view_quality')
      or %2$s)$p$, t, case when t = 'department_registers'
        then '(department_id is not null and public.current_user_has_department_scope(organization_id, department_id))'
        else 'exists (select 1 from public.department_registers r where r.id = register_id and r.department_id is not null and public.current_user_has_department_scope(r.organization_id, r.department_id))' end);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_manage') then
    execute format($p$create policy %1$s_manage on public.%1$s for all to authenticated using (
      public.current_user_is_platform_owner()
      or public.current_user_has_org_role(organization_id, array['hospital_admin'::public.app_role,'quality_manager'::public.app_role])
      or public.current_user_has_capability(organization_id, 'manage_quality'))
      with check (
      public.current_user_is_platform_owner()
      or public.current_user_has_org_role(organization_id, array['hospital_admin'::public.app_role,'quality_manager'::public.app_role])
      or public.current_user_has_capability(organization_id, 'manage_quality'))$p$, t);
    end if;
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end
$policies$;

-- --- Data tables -----------------------------------------------------------------

-- Every row of a register's data table belongs to the register's organization
-- and department, whatever the client sends. TG_ARGV[0] is the register id.
create or replace function private.register_row_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare r record;
begin
  select organization_id, department_id, version, kind, entry_date_field into r from public.department_registers where id = tg_argv[0]::uuid;
  if not found then raise exception 'Unknown register'; end if;
  new.organization_id := r.organization_id;
  new.department_id := r.department_id;
  new.register_id := tg_argv[0]::uuid;
  -- The day the entry counts on: the period of a sheet, the register's date field of a case.
  if r.kind = 'sheet' and new.period_start is not null then new.entry_date := new.period_start;
  elsif r.entry_date_field is not null then new.entry_date := coalesce((to_jsonb(new) ->> r.entry_date_field)::date, new.entry_date);
  end if;
  if tg_op = 'INSERT' then new.definition_version := coalesce(r.version, 1); new.created_by := coalesce(new.created_by, auth.uid()); end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
revoke all on function private.register_row_scope() from public, anon, authenticated;

-- The identity row takes the organization and department of its entry.
create or replace function private.register_identity_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare e record;
begin
  execute format('select organization_id, department_id from public.%I where id = $1', tg_argv[0]) into e using new.entry_id;
  if not found then raise exception 'Unknown register entry'; end if;
  new.organization_id := e.organization_id;
  new.department_id := e.department_id;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.register_identity_scope() from public, anon, authenticated;

-- The SQL type of a field's column.
create or replace function private.register_column_sql(f public.department_register_fields)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  case f.field_type
    when 'number' then return 'numeric';
    when 'date' then return 'date';
    when 'yes_no' then return 'boolean';
    when 'choice' then return 'text';
    when 'multi_choice' then return 'text[]';
    when 'gestation' then return 'integer check (' || quote_ident(f.key) || ' between 0 and 400)';
    when 'text' then return 'text';
    when 'computed' then
      if f.computed_kind = 'age_years' then
        return format('integer generated always as (case when %2$I >= %1$I then date_part(''year'', age(%2$I::timestamp, %1$I::timestamp))::integer end) stored', f.computed_from, f.computed_to);
      end if;
      return format('integer generated always as (case when %2$I >= %1$I then %2$I - %1$I end) stored', f.computed_from, f.computed_to);
    else raise exception 'Unknown field type %', f.field_type;
  end case;
end;
$$;
revoke all on function private.register_column_sql(public.department_register_fields) from public, anon, authenticated;

-- Creates the data and identity tables of a register, or adds the columns of
-- its new fields and sheet cells. Columns are never dropped or retyped.
create or replace function public.department_register_sync(p_register_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.department_registers;
  f public.department_register_fields;
  cell record;
  base text;
  ident text;
begin
  select * into r from public.department_registers where id = p_register_id for update;
  if not found then raise exception 'Unknown register'; end if;
  if not (public.current_user_is_platform_owner()
    or public.current_user_has_org_role(r.organization_id, array['hospital_admin'::public.app_role,'quality_manager'::public.app_role])
    or public.current_user_has_capability(r.organization_id, 'manage_quality')) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  base := r.table_name;
  if base is null then
    base := 'register_' || left(regexp_replace(lower(coalesce(r.template_key, 'custom')), '[^a-z0-9]+', '_', 'g'), 20) || '_' || left(replace(r.id::text, '-', ''), 8);
    update public.department_registers set table_name = base where id = r.id;
  end if;
  ident := base || '_identity';

  execute format($t$create table if not exists public.%I (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    department_id uuid references public.departments(id) on delete set null,
    register_id uuid not null references public.department_registers(id) on delete cascade,
    entry_date date not null default current_date,
    period_start date unique,
    status text not null default 'complete' check (status in ('draft','complete')),
    locked boolean not null default false,
    definition_version integer not null default 1,
    created_by uuid default auth.uid(),
    created_at timestamptz not null default now(),
    updated_by uuid default auth.uid(),
    updated_at timestamptz not null default now())$t$, base);
  execute format('create index if not exists %I on public.%I (entry_date desc)', base || '_date_idx', base);
  execute format('comment on table public.%I is %L', base, 'Data of the register «' || r.name_el || '» (' || r.code || '): one column per field, no names.');
  execute format('create or replace trigger trg_register_row_scope before insert or update on public.%I for each row execute function private.register_row_scope(%L)', base, r.id);
  execute format('alter table public.%I enable row level security', base);
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = base and policyname = 'register_read') then
    execute format($p$create policy register_read on public.%I for select to authenticated using (
    public.current_user_is_platform_owner()
    or public.current_user_has_org_role(organization_id, array['hospital_admin'::public.app_role,'quality_manager'::public.app_role,'infection_control_lead'::public.app_role])
    or public.current_user_has_capability(organization_id, 'view_quality')
    or (department_id is not null and public.current_user_has_department_scope(organization_id, department_id)))$p$, base);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = base and policyname = 'register_insert') then
    execute format($p$create policy register_insert on public.%I for insert to authenticated with check (
    public.current_user_is_platform_owner()
    or public.current_user_has_org_role(organization_id, array['hospital_admin'::public.app_role])
    or exists (select 1 from public.department_registers d where d.id = register_id and d.status = 'active'
      and d.department_id is not null and public.current_user_has_department_scope(d.organization_id, d.department_id)))$p$, base);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = base and policyname = 'register_update') then
    execute format($p$create policy register_update on public.%I for update to authenticated using (
    public.current_user_is_platform_owner()
    or public.current_user_has_org_role(organization_id, array['hospital_admin'::public.app_role,'quality_manager'::public.app_role])
    or public.current_user_has_capability(organization_id, 'manage_quality')
    or (department_id is not null and public.current_user_has_department_scope(organization_id, department_id)
      and (not locked or public.current_user_has_org_role(organization_id, array['department_manager'::public.app_role]))))
    with check (
    public.current_user_is_platform_owner()
    or public.current_user_has_org_role(organization_id, array['hospital_admin'::public.app_role,'quality_manager'::public.app_role])
    or public.current_user_has_capability(organization_id, 'manage_quality')
    or (department_id is not null and public.current_user_has_department_scope(organization_id, department_id)))$p$, base);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = base and policyname = 'register_delete') then
    execute format($p$create policy register_delete on public.%I for delete to authenticated using (
    public.current_user_is_platform_owner()
    or public.current_user_has_org_role(organization_id, array['hospital_admin'::public.app_role])
    or (not locked and department_id is not null and public.current_user_has_department_scope(organization_id, department_id)))$p$, base);
  end if;
  execute format('revoke all on public.%I from anon', base);
  execute format('grant select, insert, update, delete on public.%I to authenticated', base);

  -- Plain fields first, then the computed ones that read them.
  for f in select * from public.department_register_fields where register_id = r.id and not archived order by (field_type = 'computed'), position loop
    if not exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = base and c.column_name = f.key) then
      execute format('alter table public.%I add column %I %s', base, f.key, private.register_column_sql(f));
    end if;
    execute format('comment on column public.%I.%I is %L', base, f.key, f.label_el || coalesce(' (' || f.unit_el || ')', ''));
  end loop;

  for cell in
    select rw.key || '__' || m.key as column_name, rw.label_el || ' · ' || m.label_el as label
    from public.department_register_sheet_axes rw
    join public.department_register_sheet_axes m on m.register_id = rw.register_id and m.axis = 'measure' and not m.archived
    where rw.register_id = r.id and rw.axis = 'row' and not rw.archived
  loop
    if not exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = base and c.column_name = cell.column_name) then
      execute format('alter table public.%I add column %I integer check (%I >= 0)', base, cell.column_name, cell.column_name);
    end if;
    execute format('comment on column public.%I.%I is %L', base, cell.column_name, cell.label);
  end loop;

  if r.kind = 'case' then
    execute format($t$create table if not exists public.%I (
      entry_id uuid primary key references public.%I(id) on delete cascade,
      organization_id uuid not null references public.organizations(id) on delete cascade,
      department_id uuid references public.departments(id) on delete set null,
      case_number text,
      patient_name text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now())$t$, ident, base);
    execute format('create index if not exists %I on public.%I (case_number)', ident || '_case_idx', ident);
    execute format('comment on table public.%I is %L', ident, 'Who each entry of «' || r.name_el || '» is about. Readable only inside the department.');
    execute format('create or replace trigger trg_register_identity_scope before insert or update on public.%I for each row execute function private.register_identity_scope(%L)', ident, base);
    execute format('alter table public.%I enable row level security', ident);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = ident and policyname = 'register_identity_department') then
      execute format($p$create policy register_identity_department on public.%I for all to authenticated using (
      public.current_user_is_platform_owner()
      or (department_id is not null and public.current_user_has_department_scope(organization_id, department_id)))
      with check (
      public.current_user_is_platform_owner()
      or exists (select 1 from public.%I e where e.id = entry_id
        and e.department_id is not null and public.current_user_has_department_scope(e.organization_id, e.department_id)))$p$, ident, base);
    end if;
    execute format('revoke all on public.%I from anon', ident);
    execute format('grant select, insert, update, delete on public.%I to authenticated', ident);
  end if;

  notify pgrst, 'reload schema';
  return base;
end;
$$;
revoke all on function public.department_register_sync(uuid) from public, anon;
grant execute on function public.department_register_sync(uuid) to authenticated;
comment on function public.department_register_sync(uuid) is 'Creates or extends the data table of a department register from its fields (Quality only).';
