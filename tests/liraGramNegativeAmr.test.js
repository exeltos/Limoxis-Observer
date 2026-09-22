import fs from 'node:fs'
import {describe,expect,it} from 'vitest'
describe('LIRA gram-negative AMR knowledge',()=>{const sql=fs.readFileSync('supabase/migrations/20260923034500_lira_gram_negative_amr.sql','utf8')
it('covers Acinetobacter and Pseudomonas',()=>{expect(sql).toContain("'acinetobacter'");expect(sql).toContain("'pseudomonas-aeruginosa'")})
it('keeps colonization and resistance interpretation guarded',()=>{expect(sql).toContain('must keep colonization separate from clinical infection');expect(sql).toContain('must not equate the species name with MDR status')})
it('keeps external surveillance contextual',()=>{expect(sql).toContain('must not be presented as the current resistance prevalence of an individual hospital');expect(sql).toContain('local authorized microbiology data are the primary factual source')})
it('requires review before use',()=>{expect(sql).toContain("'review_required',true");expect(sql).not.toMatch(/set\s+status\s*=\s*'approved'/i)})})
