import { describe, expect, it, vi, beforeEach } from 'vitest'
import { HAI_CRITERIA_SETS } from '../src/features/surveillance/haiCriteriaDefinitions'
import { configureDataEnvironment } from '../src/core/data/dataEnvironment'

function storage() {
  const values = new Map()
  return {
    get length() { return values.size },
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    key: index => [...values.keys()][index] ?? null,
    values,
  }
}

describe('loadHaiCriteriaSets (demo mode)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', storage())
    configureDataEnvironment({ mode: 'demo', organizationId: 'demo-hospital', demoAccountId: 'demo-user-1' })
  })

  it('returns the static baseline sets without touching Supabase', async () => {
    const { loadHaiCriteriaSets } = await import('../src/features/surveillance/haiCriteriaLibraryService')
    const sets = await loadHaiCriteriaSets('demo-hospital')
    expect(sets).toBe(HAI_CRITERIA_SETS)
  })
})

describe('loadHaiCriteriaSets (production mode)', () => {
  const rows = new Map()
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('localStorage', storage())
    configureDataEnvironment({ mode: 'production', organizationId: 'hospital-a' })
    rows.clear()
  })

  it('shapes master_library_items rows into the same {labelEl,labelEn,source,groups} contract as the static sets', async () => {
    rows.set('hospital-a', [
      { code: 'clabsi', name_el: 'CLABSI EL', name_en: 'CLABSI EN', source_authority: 'CDC/NHSN (simplified)', metadata: { system: true, groups: [{ id: 'device', rule: 'all', items: [{ id: 'x', textEl: 'a', textEn: 'b' }] }] } },
    ])
    vi.doMock('../src/core/supabase/client', () => ({
      supabase: {
        from: () => ({
          select: () => ({
            eq: function () { return this },
            then: (resolve) => resolve({ data: rows.get('hospital-a'), error: null }),
          }),
        }),
      },
    }))
    const { loadHaiCriteriaSets } = await import('../src/features/surveillance/haiCriteriaLibraryService')
    const sets = await loadHaiCriteriaSets('hospital-a')
    expect(sets.clabsi).toEqual({ labelEl: 'CLABSI EL', labelEn: 'CLABSI EN', source: 'CDC/NHSN (simplified)', groups: [{ id: 'device', rule: 'all', items: [{ id: 'x', textEl: 'a', textEn: 'b' }] }] })
  })

  it('falls back to the static baseline if the organization has no rows yet', async () => {
    rows.set('hospital-a', [])
    vi.doMock('../src/core/supabase/client', () => ({
      supabase: {
        from: () => ({
          select: () => ({
            eq: function () { return this },
            then: (resolve) => resolve({ data: [], error: null }),
          }),
        }),
      },
    }))
    const { loadHaiCriteriaSets } = await import('../src/features/surveillance/haiCriteriaLibraryService')
    const sets = await loadHaiCriteriaSets('hospital-a')
    expect(sets).toEqual(HAI_CRITERIA_SETS)
  })
})
