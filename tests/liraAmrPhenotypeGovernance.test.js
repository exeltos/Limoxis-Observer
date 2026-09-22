import fs from 'node:fs'
import {describe,expect,it} from 'vitest'
describe('LIRA AMR phenotype governance',()=>{const sql=fs.readFileSync('supabase/migrations/20260923110000_lira_amr_phenotype_governance.sql','utf8')
it('dates MDR XDR PDR definitions',()=>{expect(sql).toContain("'dated_guidance',true");expect(sql).toContain('published in 2012')})
it('requires adequate testing',()=>{expect(sql).toContain('must not assign XDR or PDR when the tested panel is insufficient')})
it('separates phenotype mechanism and carbapenemase',()=>{expect(sql).toContain('must not infer ESBL, AmpC, carbapenemase type');expect(sql).toContain('not interchangeable concepts')})
it('protects intrinsic resistance and molecular provenance',()=>{expect(sql).toContain('must not count intrinsic resistance as acquired resistance');expect(sql).toContain('absent or unperformed molecular test')})
it('requires review',()=>{expect(sql).not.toMatch(/set\s+status\s*=\s*'approved'/i)})})
