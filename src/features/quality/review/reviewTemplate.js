// The management review (ISO 9001 §9.3, ΕΛΟΤ EN 15224) in the sections of
// the hospital's minutes form. Each section can take a summary of what
// Limoxis already holds for the period (reports, corrective actions, audits,
// objectives), so the minutes start from the facts instead of a blank page.
import { auditReviewSummary } from '../audits/auditModel'
import { standardShort } from '../audits/auditStandards'
import { certificationState, evaluationApproval } from '../resources/resourceModel'
import { normalizeOpportunity, summarizeRisks } from '../risk/riskModel'
import { satisfactionCounts } from '../surveys/surveyModel'
import { groupStatus } from '../meetings/meetingModel'

export const REVIEW_SECTIONS = [
  { key: 'previous_actions', short: 'Προηγούμενες ενέργειες', shortEn: 'Previous actions', title: 'Ανασκόπηση Ενεργειών Προηγούμενων Συνεδριάσεων', titleEn: 'Actions from previous reviews', source: 'previousActions' },
  { key: 'context_changes', short: 'Αλλαγές στο πλαίσιο', shortEn: 'Context changes', title: 'Αλλαγές σε Εξωτερικά και Εσωτερικά Ζητήματα που Αφορούν το Σύστημα Διαχείρισης Ποιότητας', titleEn: 'Changes in external and internal issues' },
  { key: 'satisfaction', short: 'Ικανοποίηση ασθενών', shortEn: 'Patient satisfaction', title: 'Ικανοποίηση Ασθενών και Ανατροφοδότηση από τα Ενδιαφερόμενα Μέρη', titleEn: 'Patient satisfaction and feedback', source: 'complaints' },
  { key: 'objectives', short: 'Στόχοι ποιότητας', shortEn: 'Quality objectives', title: 'Βαθμός Επίτευξης των Στόχων Ποιότητας', titleEn: 'Achievement of quality objectives', source: 'objectives' },
  { key: 'process_performance', short: 'Επίδοση διεργασιών', shortEn: 'Process performance', title: 'Επίδοση Διεργασιών και Συμμόρφωση των Παρεχόμενων Υπηρεσιών', titleEn: 'Process performance and conformity of services', source: 'processes' },
  { key: 'nonconformities', short: 'Μη συμμορφώσεις', shortEn: 'Nonconformities', title: 'Μη Συμμορφώσεις και Διορθωτικές Ενέργειες', titleEn: 'Nonconformities and corrective actions', source: 'capas' },
  { key: 'monitoring', short: 'Παρακολούθηση και μέτρηση', shortEn: 'Monitoring and measurement', title: 'Αποτελέσματα Παρακολούθησης και Μέτρησης', titleEn: 'Monitoring and measurement results', source: 'objectives' },
  { key: 'audits', short: 'Επιθεωρήσεις', shortEn: 'Audits', title: 'Αποτελέσματα Εσωτερικών, Εξωτερικών και Κανονιστικών Επιθεωρήσεων', titleEn: 'Results of internal, external and regulatory audits', source: 'audits' },
  { key: 'providers', short: 'Εξωτερικοί πάροχοι', shortEn: 'External providers', title: 'Επίδοση Εξωτερικών Παρόχων', titleEn: 'Performance of external providers', source: 'providers' },
  { key: 'risks', short: 'Κίνδυνοι και ευκαιρίες', shortEn: 'Risks and opportunities', title: 'Αποτελεσματικότητα Ενεργειών Αντιμετώπισης Κινδύνων και Αξιοποίησης Ευκαιριών', titleEn: 'Effectiveness of actions on risks and opportunities', source: 'risks' },
  { key: 'resources', short: 'Πόροι', shortEn: 'Resources', title: 'Επάρκεια και Διαθεσιμότητα Απαιτούμενων Πόρων', titleEn: 'Adequacy of resources', source: 'resources' },
  { key: 'climate', short: 'Κλιματική αλλαγή', shortEn: 'Climate change', title: 'Κλιματική Αλλαγή – Υπολογισμός Ανθρακικού Αποτυπώματος', titleEn: 'Climate change – carbon footprint' },
  { key: 'compliance', short: 'Νομοθετική συμμόρφωση', shortEn: 'Legal compliance', title: 'Συμμόρφωση με Νομοθετικές και Κανονιστικές Απαιτήσεις', titleEn: 'Legal and regulatory compliance', source: 'compliance' },
  { key: 'adverse_events', short: 'Ανεπιθύμητα συμβάντα', shortEn: 'Adverse events', title: 'Αναφορά και Διαχείριση Ανεπιθύμητων Συμβάντων', titleEn: 'Reporting and management of adverse events', source: 'incidents' },
  { key: 'improvements', short: 'Ευκαιρίες βελτίωσης', shortEn: 'Improvement opportunities', title: 'Ευκαιρίες προς Βελτίωση', titleEn: 'Opportunities for improvement', source: 'improvements' },
  { key: 'conclusions', short: 'Συμπεράσματα', shortEn: 'Conclusions', title: 'Γενικά Συμπεράσματα Ανασκόπησης Διοίκησης', titleEn: 'General conclusions' },
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
    // The questionnaires: the responses of the period and the share of satisfied answers (4–5 of 5).
    for (const { survey, responses } of data.surveys || []) {
      const own = (responses || []).filter(response => inPeriod(response.submittedAt, period))
      if (!own.length) continue
      const { answered, satisfied } = satisfactionCounts(survey, own)
      const rate = answered ? Math.round((satisfied / answered) * 100) : null
      lines.push(en ? `Questionnaire «${survey.title}»: ${own.length} responses, ${rate == null ? '—' : `${rate}%`} satisfied (target ${survey.satisfiedTarget || 80}%).` : `Ερωτηματολόγιο «${survey.title}»: ${own.length} απαντήσεις, ${rate == null ? '—' : `${rate}%`} ικανοποιημένοι (στόχος ${survey.satisfiedTarget || 80}%).`)
    }
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
    // The audit programme's results: compliance per standard and the findings by class.
    const summary = auditReviewSummary(data.audits || [], data.findings || [], day => inPeriod(day, period))
    for (const entry of summary.standards) lines.push(en ? `${standardShort(entry.standard)}: ${entry.audits} audits (${entry.completed} completed), average compliance ${entry.rate == null ? '—' : `${entry.rate}%`}.` : `${standardShort(entry.standard)}: ${entry.audits} επιθεωρήσεις (${entry.completed} ολοκληρωμένες), μέση συμμόρφωση ${entry.rate == null ? '—' : `${entry.rate}%`}.`)
    if (summary.total) lines.push(en ? `Audit findings: ${summary.findings.major} major, ${summary.findings.minor} minor, ${summary.findings.observation} observations, ${summary.findings.opportunity} opportunities for improvement; ${summary.open} still open.` : `Ευρήματα επιθεωρήσεων: ${summary.findings.major} μείζονα, ${summary.findings.minor} ελάσσονα, ${summary.findings.observation} παρατηρήσεις, ${summary.findings.opportunity} ευκαιρίες βελτίωσης· ${summary.open} παραμένουν ανοιχτά.`)
  }
  if (source === 'objectives' || source === 'registers') {
    if (!objectives.length) lines.push(en ? 'No quality objectives are recorded yet.' : 'Δεν έχουν καταχωριστεί ακόμη στόχοι ποιότητας.')
    for (const objective of objectives) {
      const value = objective.current?.value
      const state = objective.current?.status
      lines.push(`${(en && objective.titleEn) || objective.title}: ${value == null ? (en ? 'no value yet' : 'χωρίς τιμή ακόμη') : formatObjectiveValue(value, objective.unit, language)} (${en ? 'target' : 'στόχος'} ${objective.direction === 'lower' ? '≤' : '≥'} ${formatObjectiveValue(objective.target, objective.unit, language)}) — ${state === 'met' ? (en ? 'met' : 'επιτυγχάνεται') : state === 'missed' ? (en ? 'not met' : 'δεν επιτυγχάνεται') : en ? 'pending' : 'σε εξέλιξη'}.`)
    }
  }
  if (source === 'processes') {
    // The departments' meetings (as often as the administration set) and the committees.
    const groups = (data.meetingGroups || []).filter(group => group.active !== false)
    if (groups.length) {
      const meetings = (data.meetings || []).filter(meeting => inPeriod(meeting.meetingDate, period))
      const met = new Set(meetings.map(meeting => meeting.groupId || meeting.departmentId))
      const late = groups.filter(group => groupStatus(group, data.meetings || [], period.to).overdue)
      lines.push(en ? `Department meetings: ${meetings.length} in the period, ${groups.filter(group => met.has(group.id) || met.has(group.departmentId)).length} of ${groups.length} departments met; ${late.length} are overdue.` : `Συναντήσεις τμημάτων: ${meetings.length} στην περίοδο· συναντήθηκαν ${groups.filter(group => met.has(group.id) || met.has(group.departmentId)).length} από ${groups.length} τμήματα, ${late.length} είναι εκπρόθεσμα.`)
      const withTraining = count(meetings, meeting => meeting.trainingHeld)
      if (withTraining) lines.push(en ? `${withTraining} department meetings included a training.` : `${withTraining} συναντήσεις τμημάτων περιείχαν εκπαίδευση.`)
    }
    const committees = (data.committees || []).filter(committee => committee.status !== 'inactive')
    if (committees.length) {
      const sittings = committees.flatMap(committee => (committee.meetings || []).filter(meeting => meeting.status !== 'cancelled' && inPeriod(meeting.date, period)))
      const decisions = committees.flatMap(committee => committee.decisions || [])
      const open = decisions.filter(decision => ['open', 'in_progress'].includes(decision.status))
      lines.push(en ? `Committees: ${sittings.length} meetings of ${committees.length} committees in the period; ${open.length} decisions open, ${count(open, decision => decision.dueDate && decision.dueDate < period.to)} past their due date.` : `Επιτροπές: ${sittings.length} συνεδριάσεις ${committees.length} επιτροπών στην περίοδο· ${open.length} αποφάσεις ανοιχτές, ${count(open, decision => decision.dueDate && decision.dueDate < period.to)} εκπρόθεσμες.`)
    }
    if (!lines.length) lines.push(en ? 'No department meetings or committees are recorded yet.' : 'Δεν έχουν καταγραφεί ακόμη συναντήσεις τμημάτων ή επιτροπές.')
  }
  if (source === 'providers') {
    const suppliers = (data.suppliers || []).filter(supplier => supplier.status !== 'inactive')
    if (!suppliers.length) lines.push(en ? 'No suppliers are recorded yet.' : 'Δεν έχουν καταχωριστεί ακόμη προμηθευτές.')
    else {
      const evaluations = suppliers.flatMap(supplier => (supplier.evaluations || []).filter(evaluation => inPeriod(evaluation.evaluatedOn, period)))
      const results = evaluations.map(evaluationApproval)
      lines.push(en ? `${suppliers.length} active suppliers; ${evaluations.length} evaluations in the period: ${count(results, r => r === 'approved')} approved, ${count(results, r => r === 'conditional')} conditional, ${count(results, r => r === 'rejected')} rejected.` : `${suppliers.length} ενεργοί προμηθευτές· ${evaluations.length} αξιολογήσεις στην περίοδο: ${count(results, r => r === 'approved')} εγκρίθηκαν, ${count(results, r => r === 'conditional')} υπό όρους, ${count(results, r => r === 'rejected')} απορρίφθηκαν.`)
      const expired = suppliers.flatMap(supplier => (supplier.certifications || []).filter(cert => certificationState(cert, period.to) === 'expired'))
      const issues = suppliers.flatMap(supplier => supplier.nonconformities || [])
      lines.push(en ? `${expired.length} expired certificates; ${count(issues, issue => inPeriod(issue.date, period))} supplier nonconformities in the period, ${count(issues, issue => issue.status === 'open')} open.` : `${expired.length} ληγμένα πιστοποιητικά· ${count(issues, issue => inPeriod(issue.date, period))} μη συμμορφώσεις προμηθευτών στην περίοδο, ${count(issues, issue => issue.status === 'open')} ανοιχτές.`)
    }
  }
  if (source === 'risks') {
    // The latest risk assessment: what remains high after the measures, and the opportunities.
    const assessment = [...(data.riskAssessments || [])].filter(row => row.status !== 'archived').sort((a, b) => String(b.assessedOn || '').localeCompare(String(a.assessedOn || '')))[0]
    if (!assessment) lines.push(en ? 'No risk assessment is recorded yet.' : 'Δεν έχει καταχωριστεί ακόμη εκτίμηση κινδύνων.')
    else {
      const summary = summarizeRisks(assessment.risks || [])
      lines.push(en ? `Risk assessment ${assessment.code || assessment.title} (${dmy(assessment.assessedOn)}): ${(assessment.risks || []).length} risks, ${summary.priorities.length} still high after the measures, ${summary.withoutPlan.length} without an action plan.` : `Εκτίμηση κινδύνων ${assessment.code || assessment.title} (${dmy(assessment.assessedOn)}): ${(assessment.risks || []).length} κίνδυνοι, ${summary.priorities.length} παραμένουν υψηλοί μετά τα μέτρα, ${summary.withoutPlan.length} χωρίς σχέδιο δράσης.`)
      const opportunities = (assessment.opportunities || []).map(normalizeOpportunity)
      if (opportunities.length) lines.push(en ? `${opportunities.length} opportunities: ${count(opportunities, o => o.effectivenessStatus === 'effective')} effective, ${count(opportunities, o => o.effectivenessStatus === 'partial')} partly, ${count(opportunities, o => o.effectivenessStatus === 'ineffective')} not effective.` : `${opportunities.length} ευκαιρίες: ${count(opportunities, o => o.effectivenessStatus === 'effective')} αποτελεσματικές, ${count(opportunities, o => o.effectivenessStatus === 'partial')} μερικώς, ${count(opportunities, o => o.effectivenessStatus === 'ineffective')} μη αποτελεσματικές.`)
    }
  }
  if (source === 'resources') {
    const programs = (data.trainingPrograms || []).filter(program => program.status !== 'cancelled' && inPeriod(program.startDate || program.dueDate, period))
    const assignments = (data.trainingAssignments || []).filter(row => inPeriod(row.completedDate, period) && row.status === 'completed')
    lines.push(en ? `Training: ${programs.length} programmes in the period, ${count(programs, program => program.status === 'completed')} completed; ${assignments.length} employee completions.` : `Εκπαίδευση: ${programs.length} προγράμματα στην περίοδο, ${count(programs, program => program.status === 'completed')} ολοκληρώθηκαν· ${assignments.length} ολοκληρώσεις εργαζομένων.`)
    const events = (data.equipmentEvents || []).filter(event => inPeriod(event.happenedOn, period))
    if ((data.equipment || []).length) lines.push(en ? `Equipment: ${count(events, event => event.kind === 'failure')} failures in the period; ${count(events, event => ['maintenance', 'calibration', 'safety'].includes(event.kind))} maintenance/calibration/safety checks, ${count(events, event => ['maintenance', 'calibration', 'safety'].includes(event.kind) && event.result === 'fail')} failed.` : `Εξοπλισμός: ${count(events, event => event.kind === 'failure')} βλάβες στην περίοδο· ${count(events, event => ['maintenance', 'calibration', 'safety'].includes(event.kind))} συντηρήσεις/διακριβώσεις/έλεγχοι ασφάλειας, ${count(events, event => ['maintenance', 'calibration', 'safety'].includes(event.kind) && event.result === 'fail')} απέτυχαν.`)
  }
  if (source === 'compliance') {
    const current = (data.documents || []).filter(doc => ['published', 'approved'].includes(doc.status))
    if (!current.length) lines.push(en ? 'No controlled documents are recorded yet.' : 'Δεν έχουν καταχωριστεί ακόμη ελεγχόμενα έγγραφα.')
    else {
      const late = current.filter(doc => doc.type !== 'licence' && doc.reviewDate && doc.reviewDate < period.to)
      const licences = current.filter(doc => doc.type === 'licence')
      lines.push(en ? `${current.length} documents in force; ${late.length} past their review date.` : `${current.length} έγγραφα σε ισχύ· ${late.length} έχουν ξεπεράσει την ημερομηνία αναθεώρησης.`)
      if (licences.length) lines.push(en ? `${licences.length} licences, ${count(licences, doc => doc.reviewDate && doc.reviewDate < period.to)} expired.` : `${licences.length} άδειες, ${count(licences, doc => doc.reviewDate && doc.reviewDate < period.to)} έχουν λήξει.`)
    }
  }
  if (source === 'improvements') {
    const summary = auditReviewSummary(data.audits || [], data.findings || [], day => inPeriod(day, period))
    const assessment = [...(data.riskAssessments || [])].filter(row => row.status !== 'archived').sort((a, b) => String(b.assessedOn || '').localeCompare(String(a.assessedOn || '')))[0]
    const opportunities = (assessment?.opportunities || []).map(normalizeOpportunity)
    lines.push(en ? `${summary.findings.opportunity} opportunities for improvement from the audits of the period; ${opportunities.length} opportunities in the risk assessment (${count(opportunities, o => o.ratingId === 'high')} of high value).` : `${summary.findings.opportunity} ευκαιρίες βελτίωσης από τις επιθεωρήσεις της περιόδου· ${opportunities.length} ευκαιρίες στην εκτίμηση κινδύνων (${count(opportunities, o => o.ratingId === 'high')} υψηλής αξίας).`)
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
