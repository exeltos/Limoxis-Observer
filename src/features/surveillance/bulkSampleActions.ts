import { hospitalToday } from '../../core/dates/hospitalDate'
import { bulkSummaryText } from './SampleReviewWorklist'
import { decideAll, episodeDraftFor, groupSamplesByPatient, openEpisodesFor, patientRecordOf } from './sampleReviewBulk'
import type { FeedbackContextValue } from '../../core/feedback/feedbackTypes'
import type { useSamplesAwaitingReview } from '../laboratory/hooks/useSamplesAwaitingReview'
import type { createClinicalRepository } from './clinicalRepository'
import type { ReviewSample } from './surveillanceListTypes'

type NoSurveillanceDecision = { status: 'no_surveillance_needed', reason: string, note: string }

// Several samples at once (owner, 19/11/2026), shared by «Προς έλεγχο» and «Ασθενείς» (owner, 20/11/2026): one episode
// per patient through the same start and the same link as «Open episode» (the link records the NICU late-onset
// infection), or one reason for all; then one reload and one sentence of what was done.
export function bulkSampleActions({ awaitingReview, clinical, language, t, notify, onDone }: {
  awaitingReview: Pick<ReturnType<typeof useSamplesAwaitingReview>, 'repository' | 'reload'>
  clinical: Pick<ReturnType<typeof createClinicalRepository>, 'createCase'>
  language: string
  t: (key: string) => string
  notify: FeedbackContextValue['notify']
  onDone?: () => unknown
}) {
  async function finish(result: { done: number, failed: { label: string }[] }, kind: 'open' | 'decide') {
    await awaitingReview.reload()
    await onDone?.()
    notify(bulkSummaryText(result, kind, language), result.failed.length ? 'warning' : 'success')
  }
  return {
    openEpisodes: async (samples: ReviewSample[]) => {
      const result = await openEpisodesFor(groupSamplesByPatient(samples), {
        createCase: group => {
          const first = group.samples[0]
          return clinical.createCase({ id: first.patientId || undefined, recordId: patientRecordOf(first) || undefined, name: first.patient, nameEn: first.patientEn || first.patient, department: first.department, departmentEn: first.departmentEn || first.department }, episodeDraftFor(group, type => t(type), hospitalToday()))
        },
        link: (sample, caseId) => awaitingReview.repository.review(sample, { status: 'episode_opened', caseId }),
      })
      await finish(result, 'open')
    },
    decide: async (samples: ReviewSample[], decision: NoSurveillanceDecision) => {
      const result = await decideAll(samples, decision, (sample, value) => awaitingReview.repository.review(sample, value))
      await finish(result, 'decide')
    },
  }
}
