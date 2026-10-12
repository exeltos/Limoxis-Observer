-- LIRA reads its knowledge without an external key: hybrid retrieval over the
-- governed chunks, combining
--   * full-text search on accent-folded text (Greek and English), and
--   * semantic search on gte-small embeddings (384 dimensions), computed inside
--     the lira-ai-gateway Edge Function by the built-in Supabase.ai model.
-- Results are fused with reciprocal rank fusion. A provider key, when a
-- hospital configures one, only adds a written answer on top of the same
-- passages; retrieval never leaves the project.

-- Lower-case and drop Greek accents (and final sigma) so that «λοίμωξη»,
-- «ΛΟΙΜΩΞΗ» and «λοιμωξη» match.
create or replace function public.lira_fold(p_text text)
returns text language sql immutable parallel safe set search_path = ''
as $function$
  select translate(lower(coalesce(p_text, '')), 'άέήίόύώϊϋΐΰς', 'αεηιουωιυιυσ')
$function$;

alter table public.lira_knowledge_chunks
  add column if not exists search_tsv tsvector
  generated always as (to_tsvector('simple'::regconfig,
    public.lira_fold(coalesce(heading, '') || ' ' || coalesce(citation_label, '') || ' ' || content))) stored;

create index if not exists lira_knowledge_chunks_search_tsv_idx
  on public.lira_knowledge_chunks using gin (search_tsv);
create index if not exists lira_knowledge_chunks_embedding_idx
  on public.lira_knowledge_chunks using hnsw (embedding extensions.vector_cosine_ops);

-- Every chunk without an embedding is queued; the gateway fills the queue in
-- the background after it answers.
update public.lira_knowledge_chunks
   set embedding_status = 'pending'
 where embedding is null and embedding_status <> 'pending';

-- A new chunk, or one whose text changes, is (re)queued for embedding.
create or replace function public.lira_knowledge_chunk_queue_embedding()
returns trigger language plpgsql set search_path = ''
as $function$
begin
  if tg_op = 'UPDATE' and (new.content is distinct from old.content or new.heading is distinct from old.heading)
     and new.embedding is not distinct from old.embedding then
    new.embedding := null;
  end if;
  if new.embedding is null then
    new.embedding_status := 'pending';
    new.embedding_model := null;
    new.embedded_at := null;
  end if;
  return new;
end;
$function$;
revoke all on function public.lira_knowledge_chunk_queue_embedding() from public, anon, authenticated;

drop trigger if exists lira_knowledge_chunk_queue_embedding on public.lira_knowledge_chunks;
create trigger lira_knowledge_chunk_queue_embedding
  before insert or update of content, heading, embedding on public.lira_knowledge_chunks
  for each row execute function public.lira_knowledge_chunk_queue_embedding();

-- Hybrid search under the caller's RLS (same eligibility as
-- search_lira_knowledge_text). Query words are folded and cut to a prefix, a
-- crude stemmer that lets «λοιμώξεις» find «λοίμωξη»; common question words are
-- dropped. Only passages that match a word, or are semantically close enough,
-- are returned.
create or replace function public.search_lira_knowledge_hybrid(
  p_organization_id uuid,
  p_query text,
  p_query_embedding extensions.vector(384) default null,
  p_limit integer default 8,
  p_min_similarity double precision default 0.80
)
returns table(chunk_id uuid, source_id uuid, title text, authority text, source_version text, source_url text,
  heading text, content text, citation_label text, page_start integer, page_end integer,
  keyword_rank integer, semantic_similarity double precision, match_score double precision)
language sql stable security invoker set search_path = ''
as $function$
  with eligible as (
    select c.id, c.source_id, c.chunk_index, c.heading, c.content, c.citation_label, c.page_start, c.page_end,
           c.embedding, c.search_tsv || to_tsvector('simple'::regconfig, public.lira_fold(s.title || ' ' || s.authority)) tsv,
           s.title, s.authority, s.source_version, s.source_url
    from public.lira_knowledge_chunks c
    join public.lira_knowledge_sources s on s.id = c.source_id
    where s.status = 'approved'
      and (s.effective_from is null or s.effective_from <= current_date)
      and (s.effective_to is null or s.effective_to >= current_date)
      and (s.organization_id is null or (s.organization_id = p_organization_id and public.is_org_member(s.organization_id)))
  ),
  words as (
    select distinct left(w, greatest(4, char_length(w) - 3)) w
    from regexp_split_to_table(public.lira_fold(p_query), '[^[:alnum:]]+') w
    where char_length(w) > 2
      and w <> all (array['και','του','της','των','τον','την','τις','τους','για','στο','στη','στην','στον','στα','στις','απο','που',
        'ποια','ποιο','ποιος','ποιες','ποιοι','πως','ποσο','ποση','ποσα','ποσες','ποσοι','ειναι','εχει','εχουμε','πρεπει','θελω',
        'the','and','for','with','what','how','which','are','does','should','our','from'])
    limit 24
  ),
  q as (
    select to_tsquery('simple'::regconfig, string_agg(quote_literal(w) || ':*', ' | ')) tsq from words
  ),
  -- Passages matching more of the question's words come first; Postgres has
  -- no IDF, so ts_rank_cd alone favours a passage repeating one common word.
  keyword as (
    select e.id, row_number() over (order by m.matched desc, ts_rank_cd(e.tsv, q.tsq) desc, e.id)::integer rnk
    from eligible e
    cross join q
    cross join lateral (
      select count(*) matched from words where e.tsv @@ to_tsquery('simple'::regconfig, quote_literal(words.w) || ':*')
    ) m
    where q.tsq is not null and e.tsv @@ q.tsq
    order by rnk
    limit 40
  ),
  semantic as (
    select e.id, (1 - (e.embedding operator(extensions.<=>) p_query_embedding))::double precision sim,
           row_number() over (order by e.embedding operator(extensions.<=>) p_query_embedding, e.id)::integer rnk
    from eligible e
    where p_query_embedding is not null and e.embedding is not null
      and 1 - (e.embedding operator(extensions.<=>) p_query_embedding) >= p_min_similarity
    order by rnk
    limit 40
  ),
  fused as (
    select coalesce(k.id, s.id) id, k.rnk keyword_rank, s.sim,
           coalesce(1.0 / (50 + k.rnk), 0) + coalesce(1.0 / (50 + s.rnk), 0) score
    from keyword k full outer join semantic s on s.id = k.id
  )
  select e.id, e.source_id, e.title, e.authority, e.source_version, e.source_url, e.heading, e.content,
         e.citation_label, e.page_start, e.page_end, f.keyword_rank, f.sim, f.score::double precision
  from fused f join eligible e on e.id = f.id
  order by f.score desc, e.authority, e.source_id, e.chunk_index
  limit greatest(1, least(p_limit, 40))
$function$;
revoke all on function public.search_lira_knowledge_hybrid(uuid, text, extensions.vector, integer, double precision) from public, anon;
grant execute on function public.search_lira_knowledge_hybrid(uuid, text, extensions.vector, integer, double precision) to authenticated;
