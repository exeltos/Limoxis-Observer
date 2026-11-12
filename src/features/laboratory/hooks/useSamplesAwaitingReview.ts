import { useCallback, useEffect, useState } from 'react'
import { useLaboratoryRepository } from './useLaboratoryRepository'
import type { SampleReviewDecision } from '../repositories/laboratoryRepository'
import type { AnyRecord } from '../../../types/featureTypes'

// «Προς έλεγχο»: the positive samples with no episode and no decision yet, for the
// infection-control roles (the home card and the worklist read the same list).
// enabled:false skips the read (the roles that never see the worklist).
export function useSamplesAwaitingReview({ enabled = true }: { enabled?: boolean } = {}) {
  const repository = useLaboratoryRepository()
  const [state, setState] = useState<{ rows: AnyRecord[], loading: boolean, error: unknown }>({ rows: [], loading: enabled, error: null })

  const reload = useCallback(async () => {
    try {
      const rows = await repository.listAwaitingReview()
      setState({ rows, loading: false, error: null })
    } catch (error) {
      setState(current => ({ ...current, loading: false, error }))
    }
  }, [repository])

  useEffect(() => { if (enabled) void reload() }, [reload, enabled])

  // decision: { status: 'no_surveillance_needed', reason, note } or { status: 'episode_opened', caseId }
  const review = useCallback(async (sample: AnyRecord, decision: SampleReviewDecision) => {
    await repository.review(sample, decision)
    await reload()
  }, [repository, reload])

  return { ...state, reload, review, repository }
}
