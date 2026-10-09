import fs from 'node:fs'
import {describe,expect,it} from 'vitest'

describe('LIRA knowledge workflow',()=>{
 it('keeps approval permission-aware and security-invoker',()=>{
  const migration=fs.readFileSync('supabase/migrations/20260922210000_lira_knowledge_workflow.sql','utf8')
  expect(migration).toContain('security invoker')
  expect(migration).toContain('current_user_is_platform_owner()')
  expect(migration).toContain("current_user_has_capability(v_source.organization_id,'manage_libraries')")
  expect(migration).toContain("status='approved'")
  expect(migration).toContain('approved_by=(select auth.uid())')
 })
})
