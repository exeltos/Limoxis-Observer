import fs from 'node:fs'
import {describe,expect,it} from 'vitest'
describe('LIRA antimicrobial stewardship knowledge',()=>{const sql=fs.readFileSync('supabase/migrations/20260923093000_lira_antimicrobial_stewardship.sql','utf8')
it('covers WHO and CDC stewardship governance',()=>{expect(sql).toContain("'antimicrobial-stewardship'");expect(sql).toContain("'hospital-antibiotic-stewardship'")})
it('keeps prescribing human governed',()=>{expect(sql).toContain('must not autonomously prescribe, stop or change');expect(sql).toContain('must not represent the flag as proof that therapy is inappropriate')})
it('protects metrics and antibiogram context',()=>{expect(sql).toContain('denominators or measurement methods are not comparable');expect(sql).toContain('must not substitute external surveillance percentages for the hospital antibiogram')})
it('requires review',()=>{expect(sql).toContain("'review_required',true");expect(sql).not.toMatch(/set\s+status\s*=\s*'approved'/i)})})
