import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { qualityAudits, qualityCapas, qualityFindings, qualityIncidents } from '../src/features/quality/qualityDemoData'
import { mapRow } from '../src/features/quality/qualityService'
import { objectiveTitle } from '../src/features/quality/review/QualityObjectives'

const greek = /[Ͱ-Ͽἀ-῿]/
const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('English titles of quality records', () => {
  it('reads title_en when present and falls back to the written title', () => {
    const row = { id: '1', code: 'FND-1', title: 'Ελλιπής τεκμηρίωση', title_en: 'Incomplete documentation', description: 'Περιγραφή', description_en: 'Description' }
    expect(mapRow('findings', row)).toMatchObject({ title: 'Ελλιπής τεκμηρίωση', titleEn: 'Incomplete documentation', descriptionEn: 'Description' })
    expect(mapRow('findings', { ...row, title_en: null, description_en: null })).toMatchObject({ titleEn: 'Ελλιπής τεκμηρίωση', descriptionEn: 'Περιγραφή' })
  })
  it('shows the English objective title in English only when it exists', () => {
    expect(objectiveTitle({ title: 'Στόχος', titleEn: 'Objective' }, 'en')).toBe('Objective')
    expect(objectiveTitle({ title: 'Στόχος', titleEn: '' }, 'en')).toBe('Στόχος')
    expect(objectiveTitle({ title: 'Στόχος', titleEn: 'Objective' }, 'el')).toBe('Στόχος')
  })
  it('the demo records carry an English title without Greek letters', () => {
    const rows = [...qualityIncidents, ...qualityFindings, ...qualityCapas, ...qualityAudits]
    expect(rows.filter(row => !row.titleEn || greek.test(row.titleEn)).map(row => `${row.id}: ${row.title} | ${row.titleEn}`)).toEqual([])
  })
  it('the demo objectives carry an English title', () => {
    expect(source('src/features/quality/review/reviewService.js').match(/titleEn: '[^']+'/g).length).toBeGreaterThanOrEqual(3)
  })
  it('saves title_en from the editors and the objective dialog', () => {
    expect(source('src/features/quality/qualityService.js')).toContain('title_en:own(record.titleEn,record.title)')
    expect(source('src/features/quality/review/reviewService.js')).toContain('title_en: objective.titleEn?.trim() || null')
    // The record editor asks for one title: its English copy follows it until a translation is stored.
    expect(source('src/features/quality/QualityRecordPage.jsx')).not.toContain('Τίτλος (αγγλικά)')
    expect(source('src/features/quality/QualityRecordPage.jsx')).toContain("x[`${k}En`]===x[k]")
    expect(source('src/features/quality/review/QualityObjectives.jsx')).not.toContain('Τίτλος (αγγλικά)')
  })
})
