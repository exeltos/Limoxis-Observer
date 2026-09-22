import fs from 'node:fs'
import {describe,expect,it} from 'vitest'
describe('LIRA MRSA VRE screening governance',()=>{const sql=fs.readFileSync('supabase/migrations/20260923050000_lira_mrsa_vre_screening.sql','utf8')
it('keeps colonization distinct from infection',()=>{expect(sql).toContain('is not, by itself, a diagnosis of active infection');expect(sql).toContain('VRE colonization is distinct from infection')})
it('guards screening and decolonization',()=>{expect(sql).toContain('must not recommend universal screening');expect(sql).toContain('must not autonomously prescribe a decolonization regimen')})
it('covers transfer communication',()=>{expect(sql).toContain('communicated to the receiving care team')})
it('requires review',()=>{expect(sql).toContain("'review_required',true");expect(sql).not.toMatch(/set\s+status\s*=\s*'approved'/i)})})
