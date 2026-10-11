// What the summary of a surveillance record lists as needing attention.
import { daysOverdue } from '../../design-system/DueDate'
import { sampleTone } from './patientRecordScope'

// A sample still waiting for its laboratory result.
export const isAwaitingResult = sample => sampleTone(sample || {}) === 'pending'

// A critical result counts as communicated once the laboratory logged the call.
export const isCommunicated = sample =>
  Boolean(
    sample.communicatedAt ||
    sample.criticalCommunicatedAt ||
    sample.communications?.length ||
    sample.microbiologyResults?.some(result => result.communications?.length),
  )

// What needs attention in the current surveillance, most urgent first; each item
// opens the stage of the surveillance where it is done.
export function summaryAttention(record, { t, samples = record?.samples || [] }) {
  if (!record || record.status !== 'active') return []
  const items = []
  const lateDays = daysOverdue(record.reviewDue)
  if (lateDays > 0)
    items.push({
      id: 'reassessment',
      tone: 'danger',
      stage: 'reassessment',
      text: t('reassessmentOverdueBanner').replace('{days}', String(lateDays)),
      action: t('openReassessment'),
    })
  const uncommunicated = samples.filter(x => x.critical && !isCommunicated(x))
  if (uncommunicated.length)
    items.push({
      id: 'critical',
      tone: 'danger',
      stage: 'samples',
      text: `${t('clinicalRecords.criticalNotCommunicated')}: ${uncommunicated.map(x => x.id).join(', ')}`,
      action: t('clinicalRecords.openSamples'),
    })
  const pendingApproval = (record.therapy || []).filter(x => x.approvalStatus === 'pending')
  if (pendingApproval.length)
    items.push({
      id: 'approval',
      tone: 'warning',
      stage: 'therapy',
      text: `${t('clinicalRecords.therapyAwaitingApproval')}: ${pendingApproval.map(x => x.antimicrobial).join(', ')}`,
      action: t('clinicalRecords.openTherapy'),
    })
  const awaiting = samples.filter(isAwaitingResult)
  if (awaiting.length)
    items.push({
      id: 'samples',
      tone: 'warning',
      stage: 'samples',
      text: `${t('clinicalRecords.samplesAwaitingResult')}: ${awaiting.map(x => x.id).join(', ')}`,
      action: t('clinicalRecords.openSamples'),
    })
  return items
}
