import { ArrowRight, CheckCircle2, Circle, Rocket } from 'lucide-react'
import { Card, CardHeader } from '../../design-system/Card'

const text = {
  el: {
    title: 'Πρώτα βήματα του νοσοκομείου', subtitle: 'Ολοκληρώστε τα με τη σειρά. Η κάρτα κρύβεται μόλις γίνουν όλα.',
    departments: 'Δημιουργήστε τα τμήματα', departmentsHint: 'Κέντρο Διαχείρισης › Βιβλιοθήκες › Τμήματα',
    users: 'Προσθέστε χρήστες και ρόλους', usersHint: 'Κέντρο Διαχείρισης › Χρήστες & Ρόλοι',
    patientDays: 'Καταχωρίστε κλινοημέρες', patientDaysHint: 'Ο παρονομαστής των δεικτών · Κέντρο Διαχείρισης › Κλινοημέρες',
    done: 'Ολοκληρώθηκε', open: 'Άνοιγμα', progress: (n, total) => `${n} από ${total}`, guide: 'Όλα τα βήματα: Βοήθεια › Οδηγός έναρξης',
  },
  en: {
    title: 'Hospital first steps', subtitle: 'Complete them in order. The card disappears once all are done.',
    departments: 'Create the departments', departmentsHint: 'Management Center › Libraries › Departments',
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

export function FirstStepsCard({ steps, language = 'el', onOpen }) {
  if (!steps || steps.every(step => step.done)) return null
  const t = text[language === 'en' ? 'en' : 'el']
  const done = steps.filter(step => step.done).length
  return <Card className="dashboard-card first-steps-card">
    <CardHeader icon={Rocket} title={t.title} subtitle={t.subtitle} actions={<span className="first-steps-progress">{t.progress(done, steps.length)}</span>} />
    <ol className="first-steps-list">
      {steps.map(step => <li key={step.id} className={step.done ? 'done' : ''}>
        {step.done ? <CheckCircle2 size={18} aria-hidden="true" /> : <Circle size={18} aria-hidden="true" />}
        <span><strong>{t[step.id]}</strong><small>{t[`${step.id}Hint`]}</small></span>
        {step.done ? <em>{t.done}</em> : <button type="button" onClick={() => onOpen?.(step.to)}>{t.open}<ArrowRight size={14} /></button>}
      </li>)}
    </ol>
    <p className="first-steps-guide">{t.guide}</p>
  </Card>
}
