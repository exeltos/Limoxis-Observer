import { awareCategoryFor } from './whoAwareClassification'
import type { DispensingRecord } from './pharmacyTypes'

// The key figures of «Κατανάλωση» for its latest month with records, against the
// month before: total grams, the WHO AWaRe shares (Access target ≥ 60% of use) and
// how many departments have recorded that month. The shares are of DDD, as the WHO
// target is, when every antibiotic of the month has a DDD reference (`ddd`: code →
// grams); otherwise of grams (`basis: 'grams'`), which the screen says and does not
// hold against the target.
export const ACCESS_TARGET = 60

const monthOf = (row: DispensingRecord) => String(row.periodStart || row.period || '').slice(0, 7)
const previousMonth = (month: string) => {
  const [year, value] = month.split('-').map(Number)
  return value === 1 ? `${year - 1}-12` : `${year}-${String(value - 1).padStart(2, '0')}`
}

export interface MonthFigures { grams: number, basis: 'ddd' | 'grams', access: number | null, reserve: number | null, departments: number }

function monthFigures(rows: DispensingRecord[], ddd: Record<string, number>): MonthFigures {
  const grams = rows.reduce((sum, row) => sum + (Number(row.quantityGrams) || 0), 0)
  const byDdd = rows.length > 0 && rows.every(row => Number(ddd[row.productCode]) > 0)
  const amount = (row: DispensingRecord) => (Number(row.quantityGrams) || 0) / (byDdd ? Number(ddd[row.productCode]) : 1)
  const total = rows.reduce((sum, row) => sum + amount(row), 0)
  const share = (category: string) => {
    if (!total) return null
    const part = rows.filter(row => awareCategoryFor(row.productEn || row.product) === category).reduce((sum, row) => sum + amount(row), 0)
    return Math.round((part / total) * 1000) / 10
  }
  return { grams, basis: byDdd ? 'ddd' : 'grams', access: share('access'), reserve: share('reserve'), departments: new Set(rows.map(row => row.departmentEl).filter(Boolean)).size }
}

export function pharmacyConsumptionKpis(rows: DispensingRecord[] = [], { ddd = {} }: { ddd?: Record<string, number> } = {}): { month: string | null, previous: string | null, current: MonthFigures | null, before: MonthFigures | null, allDepartments: number } {
  const months = [...new Set(rows.map(monthOf).filter(Boolean))].sort()
  const month = months.at(-1) || null
  if (!month) return { month: null, previous: null, current: null, before: null, allDepartments: 0 }
  const previous = previousMonth(month)
  const current = monthFigures(rows.filter(row => monthOf(row) === month), ddd)
  const beforeRows = rows.filter(row => monthOf(row) === previous)
  return {
    month,
    previous,
    current,
    before: beforeRows.length ? monthFigures(beforeRows, ddd) : null,
    allDepartments: new Set(rows.map(row => row.departmentEl).filter(Boolean)).size,
  }
}
