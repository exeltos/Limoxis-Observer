import fs from 'node:fs'
import {describe,expect,it} from 'vitest'
describe('LIRA Phase 4C clinical governance',()=>{
 const sql=fs.readFileSync('supabase/migrations/20260923010000_lira_outbreak_amr_precautions_stewardship.sql','utf8')
 it('covers outbreak, AMR, isolation and stewardship',()=>{for(const x of ['Cluster investigation workflow','AMR containment','Contact Precautions','Droplet Precautions','Airborne Precautions','Core stewardship structure'])expect(sql).toContain(x)})
 it('keeps clinical decisions assistive',()=>{expect(sql).toContain('not an autonomous outbreak declaration');expect(sql).toContain('not independently prescribe, stop or change antimicrobial treatment');expect(sql).toContain('final antimicrobial decisions remain with authorized clinicians')})
 it('does not invent universal isolation duration',()=>expect(sql).toContain('must not infer a universal isolation duration'))
 it('keeps all new sources in review',()=>{expect(sql).toContain("'review','pending'");expect(sql).not.toMatch(/set\s+status\s*=\s*'approved'/i)})
})
