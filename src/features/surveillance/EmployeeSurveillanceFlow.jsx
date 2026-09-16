import { ObserverDialog } from '../../design-system/ObserverDialog'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { EmployeeSurveillanceCanonicalFlow } from './EmployeeSurveillanceCanonicalFlow'

export function EmployeeSurveillanceFlow(props){
  return <EmployeeSurveillanceCanonicalFlow mode="single" {...props}/>
}

export function BulkEmployeeSurveillanceFlow(props){
  return <EmployeeSurveillanceCanonicalFlow mode="bulk" {...props}/>
}

export function SurveillanceSubjectChooser({onClose,onPatient,onEmployee,onEnvironmental}){
  const {t}=useLanguage()
  return <ObserverDialog eyebrow={t('surveillance')} title={t('newSurveillance')} subtitle={t('clinicalRecords.chooseSurveillanceSubject')} width="wide" className="surveillance-subject-chooser" onClose={onClose}>
    <div className="subject-choice-grid">
      <button type="button" onClick={onPatient}><span>01</span><strong>{t('patient')}</strong><small>{t('clinicalRecords.patientSurveillanceChoiceHelp')}</small></button>
      <button type="button" onClick={onEmployee}><span>02</span><strong>{t('employee')}</strong><small>{t('clinicalRecords.employeeSurveillanceChoiceHelp')}</small></button>
      <button type="button" onClick={onEnvironmental}><span>03</span><strong>{t('environmentalSurveillance')}</strong><small>{t('clinicalRecords.environmentalSurveillanceChoiceHelp')}</small></button>
    </div>
  </ObserverDialog>
}
