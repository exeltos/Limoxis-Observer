import { ObserverDialog } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { formatDay } from '../../core/i18n/formatDay'
import { useLanguage } from '../../core/i18n/LanguageContext'
import './DuplicatePatientDialog.css'

// «Υπάρχει ήδη αυτός ο ασθενής;»: shown before a new patient is created when one with the same
// details exists. Each match offers what fits the screen (`actions`: a new admission for the
// existing patient, opening it, or using it in the current form); «Συνέχεια ως νέος» creates the
// new patient anyway, for a different person with the same details.
export function DuplicatePatientDialog({ matches = [], actions = [], onContinue, onClose }) {
  const { t, language } = useLanguage()
  return (
    <ObserverDialog width="standard" title={t('patientDuplicate.title')} subtitle={t('patientDuplicate.subtitle')} onClose={onClose}
      footer={<Button variant="secondary" onClick={onContinue}>{t('patientDuplicate.continueNew')}</Button>}>
      <ul className="duplicate-patient-list">
        {matches.map(patient => (
          <li key={patient.id}>
            <div>
              <strong>{patient.name || [patient.lastName, patient.firstName].filter(Boolean).join(' ')}</strong>
              <small>{[patient.id, patient.dateOfBirth && `${t('patientDuplicate.born')} ${formatDay(patient.dateOfBirth, language)}`, patient.hospitalRecordNumber && `${t('patientDuplicate.record')} ${patient.hospitalRecordNumber}`, language === 'en' ? patient.departmentEn || patient.department : patient.department].filter(Boolean).join(' · ')}</small>
            </div>
            <div className="duplicate-patient-actions">
              {actions.map((action, index) => (
                <Button key={action.key} variant={index === 0 ? 'primary' : 'secondary'} onClick={() => action.onClick(patient)}>{action.label}</Button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </ObserverDialog>
  )
}
