import {describe,expect,it} from 'vitest'
import { readSource } from './helpers/readSource'
describe('LIRA AI provider settings',()=>{
 it('places provider settings in Management Center',()=>{const page=readSource('src/features/management/ManagementPage.jsx');expect(page).toContain("id:'liraAi'");expect(page).toContain('<LiraAiSettingsPanel/>')})
 it('never stores provider API keys in the browser database table',()=>{const sql=readSource('supabase/migrations/20260922230000_lira_ai_provider_settings.sql');expect(sql).not.toMatch(/api_key|secret_value/i);expect(sql).toContain('secret_id uuid')})
 it('stores credentials only through service-role Vault RPCs',()=>{const sql=readSource('supabase/migrations/20260922230100_lira_ai_provider_vault.sql');expect(sql).toContain('vault.create_secret');expect(sql).toContain('to service_role');expect(sql).toContain('from public,anon,authenticated')})
 it('keeps patient-level sharing off by default',()=>{const sql=readSource('supabase/migrations/20260922230000_lira_ai_provider_settings.sql');expect(sql).toContain('allow_patient_level_data boolean not null default false')})
})
