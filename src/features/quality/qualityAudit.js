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
