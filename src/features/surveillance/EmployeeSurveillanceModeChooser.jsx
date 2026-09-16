import { ObserverDialog } from '../../design-system/ObserverDialog'
import { useLanguage } from '../../core/i18n/LanguageContext'

export function EmployeeSurveillanceModeChooser({onClose,onSingle,onBulk}){
  const {language}=useLanguage()
  const en=language==='en'
  return <ObserverDialog eyebrow={en?'EMPLOYEE SURVEILLANCE':'ΕΠΙΤΗΡΗΣΗ ΕΡΓΑΖΟΜΕΝΩΝ'} title={en?'Employee surveillance':'Επιτήρηση εργαζομένων'} subtitle={en?'Choose how you want to start the surveillance.':'Επιλέξτε τον τρόπο έναρξης της επιτήρησης.'} width="wide" className="surveillance-subject-chooser" onClose={onClose}>
    <div className="subject-choice-grid">
      <button type="button" onClick={onSingle}><span>01</span><strong>{en?'Individual employee':'Μεμονωμένος εργαζόμενος'}</strong><small>{en?'Start surveillance for one employee.':'Έναρξη επιτήρησης για έναν εργαζόμενο.'}</small></button>
      <button type="button" onClick={onBulk}><span>02</span><strong>{en?'Bulk surveillance':'Μαζική επιτήρηση'}</strong><small>{en?'Start a common screening batch for multiple employees.':'Έναρξη κοινού ελέγχου για πολλούς εργαζομένους.'}</small></button>
    </div>
  </ObserverDialog>
}
