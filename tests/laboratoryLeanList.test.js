import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('the laboratory list, lighter', () => {
  it('reads the last 12 months and the open samples, without the clinical context and the empty fields', () => {
    const sql = fs.readFileSync('supabase/migrations/20261231220500_laboratory_sample_list_lean.sql', 'utf8')
    expect(sql).toContain('create or replace function public.laboratory_sample_list_lean(p_organization_id uuid, p_environmental boolean default false, p_since date default null)')
    expect(sql).toContain("or l.status not in ('completed', 'validated', 'cancelled', 'rejected')")
    expect(sql).not.toContain("'clinical_context'")
    expect(sql).toContain('json_strip_nulls(json_agg(')
  })
  it('asks for it from the laboratory screen, with «Older samples» for the rest', () => {
    const service = fs.readFileSync('src/features/laboratory/laboratoryCloudService.js', 'utf8')
    expect(service).toContain("supabase.rpc('laboratory_sample_list_lean'")
    const workspace = fs.readFileSync('src/features/laboratory/LaboratoryWorkspace.jsx', 'utf8')
    expect(workspace).toContain('useLaboratoryRegistry({ recent: !isDemo })')
    expect(workspace).toContain("t('laboratoryRecords.olderSamples')")
  })
})
