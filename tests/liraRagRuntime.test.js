import fs from 'node:fs'
import {describe,expect,it} from 'vitest'
describe('LIRA governed RAG runtime',()=>{
 const edge=fs.readFileSync('supabase/functions/lira-ai-gateway/index.ts','utf8')
 const sql=fs.readFileSync('supabase/migrations/20260922234500_lira_rag_runtime.sql','utf8')
 it('retrieves only approved current knowledge under caller RLS',()=>{expect(sql).toContain("s.status='approved'");expect(sql).toContain('security invoker');expect(sql).toContain('public.is_org_member')})
 it('grounds the provider prompt in retrieved chunks rather than browser supplied knowledge',()=>{expect(edge).toMatch(/caller\.rpc\('(get_lira_rag_chunks|search_lira_knowledge_text)'/);expect(edge).toContain('approvedKnowledge:knowledge');expect(edge).not.toContain('approvedKnowledge:body.knowledge')})
 it('returns traceable citation metadata',()=>{expect(edge).toContain('chunkId:x.chunk_id');expect(edge).toContain('sourceId:x.source_id');expect(edge).toContain('pageStart:x.page_start');const ui=fs.readFileSync('src/features/lira/LiraAssistantLauncher.jsx','utf8');expect(ui).toContain("en?'Guidance:':'Τεκμηρίωση:'")})
})
