import fs from 'node:fs'
import {describe,expect,it} from 'vitest'
describe('LIRA AI provider settings',()=>{
 it('places provider settings in Management Center',()=>{const page=fs.readFileSync('src/features/management/ManagementPage.jsx','utf8');expect(page).toContain("id:'liraAi'");expect(page).toContain('<LiraAiSettingsPanel/>')})
 it('never stores provider API keys in the browser database table',()=>{const sql=fs.readFileSync('supabase/migrations/20260922230000_lira_ai_provider_settings.sql','utf8');expect(sql).not.toMatch(/api_key|secret_value/i);expect(sql).toContain('secret_id uuid')})
 it('stores credentials only through service-role Vault RPCs',()=>{const sql=fs.readFileSync('supabase/migrations/20260922230100_lira_ai_provider_vault.sql','utf8');expect(sql).toContain('vault.create_secret');expect(sql).toContain('to service_role');expect(sql).toContain('from public,anon,authenticated')})
 it('keeps patient-level sharing off by default',()=>{const sql=fs.readFileSync('supabase/migrations/20260922230000_lira_ai_provider_settings.sql','utf8');expect(sql).toContain('allow_patient_level_data boolean not null default false')})
})
