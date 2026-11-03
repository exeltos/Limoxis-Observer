import { useState } from 'react'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { CheckboxField } from '../../design-system/CheckboxField'
import { useLanguage } from '../../core/i18n/LanguageContext'

const STORAGE_KEY = 'limoxis.employees.excelFields'
const readSelection = fields => {
  try { const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null'); if (Array.isArray(saved)) return fields.filter(field => saved.includes(field.key)).map(field => field.key) } catch { /* the choice is only a convenience */ }
  return fields.filter(field => field.initial).map(field => field.key)
}

// «Excel» of the employees: the fields of the file are chosen each time (the last choice is remembered).
// fields: [{ key, label, initial }] — onConfirm receives the chosen keys, in the order of `fields`.
export function EmployeeExcelDialog({ fields, onConfirm, onClose }) {
  const { t } = useLanguage()
  const [chosen, setChosen] = useState(() => readSelection(fields))
  const toggle = (key, on) => setChosen(current => (on ? [...current, key] : current.filter(item => item !== key)))
  const confirm = () => {
    const keys = fields.filter(field => chosen.includes(field.key)).map(field => field.key)
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keys)) } catch { /* ignore */ }
    onConfirm(keys)
  }
  return <ObserverDialog width="compact" title={t('employeesRecords.excelFieldsTitle')} subtitle={t('employeesRecords.excelFieldsHint')} onClose={onClose}
    footer={<DialogActions><Button variant="secondary" onClick={onClose}>{t('cancel')}</Button><Button disabled={!chosen.length} onClick={confirm}>{t('employeesRecords.excelDownload')}</Button></DialogActions>}>
    <div className="employee-excel-fields">
      {fields.map(field => <CheckboxField key={field.key} label={field.label} checked={chosen.includes(field.key)} onChange={on => toggle(field.key, on)} />)}
    </div>
  </ObserverDialog>
}
