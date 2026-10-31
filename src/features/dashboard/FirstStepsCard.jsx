import { useState } from 'react'
import { ArrowRight, CheckCircle2, ChevronDown, ChevronUp, Circle, Rocket, X } from 'lucide-react'
import { readLocalValue, writeLocalValue } from '../../core/storage/browserStorage'

const text = {
  el: {
    title: 'Πρώτα βήματα', subtitle: 'Η κάρτα κρύβεται μόλις γίνουν όλα.', show: 'Εμφάνιση των βημάτων', hide: 'Απόκρυψη των βημάτων', close: 'Κλείσιμο της κάρτας',
    departments: 'Δημιουργήστε τα τμήματα', departmentsHint: 'Κέντρο Διαχείρισης › Λίστες & ρυθμίσεις › Τμήματα',
    users: 'Προσθέστε χρήστες και ρόλους', usersHint: 'Κέντρο Διαχείρισης › Χρήστες & Ρόλοι',
    patientDays: 'Καταχωρίστε κλινοημέρες', patientDaysHint: 'Ο παρονομαστής των δεικτών · Κέντρο Διαχείρισης › Κλινοημέρες',
    done: 'Ολοκληρώθηκε', open: 'Άνοιγμα', progress: (n, total) => `${n} από ${total}`, guide: 'Όλα τα βήματα: Βοήθεια › Οδηγός έναρξης',
  },
  en: {
    title: 'First steps', subtitle: 'The card disappears once all are done.', show: 'Show the steps', hide: 'Hide the steps', close: 'Close the card',
    departments: 'Create the departments', departmentsHint: 'Management Center › Lists & settings › Departments',
    users: 'Add users and roles', usersHint: 'Management Center › Users & Roles',
    patientDays: 'Enter patient-days', patientDaysHint: 'The indicators’ denominator · Management Center › Patient-days',
    done: 'Done', open: 'Open', progress: (n, total) => `${n} of ${total}`, guide: 'All the steps: Help › Getting started',
  },
}

// Hospital Admin home: the setup steps of the Getting-started guide that can be checked
// from the data. Returns the step list, or null while counts are unknown.
export function firstSteps(values, { needsPatientDays = false } = {}) {
  if (values?.activeUsers == null || values?.activeDepartments == null) return null
  const steps = [
    { id: 'departments', done: Number(values.activeDepartments) > 0, to: '/management?tab=libraries' },
    { id: 'users', done: Number(values.activeUsers) > 1, to: '/management?tab=users' },
  ]
  if (needsPatientDays) steps.push({ id: 'patientDays', done: Number(values.patientDayPeriods) > 0, to: '/management?tab=patientDays' })
  return steps
}

// A small card in the bottom right corner: collapsed to its title and progress, it opens to the
// steps still to do. It leaves the home page to the work of the day.
// `storageKey`: where the choice to close it is kept for this hospital (this browser).
export function FirstStepsCard({ steps, language = 'el', onOpen, storageKey = null }) {
  const [open, setOpen] = useState(false)
  const [closed, setClosed] = useState(() => Boolean(storageKey) && readLocalValue(storageKey) === '1')
  if (!steps || steps.every(step => step.done) || closed) return null
  const t = text[language === 'en' ? 'en' : 'el']
  const done = steps.filter(step => step.done).length
  const Chevron = open ? ChevronDown : ChevronUp
  const close = () => { if (storageKey) writeLocalValue(storageKey, '1'); setClosed(true) }
  return <aside className="first-steps-dock" aria-label={t.title}>
    {open && <div className="first-steps-panel">
      <p className="first-steps-subtitle">{t.subtitle}</p>
      <ol className="first-steps-list">
        {steps.map(step => <li key={step.id} className={step.done ? 'done' : ''}>
          {step.done ? <CheckCircle2 size={16} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}
          <span><strong>{t[step.id]}</strong><small>{t[`${step.id}Hint`]}</small></span>
          {step.done ? <em>{t.done}</em> : <button type="button" onClick={() => onOpen?.(step.to)}>{t.open}<ArrowRight size={13} /></button>}
        </li>)}
      </ol>
      <p className="first-steps-guide">{t.guide}</p>
    </div>}
    <div className="first-steps-bar">
    <button type="button" className="first-steps-pill" aria-expanded={open} title={open ? t.hide : t.show} onClick={() => setOpen(value => !value)}>
      <Rocket size={16} aria-hidden="true" /><strong>{t.title}</strong><span className="first-steps-progress">{t.progress(done, steps.length)}</span><Chevron size={15} aria-hidden="true" />
    </button>
    <button type="button" className="first-steps-close" aria-label={t.close} title={t.close} onClick={close}><X size={14} aria-hidden="true" /></button>
    </div>
  </aside>
}
