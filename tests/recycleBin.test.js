// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { configureDataEnvironment } from '../src/core/data/dataEnvironment'
import { loadSnapshot, saveSnapshot } from '../src/core/data/repository'
import {
  binLocalRow,
  canDeleteRecord,
  canUseRecycleBin,
  describeDeleted,
  listRecycleBin,
  purgeFromBin,
  restoreFromBin,
} from '../src/core/recycleBin/recycleBinService'

describe('recycle bin (Demo, local)', () => {
  beforeEach(() => {
    localStorage.clear()
    configureDataEnvironment({ mode: 'demo', demoAccountId: `bin-${Math.random()}` })
  })

  it('keeps a deleted row and puts it back as it was', async () => {
    const row = { id: 'HH-1', date: '2026-09-12', department: 'ΜΕΘ', compliance: 82 }
    saveSnapshot('prevention_hand_hygiene', [])
    await binLocalRow(null, { module: 'clinical', kind: 'hand_hygiene_sessions', ...describeDeleted('Υγιεινή χεριών', row), table: 'prevention_hand_hygiene', row })
    const [entry] = await listRecycleBin(null, 'hospital_admin')
    expect(entry.label).toBe('Υγιεινή χεριών · 12/09/2026')
    expect(entry.detail).toBe('ΜΕΘ')
    await restoreFromBin(null, entry)
    expect(loadSnapshot('prevention_hand_hygiene', [])).toEqual([row])
    expect(await listRecycleBin(null, 'hospital_admin')).toEqual([])
  })

  it('gives every role a bin of its own deletions, whatever the module', async () => {
    await binLocalRow(null, { module: 'clinical', kind: 'a', label: 'Clinical', table: 'prevention_waste', row: { id: 1 } })
    await binLocalRow(null, { module: 'quality', kind: 'b', label: 'Quality', table: 'documents', row: { id: 2 } })
    expect(canUseRecycleBin('department_user')).toBe(true)
    expect((await listRecycleBin(null, 'department_user')).map(entry => entry.label).sort()).toEqual(['Clinical', 'Quality'])
    expect(canUseRecycleBin(null)).toBe(false)
  })

  it('lets the Owner, the Hospital Admin and the Infection Control Lead delete any record, anyone else only their own', () => {
    for (const role of ['hospital_admin', 'infection_control_lead']) expect(canDeleteRecord({ role, userId: 'u1', createdBy: 'u2' })).toBe(true)
    expect(canDeleteRecord({ role: 'infection_control_member', actualRole: 'platform_owner', userId: 'u1', createdBy: 'u2' })).toBe(true)
    expect(canDeleteRecord({ role: 'infection_control_member', userId: 'u1', createdBy: 'u2' })).toBe(false)
    expect(canDeleteRecord({ role: 'link_nurse', userId: 'u1', createdBy: 'u1' })).toBe(true)
    expect(canDeleteRecord({ role: 'link_nurse', userId: 'u1', createdBy: null })).toBe(false)
  })

  it('deletes an entry for good', async () => {
    await binLocalRow(null, { module: 'clinical', kind: 'a', label: 'Gone', table: 'prevention_waste', row: { id: 1 } })
    const [entry] = await listRecycleBin(null, 'hospital_admin')
    await purgeFromBin(null, entry)
    expect(await listRecycleBin(null, 'hospital_admin')).toEqual([])
  })
})
