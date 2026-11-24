import { RefreshCcw } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { ReasonDialog } from './ClinicalRecordDialogs'
import { CompletedReport } from './ClinicalRecordViews'
import type { Dispatch, SetStateAction } from 'react'
import type { ClinicalLibraries, ClinicalPermissions, JourneyCase } from './clinicalScreenTypes'

type ClinicalJourneyClosedProps = {
  record: JourneyCase
  permissions: ClinicalPermissions
  libraries: ClinicalLibraries
  t: (key: string) => string
  fmtDate: (value: unknown) => string
  language: string
  dialog: string | null
  setDialog: (dialog: string | null) => void
  reason: string
  setReason: Dispatch<SetStateAction<string>>
  onReopen: () => unknown
}

// A closed episode: its completed report and, for whoever may, «Reopen surveillance» with a reason.
// Split out of ClinicalJourney (24/11/2026).
export function ClinicalJourneyClosed({ record, permissions, libraries, t, fmtDate, language, dialog, setDialog, reason, setReason, onReopen }: ClinicalJourneyClosedProps) {
  return (
    <div className="clinical-data-hub">
      {permissions.canReopen && (
        <div className="clinical-data-heading">
          <Button variant="secondary" onClick={() => setDialog('reopen')}>
            <RefreshCcw size={15} />
            {t('clinicalRecords.reopenSurveillance')}
          </Button>
        </div>
      )}
      <CompletedReport
        record={record}
        t={t}
        fmtDate={fmtDate}
        language={language}
        libraries={libraries}
      />
      {dialog === 'reopen' && (
        <ReasonDialog
          title={t('clinicalRecords.reopenSurveillance')}
          t={t}
          reason={reason}
          setReason={setReason}
          onClose={() => setDialog(null)}
          onSave={onReopen}
        />
      )}
    </div>
  )
}
