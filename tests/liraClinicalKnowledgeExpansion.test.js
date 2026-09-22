import fs from 'node:fs'
import {describe,expect,it} from 'vitest'
describe('LIRA clinical knowledge expansion',()=>{
 const sql=fs.readFileSync('supabase/migrations/20260923003000_lira_clinical_knowledge_expansion.sql','utf8')
 it('adds device-associated HAI guardrails',()=>{for(const x of ['CLABSI','CAUTI','Ventilator-associated events','device-days'])expect(sql).toContain(x)})
 it('adds AMR and IPC interpretation guardrails',()=>{for(const x of ['EUCAST S I R categories','Five Moments','Glove use does not replace hand hygiene'])expect(sql).toContain(x)})
 it('never auto-approves knowledge',()=>{expect(sql).not.toMatch(/set\s+status\s*=\s*'approved'/i);expect(sql).toContain("'review_required',true")})
 it('keeps outbreak language assistive',()=>{expect(sql).toContain('not by itself confirmation of an outbreak')})
})
