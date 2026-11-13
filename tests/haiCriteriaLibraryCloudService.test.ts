import { describe, expect, it, vi, beforeEach } from 'vitest'

const rows = new Map()

vi.mock('../src/core/supabase/client', () => ({
  supabase: {
    from: table => {
      if (table !== 'master_library_items') throw new Error(`Unexpected table ${table}`)
      function selectBuilder(filters) {
        return {
          eq: (col, value) => selectBuilder({ ...filters, [col]: value }),
          is: (col, value) => selectBuilder({ ...filters, [col]: value }),
          order: () => selectBuilder(filters),
          then: (resolve) => {
            const data = [...rows.values()].filter(row =>
              (filters.library_key === undefined || row.library_key === filters.library_key) &&
              (filters.organization_id === undefined || (filters.organization_id === null ? row.organization_id == null : row.organization_id === filters.organization_id)) &&
              (filters.is_active === undefined || row.is_active === filters.is_active)
            )
            resolve({ data, error: null })
          },
        }
      }
      function updateBuilder(payload, filters) {
        return {
          is: (col, value) => updateBuilder(payload, { ...filters, [col]: value }),
          eq: (col, value) => updateBuilder(payload, { ...filters, [col]: value }),
          select: () => updateBuilder(payload, filters),
          single: () => {
            const row = [...rows.values()].find(r => r.id === filters.id && (filters.organization_id === undefined || r.organization_id == null))
            if (!row) return Promise.resolve({ data: null, error: { message: 'not found' } })
            Object.assign(row, payload)
            return Promise.resolve({ data: row, error: null })
          },
        }
      }
      return {
        select: () => selectBuilder({}),
        update: payload => updateBuilder(payload, {}),
      }
    },
  },
}))

const { loadHaiCriteriaLibraryItems, loadGlobalHaiCriteriaLibraryItems, updateGlobalHaiCriteriaLibraryItem } = await import('../src/features/management/haiCriteriaLibraryCloudService')

describe('haiCriteriaLibraryCloudService', () => {
  beforeEach(() => {
    rows.clear()
    rows.set('global-clabsi', { id: 'global-clabsi', organization_id: null, library_key: 'hai_criteria', code: 'clabsi', name_el: 'CLABSI EL', name_en: 'CLABSI EN', source_authority: 'CDC/NHSN (simplified)', metadata: { system: true, locked: true, groups: [{ id: 'device', rule: 'all', items: [] }] }, is_active: true })
    rows.set('org-a-clabsi', { id: 'org-a-clabsi', organization_id: 'org-a', library_key: 'hai_criteria', code: 'clabsi', name_el: 'CLABSI EL', name_en: 'CLABSI EN', source_authority: 'CDC/NHSN (simplified)', metadata: { system: true, locked: true, groups: [{ id: 'device', rule: 'all', items: [] }] }, is_active: true })
  })

  it('loads the hospital copy scoped to its organization', async () => {
    const items = await loadHaiCriteriaLibraryItems('org-a')
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ criteriaKey: 'clabsi', labelEl: 'CLABSI EL', system: true, organizationId: 'org-a' })
  })

  it('loads the global (Platform Owner) rows separately from hospital copies', async () => {
    const items = await loadGlobalHaiCriteriaLibraryItems()
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ criteriaKey: 'clabsi', organizationId: null })
  })

  it('updates a global criteria set, including its nested groups payload', async () => {
    const saved = await updateGlobalHaiCriteriaLibraryItem({ id: 'global-clabsi', labelEl: 'CLABSI (updated)', labelEn: 'CLABSI EN', source: 'CDC/NHSN', groups: [{ id: 'device', rule: 'all', items: [{ id: 'x', textEl: 'a', textEn: 'b' }] }] })
    expect(saved.labelEl).toBe('CLABSI (updated)')
    expect(saved.groups).toEqual([{ id: 'device', rule: 'all', items: [{ id: 'x', textEl: 'a', textEn: 'b' }] }])
  })
})
