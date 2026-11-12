// What the summary of a surveillance record lists as needing attention.
import { daysOverdue } from '../../design-system/DueDate'
import { sampleTone } from './patientRecordScope'
import type { AnyRecord } from '../../types/featureTypes'

// A sample still waiting for its laboratory result.
export const isAwaitingResult = (sample: AnyRecord | null | undefined) => sampleTone(sample || {}) === 'pending'

// A critical result counts as communicated once the laboratory logged the call.
export const isCommunicated = (sample: AnyRecord) =>
  Boolean(
    sample.communicatedAt ||
    sample.criticalCommunicatedAt ||
    sample.communications?.length ||
    sample.microbiologyResults?.some((result: AnyRecord) => result.communications?.length),
  )

// What needs attention in the current surveillance, most urgent first; each item
// opens the stage of the surveillance where it is done.
export function summaryAttention(record: AnyRecord | null, { t, samples = record?.samples || [], extra = [] }: AnyRecord) {
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
  const uncommunicated = samples.filter((x: AnyRecord) => x.critical && !isCommunicated(x))
  if (uncommunicated.length)
    items.push({
      id: 'critical',
      tone: 'danger',
      stage: 'samples',
      text: `${t('clinicalRecords.criticalNotCommunicated')}: ${uncommunicated.map((x: AnyRecord) => x.id).join(', ')}`,
      action: t('clinicalRecords.openSamples'),
    })
  const pendingApproval = (record.therapy || []).filter((x: AnyRecord) => x.approvalStatus === 'pending')
  if (pendingApproval.length)
    items.push({
      id: 'approval',
      tone: 'warning',
      stage: 'therapy',
      text: `${t('clinicalRecords.therapyAwaitingApproval')}: ${pendingApproval.map((x: AnyRecord) => x.antimicrobial).join(', ')}`,
      action: t('clinicalRecords.openTherapy'),
    })
  const awaiting = samples.filter(isAwaitingResult)
  if (awaiting.length)
    items.push({
      id: 'samples',
      tone: 'warning',
      stage: 'samples',
      text: `${t('clinicalRecords.samplesAwaitingResult')}: ${awaiting.map((x: AnyRecord) => x.id).join(', ')}`,
      action: t('clinicalRecords.openSamples'),
    })
  // Further signals computed elsewhere (the epidemiological questionnaire's risk signal).
  items.push(...extra)
  return items
}
