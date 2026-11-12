import { useState, type ReactNode } from 'react'
import { ObserverDialog, DialogActions } from './ObserverDialog'
import { Button } from './Button'
import { ChoiceField } from './ChoiceField'
import { useLanguage } from '../core/i18n/LanguageContext'

const read = (key: string): Record<string, string> => { try { return JSON.parse(window.localStorage.getItem(key) || 'null') || {} } catch { return {} } }
const write = (key: string, value: unknown) => { try { window.localStorage.setItem(key, JSON.stringify(value)) } catch { /* the choice is only a convenience */ } }

// Asks the few choices a printout needs (e.g. annual or monthly, planned only or with what happened) before printing.
// options: [{ key, label, choices: [{ value, label }], initial }]; onConfirm(values) — the last choice is remembered.
export interface PrintOption { key: string; label?: string; choices: Array<{ value: string; label: string }>; initial?: string }

interface PrintOptionsDialogProps {
  storageKey: string
  title?: string
  options?: PrintOption[]
  confirmLabel?: ReactNode
  onConfirm: (values: Record<string, string>) => void
  onClose?: () => void
}

export function PrintOptionsDialog({ storageKey, title, options = [], confirmLabel, onConfirm, onClose }: PrintOptionsDialogProps) {
  const { t } = useLanguage()
  const [values, setValues] = useState<Record<string, string>>(() => {
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
