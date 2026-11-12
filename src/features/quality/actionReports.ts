import type { ReportDoc, ReportFact } from '../../core/export/reportDocument'
// The printout of the corrective actions (printReport): one table, or one per status, department, owner or source.
import { qualityCode } from './qualityVocabulary'
import { recordOwners } from './qualityRecordRules'
import { isDueSoonAction, isOpenRecord, isOverdueAction } from './QualityLists'
import type { AnyRecord } from '../../types/featureTypes'

const dmy = (value: unknown) => (value ? String(value).slice(0, 10).split('-').reverse().join('/') : '')
const mid = (text: string) => ({ text, align: 'center' })

export function actionsReportDoc({ rows, groupBy = 'none', language = 'el', t = (value: string) => value, sourceLabel = (value: string) => value, period = '' }: AnyRecord): ReportDoc {
  const en = language === 'en'
  const title = (row: AnyRecord) => (en ? row.titleEn : row.title) || row.title || ''
  const department = (row: AnyRecord) => (en ? row.departmentEn : row.department) || row.department || (en ? 'No department' : 'Χωρίς τμήμα')
  const owners = (row: AnyRecord) => recordOwners(row).join(', ') || (en ? 'No owner' : 'Χωρίς υπεύθυνο')
  const keyOf = ({ status: (row: AnyRecord) => t(row.status), department, owner: owners, source: (row: AnyRecord) => sourceLabel(row.sourceKind) } as Record<string, (row: AnyRecord) => string>)[groupBy]
  const columns = [
    { text: en ? 'Code' : 'Κωδικός', width: '11%' },
    { text: en ? 'Action' : 'Ενέργεια', width: '29%' },
    { text: en ? 'Source' : 'Προέλευση', width: '13%' },
    ...(groupBy === 'department' ? [] : [{ text: en ? 'Department' : 'Τμήμα', width: '13%' }]),
    ...(groupBy === 'owner' ? [] : [{ text: en ? 'Owner' : 'Υπεύθυνος', width: '14%' }]),
    { text: en ? 'Due' : 'Προθεσμία', width: '9%', align: 'center' },
    ...(groupBy === 'status' ? [] : [{ text: en ? 'Status' : 'Κατάσταση', width: '11%' }]),
  ]
  const line = (row: AnyRecord) => [
    qualityCode(row, language), title(row), [sourceLabel(row.sourceKind), row.sourceCode].filter(Boolean).join(' · '),
    ...(groupBy === 'department' ? [] : [department(row)]),
    ...(groupBy === 'owner' ? [] : [recordOwners(row).join(', ')]),
    mid(dmy(row.dueDate) + (isOverdueAction(row) ? ' !' : '')),
    ...(groupBy === 'status' ? [] : [t(row.status)]),
  ]
  const sorted = [...rows].sort((a, b) => String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999')))
  const groups = new Map()
  for (const row of sorted) { const key = keyOf ? keyOf(row) : ''; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(row) }
  const keys = [...groups.keys()].sort((a, b) => a.localeCompare(b, 'el'))
  return {
    language,
    orientation: 'landscape',
    kind: en ? 'Quality' : 'Ποιότητα',
    title: en ? 'Corrective actions' : 'Διορθωτικές ενέργειες',
    filename: en ? 'corrective-actions' : 'diorthotikes-energeies',
    meta: [
      ...(period ? [[en ? 'Due' : 'Προθεσμία', period] as ReportFact] : []),
      [en ? 'Actions' : 'Ενέργειες', String(rows.length)],
      [en ? 'Open / overdue' : 'Ανοιχτές / εκπρόθεσμες', `${rows.filter(isOpenRecord).length} / ${rows.filter(isOverdueAction).length}`],
      [en ? 'Due in 14 days' : 'Λήγουν σε 14 ημέρες', String(rows.filter(isDueSoonAction).length)],
    ],
    sections: keys.map(key => ({ title: groupBy === 'none' ? '' : `${key} · ${groups.get(key).length}`, table: { columns, rows: groups.get(key).map(line) } })),
  }
}
