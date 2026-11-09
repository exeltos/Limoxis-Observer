// The Demo hospital's notifications to ΕΟΔΥ (2025–2026), read once by notificationReportsService.js in the demo only:
// the laboratory findings of the national plan reported a few days after the result, the healthcare-associated
// infections of the surveillance episodes (demoInfectionHistory.js) and a few clinical notifications of Demo patients.
// Written in the Demo's authored frame and moved to today like the other fixtures; the laboratory samples have moved already.
import { demoOffsetDays, shiftDemoDatesInPlace } from '../../core/data/demoClock'
import { addDays } from '../../core/data/demoSeed'
import { isEmptyPreview } from '../../core/preview/emptyPreview'
import { laboratorySamples } from '../laboratory/laboratoryDemoData'
import { historyCases } from '../surveillance/demoInfectionHistory'
import { notifiableFindings } from './notifiableFindings'
import { eodyEntry } from './eodyCatalogue'

// [date, patient, disease, status]
const CLINICAL = [
  ['2025-10-10', 'PT-252004', 'tuberculosis', 'notified'],
  ['2025-12-27', 'PT-252008', 'hepatitis_b', 'notified'],
  ['2026-01-19', 'PT-260082', 'influenza', 'notified'],
  ['2026-02-08', 'PT-260093', 'legionellosis', 'notified'],
  ['2026-05-17', 'PT-260126', 'salmonellosis', 'notified'],
  ['2026-07-02', 'PT-252019', 'west_nile', 'notified'],
  ['2026-08-26', 'PT-260179', 'tuberculosis', 'pending'],
]
// The resistant organisms whose healthcare-associated infections are reported (ΛΣΧΠΥΥ).
const REPORTED_RESISTANCE = ['MDR', 'XDR', 'VRE', 'MRSA']

export function demoNotificationReports(today = new Date()) {
  if (isEmptyPreview()) return []
  const reference = (date, number) => `ΕΟΔΥ-${date.slice(0, 4)}-${String(number).padStart(4, '0')}`
  const report = (key, date, patientRecordId, code, status, number, extra = {}) => ({
    id: key, findingKey: key, status, notifiedAt: status === 'notified' ? addDays(date, 2) : '', reference: status === 'notified' ? reference(date, number) : '',
    notes: '', updatedAt: `${status === 'notified' ? addDays(date, 2) : date}T10:00:00Z`, sampleId: '', patientRecordId,
    disease: eodyEntry(code)?.el || '', diseaseCode: code, createdAt: `${date}T09:30:00Z`, ...extra,
  })
  const findings = notifiableFindings(laboratorySamples, [])
  const reportedSamples = new Set(findings.map(finding => finding.sample.id))
  const authored = [
    ...historyCases
      .filter(item => item.hai?.[0] === 'confirmed' && REPORTED_RESISTANCE.includes(item.resistance) && !reportedSamples.has(item.sampleId))
      .map((item, index) => report(`clinical|demo-hai-${item.id}`, item.startedAt, item.patientId, 'hai', 'notified', 210 + index)),
    ...CLINICAL.map(([date, patient, code, status], index) => report(`clinical|demo-${index + 2}`, date, patient, code, status, 160 + index)),
  ]
  shiftDemoDatesInPlace(authored, demoOffsetDays(today))
  // The laboratory findings (already in today's frame): reported two days after the sample, except those of the last week.
  const lastWeek = addDays(today.toISOString().slice(0, 10), -7)
  const laboratory = findings.map((finding, index) => {
    const notified = finding.date <= lastWeek
    return report(finding.findingKey, finding.date, finding.sample.patientId || '', finding.rule.id, notified ? 'notified' : 'pending', 300 + index, { sampleId: finding.sample.id, disease: finding.rule.el })
  })
  return [...laboratory, ...authored]
}
