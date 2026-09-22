import fs from 'node:fs'
import {describe,expect,it} from 'vitest'
describe('LIRA provider runtime',()=>{
 const edge=fs.readFileSync('supabase/functions/lira-ai-gateway/index.ts','utf8')
 it('loads provider credential only through server-only runtime RPC',()=>{expect(edge).toContain("rpc('get_lira_provider_runtime_secret'");expect(edge).not.toContain('vault.decrypted_secrets')})
 it('calls OpenAI only server-side and preserves deterministic authority',()=>{expect(edge).toContain("https://api.openai.com/v1/responses");expect(edge).toContain('Treat deterministic calculations as authoritative');expect(edge).toContain('Never invent missing clinical facts')})
 it('respects tenant data-sharing switches',()=>{expect(edge).toContain('cfg.allow_aggregate_data?');expect(edge).toContain('cfg.allow_patient_level_data?')})
 it('falls back to deterministic LIRA when no provider is configured',()=>{expect(edge).toContain("mode:'deterministic_only'");const ui=fs.readFileSync('src/features/lira/LiraAssistantLauncher.jsx','utf8');expect(ui).toContain("ai.mode==='generative'");expect(ui).toContain('...deterministic')})
})
