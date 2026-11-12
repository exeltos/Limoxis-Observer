import { Plus } from 'lucide-react'
import { Button } from '../../design-system/Button'

// A patient record with no admission is never an empty page and never a card of its own:
// one short line with «Νέα νοσηλεία»; what exists for the patient (notifiable reports,
// episodes and samples outside admissions) follows as sections of the page.
export function PatientWithoutAdmission({ canAdmit, onNewAdmission, episodesCount = 0, samplesCount = 0, t }) {
  const outside = [
    episodesCount > 0 && `${episodesCount} ${t('clinicalRecords.episodesCountLabel').toLowerCase()}`,
    samplesCount > 0 && `${samplesCount} ${t('clinicalRecords.samplesCountLabel').toLowerCase()}`,
  ].filter(Boolean)
  return (
    <p className="patient-no-admission-line">
      <span>
        {t('clinicalRecords.noAdmissionTitle')}
        {outside.length > 0 && <small> · {outside.join(' · ')}</small>}
      </span>
      {canAdmit && (
        <Button variant="secondary" onClick={onNewAdmission}>
          <Plus size={15} />
          {t('clinicalRecords.newAdmission')}
        </Button>
      )}
    </p>
  )
}
