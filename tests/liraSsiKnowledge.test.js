import fs from 'node:fs'
import {describe,expect,it} from 'vitest'
describe('LIRA SSI knowledge',()=>{const sql=fs.readFileSync('supabase/migrations/20260923063000_lira_ssi_prevention_surveillance.sql','utf8')
it('covers WHO CDC and NHSN SSI',()=>{expect(sql).toContain("'ssi-prevention'");expect(sql).toContain("'ssi-prevention-cdc'");expect(sql).toContain("'ssi-surveillance'")})
it('separates prevention surveillance and diagnosis',()=>{expect(sql).toContain('must not infer that an SSI occurred solely');expect(sql).toContain('surveillance classification is not a substitute for bedside clinical diagnosis')})
it('protects definition version and denominator',()=>{expect(sql).toContain('must preserve the surveillance-definition version');expect(sql).toContain('Patient-days or total admissions are not interchangeable')})
it('requires review',()=>{expect(sql).toContain("'review_required',true");expect(sql).not.toMatch(/set\s+status\s*=\s*'approved'/i)})})
