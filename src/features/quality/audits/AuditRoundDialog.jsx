import { useEffect, useMemo, useState } from 'react'
import { ObserverDialog, DialogActions } from '../../../design-system/ObserverDialog'
import { FormGrid } from '../../../design-system/FormCard'
import { ChoiceField } from '../../../design-system/ChoiceField'
import { ManualDateField } from '../../../design-system/ManualDateField'
import { Button } from '../../../design-system/Button'
import { SearchableSelect } from '../../../design-system/SearchableSelect'
import { useDepartments } from '../../management/useLibraries'
import { useTenant } from '../../../core/tenant/TenantContext'
import { useAuditTemplates } from './useAuditTemplates'
import { roundPlan, workingDays } from './auditModel'

const L = (en, el, english) => (en ? english : el)

// An audit round: a few working days (three by default) and the departments that go on each. The
// departments with a planned audit in that month start spread over the days; each can be moved to
// another day or taken out, and any other department can be added (its audit starts from the basic
// questionnaire). Nothing is saved until «Save the round».
export function AuditRoundDialog({ audits, language, saving = false, onClose, onApply }) {
  const en = language === 'en'
  const { tenant } = useTenant()
  const { departments } = useDepartments()
  const { templates } = useAuditTemplates(tenant?.id)
  const firstOpen = useMemo(() => audits.filter(audit => audit.status === 'planned' && audit.lifecycleStatus !== 'voided' && audit.department && audit.plannedDate).map(audit => String(audit.plannedDate)).sort()[0] || '', [audits])
  const [start, setStart] = useState(() => (firstOpen ? workingDays(`${firstOpen.slice(0, 7)}-10`, 1)[0] : ''))
  const [count, setCount] = useState('3')
  const base = useMemo(() => (start ? roundPlan(audits, departments, start, Number(count)) : { days: [], items: [] }), [audits, departments, start, count])
  const [moves, setMoves] = useState({})
  useEffect(() => { setMoves({}) }, [start, count])
  const dayOf = item => (item.key in moves ? moves[item.key] : item.day)
  const items = base.items.map(item => ({ ...item, day: dayOf(item) }))
  const inRound = items.filter(item => item.day != null)
  const outside = items.filter(item => item.day == null)
  const move = (item, value) => setMoves(current => ({ ...current, [item.key]: value === '' ? null : Number(value) }))
  const spreadAgain = () => setMoves(Object.fromEntries(inRound.map((item, index) => [item.key, Math.min(base.days.length - 1, Math.floor(index * base.days.length / inRound.length))])))
  const dayName = iso => new Intl.DateTimeFormat(en ? 'en-GB' : 'el-GR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`))
  const template = templates.find(item => item.key === 'core' && item.active !== false) || null
  const dayOptions = base.days.map((day, index) => ({ value: String(index), label: dayName(day) }))
  const choose = item => <SearchableSelect hideLabel className="audit-round-day" label={L(en, `Ημέρα για ${item.department}`, `Day for ${item.department}`)} value={item.day == null ? '' : String(item.day)} options={dayOptions}
    placeholder={L(en, 'Προσθήκη σε…', 'Add to…')} clearLabel={L(en, 'Εκτός κύκλου', 'Leave out')} emptyLabel={L(en, 'Δεν βρέθηκε', 'No match')} onChange={value => move(item, value)} />
  return <ObserverDialog width="wide" title={L(en, 'Κύκλος επιθεώρησης', 'Audit round')} subtitle={L(en, 'Μοιράστε τα τμήματα στις ημέρες του κύκλου. Μπορείτε να μετακινήσετε ή να βγάλετε κάθε τμήμα και να προσθέσετε άλλα.', 'Spread the departments over the days of the round. Move or leave out any department, and add others.')} onClose={onClose}
    footer={<DialogActions onSave={() => onApply(inRound.map(item => ({ auditId: item.auditId, department: item.department, departmentEn: item.departmentEn, departmentId: item.departmentId, plannedDate: base.days[item.day] })), template, base.days.length)} saveLabel={L(en, 'Αποθήκευση κύκλου', 'Save the round')} disabled={saving || !inRound.length} />}>
    <FormGrid columns={3} className="audit-round-fields">
      <ManualDateField label={L(en, 'Πρώτη ημέρα του κύκλου', 'First day of the round')} value={start} onChange={setStart} />
      <ChoiceField label={L(en, 'Εργάσιμες ημέρες', 'Working days')} value={count} options={['1', '2', '3', '4', '5'].map(value => ({ value, label: value }))} onChange={setCount} />
      <div className="audit-round-tools"><Button variant="secondary" disabled={!inRound.length} onClick={spreadAgain}>{L(en, 'Αυτόματο μοίρασμα', 'Spread evenly')}</Button></div>
    </FormGrid>
    {!start ? <p className="inline-empty">{L(en, 'Επιλέξτε την πρώτη ημέρα του κύκλου.', 'Choose the first day of the round.')}</p> : <>
      <div className="audit-round-columns" style={{ gridTemplateColumns: `repeat(${base.days.length}, minmax(0, 1fr))` }}>
        {base.days.map((day, index) => { const here = inRound.filter(item => item.day === index); return <section key={day} className="audit-round-column">
          <header><strong>{dayName(day)}</strong><span>{here.length} {L(en, here.length === 1 ? 'τμήμα' : 'τμήματα', here.length === 1 ? 'department' : 'departments')}</span></header>
          <ul>{here.map(item => <li key={item.key}><span title={item.department}>{en ? item.departmentEn : item.department}{!item.auditId && <small>{L(en, 'νέα επιθεώρηση', 'new audit')}</small>}</span>{choose(item)}</li>)}
            {!here.length && <li className="is-empty">{L(en, 'Κανένα τμήμα', 'No department')}</li>}</ul>
        </section> })}
      </div>
      {outside.length > 0 && <section className="audit-round-outside">
        <h4>{L(en, `Εκτός κύκλου (${outside.length})`, `Outside the round (${outside.length})`)}</h4>
        <ul>{outside.map(item => <li key={item.key}><span title={item.department}>{en ? item.departmentEn : item.department}</span>{choose(item)}</li>)}</ul>
      </section>}
    </>}
  </ObserverDialog>
}
