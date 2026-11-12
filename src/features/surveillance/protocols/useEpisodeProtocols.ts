import { useCallback, useEffect, useState } from 'react'
import { loadProtocolRuns, loadTherapyReviews } from './protocolService'
import { pendingSteps, protocolByKey } from './protocolCatalogue'
import { formatElapsed, minutesBetween, runSummary } from './protocolTiming'
import { reviewWindow } from './therapyReview'

// Protocol runs and antimicrobial reviews of one episode. A database without the
// N3 tables yet (migration pending) leaves the episode as it was: no protocols.
export function useEpisodeProtocols(record, { organizationId, isDemo }) {
  const [runs, setRuns] = useState([])
  const [reviews, setReviews] = useState([])
  const therapies = record?.therapy
  const therapyKey = (therapies || []).map(item => item.id).join(',')
  const recordId = record?.id
  const reload = useCallback(async () => {
    if (!record) return
    const [runResult, reviewResult] = await Promise.allSettled([
      loadProtocolRuns(organizationId, record, { isDemo }),
      loadTherapyReviews(organizationId, record.therapy || [], { isDemo }),
    ])
    setRuns(runResult.status === 'fulfilled' ? runResult.value : [])
    setReviews(reviewResult.status === 'fulfilled' ? reviewResult.value : [])
    // `record` is read through its id and therapy list only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId, therapyKey, organizationId, isDemo])
  useEffect(() => {
    void reload()
  }, [reload])
  return { runs, reviews, reload }
}

const dayMonth = value => {
  const date = new Date(value)
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`
}

// Tabs of the started protocols (after the clinical assessment).
export function protocolStages(runs, t, language, now = new Date()) {
  return runs.map(run => ({
    id: `protocol:${run.id}`,
    protocol: true,
    locked: false,
    label: t('sepsis.badge'),
    status: run.status === 'completed' ? 'complete' : 'pending',
    meta:
      run.status === 'open'
        ? `${t(`sepsis.protocols.${run.protocolKey}.short`)} · ${formatElapsed(minutesBetween(run.recognizedAt, now), language)}`
        : t(run.status === 'completed' ? 'sepsis.tabMetaDone' : 'sepsis.tabMetaClosed'),
  }))
}

// «Χρειάζεται προσοχή» cues: an open protocol with a pending step, and therapies
// in (or past) their 48–72 h review window.
export function protocolCues(runs, record, reviews, t, { canProtocol, canTherapy, now = new Date() } = {}) {
  const cues = []
  if (canProtocol)
    for (const run of runs.filter(item => item.status === 'open' && protocolByKey(item.protocolKey))) {
      const pending = pendingSteps(run)
      const summary = runSummary(run, now)
      const short = t(`sepsis.protocols.${run.protocolKey}.short`)
      const late = summary.late.find(item => pending.some(step => step.key === item.step.key))
      const first = late?.step || pending[0]
      cues.push(
        first
          ? { id: `protocol:${run.id}`, tone: late ? 'warning' : 'info', title: t('sepsis.cuePending').replace('{protocol}', short).replace('{step}', t(`sepsis.steps.${first.key}.cue`)) }
          : { id: `protocol:${run.id}`, tone: 'info', title: t('sepsis.cueOnTrack').replace('{protocol}', short) },
      )
    }
  if (canTherapy)
    for (const therapy of record?.therapy || []) {
      const window = reviewWindow(therapy, reviews, now)
      if (window?.state === 'due') cues.push({ id: 'therapyReview', tone: 'neutral', title: t('sepsis.cueReview').replace('{from}', dayMonth(window.opensAt)).replace('{to}', dayMonth(window.dueBy)) })
      if (window?.state === 'overdue') cues.push({ id: 'therapyReview', tone: 'warning', title: t('sepsis.cueReviewOverdue').replace('{drug}', therapy.antimicrobial || '') })
    }
  return cues
}
