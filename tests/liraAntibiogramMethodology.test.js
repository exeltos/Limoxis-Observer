import fs from 'node:fs'
import {describe,expect,it} from 'vitest'
describe('LIRA antibiogram methodology',()=>{const sql=fs.readFileSync('supabase/migrations/20260923101500_lira_antibiogram_methodology.sql','utf8')
it('requires AST version provenance',()=>{expect(sql).toContain('applicable EUCAST breakpoint/version');expect(sql).toContain('must not silently reinterpret historical AST')})
it('guards susceptibility and mechanism inference',()=>{expect(sql).toContain('must not infer susceptibility');expect(sql).toContain('must not infer a resistance mechanism solely')})
it('requires explicit deduplication and local data',()=>{expect(sql).toContain('explicitly configured deduplication methodology');expect(sql).toContain('authorized local microbiology data')})
it('requires review',()=>{expect(sql).toContain("'review_required',true");expect(sql).not.toMatch(/set\s+status\s*=\s*'approved'/i)})})
