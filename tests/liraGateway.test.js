import fs from 'node:fs'
import {describe,expect,it} from 'vitest'

describe('LIRA secure AI gateway',()=>{
 const source=fs.readFileSync('supabase/functions/lira-ai-gateway/index.ts','utf8')
 it('requires a real authenticated session and organization authorization',()=>{
  expect(source).toContain('caller.auth.getUser()')
  expect(source).toContain("organization_members")
  expect(source).toContain("eq('status','active')")
 })
 it('never uses the service role or logs PHI',()=>{
  expect(source).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
  expect(source).not.toMatch(/console\.log|console\.error/)
 })
 it('retrieves only approved governed knowledge with the caller JWT',()=>{
  expect(source).toContain("from('lira_knowledge_sources')")
  expect(source).toContain("eq('status','approved')")
  expect(source).toContain("Authorization:`Bearer")
 })
 it('keeps deterministic clinical safety contracts explicit',()=>{
  expect(source).toContain('deterministicClinicalCalculations:true')
  expect(source).toContain('autonomousOutbreakDeclaration:false')
  expect(source).toContain('missingClinicalDataInference:false')
 })
})
