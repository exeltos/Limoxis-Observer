import { useState } from 'react'
import { ObserverDialog, DialogActions } from './ObserverDialog'
import { Button } from './Button'
import { CheckboxField } from './CheckboxField'
import { ChoiceField } from './ChoiceField'
import { useLanguage } from '../core/i18n/LanguageContext'

const read = (key, fallback) => { try { const saved = JSON.parse(window.localStorage.getItem(key) || 'null'); return saved ?? fallback } catch { return fallback } }
const write = (key, value) => { try { window.localStorage.setItem(key, JSON.stringify(value)) } catch { /* the choice is only a convenience */ } }

// «Excel» of a registry: the fields of the file are chosen each time (the last choice is remembered per registry).
// fields: [{ key, label, initial }]; layouts (optional): [{ value, label }] e.g. one list / one sheet per department.
// onConfirm(keys, layout) receives the chosen keys in the order of `fields`.
export function ExcelFieldsDialog({ storageKey, fields, layouts = [], onConfirm, onClose }) {
  const { t } = useLanguage()
  const [chosen, setChosen] = useState(() => {
    const saved = read(`${storageKey}.fields`, null)
    return Array.isArray(saved) ? fields.filter(field => saved.includes(field.key)).map(field => field.key) : fields.filter(field => field.initial).map(field => field.key)
  })
  const [layout, setLayout] = useState(() => { const saved = read(`${storageKey}.layout`, null); return layouts.some(item => item.value === saved) ? saved : layouts[0]?.value || '' })
  const toggle = (key, on) => setChosen(current => (on ? [...current, key] : current.filter(item => item !== key)))
  const confirm = () => {
    const keys = fields.filter(field => chosen.includes(field.key)).map(field => field.key)
    write(`${storageKey}.fields`, keys)
    if (layouts.length) write(`${storageKey}.layout`, layout)
    onConfirm(keys, layout)
  }
  return <ObserverDialog width="compact" title={t('exportFields.title')} subtitle={t('exportFields.hint')} onClose={onClose}
    footer={<DialogActions><Button variant="secondary" onClick={onClose}>{t('cancel')}</Button><Button disabled={!chosen.length} onClick={confirm}>{t('exportFields.download')}</Button></DialogActions>}>
    {layouts.length > 1 && <ChoiceField label={t('exportFields.layout')} value={layout} onChange={setLayout} options={layouts} />}
    <div className="excel-fields">
      {fields.map(field => <CheckboxField key={field.key} label={field.label} checked={chosen.includes(field.key)} onChange={on => toggle(field.key, on)} />)}
    </div>
  </ObserverDialog>
}
