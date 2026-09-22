create or replace function public.get_lira_rag_chunks(
 p_organization_id uuid,
 p_limit integer default 12
) returns table(chunk_id uuid,source_id uuid,title text,authority text,source_version text,source_url text,heading text,content text,citation_label text,page_start integer,page_end integer)
language sql stable security invoker set search_path=''
as $$
 select c.id,c.source_id,s.title,s.authority,s.source_version,s.source_url,c.heading,c.content,c.citation_label,c.page_start,c.page_end
 from public.lira_knowledge_chunks c join public.lira_knowledge_sources s on s.id=c.source_id
 where s.status='approved'
 and (s.effective_from is null or s.effective_from<=current_date)
 and (s.effective_to is null or s.effective_to>=current_date)
 and (s.organization_id is null or (s.organization_id=p_organization_id and public.is_org_member(s.organization_id)))
 order by s.authority,c.source_id,c.chunk_index
 limit greatest(1,least(p_limit,40))
$$;
revoke all on function public.get_lira_rag_chunks(uuid,integer) from public,anon;
grant execute on function public.get_lira_rag_chunks(uuid,integer) to authenticated;
