import fs from 'node:fs'
import {describe,expect,it} from 'vitest'
describe('LIRA outbreak investigation knowledge',()=>{const sql=fs.readFileSync('supabase/migrations/20260923084500_lira_outbreak_investigation.sql','utf8')
it('guards cluster signals',()=>{expect(sql).toContain('must not autonomously declare an outbreak or transmission chain');expect(sql).toContain('Temporal or spatial proximity alone does not prove')})
it('protects line list and hypotheses',()=>{expect(sql).toContain('must not fill missing epidemiologic links');expect(sql).toContain('must label hypotheses as hypotheses')})
it('preserves human decision point',()=>{expect(sql).toContain('responsible human decision point')})
it('requires review',()=>{expect(sql).toContain("'review_required',true");expect(sql).not.toMatch(/set\s+status\s*=\s*'approved'/i)})})
