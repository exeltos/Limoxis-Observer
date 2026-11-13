import { reportKindOf } from './qualityVocabulary'
import { INCIDENT_STAGES, incidentStage } from './qualityRecordRules'
import type { DeviationItem, QualityDraft, QualityRecord, RegisterRow } from './qualityTypes'

// One register for everything that went wrong or could go better (ISO 9001
// §10.2): the reports people send and the deviations other modules record
// (control entries with a finding, failed bundle criteria, trainings that did
// not change practice) that no corrective action handles yet. Each row says where it came from.

export const REGISTER_SOURCES = [
  { value: 'report', label: ['Αναφορά', 'Report'] },
  { value: 'control', label: ['Έλεγχος', 'Control'] },
  { value: 'bundle', label: ['Bundle', 'Bundle'] },
  { value: 'training', label: ['Εκπαίδευση', 'Training'] },
]

// A report's stage reads the CAPAs that point to it (capa.sourceId).
export function registerRows(incidents: QualityRecord[] = [], deviations: DeviationItem[] = [], capas: QualityDraft[] = []): RegisterRow[] {
  const reports = incidents.map((record): RegisterRow => ({
    stage: incidentStage(record, capas.filter(capa => capa.sourceId === record.id)),
    key: `report:${record.id}`,
    type: 'report',
    source: 'report',
    id: record.id,
    code: record.displayId || record.id,
    title: record.title,
    titleEn: record.titleEn || record.title,
    kind: reportKindOf(record),
    category: record.category || '',
    department: record.department || '',
    departmentEn: record.departmentEn || record.department || '',
    date: record.date || '',
    owner: (record.owners?.length ? record.owners : [record.owner].filter(Boolean)).join(', '),
    status: record.status,
    severity: record.severity,
    sentinel: Boolean(record.sentinel),
    reporter: record.anonymous || record.privacy === 'confidential' ? '' : record.reportedByLabel || record.reportedBy || '',
    anonymous: Boolean(record.anonymous || record.privacy === 'confidential'),
    record,
  }))
  const pending = deviations.map((item): RegisterRow => ({
    key: `deviation:${item.key}`,
    type: 'deviation',
    source: item.kind,
    id: item.sourceId,
    code: item.kind === 'control' ? item.sourceId.split('#')[0] : item.kind === 'training' ? item.sourceId.slice(9) : item.sourceId,
    title: item.title,
    titleEn: item.titleEn || item.title,
    kind: 'deviation',
    category: '',
    department: item.department || '',
    departmentEn: item.departmentEn || item.department || '',
    date: String(item.at || '').slice(0, 10),
    owner: '',
    status: 'withoutCapa',
    severity: item.priority,
    sentinel: false,
    item,
  }))
  return [...reports, ...pending].sort((a, b) => String(b.date).localeCompare(String(a.date)))
}

// The filters of the register; `quick` is a summary card (open, sentinel,
// deviations without a CAPA).
export function filterRegister(rows: RegisterRow[], { query = '', kind = 'all', source = 'all', status = 'all', stage = 'all', department = 'all', category = 'all', quick = null, language = 'el' }: { query?: string, kind?: string, source?: string, status?: string, stage?: string, department?: string, category?: string, quick?: string | null, language?: string } = {}) {
  const text = query.trim().toLowerCase()
  return rows
    .filter((row: RegisterRow) => !text || `${row.code} ${row.title} ${row.titleEn} ${row.owner} ${row.department} ${row.reporter || ''}`.toLowerCase().includes(text))
    .filter((row: RegisterRow) => kind === 'all' || row.kind === kind)
    .filter((row: RegisterRow) => source === 'all' || row.source === source)
    .filter((row: RegisterRow) => status === 'all' || row.status === status)
    .filter((row: RegisterRow) => stage === 'all' || row.stage === stage)
    .filter((row: RegisterRow) => category === 'all' || row.category === category)
    .filter((row: RegisterRow) => department === 'all' || (language === 'en' ? row.departmentEn : row.department) === department)
    .filter((row: RegisterRow) => !quick || (quick === 'open' ? row.type === 'report' && row.status !== 'closed' : quick === 'sentinel' ? row.sentinel : quick === 'deviations' ? row.type === 'deviation' : quick === 'closed' ? row.status === 'closed' : INCIDENT_STAGES.includes(quick) ? row.stage === quick : true))
}

export function registerCounts(rows: RegisterRow[]) {
  return {
    total: rows.length,
    open: rows.filter((row: RegisterRow) => row.type === 'report' && !['closed', 'voided'].includes(row.stage as string)).length,
    sentinel: rows.filter((row: RegisterRow) => row.sentinel && !['closed', 'voided'].includes(row.stage as string)).length,
    deviations: rows.filter((row: RegisterRow) => row.type === 'deviation').length,
    stages: Object.fromEntries(INCIDENT_STAGES.map(id => [id, rows.filter((row: RegisterRow) => row.type === 'report' && row.stage === id).length])),
  }
}

// Reports no one has classified for `days` days or more (the reminder in the bell).
export function staleReports(incidents: QualityRecord[] = [], { today, days = 7 }: { today?: string, days?: number } = {}) {
  const day = (value: unknown) => Date.parse(`${String(value).slice(0, 10)}T12:00:00Z`)
  return registerRows(incidents, [], [])
    .filter((row: RegisterRow) => row.kind === 'report' && row.stage === 'toAssess' && row.date)
    .filter(row => Math.round((day(today) - day(row.date)) / 86400000) >= days)
}
