import fs from 'node:fs'
import {describe,expect,it} from 'vitest'
describe('LIRA C difficile knowledge',()=>{const sql=fs.readFileSync('supabase/migrations/20260923071500_lira_cdiff_prevention_surveillance.sql','utf8')
it('covers prevention and surveillance',()=>{expect(sql).toContain("'cdiff-prevention'");expect(sql).toContain("'cdiff-surveillance'")})
it('guards diagnosis and testing',()=>{expect(sql).toContain('must not classify colonization or a laboratory result alone as symptomatic CDI');expect(sql).toContain('should not recommend indiscriminate repeat testing')})
it('protects surveillance attribution and denominators',()=>{expect(sql).toContain('must not infer missing exposure or attribution data');expect(sql).toContain('must not substitute an unrelated denominator')})
it('requires review',()=>{expect(sql).toContain("'review_required',true");expect(sql).not.toMatch(/set\s+status\s*=\s*'approved'/i)})})
