import { describe, expect, it } from 'vitest'
import { readSource } from './helpers/readSource'

describe('the laboratory list, lighter', () => {
  it('reads the last 12 months and the open samples, without the clinical context and the empty fields', () => {
    const sql = readSource('supabase/migrations/20261231220500_laboratory_sample_list_lean.sql')
    expect(sql).toContain('create or replace function public.laboratory_sample_list_lean(p_organization_id uuid, p_environmental boolean default false, p_since date default null)')
    expect(sql).toContain("or l.status not in ('completed', 'validated', 'cancelled', 'rejected')")
    expect(sql).not.toContain("'clinical_context'")
    expect(sql).toContain('json_strip_nulls(json_agg(')
  })
  it('asks for it from the laboratory screen, with «Older samples» for the rest', () => {
    const service = readSource('src/features/laboratory/laboratoryCloudService.js')
    expect(service).toContain("supabase.rpc('laboratory_sample_list_lean'")
    const workspace = readSource('src/features/laboratory/LaboratoryWorkspace.jsx')
    expect(workspace).toContain('useLaboratoryRegistry({ recent: !isDemo })')
    expect(workspace).toContain("t('laboratoryRecords.olderSamples')")
  })
})
