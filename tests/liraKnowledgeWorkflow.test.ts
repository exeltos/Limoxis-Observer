import {describe,expect,it} from 'vitest'
import { readSource } from './helpers/readSource'

describe('LIRA knowledge workflow',()=>{
 it('keeps approval permission-aware and security-invoker',()=>{
  const migration=readSource('supabase/migrations/20260922210000_lira_knowledge_workflow.sql')
  expect(migration).toContain('security invoker')
  expect(migration).toContain('current_user_is_platform_owner()')
  expect(migration).toContain("current_user_has_capability(v_source.organization_id,'manage_libraries')")
  expect(migration).toContain("status='approved'")
  expect(migration).toContain('approved_by=(select auth.uid())')
 })
})
