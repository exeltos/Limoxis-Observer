// What the summary of a surveillance record lists as needing attention.
import { daysOverdue } from '../../design-system/DueDate'
import { sampleTone } from './patientRecordScope'
import type { AntimicrobialTherapy, ClinicalCaseLike, EpisodeSample } from './clinicalTypes'
import type { AttentionItem, CommunicatedSample } from './surveillanceListTypes'

// A sample still waiting for its laboratory result.
export const isAwaitingResult = (sample: EpisodeSample | null | undefined) => sampleTone(sample || {}) === 'pending'

// A critical result counts as communicated once the laboratory logged the call.
export const isCommunicated = (sample: CommunicatedSample) =>
  Boolean(
    sample.communicatedAt ||
    sample.criticalCommunicatedAt ||
    sample.communications?.length ||
    sample.microbiologyResults?.some(result => result.communications?.length),
  )

// How the summary writes, the samples it reads and the further signals it adds.
interface SummaryAttentionOptions<E> {
  t: (key: string) => string
  samples?: EpisodeSample[]
  extra?: E[]
}
// What needs attention in the current surveillance, most urgent first; each item
// opens the stage of the surveillance where it is done.
// The page's own signals keep their type (E).
export function summaryAttention<E = AttentionItem>(record: ClinicalCaseLike | null, { t, samples = record?.samples || [], extra = [] }: SummaryAttentionOptions<E>) {
  if (!record || record.status !== 'active') return []
  const items: (AttentionItem | E)[] = []
  const lateDays = daysOverdue(record.reviewDue)
  if (lateDays > 0)
    items.push({
      id: 'reassessment',
      tone: 'danger',
      stage: 'reassessment',
      text: t('reassessmentOverdueBanner').replace('{days}', String(lateDays)),
      action: t('openReassessment'),
    })
  const uncommunicated = samples.filter((x: EpisodeSample) => x.critical && !isCommunicated(x))
  if (uncommunicated.length)
    items.push({
      id: 'critical',
      tone: 'danger',
      stage: 'samples',
      text: `${t('clinicalRecords.criticalNotCommunicated')}: ${uncommunicated.map((x: EpisodeSample) => x.id).join(', ')}`,
      action: t('clinicalRecords.openSamples'),
    })
  const pendingApproval = (record.therapy || []).filter((x: AntimicrobialTherapy) => x.approvalStatus === 'pending')
  if (pendingApproval.length)
    items.push({
      id: 'approval',
      tone: 'warning',
      stage: 'therapy',
      text: `${t('clinicalRecords.therapyAwaitingApproval')}: ${pendingApproval.map((x: AntimicrobialTherapy) => x.antimicrobial).join(', ')}`,
      action: t('clinicalRecords.openTherapy'),
    })
  const awaiting = samples.filter(isAwaitingResult)
  if (awaiting.length)
    items.push({
      id: 'samples',
      tone: 'warning',
      stage: 'samples',
      text: `${t('clinicalRecords.samplesAwaitingResult')}: ${awaiting.map((x: EpisodeSample) => x.id).join(', ')}`,
      action: t('clinicalRecords.openSamples'),
    })
  // Further signals computed elsewhere (the epidemiological questionnaire's risk signal).
  items.push(...extra)
  return items
}
