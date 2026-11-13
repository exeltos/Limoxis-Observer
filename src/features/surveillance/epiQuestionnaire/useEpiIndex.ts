import { useEffect, useState } from 'react'
import { loadAllEpiQuestionnaires } from './epiQuestionnaireService'
import { isCoreComplete } from './epiQuestionnaireModel'
import type { EpiEpisode, EpiQuestionnaire } from './epiQuestionnaireTypes'

// The questionnaires by episode id; `ready` once a read succeeded.
export interface EpiIndex {
  rows: Record<string, EpiQuestionnaire>
  ready: boolean
}
interface UseEpiIndexOptions {
  organizationId?: string | null
  isDemo?: boolean
  enabled?: boolean
  refreshKey?: string
}
// The questionnaires of the whole hospital, once, for the episode lists («Ερωτηματολόγιο: εκκρεμεί»).
// `ready` is false until a read succeeded: a role that cannot read them, or a failing read, shows
// no reminder instead of a wrong one on every row.
export function useEpiIndex({ organizationId, isDemo, enabled = true, refreshKey = '' }: UseEpiIndexOptions = {}) {
  const [state, setState] = useState<EpiIndex>({ rows: {}, ready: false })
  useEffect(() => {
    if (!enabled) return undefined
    let alive = true
    loadAllEpiQuestionnaires(organizationId, { isDemo })
      .then(rows => alive && setState({ rows, ready: true }))
      .catch(() => alive && setState({ rows: {}, ready: false }))
    return () => {
      alive = false
    }
  }, [organizationId, isDemo, enabled, refreshKey])
  return state
}

// An active episode whose core questions are not answered yet (an episode always has its id).
export const epiPending = (index: EpiIndex | null | undefined, episode: Pick<EpiEpisode, 'id' | 'recordId' | 'status'>) => Boolean(index?.ready) && episode?.status === 'active' && !isCoreComplete(index!.rows[(episode.recordId || episode.id) as string]?.answers)
