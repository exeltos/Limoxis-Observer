import fs from 'node:fs'
import {describe,expect,it} from 'vitest'
describe('LIRA device infection prevention knowledge',()=>{const sql=fs.readFileSync('supabase/migrations/20260923054500_lira_device_infection_prevention.sql','utf8')
it('covers central line urinary catheter and ventilator prevention',()=>{expect(sql).toContain("'clabsi-prevention'");expect(sql).toContain("'cauti-prevention'");expect(sql).toContain("'vap-vae-prevention'")})
it('keeps prevention findings separate from diagnosis',()=>{expect(sql).toContain('not automatically as evidence that a CAUTI occurred');expect(sql).toContain('should not diagnose VAP from a missing bundle element')})
it('protects device-day denominators',()=>{expect(sql).toContain('Patient-days are not a substitute for central-line days')})
it('requires review',()=>{expect(sql).toContain("'review_required',true");expect(sql).not.toMatch(/set\s+status\s*=\s*'approved'/i)})})
