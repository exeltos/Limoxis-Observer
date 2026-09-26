import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { INDICATOR_METRICS } from '../src/features/indicators/indicatorDefinitionService.js'
import { indicatorMetricLabel, metricLabels } from '../src/features/indicators/IndicatorDefinitionForm.jsx'
import { visibleForDepartment } from '../src/features/indicators/indicatorCloudService.js'
// Only the declarations matter here, not whether they carry !important.
const withoutImportant = css => css.replaceAll('!important', '')


const coreCss = fs.readFileSync('src/styles/foundation.css', 'utf8')
const definitionForm = fs.readFileSync('src/features/indicators/IndicatorDefinitionForm.jsx', 'utf8')
const createPage = fs.readFileSync('src/features/indicators/IndicatorCreatePage.jsx', 'utf8')
const recordPage = fs.readFileSync('src/features/indicators/IndicatorRecordPage.jsx', 'utf8')
const definitionService = fs.readFileSync('src/features/indicators/indicatorDefinitionService.js', 'utf8')
const indicatorsPage = fs.readFileSync('src/features/indicators/IndicatorsPage.jsx', 'utf8')
const migration = fs.readFileSync('supabase/migrations/20260922140000_indicator_visible_departments.sql', 'utf8')

describe('indicator metric labels: every metric has a real bilingual label', () => {
  it('covers all INDICATOR_METRICS with a distinct Greek and English label (not the raw key)', () => {
    const missing = INDICATOR_METRICS.filter((key) => !metricLabels[key])
    expect(missing).toEqual([])
  })

  it('never falls back to the raw snake_case key for either language', () => {
    const rawFallbacks = INDICATOR_METRICS.filter((key) => indicatorMetricLabel(key, 'el') === key || indicatorMetricLabel(key, 'en') === key)
    expect(rawFallbacks).toEqual([])
  })

  it('translates organism-specific metrics like bacteremia and AMR isolates', () => {
    expect(indicatorMetricLabel('bacteremia_ecoli', 'el')).toBe('Βακτηριαιμίες από E. coli')
    expect(indicatorMetricLabel('bacteremia_ecoli', 'en')).toBe('E. coli bacteremia')
    expect(indicatorMetricLabel('amr_resistant_klebsiella', 'el')).toContain('Klebsiella')
    expect(indicatorMetricLabel('mdr_isolation_saureus', 'en')).toContain('S. aureus')
  })
})

describe('indicator definition form: compact 3-column layout', () => {
  it('packs the entry-grid into 3 columns for both create and record forms', () => {
    expect(withoutImportant(coreCss)).toContain('.indicator-create-form .entry-grid,\n.indicator-record-form .entry-grid{\n  grid-template-columns:repeat(3,minmax(0,1fr));')
  })

  it('keeps title, definitions and validation notes full-width', () => {
    expect(withoutImportant(coreCss)).toContain('.indicator-create-form .entry-grid .entry-span-2,\n.indicator-record-form .entry-grid .entry-span-2{\n  grid-column:1 / -1;\n}')
  })
})

describe('indicator visibility by department', () => {
  it('stores visible_department_ids as a jsonb array defaulting to empty (visible to everyone)', () => {
    expect(migration).toContain('visible_department_ids jsonb not null default')
  })

  it('reads and writes visibleDepartmentIds through the definition service', () => {
    expect(definitionService).toContain('visible_department_ids')
    expect(definitionService).toContain('visibleDepartmentIds:Array.isArray(row.visible_department_ids)?row.visible_department_ids:[]')
    expect(definitionService).toContain('visible_department_ids:Array.isArray(normalized.visibleDepartmentIds)?normalized.visibleDepartmentIds:[]')
  })

  it('lets a manager pick which departments see the indicator from the definition form', () => {
    expect(definitionForm).toContain('toggleDepartment')
    expect(definitionForm).toContain('recipient-picker')
    expect(createPage).toContain('departments={departments}')
    expect(recordPage).toContain('departments={departments}')
  })

  it('an indicator with no department restriction is visible everywhere', () => {
    expect(visibleForDepartment({ visibleDepartmentIds: [] }, 'dept-icu')).toBe(true)
    expect(visibleForDepartment({ visibleDepartmentIds: [] }, null)).toBe(true)
  })

  it('a restricted indicator is only visible to its allowed departments', () => {
    const def = { visibleDepartmentIds: ['dept-icu', 'dept-er'] }
    expect(visibleForDepartment(def, 'dept-icu')).toBe(true)
    expect(visibleForDepartment(def, 'dept-cardiology')).toBe(false)
  })

  it('a restricted indicator still shows in the whole-hospital (no department filter) view', () => {
    expect(visibleForDepartment({ visibleDepartmentIds: ['dept-icu'] }, null)).toBe(true)
  })

  it('the indicators list filters definitions by the currently viewed department', () => {
    expect(indicatorsPage).toContain('visibleForDepartment')
    expect(indicatorsPage).toContain('allDefs.filter(def=>visibleForDepartment(def,calculatedDepartment))')
  })
})
