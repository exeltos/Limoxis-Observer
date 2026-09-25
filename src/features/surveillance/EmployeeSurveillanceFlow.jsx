import { Building2, UserRound, UsersRound } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { SubjectChoiceStep } from '../../design-system/SubjectChoiceStep'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { EmployeeSurveillanceCanonicalFlow } from './EmployeeSurveillanceCanonicalFlow'

export function EmployeeSurveillanceFlow(props){
  return <EmployeeSurveillanceCanonicalFlow mode="single" {...props}/>
}

export function BulkEmployeeSurveillanceFlow(props){
  return <EmployeeSurveillanceCanonicalFlow mode="bulk" {...props}/>
}

// Same numbered question + icon cards as the Laboratory "new sample" dialog.
export function SurveillanceSubjectChooser({onClose,onPatient,onEmployee,onEnvironmental}){
  const {t}=useLanguage()
  const choices=[
    ['patient',UserRound,t('patient'),t('clinicalRecords.patientSurveillanceChoiceHelp')],
    ['employee',UsersRound,t('employee'),t('clinicalRecords.employeeSurveillanceChoiceHelp')],
    ['environment',Building2,t('environmentalSurveillance'),t('clinicalRecords.environmentalSurveillanceChoiceHelp')],
  ]
  const choose=id=>id==='patient'?onPatient?.():id==='employee'?onEmployee?.():onEnvironmental?.()
  return <ObserverDialog eyebrow={t('surveillance')} title={t('newSurveillance')} width="standard" className="surveillance-subject-chooser" onClose={onClose} footer={<Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>}>
    <SubjectChoiceStep step={1} title={t('clinicalRecords.surveillanceSubjectQuestion')} hint={t('clinicalRecords.chooseCategoryToContinue')} choices={choices} onChoose={choose}/>
  </ObserverDialog>
}
