-- The embedding queue trigger compared two vectors with IS NOT DISTINCT FROM.
-- With an empty search_path the pgvector = operator (in extensions) is not
-- found, so every edit of a chunk's text failed. The vectors are compared as
-- text instead, which needs no operator lookup.
create or replace function public.lira_knowledge_chunk_queue_embedding()
returns trigger language plpgsql set search_path = ''
as $function$
begin
  if tg_op = 'UPDATE' and (new.content is distinct from old.content or new.heading is distinct from old.heading)
     and new.embedding::text is not distinct from old.embedding::text then
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
