import { useMemo, useState } from 'react'
import { ObserverDialog, DialogActions } from '../../../design-system/ObserverDialog'
import { FormGrid } from '../../../design-system/FormCard'
import { ChoiceField } from '../../../design-system/ChoiceField'
import { ManualDateField } from '../../../design-system/ManualDateField'
import { formatDay } from '../../../core/i18n/formatDay'
import { spreadAuditRound, workingDays } from './auditModel'

const L = (en, el, english) => (en ? english : el)

// An audit round: the month's planned department audits spread over a few
// working days (three by default). The day split is shown before it is applied.
export function AuditRoundDialog({ audits, language, saving = false, onClose, onApply }) {
  const en = language === 'en'
  const firstOpen = useMemo(() => audits.filter(audit => audit.status === 'planned' && audit.lifecycleStatus !== 'voided' && audit.department && audit.plannedDate).map(audit => String(audit.plannedDate)).sort()[0] || '', [audits])
  const [start, setStart] = useState(() => (firstOpen ? workingDays(`${firstOpen.slice(0, 7)}-10`, 1)[0] : ''))
  const [days, setDays] = useState('3')
  const plan = useMemo(() => (start ? spreadAuditRound(audits, start, Number(days)) : { days: [], assignments: [] }), [audits, start, days])
  const perDay = plan.days.map(day => ({ day, list: plan.assignments.filter(item => item.plannedDate === day) }))
  return <ObserverDialog width="standard" title={L(en, 'Κύκλος επιθεώρησης', 'Audit round')} subtitle={L(en, 'Οι επιθεωρήσεις του μήνα μοιράζονται στις ημέρες του κύκλου.', 'The month\'s audits are spread over the days of the round.')} onClose={onClose}
    footer={<DialogActions onSave={() => onApply(start, Number(days))} saveLabel={L(en, 'Μοίρασμα στις ημέρες', 'Spread over the days')} disabled={saving || !plan.assignments.length} />}>
    <FormGrid columns={2}>
      <ManualDateField label={L(en, 'Πρώτη ημέρα του κύκλου', 'First day of the round')} value={start} onChange={setStart} />
      <ChoiceField label={L(en, 'Εργάσιμες ημέρες', 'Working days')} value={days} options={['1', '2', '3', '4', '5'].map(value => ({ value, label: value }))} onChange={setDays} />
    </FormGrid>
    {plan.assignments.length === 0
      ? <p className="inline-empty">{L(en, 'Δεν υπάρχουν προγραμματισμένες επιθεωρήσεις τμημάτων για τον μήνα της πρώτης ημέρας.', 'No planned department audits for the month of the first day.')}</p>
      : <ul className="audit-round-days">{perDay.map(({ day, list }) => <li key={day}>
        <strong>{formatDay(day, language)}</strong> <span>{list.length} {L(en, list.length === 1 ? 'τμήμα' : 'τμήματα', list.length === 1 ? 'department' : 'departments')}</span>
        <small>{list.slice(0, 6).map(item => item.audit.department).join(' · ')}{list.length > 6 ? ` · +${list.length - 6}` : ''}</small>
      </li>)}</ul>}
  </ObserverDialog>
}
