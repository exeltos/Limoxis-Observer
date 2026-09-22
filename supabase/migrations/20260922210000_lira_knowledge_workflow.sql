-- LIRA Phase 2C: approval + ingestion workflow foundations.
alter table public.lira_knowledge_sources
  add column if not exists review_notes text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists ingestion_status text not null default 'pending'
    check (ingestion_status in ('pending','ready','ingested','failed'));

create or replace function public.approve_lira_knowledge_source(
  p_source_id uuid,
  p_review_notes text default null
) returns public.lira_knowledge_sources
language plpgsql
security invoker
set search_path=''
as $$
declare v_source public.lira_knowledge_sources;
begin
  select * into v_source from public.lira_knowledge_sources where id=p_source_id for update;
  if not found then raise exception 'LIRA knowledge source not found'; end if;
  if not (
    (v_source.organization_id is null and public.current_user_is_platform_owner())
    or
    (v_source.organization_id is not null and public.current_user_has_capability(v_source.organization_id,'manage_libraries'))
  ) then raise exception 'Not authorized to approve LIRA knowledge source'; end if;
  if nullif(trim(v_source.source_version),'') is null then raise exception 'Source version is required before approval'; end if;
  update public.lira_knowledge_sources
  set status='approved',review_notes=p_review_notes,reviewed_by=(select auth.uid()),reviewed_at=now(),
      approved_by=(select auth.uid()),approved_at=now(),updated_by=(select auth.uid()),updated_at=now()
  where id=p_source_id returning * into v_source;
  return v_source;
end $$;

revoke all on function public.approve_lira_knowledge_source(uuid,text) from public,anon;
grant execute on function public.approve_lira_knowledge_source(uuid,text) to authenticated;

create or replace function public.retire_lira_knowledge_source(
  p_source_id uuid,
  p_review_notes text default null
) returns public.lira_knowledge_sources
language plpgsql
security invoker
set search_path=''
as $$
declare v_source public.lira_knowledge_sources;
begin
  select * into v_source from public.lira_knowledge_sources where id=p_source_id for update;
  if not found then raise exception 'LIRA knowledge source not found'; end if;
  if not (
    (v_source.organization_id is null and public.current_user_is_platform_owner())
    or
    (v_source.organization_id is not null and public.current_user_has_capability(v_source.organization_id,'manage_libraries'))
  ) then raise exception 'Not authorized to retire LIRA knowledge source'; end if;
  update public.lira_knowledge_sources
  set status='retired',review_notes=p_review_notes,reviewed_by=(select auth.uid()),reviewed_at=now(),
      updated_by=(select auth.uid()),updated_at=now()
  where id=p_source_id returning * into v_source;
  return v_source;
end $$;

revoke all on function public.retire_lira_knowledge_source(uuid,text) from public,anon;
grant execute on function public.retire_lira_knowledge_source(uuid,text) to authenticated;
