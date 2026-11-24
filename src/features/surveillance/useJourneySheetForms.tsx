import { useRef } from 'react'
import { InlineDialogContext } from '../../design-system/ObserverDialog'
import { canWriteEpi } from './epiQuestionnaire/epiQuestionnaireText'
import type { ClinicalEntry, ClinicalPermissions, JourneyCase } from './clinicalScreenTypes'
import type { InlineDialogEntry as InlineForm } from '../../design-system/ObserverDialog'
import type { ReactNode } from 'react'

type JourneySheetFormsOptions = {
  editing: boolean
  active: boolean
  permissions: ClinicalPermissions
  record: JourneyCase
  role: string | null | undefined
  stage: string
  setStage: (stage: string) => void
  dialog: string | null
  setDialog: (dialog: string | null) => void
  setEntryDetail: (entry: ClinicalEntry | null) => void
  formNonce: number
}

// «Edit sheet» (owner, 8/11/2026): which forms sit on the page, the form each step opens with, and «Next» saving the
// changed form of the step before moving on. Split out of ClinicalJourney (24/11/2026).
export function useJourneySheetForms({ editing, active, permissions, record, role, stage, setStage, dialog, setDialog, setEntryDetail, formNonce }: JourneySheetFormsOptions) {
  // The sheet's fields (owner, 8/11/2026): the forms of the assessment, the isolation, the reassessment and the outcome
  // sit on the page itself, with their own Save, instead of a window over it.
  // Only in «Edit sheet», one step at a time (owner, 8/11/2026).
  const sheetEdit = {
    assessment: editing && active && permissions.canAssess,
    isolation: editing && active && permissions.canIsolation && !record.isolation && record.isolationDecision?.required !== false,
    reassessment: editing && active && permissions.canReassess,
    outcome: editing && active && permissions.canOutcome && !record.outcome,
  }
  // «Next» saves the form of the step when it was changed (owner, 8/11/2026): the inline form on show registers
  // itself here (InlineDialogContext), and moving to another step saves it first.
  const pendingForm = useRef<InlineForm | null>(null)
  const inlineForms = { register: (entry: InlineForm) => (pendingForm.current = entry), unregister: (entry: InlineForm) => pendingForm.current === entry && (pendingForm.current = null) }
  const sheetForm = (node: ReactNode) => <InlineDialogContext.Provider key={formNonce} value={inlineForms}>{node}</InlineDialogContext.Provider>
  // In «Edit sheet» every step opens with its form, no button to press first (owner, 8/11/2026): a new sample, HAI
  // assessment, device or therapy; the full questionnaire; the end of an active isolation.
  const stageForms: Record<string, string | null> =
    editing && active
      ? {
          samples: permissions.canLab ? 'sample' : null,
          questionnaire: canWriteEpi(role) ? 'epi' : null,
          hai: permissions.canAssess ? 'hai' : null,
          devices: permissions.canAssess ? 'device' : null,
          therapy: permissions.canTherapy ? 'therapy' : null,
          isolation: permissions.canIsolation && record.isolation?.status === 'active' ? 'endIsolation' : null,
        }
      : {}
  const shownDialog = dialog || stageForms[stage] || null
  // The step's own form has nothing to close to; a form opened on purpose closes back to it.
  const closeDialog = dialog && dialog !== stageForms[stage] ? () => setDialog(null) : null
  function goToStage(id: string) {
    const form = pendingForm.current
    if (id !== stage && form?.dirty() && !form.save()) return
    if (id !== stage) {
      setDialog(null)
      setEntryDetail(null)
    }
    setStage(id)
  }
  return { sheetEdit, inlineForms, sheetForm, stageForms, shownDialog, closeDialog, goToStage }
}
