import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { EmployeeSurveillanceCanonicalFlow } from './EmployeeSurveillanceCanonicalFlow'

export function EmployeeSurveillanceFlow(props){
  return <EmployeeSurveillanceCanonicalFlow mode="single" {...props}/>
}

export function BulkEmployeeSurveillanceFlow(props){
  return <EmployeeSurveillanceCanonicalFlow mode="bulk" {...props}/>
}

export function SurveillanceSubjectChooser({onClose,onPatient,onEmployee,onBulkEmployee,onEnvironmental}){
  const {t,language}=useLanguage()
  const [employeeChoice,setEmployeeChoice]=useState(false)

  if(employeeChoice)return <ObserverDialog eyebrow={t('surveillance')} title={t('employee')} subtitle={language==='el'?'Επιλέξτε αν η επιτήρηση αφορά έναν εργαζόμενο ή ομάδα εργαζομένων.':'Choose whether the surveillance concerns one employee or a group of employees.'} width="medium" className="surveillance-subject-chooser employee-surveillance-mode-chooser" onClose={onClose}>
    <div className="subject-choice-grid subject-choice-grid--two">
      <button type="button" onClick={onEmployee}><span>01</span><strong>{language==='el'?'Ατομική επιτήρηση':'Individual surveillance'}</strong><small>{language==='el'?'Screening και παρακολούθηση ενός εργαζομένου.':'Screening and follow-up for one employee.'}</small></button>
      <button type="button" onClick={onBulkEmployee}><span>02</span><strong>{t('clinicalRecords.bulkEmployeeSurveillance')}</strong><small>{t('clinicalRecords.bulkEmployeeChoiceHelp')}</small></button>
    </div>
    <div className="employee-surveillance-mode-actions"><Button variant="secondary" onClick={()=>setEmployeeChoice(false)}><ArrowLeft size={16}/>{language==='el'?'Πίσω':'Back'}</Button></div>
  </ObserverDialog>

  return <ObserverDialog eyebrow={t('surveillance')} title={t('newSurveillance')} subtitle={t('clinicalRecords.chooseSurveillanceSubject')} width="wide" className="surveillance-subject-chooser" onClose={onClose}>
    <div className="subject-choice-grid subject-choice-grid--three">
      <button type="button" onClick={onPatient}><span>01</span><strong>{t('patient')}</strong><small>{t('clinicalRecords.patientSurveillanceChoiceHelp')}</small></button>
      <button type="button" onClick={()=>setEmployeeChoice(true)}><span>02</span><strong>{t('employee')}</strong><small>{t('clinicalRecords.employeeSurveillanceChoiceHelp')}</small></button>
      <button type="button" onClick={onEnvironmental}><span>03</span><strong>{t('environmentalSurveillance')}</strong><small>{t('clinicalRecords.environmentalSurveillanceChoiceHelp')}</small></button>
    </div>
  </ObserverDialog>
}
