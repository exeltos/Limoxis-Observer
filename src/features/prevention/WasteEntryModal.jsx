import { ObserverDialog } from '../../design-system/ObserverDialog'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { WasteEntryEditor } from './WasteEntryEditor'

export function WasteEntryModal({onClose,onSave,fixedDepartment='',initialRecord=null,departments=[],wasteTypes=[],findPatientDays}){
 const {language}=useLanguage();const en=language==='en'
 return <ObserverDialog
  eyebrow={en?'PREVENTION CENTER':'ΚΕΝΤΡΟ ΠΡΟΛΗΨΗΣ'}
  title={initialRecord?(en?'Edit waste measurement':'Επεξεργασία μέτρησης αποβλήτων'):(en?'New waste measurement':'Νέα μέτρηση αποβλήτων')}
  subtitle={en?'Record weight, containers and indicator per 1,000 patient-days.':'Καταγραφή βάρους, περιεκτών και δείκτη ανά 1.000 νοσηλευτικές ημέρες.'}
  width="workspace"
  presentation="workspace"
  className="prevention-entry-card waste-entry-card"
  onClose={onClose}
 >
  <WasteEntryEditor onCancel={onClose} onSave={onSave} fixedDepartment={fixedDepartment} initialRecord={initialRecord} departments={departments} wasteTypes={wasteTypes} findPatientDays={findPatientDays}/>
 </ObserverDialog>
}
