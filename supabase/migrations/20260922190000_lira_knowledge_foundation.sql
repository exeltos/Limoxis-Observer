-- LIRA Phase 2: governed knowledge foundation for permission-aware RAG.
-- Embeddings remain nullable until an embedding pipeline/model is approved.

create extension if not exists vector with schema extensions;

create table if not exists public.lira_knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  source_type text not null default 'guideline',
  title text not null,
  authority text not null,
  source_url text,
  source_version text,
  language text not null default 'el',
  status text not null default 'draft' check (status in ('draft','review','approved','retired')),
  effective_from date,
  effective_to date,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  content_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lira_knowledge_source_approval_ck check (
    status <> 'approved' or (approved_by is not null and approved_at is not null)
  )
);

create table if not exists public.lira_knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.lira_knowledge_sources(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  heading text,
  content text not null,
  citation_label text,
  page_start integer,
  page_end integer,
  token_count integer,
  content_hash text,
  embedding extensions.vector(384),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(source_id,chunk_index)
);

create index if not exists lira_knowledge_sources_org_status_idx
  on public.lira_knowledge_sources(organization_id,status);
create index if not exists lira_knowledge_sources_authority_idx
  on public.lira_knowledge_sources(authority);
create index if not exists lira_knowledge_chunks_source_idx
  on public.lira_knowledge_chunks(source_id);

alter table public.lira_knowledge_sources enable row level security;
alter table public.lira_knowledge_chunks enable row level security;

revoke all on public.lira_knowledge_sources from anon;
revoke all on public.lira_knowledge_chunks from anon;
grant select,insert,update,delete on public.lira_knowledge_sources to authenticated;
grant select,insert,update,delete on public.lira_knowledge_chunks to authenticated;

drop policy if exists lira_knowledge_sources_read on public.lira_knowledge_sources;
create policy lira_knowledge_sources_read on public.lira_knowledge_sources
for select to authenticated
using (
  (organization_id is null and status = 'approved')
  or (organization_id is not null and public.is_org_member(organization_id))
  or public.current_user_is_platform_owner()
);

drop policy if exists lira_knowledge_sources_insert on public.lira_knowledge_sources;
create policy lira_knowledge_sources_insert on public.lira_knowledge_sources
for insert to authenticated
with check (
  (organization_id is null and public.current_user_is_platform_owner())
  or (organization_id is not null and public.current_user_has_capability(organization_id,'manage_libraries'))
);

drop policy if exists lira_knowledge_sources_update on public.lira_knowledge_sources;
create policy lira_knowledge_sources_update on public.lira_knowledge_sources
for update to authenticated
using (
  (organization_id is null and public.current_user_is_platform_owner())
  or (organization_id is not null and public.current_user_has_capability(organization_id,'manage_libraries'))
)
with check (
  (organization_id is null and public.current_user_is_platform_owner())
  or (organization_id is not null and public.current_user_has_capability(organization_id,'manage_libraries'))
);

drop policy if exists lira_knowledge_sources_delete on public.lira_knowledge_sources;
create policy lira_knowledge_sources_delete on public.lira_knowledge_sources
for delete to authenticated
using (
  (organization_id is null and public.current_user_is_platform_owner())
  or (organization_id is not null and public.current_user_has_capability(organization_id,'manage_libraries'))
);

drop policy if exists lira_knowledge_chunks_read on public.lira_knowledge_chunks;
create policy lira_knowledge_chunks_read on public.lira_knowledge_chunks
for select to authenticated
using (
  exists (
    select 1 from public.lira_knowledge_sources s
    where s.id = source_id
      and (
        (s.organization_id is null and s.status = 'approved')
        or (s.organization_id is not null and public.is_org_member(s.organization_id))
        or public.current_user_is_platform_owner()
      )
  )
);

drop policy if exists lira_knowledge_chunks_insert on public.lira_knowledge_chunks;
create policy lira_knowledge_chunks_insert on public.lira_knowledge_chunks
for insert to authenticated
with check (
  exists (
    select 1 from public.lira_knowledge_sources s
    where s.id = source_id and (
      (s.organization_id is null and public.current_user_is_platform_owner())
      or (s.organization_id is not null and public.current_user_has_capability(s.organization_id,'manage_libraries'))
    )
  )
);

drop policy if exists lira_knowledge_chunks_update on public.lira_knowledge_chunks;
create policy lira_knowledge_chunks_update on public.lira_knowledge_chunks
for update to authenticated
using (
  exists (
    select 1 from public.lira_knowledge_sources s
    where s.id = source_id and (
      (s.organization_id is null and public.current_user_is_platform_owner())
      or (s.organization_id is not null and public.current_user_has_capability(s.organization_id,'manage_libraries'))
    )
  )
)
with check (
  exists (
    select 1 from public.lira_knowledge_sources s
    where s.id = source_id and (
      (s.organization_id is null and public.current_user_is_platform_owner())
      or (s.organization_id is not null and public.current_user_has_capability(s.organization_id,'manage_libraries'))
    )
  )
);

drop policy if exists lira_knowledge_chunks_delete on public.lira_knowledge_chunks;
create policy lira_knowledge_chunks_delete on public.lira_knowledge_chunks
for delete to authenticated
using (
  exists (
    select 1 from public.lira_knowledge_sources s
    where s.id = source_id and (
      (s.organization_id is null and public.current_user_is_platform_owner())
      or (s.organization_id is not null and public.current_user_has_capability(s.organization_id,'manage_libraries'))
    )
  )
);

create or replace function public.match_lira_knowledge(
  query_embedding extensions.vector(384),
  match_organization_id uuid default null,
  match_threshold double precision default 0.72,
  match_count integer default 8
)
returns table (
  chunk_id uuid,
  source_id uuid,
  title text,
  authority text,
  source_version text,
  source_url text,
  heading text,
  content text,
  citation_label text,
  similarity double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id,c.source_id,s.title,s.authority,s.source_version,s.source_url,
    c.heading,c.content,c.citation_label,
    (1 - (c.embedding OPERATOR(extensions.<=>) query_embedding))::double precision as similarity
  from public.lira_knowledge_chunks c
  join public.lira_knowledge_sources s on s.id = c.source_id
  where c.embedding is not null
    and s.status = 'approved'
    and (s.effective_from is null or s.effective_from <= current_date)
    and (s.effective_to is null or s.effective_to >= current_date)
    and (
      s.organization_id is null
      or (
        s.organization_id = match_organization_id
        and public.is_org_member(s.organization_id)
      )
    )
    and (1 - (c.embedding OPERATOR(extensions.<=>) query_embedding)) >= match_threshold
  order by c.embedding OPERATOR(extensions.<=>) query_embedding
  limit greatest(1,least(match_count,20));
$$;

revoke all on function public.match_lira_knowledge(extensions.vector,uuid,double precision,integer) from public,anon;
grant execute on function public.match_lira_knowledge(extensions.vector,uuid,double precision,integer) to authenticated;

comment on table public.lira_knowledge_sources is 'Governed, versioned LIRA knowledge sources. Global approved sources use organization_id NULL; hospital-specific sources are tenant scoped.';
comment on table public.lira_knowledge_chunks is 'Citation-ready chunks and optional pgvector embeddings derived from governed LIRA knowledge sources.';
comment on function public.match_lira_knowledge is 'Permission-aware semantic retrieval over approved LIRA knowledge. SECURITY INVOKER; RLS remains active.';
