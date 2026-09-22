import fs from 'node:fs'
import {describe,expect,it} from 'vitest'
describe('LIRA secure AI gateway',()=>{
 const source=fs.readFileSync('supabase/functions/lira-ai-gateway/index.ts','utf8')
 it('requires a real authenticated session and organization authorization',()=>{expect(source).toContain('caller.auth.getUser()');expect(source).toContain("organization_members");expect(source).toContain("eq('status','active')")})
 it('uses privileged access only for the server-only tenant credential and never logs PHI',()=>{expect(source).toContain("rpc('get_lira_provider_runtime_secret'");expect(source).not.toMatch(/console\.log|console\.error/)})
 it('keeps the caller JWT client for user authorization',()=>{expect(source).toContain('Authorization:\`Bearer');expect(source).toContain('const caller=createClient')})
 it('keeps deterministic clinical safety contracts explicit',()=>{expect(source).toContain('deterministicClinicalCalculations:true');expect(source).toContain('Never invent missing clinical facts');expect(source).toContain('Never declare an outbreak autonomously')})
})
