import fs from 'node:fs'
import {describe,expect,it} from 'vitest'
describe('LIRA Phase 4D organism IPC and retrieval',()=>{
 const sql=fs.readFileSync('supabase/migrations/20260923021500_lira_organism_ipc_retrieval.sql','utf8')
 it('searches eligible approved knowledge before limiting results',()=>{expect(sql).toContain('search_lira_knowledge_text');expect(sql).toContain("s.status='approved'");expect(sql).toContain('score desc')})
 it('keeps new organism sources under review',()=>{expect(sql).toContain("'review_required',true");expect(sql).not.toMatch(/set\s+status\s*=\s*'approved'/i)})
 it('covers C auris C difficile MRSA and CRE',()=>{for(const x of ['Candida auris','C. diff','MRSA','Carbapenem-resistant Enterobacterales'])expect(sql).toContain(x)})
 it('keeps organism interpretation guarded',()=>{expect(sql).toContain('must not infer active infection solely from a colonization result');expect(sql).toContain('should not infer a transmission chain from resistance phenotype alone')})
 it('gateway uses query-aware RPC',()=>{const g=fs.readFileSync('supabase/functions/lira-ai-gateway/index.ts','utf8');expect(g).toContain("rpc('search_lira_knowledge_text'");expect(g).not.toContain("caller.rpc('get_lira_rag_chunks'")})
})
