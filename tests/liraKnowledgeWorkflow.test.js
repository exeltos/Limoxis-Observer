import fs from 'node:fs'
import {describe,expect,it} from 'vitest'
import {buildLiraCitation,canUseLiraKnowledgeSource,formatLiraCitation} from '../src/features/lira/liraKnowledgeGovernance'

describe('LIRA knowledge workflow',()=>{
 it('refuses draft/review/retired or out-of-date knowledge',()=>{
  expect(canUseLiraKnowledgeSource({status:'review'})).toBe(false)
  expect(canUseLiraKnowledgeSource({status:'retired'})).toBe(false)
  expect(canUseLiraKnowledgeSource({status:'approved',effective_from:'2027-01-01'},{today:'2026-09-22'})).toBe(false)
  expect(canUseLiraKnowledgeSource({status:'approved',effective_to:'2026-01-01'},{today:'2026-09-22'})).toBe(false)
  expect(canUseLiraKnowledgeSource({status:'approved',effective_from:'2026-01-01'},{today:'2026-09-22'})).toBe(true)
 })
 it('creates traceable citation metadata',()=>{
  const citation=buildLiraCitation({id:'s1',authority:'ECDC',title:'HAI-Net ICU protocol',source_version:'2.3',source_url:'https://example.test'},{id:'c1',heading:'Definitions',page_start:12,page_end:13})
  expect(citation).toMatchObject({sourceId:'s1',chunkId:'c1',authority:'ECDC',version:'2.3',pageStart:12,pageEnd:13})
  expect(formatLiraCitation(citation)).toContain('ECDC · HAI-Net ICU protocol v2.3 · p. 12–13')
 })
 it('keeps approval permission-aware and security-invoker',()=>{
  const migration=fs.readFileSync('supabase/migrations/20260922210000_lira_knowledge_workflow.sql','utf8')
  expect(migration).toContain('security invoker')
  expect(migration).toContain('current_user_is_platform_owner()')
  expect(migration).toContain("current_user_has_capability(v_source.organization_id,'manage_libraries')")
  expect(migration).toContain("status='approved'")
  expect(migration).toContain('approved_by=(select auth.uid())')
 })
})
