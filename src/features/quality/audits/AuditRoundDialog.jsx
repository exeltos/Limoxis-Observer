import { useEffect, useMemo, useState } from 'react'
import { ObserverDialog, DialogActions } from '../../../design-system/ObserverDialog'
import { FormGrid } from '../../../design-system/FormCard'
import { ChoiceField } from '../../../design-system/ChoiceField'
import { ManualDateField } from '../../../design-system/ManualDateField'
import { Button } from '../../../design-system/Button'
import { useDepartments } from '../../management/useLibraries'
import { useTenant } from '../../../core/tenant/TenantContext'
import { useAuditTemplates } from './useAuditTemplates'
import { roundPlan, workingDays } from './auditModel'

const L = (en, el, english) => (en ? english : el)
const evenly = (keys, days) => Object.fromEntries(keys.map((key, index) => [key, Math.min(days - 1, Math.floor(index * days / keys.length))]))

// An audit round: a few working days (three by default) and the departments that go on each, as chips
// to drag into the day boxes (or to pick and then click a box). Every department starts in the round,
// spread evenly; drag one out to «Outside the round», or into another day. Nothing is saved until
// «Save the round»: a department with no audit that month gets one, from the basic questionnaire.
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
  const [dragging, setDragging] = useState(null)
  const [picked, setPicked] = useState(null)
  const [over, setOver] = useState(null)
  // The round starts with every department in it, spread evenly over the days.
  const everyone = () => evenly(base.items.map(item => item.key), base.days.length)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setMoves(everyone()) }, [base])
  const items = base.items.map(item => ({ ...item, day: item.key in moves ? moves[item.key] : null }))
  const inRound = items.filter(item => item.day != null)
  const outside = items.filter(item => item.day == null)
  const fresh = inRound.filter(item => !item.auditId).length
  const spreadAgain = () => setMoves(everyone())
  const dayName = iso => new Intl.DateTimeFormat(en ? 'en-GB' : 'el-GR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`))
  const template = templates.find(item => item.key === 'core' && item.active !== false) || null
  const drop = target => {
    const key = dragging || picked
    if (key) setMoves(current => ({ ...current, [key]: target === 'out' ? null : target }))
    setDragging(null); setPicked(null); setOver(null)
  }
  const zone = target => ({
    onDragOver: event => { event.preventDefault(); if (over !== target) setOver(target) },
    onDragLeave: () => setOver(current => (current === target ? null : current)),
    onDrop: event => { event.preventDefault(); drop(target) },
    onClick: () => { if (picked) drop(target) },
  })
  const chip = item => <button type="button" key={item.key} draggable className={`audit-dept-chip${picked === item.key ? ' is-picked' : ''}${item.auditId ? '' : ' is-new'}`} aria-pressed={picked === item.key}
    title={item.auditId ? item.department : `${item.department} · ${L(en, 'νέα επιθεώρηση', 'new audit')}`}
    onDragStart={event => { setDragging(item.key); event.dataTransfer.setData('text/plain', item.key); event.dataTransfer.effectAllowed = 'move' }}
    onDragEnd={() => { setDragging(null); setOver(null) }}
    onClick={event => { event.stopPropagation(); setPicked(picked === item.key ? null : item.key) }}>{en ? item.departmentEn : item.department}</button>
  return <ObserverDialog width="wide" title={L(en, 'Κύκλος επιθεώρησης', 'Audit round')} subtitle={L(en, 'Σύρετε τα τμήματα στις ημέρες του κύκλου (ή πατήστε ένα τμήμα και μετά την ημέρα).', 'Drag the departments into the days of the round (or pick one, then click the day).')} onClose={onClose}
    footer={<DialogActions onSave={() => onApply(inRound.map(item => ({ auditId: item.auditId, department: item.department, departmentEn: item.departmentEn, departmentId: item.departmentId, plannedDate: base.days[item.day] })), template, base.days.length)} saveLabel={L(en, 'Αποθήκευση κύκλου', 'Save the round')} disabled={saving || !inRound.length}>
      <span className="audit-round-summary">{inRound.length} {L(en, 'τμήματα', 'departments')}{fresh > 0 ? ` · ${fresh} ${L(en, 'νέες επιθεωρήσεις', 'new audits')}` : ''}</span>
    </DialogActions>}>
    <FormGrid columns={3} className="audit-round-fields">
      <ManualDateField label={L(en, 'Πρώτη ημέρα του κύκλου', 'First day of the round')} value={start} onChange={setStart} />
      <ChoiceField label={L(en, 'Εργάσιμες ημέρες', 'Working days')} value={count} options={['1', '2', '3', '4', '5'].map(value => ({ value, label: value }))} onChange={setCount} />
      <div className="audit-round-tools"><Button variant="secondary" disabled={!items.length} onClick={spreadAgain}>{L(en, 'Αυτόματο μοίρασμα (όλα τα τμήματα)', 'Spread all departments evenly')}</Button></div>
    </FormGrid>
    {!start ? <p className="inline-empty">{L(en, 'Επιλέξτε την πρώτη ημέρα του κύκλου.', 'Choose the first day of the round.')}</p> : <>
      <div className="audit-round-columns" style={{ gridTemplateColumns: `repeat(${base.days.length}, minmax(0, 1fr))` }}>
        {base.days.map((day, index) => { const here = inRound.filter(item => item.day === index); return <section key={day} className={`audit-round-box${over === index ? ' is-over' : ''}`} aria-label={dayName(day)} {...zone(index)}>
          <header><strong>{dayName(day)}</strong><span>{here.length} {L(en, here.length === 1 ? 'τμήμα' : 'τμήματα', here.length === 1 ? 'department' : 'departments')}</span></header>
          <div className="audit-round-chips">{here.map(chip)}{!here.length && <small>{L(en, 'Ρίξτε εδώ τμήματα', 'Drop departments here')}</small>}</div>
        </section> })}
      </div>
      <section className={`audit-round-box is-outside${over === 'out' ? ' is-over' : ''}`} aria-label={L(en, 'Εκτός κύκλου', 'Outside the round')} {...zone('out')}>
        <header><strong>{L(en, 'Εκτός κύκλου', 'Outside the round')}</strong><span>{outside.length} {L(en, outside.length === 1 ? 'τμήμα' : 'τμήματα', outside.length === 1 ? 'department' : 'departments')}</span></header>
        <div className="audit-round-chips">{outside.map(chip)}{!outside.length && <small>{L(en, 'Όλα τα τμήματα συμμετέχουν. Σύρτε εδώ όσα δεν θα επιθεωρηθούν.', 'Every department takes part. Drag here those that will not be audited.')}</small>}</div>
      </section>
    </>}
  </ObserverDialog>
}
