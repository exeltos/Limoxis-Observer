create table if not exists public.lira_knowledge_source_revisions(
 id uuid primary key default gen_random_uuid(),
 source_id uuid not null references public.lira_knowledge_sources(id) on delete cascade,
 revision_no integer not null,
 action text not null check(action in ('created','edited','approved','retired','new_version')),
 snapshot jsonb not null,
 changed_by uuid references auth.users(id) on delete set null,
 changed_at timestamptz not null default now(),
 unique(source_id,revision_no)
);
alter table public.lira_knowledge_source_revisions enable row level security;
revoke all on public.lira_knowledge_source_revisions from anon;
grant select on public.lira_knowledge_source_revisions to authenticated;
create policy "lira revisions readable by governors" on public.lira_knowledge_source_revisions for select to authenticated using(
 public.current_user_is_platform_owner() or (exists(select 1 from public.lira_knowledge_sources s where s.id=source_id and s.organization_id is not null and public.current_user_has_capability(s.organization_id,'manage_libraries')))
);
create or replace function public.revise_lira_knowledge_source(p_source_id uuid,p_title text,p_source_version text,p_source_url text,p_review_notes text default null)
returns public.lira_knowledge_sources language plpgsql security invoker set search_path='' as $$
declare s public.lira_knowledge_sources; n integer;
begin
 select * into s from public.lira_knowledge_sources where id=p_source_id for update;
 if not found then raise exception 'LIRA knowledge source not found'; end if;
 if not ((s.organization_id is null and public.current_user_is_platform_owner()) or (s.organization_id is not null and public.current_user_has_capability(s.organization_id,'manage_libraries'))) then raise exception 'Not authorized'; end if;
 if s.status='approved' then raise exception 'Approved sources are immutable; create a new version instead'; end if;
 select coalesce(max(revision_no),0)+1 into n from public.lira_knowledge_source_revisions where source_id=s.id;
 insert into public.lira_knowledge_source_revisions(source_id,revision_no,action,snapshot,changed_by) values(s.id,n,'edited',to_jsonb(s),(select auth.uid()));
 update public.lira_knowledge_sources set title=trim(p_title),source_version=trim(p_source_version),source_url=nullif(trim(p_source_url),''),review_notes=p_review_notes,status='review',reviewed_by=null,reviewed_at=null,approved_by=null,approved_at=null,updated_by=(select auth.uid()),updated_at=now() where id=s.id returning * into s;
 return s;
end $$;
revoke all on function public.revise_lira_knowledge_source(uuid,text,text,text,text) from public,anon; grant execute on function public.revise_lira_knowledge_source(uuid,text,text,text,text) to authenticated;
create or replace function public.create_lira_knowledge_source_version(p_source_id uuid,p_source_version text,p_review_notes text default null)
returns public.lira_knowledge_sources language plpgsql security invoker set search_path='' as $$
declare old public.lira_knowledge_sources; fresh public.lira_knowledge_sources; n integer;
begin
 select * into old from public.lira_knowledge_sources where id=p_source_id for update;
 if not found then raise exception 'LIRA knowledge source not found'; end if;
 if old.status<>'approved' then raise exception 'New version can only be created from an approved source'; end if;
 if not ((old.organization_id is null and public.current_user_is_platform_owner()) or (old.organization_id is not null and public.current_user_has_capability(old.organization_id,'manage_libraries'))) then raise exception 'Not authorized'; end if;
 insert into public.lira_knowledge_sources(organization_id,source_type,title,authority,source_url,source_version,language,status,effective_from,metadata,created_by,updated_by,review_notes,ingestion_status)
 values(old.organization_id,old.source_type,old.title,old.authority,old.source_url,trim(p_source_version),old.language,'review',old.effective_from,old.metadata,(select auth.uid()),(select auth.uid()),p_review_notes,'pending') returning * into fresh;
 insert into public.lira_knowledge_chunks(source_id,chunk_index,heading,content,citation_label,page_start,page_end,token_count,content_hash,metadata,embedding_status)
 select fresh.id,chunk_index,heading,content,citation_label,page_start,page_end,token_count,content_hash,metadata,'pending' from public.lira_knowledge_chunks where source_id=old.id;
 select coalesce(max(revision_no),0)+1 into n from public.lira_knowledge_source_revisions where source_id=old.id;
 insert into public.lira_knowledge_source_revisions(source_id,revision_no,action,snapshot,changed_by) values(old.id,n,'new_version',jsonb_build_object('new_source_id',fresh.id,'new_version',fresh.source_version),(select auth.uid()));
 return fresh;
end $$;
revoke all on function public.create_lira_knowledge_source_version(uuid,text,text) from public,anon; grant execute on function public.create_lira_knowledge_source_version(uuid,text,text) to authenticated;
