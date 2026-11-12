import {describe,expect,it} from 'vitest'
import { readSource } from './helpers/readSource'
describe('LIRA governed RAG runtime',()=>{
 const edge=readSource('supabase/functions/lira-ai-gateway/index.ts')
 const sql=readSource('supabase/migrations/20260922234500_lira_rag_runtime.sql')
 it('retrieves only approved current knowledge under caller RLS',()=>{expect(sql).toContain("s.status='approved'");expect(sql).toContain('security invoker');expect(sql).toContain('public.is_org_member')})
 it('grounds the provider prompt in retrieved chunks rather than browser supplied knowledge',()=>{expect(edge).toMatch(/caller\.rpc\('(get_lira_rag_chunks|search_lira_knowledge_text)'/);expect(edge).toContain('approvedKnowledge:knowledge');expect(edge).not.toContain('approvedKnowledge:body.knowledge')})
 it('returns traceable citation metadata',()=>{expect(edge).toContain('chunkId:x.chunk_id');expect(edge).toContain('sourceId:x.source_id');expect(edge).toContain('pageStart:x.page_start');const ui=readSource('src/features/lira/LiraAssistantLauncher.jsx');expect(ui).toContain("en?'Guidance:':'Τεκμηρίωση:'")})
})
