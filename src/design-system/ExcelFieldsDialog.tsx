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
  const [layout, setLayout] = useState(() => { const saved = read(`${storageKey}.layout`, null); return layouts.some(item => item.value === saved) ? saved : layouts[0]?.value || '' })
  // `fields` may depend on the layout (e.g. programmes or participants): then each layout keeps its own choice.
  const fieldsOf = value => (typeof fields === 'function' ? fields(value) : fields)
  const keyOf = value => (typeof fields === 'function' ? `${storageKey}.${value}.fields` : `${storageKey}.fields`)
  const initialChoice = value => {
    const list = fieldsOf(value), saved = read(keyOf(value), null)
    return Array.isArray(saved) ? list.filter(field => saved.includes(field.key)).map(field => field.key) : list.filter(field => field.initial).map(field => field.key)
  }
  const [chosen, setChosen] = useState(() => initialChoice(layout))
  const list = fieldsOf(layout)
  const changeLayout = value => { setLayout(value); if (typeof fields === 'function') setChosen(initialChoice(value)) }
  const toggle = (key, on) => setChosen(current => (on ? [...current, key] : current.filter(item => item !== key)))
  const confirm = () => {
    const keys = list.filter(field => chosen.includes(field.key)).map(field => field.key)
    write(keyOf(layout), keys)
    if (layouts.length) write(`${storageKey}.layout`, layout)
    onConfirm(keys, layout)
  }
  return <ObserverDialog width="compact" title={t('exportFields.title')} subtitle={t('exportFields.hint')} onClose={onClose}
    footer={<DialogActions><Button variant="secondary" onClick={onClose}>{t('cancel')}</Button><Button disabled={!chosen.length} onClick={confirm}>{t('exportFields.download')}</Button></DialogActions>}>
    {layouts.length > 1 && <ChoiceField label={t('exportFields.layout')} value={layout} onChange={changeLayout} options={layouts} />}
    <div className="excel-fields">
      {list.map(field => <CheckboxField key={field.key} label={field.label} checked={chosen.includes(field.key)} onChange={on => toggle(field.key, on)} />)}
    </div>
  </ObserverDialog>
}

// The fields of a ready table ({ headers, rows }): one per column, all chosen at first.
export const tableFields = table => (table?.headers || []).map((label, index) => ({ key: String(index), label, initial: true }))
// The same table with only the chosen columns (keys from tableFields), in their order.
export const pickColumns = (table, keys) => {
  const indexes = keys.map(Number)
  return { ...table, headers: indexes.map(index => table.headers[index]), rows: table.rows.map(row => indexes.map(index => row[index])) }
}
