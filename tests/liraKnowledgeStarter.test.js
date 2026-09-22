import fs from 'node:fs'
import {describe,expect,it} from 'vitest'
describe('LIRA official knowledge starter pack',()=>{
 const sql=fs.readFileSync('supabase/migrations/20260923000500_lira_official_knowledge_starter.sql','utf8')
 it('seeds only review-stage governed summaries',()=>{expect(sql).toContain("where s.status='review'");expect(sql).toContain("'review_required',true");expect(sql).toContain("'official-source-summary'")})
 it('covers the initial official authorities',()=>{for(const x of ['CDC/NHSN','ECDC','EUCAST','WHO'])expect(sql).toContain(x)})
 it('requires explicit approval in Management Center',()=>{const ui=fs.readFileSync('src/features/management/LiraKnowledgePanel.jsx','utf8');expect(ui).toContain("approve_lira_knowledge_source");expect(ui).toMatch(/(?:x|selected)\.status\s*===\s*['"]review['"]/)})
})
