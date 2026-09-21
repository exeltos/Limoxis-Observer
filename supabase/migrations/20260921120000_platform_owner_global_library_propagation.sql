-- Lets the Platform Owner edit a "system" library item once, from a global
-- (organization_id is null) master row, and have the change fan out to every
-- organization's own copy. Previously each organization only got a static,
-- disconnected snapshot of the baseline catalog at creation time.

alter table public.master_library_items alter column organization_id drop not null;

alter table public.master_library_items
  add column if not exists origin_item_id uuid references public.master_library_items(id) on delete set null;

create index if not exists master_library_items_origin_item_id_idx
  on public.master_library_items(origin_item_id);

-- Backfill: one global master row per distinct baseline (library_key, code)
-- already duplicated across organizations, linking their existing copies to it.
alter table public.master_library_items disable trigger trg_audit_master_library_items;
do $$
declare
  rec record;
  new_id uuid;
begin
  for rec in
    select distinct on (library_key, code) library_key, code, name_el, name_en, source_authority, source_version
    from public.master_library_items
    where organization_id is not null
      and code is not null
      and coalesce(metadata->>'system','false') = 'true'
    order by library_key, code, created_at
  loop
    insert into public.master_library_items(
      organization_id, library_key, code, name_el, name_en, metadata, source_authority, source_version, is_active
    ) values (
      null, rec.library_key, rec.code, rec.name_el, rec.name_en,
      jsonb_build_object('system', true, 'locked', true, 'baseline_code', rec.code),
      rec.source_authority, rec.source_version, true
    )
    returning id into new_id;

    update public.master_library_items
    set origin_item_id = new_id
    where organization_id is not null
      and library_key = rec.library_key
      and code = rec.code
      and coalesce(metadata->>'system','false') = 'true';
  end loop;
end $$;
alter table public.master_library_items enable trigger trg_audit_master_library_items;

-- Fan-out trigger: any insert/update/delete on a global master row (organization_id
-- is null) is mirrored onto every organization's linked copy (origin_item_id).
-- Per-organization writes (organization_id is not null) are untouched.
create or replace function private.propagate_master_library_global_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.organization_id is not null then return new; end if;
    insert into public.master_library_items(
      organization_id, library_key, code, name_el, name_en, metadata, source_authority, source_version, is_active, origin_item_id
    )
    select o.id, new.library_key, new.code, new.name_el, new.name_en,
           jsonb_build_object('system', true, 'locked', true, 'baseline_code', new.code),
           new.source_authority, new.source_version, new.is_active, new.id
    from public.organizations o
    on conflict (organization_id, library_key, name_el) do nothing;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.organization_id is not null then return new; end if;
    update public.master_library_items
    set name_el = new.name_el,
        name_en = new.name_en,
        source_authority = new.source_authority,
        source_version = new.source_version,
        is_active = new.is_active,
        metadata = jsonb_build_object('system', true, 'locked', true, 'baseline_code', new.code)
    where origin_item_id = new.id;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.organization_id is not null then return old; end if;
    update public.master_library_items set is_active = false where origin_item_id = old.id;
    return old;
  end if;

  return coalesce(new, old);
end;
$$;

revoke all on function private.propagate_master_library_global_item() from public,anon,authenticated;

drop trigger if exists master_library_items_propagate on public.master_library_items;
create trigger master_library_items_propagate
after insert or update or delete on public.master_library_items
for each row execute function private.propagate_master_library_global_item();

-- New organizations should inherit the *current* global catalog (linked), not
-- just the static baseline VALUES list, so future global additions reach them too.
create or replace function private.seed_system_master_libraries_on_org_create()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.seed_system_master_libraries(new.id);
  insert into public.master_library_items(
    organization_id, library_key, code, name_el, name_en, metadata, source_authority, source_version, is_active, origin_item_id
  )
  select new.id, g.library_key, g.code, g.name_el, g.name_en,
         jsonb_build_object('system', true, 'locked', true, 'baseline_code', g.code),
         g.source_authority, g.source_version, g.is_active, g.id
  from public.master_library_items g
  where g.organization_id is null
  on conflict (organization_id, library_key, name_el) do update set origin_item_id = excluded.origin_item_id;
  return new;
end;
$$;

revoke all on function private.seed_system_master_libraries_on_org_create() from public,anon,authenticated;
