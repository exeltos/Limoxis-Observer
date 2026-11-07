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
// Dates and numbers are centred, under centred headers, so the columns line up.
const mid = value => ({ text: value, align: 'center' })
const heads = (list, centred, widths = []) => list.map((label, i) => ({ text: label, ...(centred.includes(i) ? { align: 'center' } : {}), ...(widths[i] ? { width: widths[i] } : {}) }))
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
  const columns = heads(en
    ? ['Programme', 'Organiser', 'Trainer', 'Date', 'Hours', 'Attended / assigned', 'Person-hours', 'Status']
    : ['Πρόγραμμα', 'Διοργανωτής', 'Εκπαιδευτής', 'Ημερομηνία', 'Ώρες', 'Παρακολούθησαν / ανατέθηκαν', 'Ανθρωποώρες', 'Κατάσταση'], [3, 4, 5, 6], ['22%', '15%', '13%', '9%', '6%', '12%', '11%', '12%'])
  const row = s => [s.program.title, s.program.owner || '', s.program.trainer || '', mid(dmy(s.program.startDate || s.program.dueDate)), mid(hours(s.program.durationHours)), mid(`${s.done} / ${s.assigned}`), mid(hours(s.personHours)), statusLabel(s.program.status)]
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
      [en ? 'Attended / assigned' : 'Παρακολούθησαν / ανατέθηκαν', `${total.done} / ${total.assigned}`],
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
  const columns = heads(en ? ['#', 'Person', 'Department', 'Status', 'Completed'] : ['#', 'Ονοματεπώνυμο', 'Τμήμα', 'Κατάσταση', 'Ολοκλήρωση'], [0, 4], ['6%', '36%', '24%', '18%', '16%'])
  return {
    language,
    kind: en ? 'Training' : 'Εκπαίδευση',
    title: en ? 'Participants per programme' : 'Συμμετέχοντες ανά πρόγραμμα',
    filename: en ? 'training-participants' : 'symmetexontes-ekpaideuseon',
    meta: [...(period ? [[en ? 'Period' : 'Περίοδος', period]] : []), [en ? 'Programmes' : 'Προγράμματα', String(stats.length)], [en ? 'Participations' : 'Συμμετοχές', String(stats.reduce((n, s) => n + s.assigned, 0))]],
    sections: stats.map(s => ({
      title: `${s.program.title} · ${dmy(s.program.startDate || s.program.dueDate)} · ${s.done}/${s.assigned}`,
      table: { columns, rows: [...s.list].sort((a, b) => String(a.employeeName || '').localeCompare(String(b.employeeName || ''), 'el')).map((a, i) => [mid(String(i + 1)), a.employeeName || '', a.department || '', statusLabel(a.computedStatus || a.status), mid(dmy(a.completedDate))]) },
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
  const columns = heads(en
    ? ['Programme', 'Organiser', 'Audience', 'Start', 'Due', ...(withActual ? ['Attended / assigned', 'Status'] : [])]
    : ['Πρόγραμμα', 'Διοργανωτής', 'Ομάδα-στόχος', 'Έναρξη', 'Προθεσμία', ...(withActual ? ['Παρακολούθησαν / ανατέθηκαν', 'Κατάσταση'] : [])], [3, 4, 5], withActual ? ['28%', '16%', '14%', '9%', '9%', '12%', '12%'] : ['36%', '20%', '20%', '12%', '12%'])
  const row = s => [s.program.title, s.program.owner || '', s.program.audience || '', mid(dmy(s.program.startDate)), mid(dmy(s.program.dueDate)), ...(withActual ? [mid(`${s.done} / ${s.assigned}`), stateLabel(s.program.status)] : [])]
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
    sections: [{ title: '', table: { columns: heads(en ? ['Training', 'Organiser', 'Date', 'Hours', 'Status', 'Score'] : ['Εκπαίδευση', 'Διοργανωτής', 'Ημερομηνία', 'Ώρες', 'Κατάσταση', 'Βαθμολογία'], [2, 3, 5], ['36%', '20%', '12%', '8%', '14%', '10%']), rows: rows.map(r => [r.title, r.organiser || '', mid(dmy(r.date)), mid(hours(r.hours)), r.statusLabel, mid(r.score ?? '')]) } }],
  }
}

// «Επάρκεια»: the matrix (who is covered for each required training, per department) or the retraining plan
// (who has to be trained and by when, per month). matrix/plan come from trainingCompetence.
export function competenceReportDoc({ matrix, plan, content = 'matrix', department = 'all', language = 'el', personName = e => e.name || '', today = '' }) {
  const en = language === 'en'
  const stateText = state => ({ valid: en ? 'Valid' : 'Σε ισχύ', expiring: en ? 'Expiring' : 'Λήγει', expired: en ? 'Expired' : 'Έληξε', missing: en ? 'Missing' : 'Λείπει' })[state] || state
  const scope = department === 'all' ? (en ? 'All departments' : 'Όλα τα τμήματα') : department
  const byDepartment = (list, of) => {
    const groups = new Map()
    for (const item of list) { const key = of(item) || (en ? 'No department' : 'Χωρίς τμήμα'); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(item) }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], en ? 'en' : 'el'))
  }
  if (content === 'plan') {
    const names = MONTH_NAMES[en ? 'en' : 'el']
    const now = day(today)
    const keyOf = item => (!item.due || item.due <= now ? 'now' : item.due.slice(0, 7))
    const groups = new Map()
    for (const item of plan) { const key = keyOf(item); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(item) }
    const keys = [...groups.keys()].sort((a, b) => (a === 'now' ? -1 : b === 'now' ? 1 : a.localeCompare(b)))
    const columns = heads(en ? ['Due by', 'Person', 'Department', 'Category', 'Required training', 'Status'] : ['Έως', 'Ονοματεπώνυμο', 'Τμήμα', 'Κατηγορία', 'Απαιτούμενη εκπαίδευση', 'Κατάσταση'], [0, 5], ['12%', '20%', '15%', '15%', '26%', '12%'])
    return {
      language,
      kind: en ? 'Training' : 'Εκπαίδευση',
      title: en ? 'Retraining plan' : 'Πλάνο επανεκπαίδευσης',
      filename: en ? 'retraining-plan' : 'plano-epanekpaideusis',
      meta: [[en ? 'Department' : 'Τμήμα', scope], [en ? 'To be trained' : 'Προς εκπαίδευση', String(plan.length)], [en ? 'Missing' : 'Λείπει', String(plan.filter(i => i.state === 'missing').length)], [en ? 'Expired / expiring' : 'Έληξε / λήγει', `${plan.filter(i => i.state === 'expired').length} / ${plan.filter(i => i.state === 'expiring').length}`]],
      sections: keys.map(key => ({
        title: `${key === 'now' ? (en ? 'Now (missing or expired)' : 'Άμεσα (λείπει ή έληξε)') : `${names[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`} · ${groups.get(key).length}`,
        table: { columns, rows: groups.get(key).map(item => [mid(dmy(item.due)), personName(item.employee), item.employee.department || '', item.employee.profession || '', item.requirement.title, mid(stateText(item.state))]) },
      })),
    }
  }
  const requirements = matrix.requirements
  const cellText = cell => (!cell ? '' : cell.state === 'valid' ? `✓${cell.validUntil ? ` ${dmy(cell.validUntil)}` : ''}` : cell.state === 'expiring' ? `${stateText('expiring')} ${dmy(cell.validUntil)}` : stateText(cell.state))
  const columns = [{ text: en ? 'Person' : 'Ονοματεπώνυμο', width: '18%' }, { text: en ? 'Category' : 'Κατηγορία', width: '12%' }, ...requirements.map(r => ({ text: r.title, align: 'center' }))]
  const count = state => matrix.counts[state] || 0
  return {
    language,
    orientation: 'landscape',
    kind: en ? 'Training' : 'Εκπαίδευση',
    title: en ? 'Competence matrix' : 'Πίνακας επάρκειας',
    filename: en ? 'competence-matrix' : 'pinakas-eparkeias',
    meta: [[en ? 'Department' : 'Τμήμα', scope], [en ? 'People' : 'Άτομα', String(matrix.rows.length)], [en ? 'Coverage' : 'Κάλυψη', matrix.rate == null ? '—' : `${matrix.rate}%`], [en ? 'Missing / expired / expiring' : 'Λείπει / έληξε / λήγει', `${count('missing')} / ${count('expired')} / ${count('expiring')}`]],
    sections: byDepartment(matrix.rows, row => row.employee.department).map(([name, rows]) => ({
      title: `${name} · ${rows.length}`,
      table: { columns, rows: [...rows].sort((a, b) => personName(a.employee).localeCompare(personName(b.employee), 'el')).map(row => [personName(row.employee), row.employee.profession || '', ...row.cells.map(cell => ({ text: cellText(cell) || '—', align: 'center', className: cell && cell.state !== 'valid' && cell.state !== 'expiring' ? 'rd-bad' : '' }))]) },
    })),
  }
}

// «Φύλλο προγράμματος»: the programme's details and its attendance list — blank, for signatures on the day,
// or with who attended (for the file). A few empty rows are left for people added on the day.
export function programSheetDoc({ program, assignments, language = 'el', withAttendance = false, categoryLabel = v => v, methodLabel = v => v, statusLabel = v => v }) {
  const en = language === 'en'
  const list = [...assignments].sort((a, b) => String(a.employeeName || '').localeCompare(String(b.employeeName || ''), 'el'))
  const period = program.startDate && day(program.startDate) !== day(program.dueDate) ? `${dmy(program.startDate)} – ${dmy(program.dueDate)}` : dmy(program.startDate || program.dueDate)
  const columns = withAttendance
    ? heads(en ? ['#', 'Person', 'Department', 'Status', 'Completed', 'Signature'] : ['#', 'Ονοματεπώνυμο', 'Τμήμα', 'Κατάσταση', 'Ολοκλήρωση', 'Υπογραφή'], [0, 3, 4], ['5%', '28%', '20%', '14%', '13%', '20%'])
    : heads(en ? ['#', 'Person', 'Department', 'Signature'] : ['#', 'Ονοματεπώνυμο', 'Τμήμα', 'Υπογραφή'], [0], ['5%', '35%', '25%', '35%'])
  const rows = list.map((a, i) => [mid(String(i + 1)), a.employeeName || '', a.department || '', ...(withAttendance ? [mid(statusLabel(a.computedStatus || a.status)), mid(dmy(a.completedDate))] : []), { text: '', className: 'rd-sign' }])
  const blank = withAttendance ? 0 : 5
  for (let i = 0; i < blank; i += 1) rows.push([mid(String(list.length + i + 1)), '', '', { text: '', className: 'rd-sign' }])
  return {
    language,
    kind: en ? 'Training' : 'Εκπαίδευση',
    code: program.id,
    title: program.title,
    subtitle: en ? (withAttendance ? 'Programme sheet and attendance' : 'Programme sheet · attendance list') : (withAttendance ? 'Φύλλο προγράμματος και παρουσίες' : 'Φύλλο προγράμματος · λίστα παρουσιών'),
    filename: `${en ? 'programme-sheet' : 'fyllo-programmatos'}-${program.id}`,
    meta: [
      [en ? 'Category' : 'Κατηγορία', program.category ? categoryLabel(program.category) : ''],
      [en ? 'Method' : 'Τρόπος', program.method ? methodLabel(program.method) : ''],
      [en ? 'Organiser' : 'Διοργανωτής', program.owner || ''],
      [en ? 'Trainer' : 'Εκπαιδευτής', program.trainer || ''],
      [en ? 'Date' : 'Ημερομηνία', `${period}${program.startTime ? ` · ${program.startTime}` : ''}`],
      [en ? 'Duration' : 'Διάρκεια', program.durationHours ? `${hours(program.durationHours)} ${en ? 'h' : 'ώρες'}` : ''],
      [en ? 'Location' : 'Τόπος', program.location || ''],
      [en ? 'Audience' : 'Κοινό', program.audience || ''],
    ].filter(([, value]) => value),
    sections: [
      ...(program.description ? [{ title: en ? 'Purpose / description' : 'Σκοπός / περιγραφή', text: program.description }] : []),
      { title: `${en ? 'Attendance list' : 'Λίστα παρουσιών'} · ${list.length}`, table: { columns, rows, empty: en ? 'No participants yet.' : 'Δεν υπάρχουν ακόμη συμμετέχοντες.' } },
    ],
    signatures: [{ role: en ? 'Trainer' : 'Εκπαιδευτής', name: program.trainer || '' }, { role: en ? 'Organiser' : 'Διοργανωτής', name: program.owner || '' }],
  }
}

export { MONTHS }
