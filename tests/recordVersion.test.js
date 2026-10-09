import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { expectVersion, guardedSingle } from '../src/core/data/recordVersion.js'
import { sanitizeUserMessage, userFacingError } from '../src/core/feedback/userFacingError.js'

const fakeQuery = result => { const calls = []; const q = { calls, eq: (c, v) => { calls.push([c, v]); return q }, then: (ok, no) => Promise.resolve(result).then(ok, no) }; return q }

describe('record versions (concurrent editing)', () => {
  it('adds the loaded version to the update only when it is known', () => {
    expect(expectVersion(fakeQuery({}), '2026-10-09T10:00:00.123456+00:00').calls).toEqual([['updated_at', '2026-10-09T10:00:00.123456+00:00']])
    expect(expectVersion(fakeQuery({}), null).calls).toEqual([])
  })

  it('turns "no row" into CONFLICT when a version was required, and passes other results through', async () => {
    await expect(guardedSingle(fakeQuery({ data: null, error: { code: 'PGRST116' } }), { table: 'patients', updatedAt: 'v1' })).rejects.toMatchObject({ code: 'CONFLICT', table: 'patients' })
    await expect(guardedSingle(fakeQuery({ data: null, error: { code: 'PGRST116' } }), { table: 'patients' })).rejects.toMatchObject({ code: 'PGRST116' })
    await expect(guardedSingle(fakeQuery({ data: { id: 1 }, error: null }), { updatedAt: 'v1' })).resolves.toEqual({ id: 1 })
  })

  it('tells the user in their language what happened', () => {
    const el = userFacingError({ code: 'CONFLICT' }, { language: 'el' })
    expect(el).toMatch(/Κάποιος άλλος/)
    expect(sanitizeUserMessage('Someone else already changed this record. Reload it before saving again.', { language: 'el' })).toBe(el)
  })

  it('guards the editable records and the database moves their version on every update', () => {
    for (const file of ['src/features/patients/patientsService.js', 'src/features/quality/qualityService.js', 'src/features/employees/employeeService.js', 'src/features/documents/documentService.js']) expect(fs.readFileSync(file, 'utf8'), file).toMatch(/guardedSingle\(expectVersion\(/)
    const sql = fs.readFileSync('supabase/migrations/20261023120000_record_version_touch.sql', 'utf8')
    for (const table of ['patients', 'employees', 'quality_incidents', 'quality_findings', 'quality_capa_actions', 'quality_audits']) expect(sql).toContain(`'${table}'`)
  })
})
