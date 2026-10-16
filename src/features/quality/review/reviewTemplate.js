// The management review (ISO 9001 §9.3, ΕΛΟΤ EN 15224) in the sections of
// the hospital's minutes form. Each section can take a summary of what
// Limoxis already holds for the period (reports, corrective actions, audits,
// objectives), so the minutes start from the facts instead of a blank page.

export const REVIEW_SECTIONS = [
  { key: 'previous_actions', title: 'Ανασκόπηση Ενεργειών Προηγούμενων Συνεδριάσεων', titleEn: 'Actions from previous reviews', source: 'previousActions' },
  { key: 'context_changes', title: 'Αλλαγές σε Εξωτερικά και Εσωτερικά Ζητήματα που Αφορούν το Σύστημα Διαχείρισης Ποιότητας', titleEn: 'Changes in external and internal issues' },
  { key: 'satisfaction', title: 'Ικανοποίηση Ασθενών και Ανατροφοδότηση από τα Ενδιαφερόμενα Μέρη', titleEn: 'Patient satisfaction and feedback', source: 'complaints' },
  { key: 'objectives', title: 'Βαθμός Επίτευξης των Στόχων Ποιότητας', titleEn: 'Achievement of quality objectives', source: 'objectives' },
  { key: 'process_performance', title: 'Επίδοση Διεργασιών και Συμμόρφωση των Παρεχόμενων Υπηρεσιών', titleEn: 'Process performance and conformity of services', source: 'registers' },
  { key: 'nonconformities', title: 'Μη Συμμορφώσεις και Διορθωτικές Ενέργειες', titleEn: 'Nonconformities and corrective actions', source: 'capas' },
  { key: 'monitoring', title: 'Αποτελέσματα Παρακολούθησης και Μέτρησης', titleEn: 'Monitoring and measurement results', source: 'objectives' },
  { key: 'audits', title: 'Αποτελέσματα Εσωτερικών, Εξωτερικών και Κανονιστικών Επιθεωρήσεων', titleEn: 'Results of internal, external and regulatory audits', source: 'audits' },
  { key: 'providers', title: 'Επίδοση Εξωτερικών Παρόχων', titleEn: 'Performance of external providers' },
  { key: 'risks', title: 'Αποτελεσματικότητα Ενεργειών Αντιμετώπισης Κινδύνων και Αξιοποίησης Ευκαιριών', titleEn: 'Effectiveness of actions on risks and opportunities' },
  { key: 'resources', title: 'Επάρκεια και Διαθεσιμότητα Απαιτούμενων Πόρων', titleEn: 'Adequacy of resources' },
  { key: 'climate', title: 'Κλιματική Αλλαγή – Υπολογισμός Ανθρακικού Αποτυπώματος', titleEn: 'Climate change – carbon footprint' },
  { key: 'compliance', title: 'Συμμόρφωση με Νομοθετικές και Κανονιστικές Απαιτήσεις', titleEn: 'Legal and regulatory compliance' },
  { key: 'adverse_events', title: 'Αναφορά και Διαχείριση Ανεπιθύμητων Συμβάντων', titleEn: 'Reporting and management of adverse events', source: 'incidents' },
  { key: 'improvements', title: 'Ευκαιρίες προς Βελτίωση', titleEn: 'Opportunities for improvement' },
  { key: 'conclusions', title: 'Γενικά Συμπεράσματα Ανασκόπησης Διοίκησης', titleEn: 'General conclusions' },
]

const pad = n => String(n).padStart(2, '0')
// A typed number: «24,6» (Greek decimal comma) reads as 24.6.
export const toNumber = value => (value == null || value === '' ? null : Number(String(value).trim().replace(',', '.')))
// A value with its unit, in the language's number format (24,6 ημέρες · 46,4%).
export function formatObjectiveValue(value, unit, language = 'el') {
  const number = toNumber(value)
  if (number == null || Number.isNaN(number)) return value == null || value === '' ? '—' : String(value)
  const text = new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'el-GR', { maximumFractionDigits: 2 }).format(number)
  return unit === '%' ? `${text}%` : unit ? `${text} ${unit}` : text
}
export const addDays = (day, days) => { const date = new Date(`${day}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10) }
const inPeriod = (day, period) => { const value = String(day || '').slice(0, 10); return Boolean(value) && value >= period.from && value <= period.to }
const dmy = day => { const [y, m, d] = String(day || '').slice(0, 10).split('-'); return y ? `${Number(d)}/${Number(m)}/${y}` : '' }
const count = (rows, test) => rows.filter(test).length

// A new review from the previous one: the same participants and frequency,
// the period from the last review to today, the actions still open.
export function newReviewFrom(previous, today = new Date().toISOString().slice(0, 10)) {
  const frequency = previous?.frequencyDays || 90
  const reviewDate = today
  return {
    code: '',
    title: 'Ανασκόπηση Διοίκησης',
    reviewDate,
    periodFrom: previous?.reviewDate ? addDays(previous.reviewDate, 1) : `${reviewDate.slice(0, 4)}-01-01`,
    periodTo: reviewDate,
    frequencyDays: frequency,
    nextReviewDate: addDays(reviewDate, frequency),
    status: 'draft',
    summary: '',
    sections: REVIEW_SECTIONS.map((section, position) => ({ key: section.key, position, title: section.title, body: '' })),
    actions: (previous?.actions || []).filter(action => action.status === 'open').map(action => ({ ...action, id: undefined, carried: true })),
    participants: (previous?.participants || []).map(person => ({ name: person.name, role: person.role || '', attended: true, signedAt: null })),
  }
}

// What Limoxis holds for a section over the period, as sentences the author
// can insert and edit. `data` = { incidents, capas, findings, audits, objectives, previous }.
export function sectionFacts(source, data = {}, period, language = 'el') {
  const en = language === 'en'
  const incidents = (data.incidents || []).filter(row => inPeriod(row.date, period))
  const capas = data.capas || []
  const audits = (data.audits || []).filter(row => inPeriod(row.completedDate || row.plannedDate, period))
  const objectives = data.objectives || []
  const lines = []
  if (source === 'incidents') {
    const sentinel = count(incidents, row => row.sentinel)
    lines.push(en ? `${incidents.length} reports in the period (${dmy(period.from)}–${dmy(period.to)}); ${count(incidents, row => row.status === 'closed')} closed, ${sentinel} sentinel events.` : `${incidents.length} αναφορές στην περίοδο ${dmy(period.from)}–${dmy(period.to)}· ${count(incidents, row => row.status === 'closed')} έκλεισαν, ${sentinel} συμβάντα-φρουροί.`)
    const kinds = { clinical: en ? 'clinical' : 'κλινικά', nonClinical: en ? 'non-clinical' : 'μη κλινικά', complaint: en ? 'complaints' : 'παράπονα', suggestion: en ? 'suggestions' : 'προτάσεις' }
    const split = Object.entries(kinds).map(([kind, label]) => `${count(incidents, row => (row.reportKind || 'clinical') === kind)} ${label}`).join(', ')
    if (incidents.length) lines.push(en ? `By kind: ${split}.` : `Ανά είδος: ${split}.`)
  }
  if (source === 'complaints') {
    const complaints = incidents.filter(row => row.reportKind === 'complaint'), suggestions = incidents.filter(row => row.reportKind === 'suggestion')
    lines.push(en ? `${complaints.length} complaints and ${suggestions.length} suggestions recorded in the period.` : `Καταγράφηκαν ${complaints.length} παράπονα και ${suggestions.length} προτάσεις στην περίοδο.`)
  }
  if (source === 'capas') {
    const open = capas.filter(row => !['closed', 'completed'].includes(row.status))
    const overdue = open.filter(row => row.dueDate && row.dueDate < period.to)
    const opened = capas.filter(row => inPeriod(row.date || row.createdAt, period))
    lines.push(en ? `${opened.length} corrective actions opened in the period; ${open.length} open today, ${overdue.length} past their due date.` : `${opened.length} διορθωτικές ενέργειες ανοίχτηκαν στην περίοδο· ${open.length} ανοιχτές σήμερα, ${overdue.length} εκπρόθεσμες.`)
    const findings = (data.findings || []).filter(row => inPeriod(row.date, period))
    if (findings.length) lines.push(en ? `${findings.length} findings recorded, ${count(findings, row => ['high', 'critical'].includes(row.severity))} of high severity.` : `${findings.length} ευρήματα, ${count(findings, row => ['high', 'critical'].includes(row.severity))} υψηλής σοβαρότητας.`)
  }
  if (source === 'audits') {
    lines.push(en ? `${audits.length} audits in the period, ${count(audits, row => row.status === 'completed')} completed.` : `${audits.length} επιθεωρήσεις στην περίοδο, ${count(audits, row => row.status === 'completed')} ολοκληρωμένες.`)
  }
  if (source === 'objectives' || source === 'registers') {
    if (!objectives.length) lines.push(en ? 'No quality objectives are recorded yet.' : 'Δεν έχουν καταχωριστεί ακόμη στόχοι ποιότητας.')
    for (const objective of objectives) {
      const value = objective.current?.value
      const state = objective.current?.status
      lines.push(`${objective.title}: ${value == null ? (en ? 'no value yet' : 'χωρίς τιμή ακόμη') : formatObjectiveValue(value, objective.unit, language)} (${en ? 'target' : 'στόχος'} ${objective.direction === 'lower' ? '≤' : '≥'} ${formatObjectiveValue(objective.target, objective.unit, language)}) — ${state === 'met' ? (en ? 'met' : 'επιτυγχάνεται') : state === 'missed' ? (en ? 'not met' : 'δεν επιτυγχάνεται') : en ? 'pending' : 'σε εξέλιξη'}.`)
    }
  }
  if (source === 'previousActions') {
    const actions = data.previous?.actions || []
    if (!data.previous) lines.push(en ? 'There is no earlier review in Limoxis.' : 'Δεν υπάρχει προηγούμενη ανασκόπηση στο Limoxis.')
    else if (!actions.length) lines.push(en ? 'No actions were decided in the previous review.' : 'Δεν είχαν αποφασιστεί ενέργειες στην προηγούμενη ανασκόπηση.')
    else lines.push(en ? `${count(actions, row => row.status === 'done')} of ${actions.length} actions of the previous review are done; ${count(actions, row => row.status === 'open')} remain open.` : `Από τις ${actions.length} ενέργειες της προηγούμενης ανασκόπησης ολοκληρώθηκαν ${count(actions, row => row.status === 'done')}· ${count(actions, row => row.status === 'open')} παραμένουν ανοιχτές.`)
  }
  return lines
}

// An objective against its indicator: met, missed or pending.
export function objectiveState(objective, value) {
  if (value == null || objective.target == null || objective.target === '') return 'pending'
  const target = toNumber(objective.target)
  if (target == null || Number.isNaN(target)) return 'pending'
  return (objective.direction === 'lower' ? value <= target : value >= target) ? 'met' : 'missed'
}

export const reviewStatusLabel = (status, language = 'el') => (language === 'en' ? { draft: 'Draft', in_review: 'For signature', approved: 'Approved' } : { draft: 'Πρόχειρο', in_review: 'Προς υπογραφή', approved: 'Εγκρίθηκε' })[status] || status
export const nextCode = (prefix, codes = [], year = new Date().getFullYear()) => {
  const numbers = codes.map(code => Number(String(code || '').match(new RegExp(`^${prefix}-${year}-(\\d+)$`))?.[1] || 0))
  return `${prefix}-${year}-${pad(Math.max(0, ...numbers) + 1)}`
}
