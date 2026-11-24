import { useEffect, useState } from 'react'
import { useAuditActor } from '../../core/audit/useAuditActor'
import { protocolCues, protocolStages, useEpisodeProtocols } from './protocols/useEpisodeProtocols'
import type { ClinicalPermissions, JourneyCase, ProtocolRequest } from './clinicalScreenTypes'
import type { Handler } from './surveillanceTypes'
import type { FeedbackTone } from '../../core/feedback/feedbackTypes'

type Notify = (message: string, tone?: FeedbackTone) => unknown
type JourneyProtocolsOptions = {
  record: JourneyCase
  organizationId: string | null | undefined
  isDemo: boolean
  active: boolean
  stage: string
  startProtocolRequest: ProtocolRequest | null
  onProtocolRequestHandled: Handler
  setDialog: (dialog: string | null) => void
  permissions: ClinicalPermissions
  t: (key: string) => string
  language: string
  notify: Notify
}

// N3: the protocols started on the episode and the 48–72 h antimicrobial reviews — their extra stages and cues,
// the run on show, and «Start protocol» from the episode header or from a qSOFA / SOFA prompt.
// Split out of ClinicalJourney (24/11/2026).
export function useJourneyProtocols({ record, organizationId, isDemo, active, stage, startProtocolRequest, onProtocolRequestHandled, setDialog, permissions, t, language, notify }: JourneyProtocolsOptions) {
  const actor = useAuditActor()
  const protocols = useEpisodeProtocols(record, { organizationId, isDemo })
  const [protocolPreset, setProtocolPreset] = useState<ProtocolRequest | null>(null)
  // "Start protocol" from the episode header or from a qSOFA / SOFA prompt.
  useEffect(() => {
    if (!startProtocolRequest?.nonce || !active) return
    setProtocolPreset(startProtocolRequest)
    setDialog('protocolPicker')
    onProtocolRequestHandled?.()
  }, [startProtocolRequest, active, onProtocolRequestHandled, setDialog])
  async function runProtocol(work: () => Promise<unknown>, message?: string) {
    try {
      const result = await work()
      setDialog(null)
      await protocols.reload()
      notify(message || t('actionCompleted'), 'success')
      return result ?? true
    } catch (error) {
      notify((error as Error)?.message || t('actionFailed'), 'danger')
      return false
    }
  }
  const protocolOptions = { isDemo, actor }
  const now = new Date()
  const extraStages = protocolStages(protocols.runs, t, language, now)
  const extraCues = protocolCues(protocols.runs, record, protocols.reviews, t, {
    canProtocol: permissions.canProtocol,
    canTherapy: permissions.canTherapy,
    now,
  })
  const activeRun = stage.startsWith('protocol:')
    ? protocols.runs.find(run => `protocol:${run.id}` === stage) || null
    : null
  return { actor, protocols, protocolPreset, setProtocolPreset, runProtocol, protocolOptions, now, extraStages, extraCues, activeRun }
}
