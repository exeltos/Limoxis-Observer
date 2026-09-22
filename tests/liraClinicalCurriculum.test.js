import fs from 'node:fs'
import {describe,expect,it} from 'vitest'
import {LIRA_CURRICULUM_DOMAINS,LIRA_KNOWLEDGE_SAFETY,getLiraCurriculumDomain} from '../src/features/lira/liraClinicalCurriculum'

describe('LIRA clinical curriculum governance',()=>{
 it('covers the agreed clinical curriculum',()=>{
  expect(LIRA_CURRICULUM_DOMAINS.map(x=>x.id)).toEqual(['hai','amr','laboratory','prevention','hand_hygiene','stewardship','outbreaks','indicators','quality'])
 })
 it('keeps high-risk conclusions deterministic and evidence-led',()=>{
  expect(LIRA_KNOWLEDGE_SAFETY).toMatchObject({approvedSourcesOnly:true,citationsRequired:true,deterministicCalculations:true,noAutonomousOutbreakDeclaration:true,noMissingClinicalDataInference:true,organizationIsolationRequired:true})
  expect(getLiraCurriculumDomain('hai')?.requiresDeterministicEngine).toBe(true)
 })
 it('seeds authoritative sources as review, never silently approved',()=>{
  const migration=fs.readFileSync('supabase/migrations/20260922200000_lira_clinical_curriculum_registry.sql','utf8')
  expect(migration).toContain("'review'")
  expect(migration).toContain("'CDC/NHSN'")
  expect(migration).toContain("'ECDC'")
  expect(migration).toContain("'EUCAST'")
  expect(migration).toContain("'WHO'")
  expect(migration).not.toContain("'approved',v.effective_from")
 })
})
