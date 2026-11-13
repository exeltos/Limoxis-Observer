import { describe, expect, it } from 'vitest'
import { filterDeviations, deviationsExport } from '../src/features/quality/QualityReportRegister'
import { deviationsReportDoc } from '../src/features/quality/deviationReports'
import { causeCategoriesText } from '../src/features/quality/qualityVocabulary'

const row = (code, extra = {}) => ({ key: code, type: 'finding', code, title: code, titleEn: code, source: 'manual', status: 'closed', severity: 'medium', department: 'ΜΕΘ', departmentEn: 'ICU', date: '2026-03-01', hasCapa: true, deviationKind: '', causeCategories: [], recurring: null, item: {}, ...extra })
const ALL = { query: '', scope: 'registry', source: 'all', department: 'all', priority: 'all', status: 'all', deviationKind: 'all', cause: 'all', recurring: 'all', dateFrom: '', dateTo: '', quick: null }

describe('Deviations: kind, causes, recurrence', () => {
  const rows = [
    row('FND-1', { deviationKind: 'breakdown', causeCategories: ['equipment'], recurring: true, date: '2026-02-10' }),
    row('FND-2', { deviationKind: 'procedure', causeCategories: ['procedure', 'human_error'], recurring: false, status: 'open', hasCapa: false, date: '2026-05-04' }),
    row('FND-3', { date: '2025-12-01' }),
  ] as never[]
  it('filters by kind, cause, recurrence and dates', () => {
    expect(filterDeviations(rows, { ...ALL, deviationKind: 'procedure' }).map(r => r.code)).toEqual(['FND-2'])
    expect(filterDeviations(rows, { ...ALL, cause: 'human_error' }).map(r => r.code)).toEqual(['FND-2'])
    expect(filterDeviations(rows, { ...ALL, recurring: 'yes' }).map(r => r.code)).toEqual(['FND-1'])
    expect(filterDeviations(rows, { ...ALL, dateFrom: '2026-01-01', dateTo: '2026-03-31' }).map(r => r.code)).toEqual(['FND-1'])
    expect(filterDeviations(rows, { ...ALL, quick: 'withoutCapa' }).map(r => r.code)).toEqual(['FND-2'])
  })
  it('names the causes and exports and prints the new fields', () => {
    expect(causeCategoriesText(['procedure', 'human_error'])).toBe('Μη τήρηση διαδικασίας, Ανθρώπινο λάθος')
    const table = deviationsExport(rows, { language: 'el', t: v => v })
    expect(table.headers).toContain('Είδος')
    expect(table.rows[0].slice(2, 3)).toEqual(['Βλάβη'])
    const doc = deviationsReportDoc({ rows, groupBy: 'kind' })
    expect(doc.sections.map(section => section.title)).toEqual(['Βλάβη · 1', 'Μη τήρηση διαδικασίας · 1', 'Χωρίς είδος · 1'])
    expect(doc.meta).toContainEqual(['Επαναλαμβανόμενες', '1'])
  })
})
