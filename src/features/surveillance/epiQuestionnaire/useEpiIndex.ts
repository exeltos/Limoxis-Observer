import { useEffect, useState } from 'react'
import { loadAllEpiQuestionnaires } from './epiQuestionnaireService'
import { isCoreComplete } from './epiQuestionnaireModel'
import type { AnyRecord } from '../../../types/featureTypes'

interface UseEpiIndexOptions {
  organizationId?: string
  isDemo?: boolean
  enabled?: boolean
  refreshKey?: string
}
// The questionnaires of the whole hospital, once, for the episode lists («Ερωτηματολόγιο: εκκρεμεί»).
// `ready` is false until a read succeeded: a role that cannot read them, or a failing read, shows
// no reminder instead of a wrong one on every row.
export function useEpiIndex({ organizationId, isDemo, enabled = true, refreshKey = '' }: UseEpiIndexOptions = {}) {
  const [state, setState] = useState({ rows: {}, ready: false })
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

// An active episode whose core questions are not answered yet.
export const epiPending = (index: number, episode: AnyRecord) => Boolean(index?.ready) && episode?.status === 'active' && !isCoreComplete(index.rows[episode.recordId || episode.id]?.answers)
