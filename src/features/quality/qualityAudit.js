import { checklistScore } from '../../core/checklist/checklistScore'
import { checklistRows } from '../controls/controlStructured'

// An audit (ISO 9001 §9.2, JCI QPS): a planned date, a scope, and a checklist
// answered Yes / No / N/A. Its checklist comes from a control that is a
// checklist (Controls > «Επιθεώρηση με λίστα ελέγχου», so the same list serves
// both) or from items typed for this audit. Every «No» becomes a finding,
// and a finding gets its corrective action.

// The controls whose answer is a checklist: the audit templates.
export const checklistTemplates = (controls = []) => controls.filter(control => control?.responseConfig?.mode === 'checklist' && (control.responseConfig.checklist || []).length && control.status !== 'archived')

export function auditChecklistFromControl(control) {
  return checklistRows(control).map((row, index) => ({ ...row, id: row.id || `item-${index + 1}` }))
}

// One item per line, for an audit without a template.
export function auditChecklistFromText(text = '') {
  return String(text).split('\n').map(line => line.replace(/^\s*(\d+[.)]|[-•])\s*/, '').trim()).filter(Boolean).map((item, index) => ({ id: `item-${index + 1}`, item, itemEn: item, required: true, answer: '', note: '' }))
}

export const auditCompliance = record => checklistScore(record?.checklist || [])

// The «No» answers that have no finding yet.
export const pendingFindings = (rows = []) => rows.filter(row => row.answer === 'no' && !row.findingId)

// What each new finding of an audit is created with.
export function findingDraftFromRow(audit, row, language = 'el') {
  const en = language === 'en'
  const text = en ? row.itemEn || row.item : row.item
  return {
    title: text,
    titleEn: row.itemEn || row.item,
    departmentId: audit.departmentId || '',
    department: audit.department || '',
    departmentEn: audit.departmentEn || audit.department || '',
    severity: 'medium',
    status: 'open',
    source: 'audit',
    sourceId: audit.id,
    description: [en ? `Audit ${audit.displayId || audit.id}: «${text}» not met.` : `Επιθεώρηση ${audit.displayId || audit.id}: δεν τηρείται «${text}».`, row.note].filter(Boolean).join('\n'),
    date: audit.completedDate || audit.plannedDate || new Date().toISOString().slice(0, 10),
  }
}

// The audit programme of a year: the audits of each month, by planned date.
export function auditProgramme(audits = [], year = new Date().getFullYear()) {
  const months = Array.from({ length: 12 }, (_, month) => ({ month, audits: [] }))
  for (const audit of audits) {
    const day = String(audit.plannedDate || audit.completedDate || '')
    if (!day.startsWith(String(year))) continue
    months[Number(day.slice(5, 7)) - 1]?.audits.push(audit)
  }
  for (const entry of months) entry.audits.sort((a, b) => String(a.plannedDate).localeCompare(String(b.plannedDate)))
  return months
}

// Where an audit stands on the programme: done, under way, late (its planned
// date has passed), planned, or cancelled.
export function auditState(audit, today = new Date().toISOString().slice(0, 10)) {
  if (audit.status === 'cancelled' || audit.lifecycleStatus === 'voided') return 'cancelled'
  if (audit.status === 'completed') return 'done'
  if (audit.plannedDate && audit.plannedDate < today) return 'late'
  if (audit.status === 'inProgress') return 'running'
  return 'planned'
}

// The year's programme as a grid: one row per department (the organization's
// departments, then any other an audit names, then «whole organization» for
// audits without one), twelve months each. `covered` says whether the
// department has an audit that year; `totals` counts the audits by state.
export function auditMatrix(audits = [], year = new Date().getFullYear(), departments = [], today = new Date().toISOString().slice(0, 10)) {
  const inYear = audits.filter(audit => String(audit.plannedDate || audit.completedDate || '').startsWith(String(year)))
  const rows = new Map()
  const row = (key, name, nameEn, id = '') => {
    if (!rows.has(key)) rows.set(key, { key, name, nameEn: nameEn || name, id, months: Array.from({ length: 12 }, () => []), count: 0 })
    return rows.get(key)
  }
  for (const department of departments) row(department.name, department.name, department.nameEn, department.id || '')
  const totals = { done: 0, running: 0, late: 0, planned: 0, cancelled: 0 }
  for (const audit of inYear) {
    const name = String(audit.department || '').trim()
    const target = name ? row(name, name, audit.departmentEn) : row('', '', '')
    const month = Number(String(audit.plannedDate || audit.completedDate).slice(5, 7)) - 1
    const state = auditState(audit, today)
    target.months[month]?.push({ audit, state })
    target.count += 1
    totals[state] += 1
  }
  for (const entry of rows.values()) for (const cell of entry.months) cell.sort((a, b) => String(a.audit.plannedDate).localeCompare(String(b.audit.plannedDate)))
  const list = [...rows.values()].sort((a, b) => (a.key === '') - (b.key === '') || a.name.localeCompare(b.name, 'el'))
  return { rows: list.map(entry => ({ ...entry, covered: entry.count > 0 })), totals, total: inYear.length }
}
