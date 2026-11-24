import { useEffect, useState } from 'react'
import { isCoreComplete } from './epiQuestionnaire/epiQuestionnaireModel'
import { loadEpiQuestionnaires, loadEpiSettings } from './epiQuestionnaire/epiQuestionnaireService'
import type { EpiState, JourneyCase } from './clinicalScreenTypes'

// The epidemiological questionnaire of the episode, a step of its own (owner, 8/11/2026): its row and settings,
// reloaded when `nonce` moves (a saved answer), and whether its core questions are complete.
// Split out of ClinicalJourney (24/11/2026).
export function useJourneyEpi(record: JourneyCase, organizationId: string | null | undefined, isDemo: boolean) {
  const epiKey = isDemo ? record.id : record.recordId || record.id
  const [epi, setEpi] = useState<EpiState>({ row: null, settings: [], ready: false, nonce: 0 })
  useEffect(() => {
    let alive = true
    Promise.all([
      loadEpiQuestionnaires(organizationId, [epiKey], { isDemo }),
      loadEpiSettings(organizationId, { isDemo }).catch(() => []),
    ])
      .then(([rows, settings]) => alive && setEpi(current => ({ ...current, row: rows?.[String(epiKey)] || null, settings, ready: true })))
      .catch(() => alive && setEpi(current => ({ ...current, ready: false })))
    return () => {
      alive = false
    }
  }, [organizationId, isDemo, epiKey, epi.nonce])
  const epiDone = Boolean(epi.row && isCoreComplete(epi.row.answers))
  return { epiKey, epi, setEpi, epiDone }
}
