-- LIRA Phase 2D: deterministic, citation-preserving ingestion contract.
alter table public.lira_knowledge_chunks
  add column if not exists embedding_status text not null default 'pending'
    check (embedding_status in ('pending','ready','failed','not_required')),
  add column if not exists embedding_model text,
  add column if not exists embedded_at timestamptz;

create or replace function public.replace_lira_knowledge_chunks(
  p_source_id uuid,
  p_chunks jsonb
) returns integer
language plpgsql
security invoker
set search_path=''
as $$
declare v_source public.lira_knowledge_sources; v_count integer;
begin
 select * into v_source from public.lira_knowledge_sources where id=p_source_id for update;
 if not found then raise exception 'LIRA knowledge source not found'; end if;
 if not (
   (v_source.organization_id is null and public.current_user_is_platform_owner())
   or (v_source.organization_id is not null and public.current_user_has_capability(v_source.organization_id,'manage_libraries'))
 ) then raise exception 'Not authorized to ingest LIRA knowledge'; end if;
 if v_source.status not in ('review','approved') then raise exception 'Source must be in review or approved state for ingestion'; end if;
 if jsonb_typeof(p_chunks)<>'array' or jsonb_array_length(p_chunks)=0 then raise exception 'At least one chunk is required'; end if;

 delete from public.lira_knowledge_chunks where source_id=p_source_id;
 insert into public.lira_knowledge_chunks
   (source_id,chunk_index,heading,content,citation_label,page_start,page_end,token_count,content_hash,metadata,embedding_status)
 select p_source_id,
   (x->>'chunk_index')::integer,
   nullif(x->>'heading',''),
   x->>'content',
   nullif(x->>'citation_label',''),
   nullif(x->>'page_start','')::integer,
   nullif(x->>'page_end','')::integer,
   nullif(x->>'token_count','')::integer,
   nullif(x->>'content_hash',''),
   coalesce(x->'metadata','{}'::jsonb),
   'pending'
 from jsonb_array_elements(p_chunks) x
 where nullif(trim(x->>'content'),'') is not null;

 get diagnostics v_count = row_count;
 if v_count=0 then raise exception 'No valid chunks supplied'; end if;
 update public.lira_knowledge_sources
 set ingestion_status='ingested',updated_by=(select auth.uid()),updated_at=now()
 where id=p_source_id;
 return v_count;
end $$;

revoke all on function public.replace_lira_knowledge_chunks(uuid,jsonb) from public,anon;
grant execute on function public.replace_lira_knowledge_chunks(uuid,jsonb) to authenticated;
