import fs from 'node:fs'
import {describe,expect,it} from 'vitest'
describe('LIRA hand hygiene and environmental knowledge',()=>{const sql=fs.readFileSync('supabase/migrations/20260923080000_lira_hand_hygiene_environment.sql','utf8')
it('covers Five Moments and observation method',()=>{expect(sql).toContain('WHO Five Moments');expect(sql).toContain('Hand Hygiene Technical Reference Manual')})
it('protects compliance denominator and glove semantics',()=>{expect(sql).toContain('must not treat the number of observed staff members as the denominator');expect(sql).toContain('must not count glove use alone')})
it('guards environmental monitoring interpretation',()=>{expect(sql).toContain('must not equate a single environmental result with overall cleaning performance')})
it('requires review',()=>{expect(sql).toContain("'review_required',true");expect(sql).not.toMatch(/set\s+status\s*=\s*'approved'/i)})})
