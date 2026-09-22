import fs from 'node:fs'
import {describe,expect,it} from 'vitest'
describe('LIRA ESBL and breakpoint governance',()=>{const sql=fs.readFileSync('supabase/migrations/20260923043000_lira_esbl_breakpoints.sql','utf8')
it('covers ESBL Enterobacterales',()=>{expect(sql).toContain("'esbl-enterobacterales'");expect(sql).toContain('Colonization alone must not be represented as active infection')})
it('makes breakpoints version sensitive',()=>{expect(sql).toContain("'version_sensitive',true");expect(sql).toContain('must preserve the breakpoint version used by the laboratory')})
it('guards SIR and MDR classification',()=>{expect(sql).toContain('must not convert MIC or inhibition-zone values');expect(sql).toContain('not by itself equivalent to a complete MDR/XDR classification')})
it('requires governance review',()=>{expect(sql).toContain("'review_required',true");expect(sql).not.toMatch(/set\s+status\s*=\s*'approved'/i)})})
