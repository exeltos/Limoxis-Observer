// The printouts of Training, on the shared report layout (printReport): the programmes with how many attended,
// the participants of each programme, the annual or monthly plan, and an employee's training history.
import { MONTHS, programMonths } from './trainingAnnualPlan'

const day = value => String(value || '').slice(0, 10)
const dmy = value => (day(value) ? day(value).split('-').reverse().join('/') : '')
const num = value => (Number.isFinite(Number(value)) ? Number(value) : 0)
const hours = value => (value ? String(Math.round(value * 10) / 10).replace('.', ',') : '')
const MONTH_NAMES = {
  el: ['Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
}
const attended = assignment => assignment.computedStatus === 'completed' || assignment.status === 'completed' || assignment.attendance === true

// Per programme: assigned, attended, person-hours.
function programStats(programs, assignments) {
  const byProgram = new Map()
  for (const a of assignments) { const list = byProgram.get(a.programId) || []; list.push(a); byProgram.set(a.programId, list) }
  return programs.map(program => {
    const list = byProgram.get(program.id) || []
    const done = list.filter(attended).length
    return { program, list, assigned: list.length, done, personHours: done * num(program.durationHours) }
  })
}

// «Αναφορά προγραμμάτων»: totals, then the programmes (grouped by month, by organiser, or one table).
export function programmesReportDoc({ programs, assignments, language = 'el', statusLabel = v => v, groupBy = 'month', period = '' }) {
  const en = language === 'en'
  const stats = programStats(programs, assignments)
  const people = new Set(assignments.filter(a => programs.some(p => p.id === a.programId) && attended(a)).map(a => a.employeeId || a.employeeName).filter(Boolean))
  const columns = en
    ? ['Programme', 'Organiser', 'Trainer', 'Date', 'Hours', 'Attended / assigned', 'Person-hours', 'Status']
    : ['Πρόγραμμα', 'Διοργανωτής', 'Εκπαιδευτής', 'Ημερομηνία', 'Ώρες', 'Παρακολούθησαν / ανατέθηκαν', 'Ανθρωποώρες', 'Κατάσταση']
  const row = s => [s.program.title, s.program.owner || '', s.program.trainer || '', dmy(s.program.startDate || s.program.dueDate), hours(s.program.durationHours), `${s.done} / ${s.assigned}`, hours(s.personHours), statusLabel(s.program.status)]
  const sorted = [...stats].sort((a, b) => day(a.program.startDate || a.program.dueDate).localeCompare(day(b.program.startDate || b.program.dueDate)))
  const groups = new Map()
  for (const s of sorted) {
    const date = day(s.program.startDate || s.program.dueDate)
    const key = groupBy === 'month' ? (date ? date.slice(0, 7) : '—') : groupBy === 'organiser' ? (s.program.owner || (en ? 'No organiser' : 'Χωρίς διοργανωτή')) : ''
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(s)
  }
  const groupTitle = key => (groupBy === 'month' && key !== '—' ? `${MONTH_NAMES[en ? 'en' : 'el'][Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}` : key)
  const sum = list => ({ done: list.reduce((n, s) => n + s.done, 0), assigned: list.reduce((n, s) => n + s.assigned, 0), hours: list.reduce((n, s) => n + s.personHours, 0) })
  const keys = [...groups.keys()].sort((a, b) => (groupBy === 'month' ? a.localeCompare(b) : a.localeCompare(b, en ? 'en' : 'el')))
  const total = sum(stats)
  return {
    language,
    orientation: 'landscape',
    kind: en ? 'Training' : 'Εκπαίδευση',
    title: en ? 'Training programmes report' : 'Αναφορά προγραμμάτων εκπαίδευσης',
    filename: en ? 'training-programmes-report' : 'anafora-programmaton-ekpaideusis',
    meta: [
      ...(period ? [[en ? 'Period' : 'Περίοδος', period]] : []),
      [en ? 'Programmes' : 'Προγράμματα', String(stats.length)],
      [en ? 'Participations (attended / assigned)' : 'Συμμετοχές (παρακολούθησαν / ανατέθηκαν)', `${total.done} / ${total.assigned}`],
      [en ? 'People trained' : 'Άτομα που εκπαιδεύτηκαν', String(people.size)],
      [en ? 'Person-hours' : 'Ανθρωποώρες', hours(total.hours) || '0'],
    ],
    sections: keys.map(key => {
      const list = groups.get(key), s = sum(list)
      return {
        title: groupBy === 'none' ? '' : `${groupTitle(key)} · ${list.length} ${list.length === 1 ? (en ? 'programme' : 'πρόγραμμα') : (en ? 'programmes' : 'προγράμματα')} · ${s.done}/${s.assigned}`,
        table: { columns, rows: list.map(row) },
      }
    }),
  }
}

// «Συμμετέχοντες ανά πρόγραμμα»: each programme with who attended.
export function participantsReportDoc({ programs, assignments, language = 'el', statusLabel = v => v, period = '' }) {
  const en = language === 'en'
  const stats = programStats(programs, assignments).filter(s => s.assigned).sort((a, b) => day(a.program.startDate || a.program.dueDate).localeCompare(day(b.program.startDate || b.program.dueDate)))
  const columns = en ? ['#', 'Person', 'Department', 'Status', 'Completed'] : ['#', 'Ονοματεπώνυμο', 'Τμήμα', 'Κατάσταση', 'Ολοκλήρωση']
  return {
    language,
    kind: en ? 'Training' : 'Εκπαίδευση',
    title: en ? 'Participants per programme' : 'Συμμετέχοντες ανά πρόγραμμα',
    filename: en ? 'training-participants' : 'symmetexontes-ekpaideuseon',
    meta: [...(period ? [[en ? 'Period' : 'Περίοδος', period]] : []), [en ? 'Programmes' : 'Προγράμματα', String(stats.length)], [en ? 'Participations' : 'Συμμετοχές', String(stats.reduce((n, s) => n + s.assigned, 0))]],
    sections: stats.map(s => ({
      title: `${s.program.title} · ${dmy(s.program.startDate || s.program.dueDate)} · ${s.done}/${s.assigned}`,
      table: { columns, rows: [...s.list].sort((a, b) => String(a.employeeName || '').localeCompare(String(b.employeeName || ''), 'el')).map((a, i) => [String(i + 1), a.employeeName || '', a.department || '', statusLabel(a.computedStatus || a.status), dmy(a.completedDate)]) },
    })),
  }
}

// The plan of a year or of one month: what is planned and, if asked, what happened.
export function trainingPlanReportDoc({ programs, assignments, year, month = null, withActual = true, language = 'el', stateLabel = v => v }) {
  const en = language === 'en'
  const y = Number(year)
  const stats = programStats(programs.filter(p => p.status !== 'cancelled'), assignments)
    .map(s => ({ ...s, months: programMonths(s.program, y) }))
    .filter(s => s.months.length && (month == null || s.months.includes(month)))
    .sort((a, b) => a.months[0] - b.months[0] || day(a.program.startDate || a.program.dueDate).localeCompare(day(b.program.startDate || b.program.dueDate)) || String(a.program.title).localeCompare(String(b.program.title), 'el'))
  const columns = en
    ? ['Programme', 'Organiser', 'Audience', 'Start', 'Due', ...(withActual ? ['Attended / assigned', 'Status'] : [])]
    : ['Πρόγραμμα', 'Διοργανωτής', 'Ομάδα-στόχος', 'Έναρξη', 'Προθεσμία', ...(withActual ? ['Παρακολούθησαν / ανατέθηκαν', 'Κατάσταση'] : [])]
  const row = s => [s.program.title, s.program.owner || '', s.program.audience || '', dmy(s.program.startDate), dmy(s.program.dueDate), ...(withActual ? [`${s.done} / ${s.assigned}`, stateLabel(s.program.status)] : [])]
  const months = month == null ? [...new Set(stats.map(s => s.months[0]))].sort((a, b) => a - b) : [month]
  const names = MONTH_NAMES[en ? 'en' : 'el']
  return {
    language,
    orientation: 'landscape',
    kind: en ? 'Training' : 'Εκπαίδευση',
    title: month == null ? (en ? `Annual training plan ${y}` : `Ετήσιο πλάνο εκπαίδευσης ${y}`) : (en ? `Training plan · ${names[month]} ${y}` : `Πλάνο εκπαίδευσης · ${names[month]} ${y}`),
    filename: month == null ? `plano-ekpaideusis-${y}` : `plano-ekpaideusis-${y}-${String(month + 1).padStart(2, '0')}`,
    meta: [
      [en ? 'Programmes' : 'Προγράμματα', String(stats.length)],
      ...(withActual ? [[en ? 'Attended / assigned' : 'Παρακολούθησαν / ανατέθηκαν', `${stats.reduce((n, s) => n + s.done, 0)} / ${stats.reduce((n, s) => n + s.assigned, 0)}`]] : []),
    ],
    sections: months.map(m => ({
      title: `${names[m]} ${y}`,
      table: { columns, rows: stats.filter(s => (month == null ? s.months[0] === m : true)).map(row) },
    })),
  }
}

// An employee's training history.
export function employeeTrainingDoc({ employeeName, employeeCode, department, rows, language = 'el' }) {
  const en = language === 'en'
  const total = rows.reduce((n, r) => n + (r.done ? num(r.hours) : 0), 0)
  return {
    language,
    kind: en ? 'Training' : 'Εκπαίδευση',
    code: employeeCode,
    title: en ? `Training history · ${employeeName}` : `Ιστορικό εκπαίδευσης · ${employeeName}`,
    filename: en ? `training-history-${employeeCode}` : `istoriko-ekpaideusis-${employeeCode}`,
    meta: [[en ? 'Code' : 'Κωδικός', employeeCode || ''], [en ? 'Department' : 'Τμήμα', department || ''], [en ? 'Trainings completed' : 'Ολοκληρωμένες εκπαιδεύσεις', String(rows.filter(r => r.done).length)], [en ? 'Hours' : 'Ώρες', hours(total) || '0']],
    sections: [{ title: '', table: { columns: en ? ['Training', 'Organiser', 'Date', 'Hours', 'Status', 'Score'] : ['Εκπαίδευση', 'Διοργανωτής', 'Ημερομηνία', 'Ώρες', 'Κατάσταση', 'Βαθμολογία'], rows: rows.map(r => [r.title, r.organiser || '', dmy(r.date), hours(r.hours), r.statusLabel, r.score ?? '']) } }],
  }
}

export { MONTHS }
