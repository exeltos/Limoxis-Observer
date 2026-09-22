import fs from 'node:fs'
import {describe,expect,it} from 'vitest'
describe('LIRA knowledge governance workflow',()=>{
 const sql=fs.readFileSync('supabase/migrations/20260923013000_lira_knowledge_governance_workflow.sql','utf8')
 it('keeps approved sources immutable',()=>expect(sql).toContain('Approved sources are immutable; create a new version instead'))
 it('creates review-stage versions and copies chunks',()=>{expect(sql).toContain("old.status<>'approved'");expect(sql).toContain("'review'");expect(sql).toContain('insert into public.lira_knowledge_chunks')})
 it('stores revision audit snapshots',()=>{expect(sql).toContain('lira_knowledge_source_revisions');expect(sql).toContain('to_jsonb(s)')})
 it('exposes approve edit retire and new-version controls',()=>{const ui=fs.readFileSync('src/features/management/LiraKnowledgePanel.jsx','utf8');for(const x of ['approve_lira_knowledge_source','revise_lira_knowledge_source','retire_lira_knowledge_source','create_lira_knowledge_source_version'])expect(ui).toContain(x)})
})
