// What the Division Director's screens show of a department row (division_overview): the labels,
// the roster pill and what needs attention. Greek and English side by side; no raw key reaches the screen.
import { PROFESSIONAL_CATEGORIES } from '../interviews/interviewsModel'
import { hospitalToday } from '../../core/dates/hospitalDate'
import type { AnyRecord } from '../../types/featureTypes'

const pick = (language: string, el: string, en: string) => (language === 'en' ? en : el)

// A professional category by its label, without the explanation in brackets («Υποστηρικτικό»).
export function categoryName(key: string, language = 'el') {
  const labels = (PROFESSIONAL_CATEGORIES as Record<string, string[]>)[key]
  if (!labels) return ''
  return labels[language === 'en' ? 1 : 0].replace(/\s*\(.*\)\s*$/, '')
}

// «Δεκεμβρίου» / «December» (the month of a roster), «Νοέμβριος 2026» / «November 2026» (the month shown).
export function monthGenitive(month: string | null | undefined, language = 'el') {
  if (!month) return ''
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'el-GR', { month: 'long', timeZone: 'UTC' }).format(new Date(`${month}-15T12:00:00Z`))
}
export function monthTitle(month = hospitalToday().slice(0, 7), language = 'el') {
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'el-GR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-15T12:00:00Z`))
}

// The roster of next month: [text, tone] for its pill.
export function rosterPill(row: AnyRecord | null | undefined, language = 'el'): [string, string] {
  const nights = Number(row?.uncoveredNights) || 0
  if (row?.rosterNextMonth === 'published') return [pick(language, 'Δημοσιευμένο', 'Published'), 'success']
  if (row?.rosterNextMonth === 'draft') return nights ? [pick(language, `Προσχέδιο · ${nights} ${nights === 1 ? 'νύχτα' : 'νύχτες'}`, `Draft · ${nights} ${nights === 1 ? 'night' : 'nights'}`), 'warning'] : [pick(language, 'Προσχέδιο', 'Draft'), 'info']
  return [pick(language, 'Λείπει', 'Missing'), 'danger']
}

// A percentage, or «—» when there is no data.
export const percentText = (value: unknown) => (value == null || value === '' || !Number.isFinite(Number(value)) ? '—' : `${Math.round(Number(value))}%`)
// Against a target: at or above it good, within 15 points watch, else off target.
export function percentStatus(value: unknown, target: number) {
  if (value == null || !Number.isFinite(Number(value))) return null
  const number = Number(value)
  return number >= target ? 'good' : number >= target - 15 ? 'warning' : 'danger'
}

// «Χρειάζονται προσοχή»: a missing roster first, then requests waiting over 3 days, a draft with
// uncovered nights and training that expires within 30 days.
export interface AttentionItem { key: string, departmentId: string, tone: 'danger' | 'warning' | 'info', to: string, count?: number, title: string }
export function attentionItems(departments: AnyRecord[] = [], nextMonth = '', language = 'el') {
  const month = monthGenitive(nextMonth, language)
  const items: AttentionItem[] = []
  for (const row of departments) {
    if (row.rosterNextMonth === 'missing' || !row.rosterNextMonth) items.push({ key: `roster-${row.id}`, departmentId: row.id, tone: 'danger', to: 'rosters', title: `${row.name}: ${pick(language, `λείπει το πρόγραμμα ${month}`, `no ${month} roster yet`)}` })
  }
  for (const row of departments) {
    const waiting = Number(row.pendingRequestsOver3Days) || 0
    if (waiting) items.push({ key: `requests-${row.id}`, departmentId: row.id, tone: 'warning', to: 'rosters', count: waiting, title: `${row.name}: ${pick(language, waiting === 1 ? 'αίτημα περιμένει πάνω από 3 ημέρες' : 'αιτήματα περιμένουν πάνω από 3 ημέρες', waiting === 1 ? 'a request waiting over 3 days' : 'requests waiting over 3 days')}` })
  }
  for (const row of departments) {
    const nights = Number(row.uncoveredNights) || 0
    if (row.rosterNextMonth === 'draft' && nights) items.push({ key: `nights-${row.id}`, departmentId: row.id, tone: 'warning', to: 'rosters', count: nights, title: `${row.name}: ${pick(language, nights === 1 ? 'ακάλυπτη νύχτα στο προσχέδιο' : 'ακάλυπτες νύχτες στο προσχέδιο', nights === 1 ? 'uncovered night in the draft' : 'uncovered nights in the draft')}` })
  }
  for (const row of departments) {
    const expiring = Number(row.trainingExpiring30) || 0
    if (expiring) items.push({ key: `training-${row.id}`, departmentId: row.id, tone: 'info', to: 'training', count: expiring, title: `${row.name}: ${pick(language, expiring === 1 ? 'εκπαίδευση λήγει σε 30 ημέρες' : 'εκπαιδεύσεις λήγουν σε 30 ημέρες', expiring === 1 ? 'training expires within 30 days' : 'trainings expire within 30 days')}` })
  }
  return items
}
