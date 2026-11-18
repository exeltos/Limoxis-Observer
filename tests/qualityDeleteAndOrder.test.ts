// Κέντρο Ποιότητας (owner, 18/11): «Διαγραφή» to the Recycle Bin and «newest first» always,
// with the time and the code breaking ties of the same day.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { registerDateKey, registerRows } from '../src/features/quality/qualityRegister'
import { qualityTable } from '../src/features/quality/qualityService'
import { readSource } from './helpers/readSource'
import type { QualityRecord } from '../src/features/quality/qualityTypes'

const root = path.resolve(__dirname, '..')
const read = (file: string) => readSource(path.join(root, file))

describe('newest first', () => {
  it('orders reports of the same day by time, then by when they were recorded and the code', () => {
    const rec = (id: string, date: string, eventTime = '', createdAt = '') => ({ id, displayId: id, title: id, date, eventTime, createdAt, status: 'reported' }) as unknown as QualityRecord
    const rows = registerRows([
      rec('INC-1509', '2026-11-09', '08:00', '2026-11-09T08:10:00Z'),
      rec('INC-1510', '2026-11-09', '17:30', '2026-11-09T17:40:00Z'),
      rec('INC-1511', '2026-11-10'),
      rec('INC-1508', '2026-11-09', '', '2026-11-09T07:00:00Z'),
    ])
    expect(rows.map(row => row.code)).toEqual(['INC-1511', 'INC-1510', 'INC-1509', 'INC-1508'])
    expect(registerDateKey({ date: '2026-11-09', code: 'B' }) > registerDateKey({ date: '2026-11-09', code: 'A' })).toBe(true)
  })

  it('opens the register sorted by date, newest first', () => {
    const source = read('src/features/quality/QualityReportRegister.tsx')
    expect(source).toContain("useSortedPaging(items,JSON.stringify(filters),sortBy,{key:'date',dir:'desc'})")
    expect(source).toContain('date:(row: RegisterRow)=>registerDateKey(row)')
  })
})

describe('delete to the Recycle Bin', () => {
  it('offers «Διαγραφή» on the quality record to whoever manages quality, by its table', () => {
    expect(['incidents', 'findings', 'capas', 'audits'].map(qualityTable)).toEqual(['quality_incidents', 'quality_findings', 'quality_capa_actions', 'quality_audits'])
    const page = read('src/features/quality/QualityRecordPage.tsx')
    expect(page).toContain('recordDelete({allowed:canManage,table:qualityTable(recordType),id:record.dbId')
  })

  it('lets the server move quality records to the bin for the Quality Manager or whoever manages quality', () => {
    const sql = read('supabase/migrations/20261231596000_quality_recycle_bin.sql')
    expect(sql).toContain("when p_table = any(array['quality_incidents', 'quality_findings', 'quality_capa_actions', 'quality_audits']) then 'quality'")
    expect(sql).toContain("v_module = 'quality' and (public.current_user_has_org_role(v_org, array['quality_manager']::public.app_role[])")
    expect(sql).toContain("public.current_user_has_capability(v_org, 'manage_quality')")
  })
})
