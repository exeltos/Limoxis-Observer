import { useState } from 'react'
import { ObserverDialog, DialogActions } from './ObserverDialog'
import { Button } from './Button'
import { ChoiceField } from './ChoiceField'
import { useLanguage } from '../core/i18n/LanguageContext'

const read = key => { try { return JSON.parse(window.localStorage.getItem(key) || 'null') || {} } catch { return {} } }
const write = (key, value) => { try { window.localStorage.setItem(key, JSON.stringify(value)) } catch { /* the choice is only a convenience */ } }

// Asks the few choices a printout needs (e.g. annual or monthly, planned only or with what happened) before printing.
// options: [{ key, label, choices: [{ value, label }], initial }]; onConfirm(values) — the last choice is remembered.
export function PrintOptionsDialog({ storageKey, title, options = [], confirmLabel, onConfirm, onClose }) {
  const { t } = useLanguage()
  const [values, setValues] = useState(() => {
    const saved = read(storageKey)
    return Object.fromEntries(options.map(option => [option.key, option.choices.some(choice => choice.value === saved[option.key]) ? saved[option.key] : (option.initial ?? option.choices[0]?.value)]))
  })
  const confirm = () => { write(storageKey, values); onConfirm(values) }
  return <ObserverDialog width="compact" title={title} onClose={onClose}
    footer={<DialogActions><Button variant="secondary" onClick={onClose}>{t('cancel')}</Button><Button onClick={confirm}>{confirmLabel || t('exportFields.print')}</Button></DialogActions>}>
    <div className="print-options">
      {options.map(option => <ChoiceField key={option.key} label={option.label} value={values[option.key]} onChange={value => setValues(current => ({ ...current, [option.key]: value }))} options={option.choices} />)}
    </div>
  </ObserverDialog>
}
