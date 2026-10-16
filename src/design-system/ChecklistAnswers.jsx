import { CheckCheck } from 'lucide-react'
import { Button } from './Button'
import { ModeSwitch } from './ModeSwitch'
import { SectionHeader } from './SectionHeader'
import { checklistScore, checklistSummary } from '../core/checklist/checklistScore'
import './ChecklistAnswers.css'

// A checklist being answered: one row per item with Yes / No / N/A as large
// touch targets, a note on a No, «Rest: Yes» and the compliance bar. Used by a
// control entry and by an audit. rows: [{id,item,itemEn,required,answer,note}].
export function ChecklistAnswers({ rows = [], onRowChange, onRowsChange, language = 'el', title, disabled = false, noteLabel }) {
  const en = language === 'en'
  const score = checklistScore(rows)
  return (
    <section className="lo-checklist">
      <SectionHeader title={title || (en ? 'Checklist' : 'Λίστα ελέγχου')} subtitle={score.applicable ? checklistSummary(rows, language) : en ? 'Answer every required item.' : 'Απαντήστε σε κάθε υποχρεωτικό σημείο.'} actions={!disabled && onRowsChange && <Button variant="secondary" onClick={() => onRowsChange(rows.map(row => (row.answer ? row : { ...row, answer: 'yes' })))}><CheckCheck size={15} /> {en ? 'Rest: Yes' : 'Υπόλοιπα: Ναι'}</Button>} />
      <ol className="lo-checklist-items">
        {rows.map((row, index) => (
          <li key={row.id || index} className={row.answer === 'no' ? 'is-no' : row.answer === 'yes' ? 'is-yes' : ''}>
            <span className="lo-checklist-number">{index + 1}</span>
            <div className="lo-checklist-text">
              <strong>{en ? row.itemEn || row.item : row.item}{row.required !== false && <em aria-label={en ? 'required' : 'υποχρεωτικό'}> *</em>}</strong>
              {row.answer === 'no' && (disabled ? row.note && <span className="lo-checklist-note">{row.note}</span> : <input aria-label={noteLabel || (en ? 'What was found' : 'Τι βρέθηκε')} value={row.note || ''} onChange={event => onRowChange?.(index, 'note', event.target.value)} placeholder={en ? 'What was found / action taken' : 'Τι βρέθηκε / ενέργεια'} />)}
            </div>
            <fieldset className="lo-checklist-answer" disabled={disabled}>
              <ModeSwitch className="lo-checklist-yesno" ariaLabel={row.item} value={row.answer} onChange={value => onRowChange?.(index, 'answer', value)} options={[{ value: 'yes', label: en ? 'Yes' : 'Ναι' }, { value: 'no', label: en ? 'No' : 'Όχι' }, { value: 'na', label: en ? 'N/A' : 'Δ/Ε' }]} />
            </fieldset>
          </li>
        ))}
      </ol>
      {score.rate != null && <div className="lo-checklist-score"><span>{en ? 'Compliance' : 'Συμμόρφωση'}</span><div className="lo-checklist-score-bar"><i style={{ width: `${score.rate}%` }} /></div><strong>{score.rate}%</strong></div>}
    </section>
  )
}
