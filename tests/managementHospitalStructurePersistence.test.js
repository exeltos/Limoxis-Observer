import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

const panel = fs.readFileSync('src/features/management/HospitalStructurePanel.jsx', 'utf8')
const service = fs.readFileSync('src/features/management/hospitalStructureCloudService.js', 'utf8')
const migration = fs.readFileSync('supabase/migrations/20260919220000_add_hospital_structure_indicator.sql', 'utf8')

describe('Management Center hospital structure indicator (ΥΑ Υ1.Γ.Π.114971/ΦΕΚ Β 388/2014 §2.8)', () => {
  it('keeps demo/production loading isolated and gates the create action', () => {
    expect(panel).toContain('loadHospitalStructureHistory(tenant.id)')
    expect(panel).toContain('saveHospitalStructureSnapshot')
  })
  it('uses tenant-scoped cloud writes for structural snapshots', () => {
    expect(service).toContain("from('hospital_structure_snapshots')")
    expect(service).toContain("eq('organization_id',")
    expect(service).toContain('saveHospitalStructureSnapshot')
    expect(service).toContain('deleteHospitalStructureSnapshot')
  })
  it('is append-only: no update policy, and delete is platform-owner only', () => {
    expect(migration).not.toContain('for update')
    expect(migration).toContain('hospital_structure_delete')
    expect(migration).toContain('current_user_is_platform_owner()')
  })
  it('hardens grants, RLS and audit trail', () => {
    expect(migration).toContain('revoke all on public.hospital_structure_snapshots from public, anon')
    expect(migration).toContain('grant select, insert, delete on public.hospital_structure_snapshots to authenticated')
    expect(migration).toContain('trg_audit_hospital_structure_snapshots')
    expect(migration).toContain('private.audit_management_change()')
  })
})
