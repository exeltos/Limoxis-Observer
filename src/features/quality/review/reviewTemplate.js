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
// An objective's value for lists and exports: a missing value is said to be «not measured», never left as a dash that reads like a zero.
export const objectiveValueText = (value, unit, language = 'el') => (value == null || value === '' ? (language === 'en' ? 'Not measured' : 'Δεν μετριέται') : formatObjectiveValue(value, unit, language))
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

// A count with its word in the right number: «1 αξιολόγηση», «3 αξιολογήσεις».
const n = (value, one, many) => `${value} ${value === 1 ? one : many}`
// Only the word (a verb or an adjective after the count): «1 εγκρίθηκε», «2 εγκρίθηκαν».
const w = (value, one, many) => (value === 1 ? one : many)

// What Limoxis holds for a section over the period, as sentences the author
// can insert and edit. `data` = { incidents, capas, findings, audits, objectives, previous, … }.
export function sectionFacts(source, data = {}, period, language = 'el') {
  const en = language === 'en'
  const incidents = (data.incidents || []).filter(row => inPeriod(row.date, period))
  const capas = data.capas || []
  const audits = (data.audits || []).filter(row => inPeriod(row.completedDate || row.plannedDate, period))
  const objectives = data.objectives || []
  const lines = []
  if (source === 'incidents') {
    const sentinel = count(incidents, row => row.sentinel)
    const closed = count(incidents, row => row.status === 'closed')
    lines.push(en ? `${n(incidents.length, 'report', 'reports')} in the period (${dmy(period.from)}–${dmy(period.to)}); ${closed} closed, ${n(sentinel, 'sentinel event', 'sentinel events')}.` : `${n(incidents.length, 'αναφορά', 'αναφορές')} στην περίοδο ${dmy(period.from)}–${dmy(period.to)}· ${closed} ${w(closed, 'έκλεισε', 'έκλεισαν')}, ${n(sentinel, 'συμβάν-φρουρός', 'συμβάντα-φρουροί')}.`)
    const kinds = { clinical: en ? ['clinical', 'clinical'] : ['κλινικό', 'κλινικά'], nonClinical: en ? ['non-clinical', 'non-clinical'] : ['μη κλινικό', 'μη κλινικά'], complaint: en ? ['complaint', 'complaints'] : ['παράπονο', 'παράπονα'], suggestion: en ? ['suggestion', 'suggestions'] : ['πρόταση', 'προτάσεις'] }
    const split = Object.entries(kinds).map(([kind, [one, many]]) => n(count(incidents, row => (row.reportKind || 'clinical') === kind), one, many)).join(', ')
    if (incidents.length) lines.push(en ? `By kind: ${split}.` : `Ανά είδος: ${split}.`)
  }
  if (source === 'complaints') {
    const complaints = count(incidents, row => row.reportKind === 'complaint'), suggestions = count(incidents, row => row.reportKind === 'suggestion')
    lines.push(en ? `Recorded in the period: ${n(complaints, 'complaint', 'complaints')} and ${n(suggestions, 'suggestion', 'suggestions')}.` : `Καταγράφηκαν στην περίοδο: ${n(complaints, 'παράπονο', 'παράπονα')} και ${n(suggestions, 'πρόταση', 'προτάσεις')}.`)
    // The questionnaires: the responses of the period and the share of satisfied answers (4–5 of 5).
    for (const { survey, responses } of data.surveys || []) {
      const own = (responses || []).filter(response => inPeriod(response.submittedAt, period))
      if (!own.length) continue
      const { answered, satisfied } = satisfactionCounts(survey, own)
      const rate = answered ? Math.round((satisfied / answered) * 100) : null
      lines.push(en ? `Questionnaire «${survey.title}»: ${n(own.length, 'response', 'responses')}, ${rate == null ? '—' : `${rate}%`} satisfied (target ${survey.satisfiedTarget || 80}%).` : `Ερωτηματολόγιο «${survey.title}»: ${n(own.length, 'απάντηση', 'απαντήσεις')}, ${rate == null ? '—' : `${rate}%`} ικανοποιημένοι (στόχος ${survey.satisfiedTarget || 80}%).`)
    }
  }
  if (source === 'capas') {
    const open = capas.filter(row => !['closed', 'completed'].includes(row.status))
    const overdue = open.filter(row => row.dueDate && row.dueDate < period.to)
    const opened = capas.filter(row => inPeriod(row.date || row.createdAt, period))
    lines.push(en ? `${n(opened.length, 'corrective action', 'corrective actions')} opened in the period; ${open.length} open today, ${overdue.length} past their due date.` : `${n(opened.length, 'διορθωτική ενέργεια ανοίχτηκε', 'διορθωτικές ενέργειες ανοίχτηκαν')} στην περίοδο· ${n(open.length, 'ανοιχτή', 'ανοιχτές')} σήμερα, ${n(overdue.length, 'εκπρόθεσμη', 'εκπρόθεσμες')}.`)
    const findings = (data.findings || []).filter(row => inPeriod(row.date, period))
    if (findings.length) lines.push(en ? `${n(findings.length, 'finding', 'findings')} recorded, ${count(findings, row => ['high', 'critical'].includes(row.severity))} of high severity.` : `${n(findings.length, 'εύρημα', 'ευρήματα')}, ${count(findings, row => ['high', 'critical'].includes(row.severity))} υψηλής σοβαρότητας.`)
  }
  if (source === 'audits') {
    const completed = count(audits, row => row.status === 'completed')
    lines.push(en ? `${n(audits.length, 'audit', 'audits')} in the period, ${completed} completed.` : `${n(audits.length, 'επιθεώρηση', 'επιθεωρήσεις')} στην περίοδο, ${n(completed, 'ολοκληρωμένη', 'ολοκληρωμένες')}.`)
    // The audit programme's results: compliance per standard and the findings by class.
    const summary = auditReviewSummary(data.audits || [], data.findings || [], day => inPeriod(day, period))
    for (const entry of summary.standards) lines.push(en ? `${standardShort(entry.standard)}: ${n(entry.audits, 'audit', 'audits')} (${entry.completed} completed), average compliance ${entry.rate == null ? '—' : `${entry.rate}%`}.` : `${standardShort(entry.standard)}: ${n(entry.audits, 'επιθεώρηση', 'επιθεωρήσεις')} (${n(entry.completed, 'ολοκληρωμένη', 'ολοκληρωμένες')}), μέση συμμόρφωση ${entry.rate == null ? '—' : `${entry.rate}%`}.`)
    const f = summary.findings
    if (summary.total) lines.push(en ? `Audit findings: ${f.major} major, ${f.minor} minor, ${n(f.observation, 'observation', 'observations')}, ${n(f.opportunity, 'opportunity for improvement', 'opportunities for improvement')}; ${summary.open} still open.` : `Ευρήματα επιθεωρήσεων: ${n(f.major, 'μείζον', 'μείζονα')}, ${n(f.minor, 'έλασσον', 'ελάσσονα')}, ${n(f.observation, 'παρατήρηση', 'παρατηρήσεις')}, ${n(f.opportunity, 'ευκαιρία βελτίωσης', 'ευκαιρίες βελτίωσης')}· ${summary.open} ${w(summary.open, 'παραμένει ανοιχτό', 'παραμένουν ανοιχτά')}.`)
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
      const metCount = groups.filter(group => met.has(group.id) || met.has(group.departmentId)).length
      const late = groups.filter(group => groupStatus(group, data.meetings || [], period.to).overdue).length
      lines.push(en ? `Department meetings: ${meetings.length} in the period; ${metCount} of ${n(groups.length, 'department', 'departments')} met, ${late} ${w(late, 'is', 'are')} overdue.` : `Συναντήσεις τμημάτων: ${meetings.length} στην περίοδο· ${w(metCount, 'συναντήθηκε', 'συναντήθηκαν')} ${metCount} από ${n(groups.length, 'τμήμα', 'τμήματα')}, ${late} ${w(late, 'είναι εκπρόθεσμο', 'είναι εκπρόθεσμα')}.`)
      const withTraining = count(meetings, meeting => meeting.trainingHeld)
      if (withTraining) lines.push(en ? `${n(withTraining, 'department meeting', 'department meetings')} included a training.` : `${n(withTraining, 'συνάντηση τμήματος περιείχε', 'συναντήσεις τμημάτων περιείχαν')} εκπαίδευση.`)
    }
    const committees = (data.committees || []).filter(committee => committee.status !== 'inactive')
    if (committees.length) {
      const sittings = committees.flatMap(committee => (committee.meetings || []).filter(meeting => meeting.status !== 'cancelled' && inPeriod(meeting.date, period)))
      const open = committees.flatMap(committee => committee.decisions || []).filter(decision => ['open', 'in_progress'].includes(decision.status))
      const late = count(open, decision => decision.dueDate && decision.dueDate < period.to)
      lines.push(en ? `Committees: ${n(sittings.length, 'meeting', 'meetings')} of ${n(committees.length, 'committee', 'committees')} in the period; ${n(open.length, 'decision', 'decisions')} open, ${late} past their due date.` : `Επιτροπές: ${n(sittings.length, 'συνεδρίαση', 'συνεδριάσεις')} ${committees.length === 1 ? '1 επιτροπής' : `${committees.length} επιτροπών`} στην περίοδο· ${n(open.length, 'απόφαση ανοιχτή', 'αποφάσεις ανοιχτές')}, ${n(late, 'εκπρόθεσμη', 'εκπρόθεσμες')}.`)
    }
    if (!lines.length) lines.push(en ? 'No department meetings or committees are recorded yet.' : 'Δεν έχουν καταγραφεί ακόμη συναντήσεις τμημάτων ή επιτροπές.')
  }
  if (source === 'providers') {
    const suppliers = (data.suppliers || []).filter(supplier => supplier.status !== 'inactive')
    if (!suppliers.length) lines.push(en ? 'No suppliers are recorded yet.' : 'Δεν έχουν καταχωριστεί ακόμη προμηθευτές.')
    else {
      const evaluations = suppliers.flatMap(supplier => (supplier.evaluations || []).filter(evaluation => inPeriod(evaluation.evaluatedOn, period)))
      const results = evaluations.map(evaluationApproval)
      const approved = count(results, r => r === 'approved'), conditional = count(results, r => r === 'conditional'), rejected = count(results, r => r === 'rejected')
      lines.push(en ? `${n(suppliers.length, 'active supplier', 'active suppliers')}; ${n(evaluations.length, 'evaluation', 'evaluations')} in the period: ${approved} approved, ${conditional} conditional, ${rejected} rejected.` : `${n(suppliers.length, 'ενεργός προμηθευτής', 'ενεργοί προμηθευτές')}· ${n(evaluations.length, 'αξιολόγηση', 'αξιολογήσεις')} στην περίοδο: ${approved} ${w(approved, 'εγκρίθηκε', 'εγκρίθηκαν')}, ${conditional} υπό όρους, ${rejected} ${w(rejected, 'απορρίφθηκε', 'απορρίφθηκαν')}.`)
      const expired = suppliers.flatMap(supplier => (supplier.certifications || []).filter(cert => certificationState(cert, period.to) === 'expired')).length
      const issues = suppliers.flatMap(supplier => supplier.nonconformities || [])
      const recent = count(issues, issue => inPeriod(issue.date, period)), open = count(issues, issue => issue.status === 'open')
      lines.push(en ? `${n(expired, 'expired certificate', 'expired certificates')}; ${n(recent, 'supplier nonconformity', 'supplier nonconformities')} in the period, ${open} open.` : `${n(expired, 'ληγμένο πιστοποιητικό', 'ληγμένα πιστοποιητικά')}· ${n(recent, 'μη συμμόρφωση προμηθευτή', 'μη συμμορφώσεις προμηθευτών')} στην περίοδο, ${n(open, 'ανοιχτή', 'ανοιχτές')}.`)
    }
  }
  if (source === 'risks') {
    // The latest risk assessment: what remains high after the measures, and the opportunities.
    const assessment = [...(data.riskAssessments || [])].filter(row => row.status !== 'archived').sort((a, b) => String(b.assessedOn || '').localeCompare(String(a.assessedOn || '')))[0]
    if (!assessment) lines.push(en ? 'No risk assessment is recorded yet.' : 'Δεν έχει καταχωριστεί ακόμη εκτίμηση κινδύνων.')
    else {
      const summary = summarizeRisks(assessment.risks || [])
      const total = (assessment.risks || []).length, high = summary.priorities.length, noPlan = summary.withoutPlan.length
      lines.push(en ? `Risk assessment ${assessment.code || assessment.title} (${dmy(assessment.assessedOn)}): ${n(total, 'risk', 'risks')}, ${high} still high after the measures, ${noPlan} without an action plan.` : `Εκτίμηση κινδύνων ${assessment.code || assessment.title} (${dmy(assessment.assessedOn)}): ${n(total, 'κίνδυνος', 'κίνδυνοι')}, ${high} ${w(high, 'παραμένει υψηλός', 'παραμένουν υψηλοί')} μετά τα μέτρα, ${noPlan} χωρίς σχέδιο δράσης.`)
      const opportunities = (assessment.opportunities || []).map(normalizeOpportunity)
      const effective = count(opportunities, o => o.effectivenessStatus === 'effective'), partial = count(opportunities, o => o.effectivenessStatus === 'partial'), ineffective = count(opportunities, o => o.effectivenessStatus === 'ineffective')
      if (opportunities.length) lines.push(en ? `${n(opportunities.length, 'opportunity', 'opportunities')}: ${effective} effective, ${partial} partly, ${ineffective} not effective.` : `${n(opportunities.length, 'ευκαιρία', 'ευκαιρίες')}: ${n(effective, 'αποτελεσματική', 'αποτελεσματικές')}, ${partial} μερικώς, ${n(ineffective, 'μη αποτελεσματική', 'μη αποτελεσματικές')}.`)
    }
  }
  if (source === 'resources') {
    const programs = (data.trainingPrograms || []).filter(program => program.status !== 'cancelled' && inPeriod(program.startDate || program.dueDate, period))
    const done = count(programs, program => program.status === 'completed')
    const completions = count(data.trainingAssignments || [], row => inPeriod(row.completedDate, period) && row.status === 'completed')
    lines.push(en ? `Training: ${n(programs.length, 'programme', 'programmes')} in the period, ${done} completed; ${n(completions, 'employee completion', 'employee completions')}.` : `Εκπαίδευση: ${n(programs.length, 'πρόγραμμα', 'προγράμματα')} στην περίοδο, ${done} ${w(done, 'ολοκληρώθηκε', 'ολοκληρώθηκαν')}· ${n(completions, 'ολοκλήρωση εργαζομένου', 'ολοκληρώσεις εργαζομένων')}.`)
    const events = (data.equipmentEvents || []).filter(event => inPeriod(event.happenedOn, period))
    const checks = events.filter(event => ['maintenance', 'calibration', 'safety'].includes(event.kind))
    const failures = count(events, event => event.kind === 'failure'), failed = count(checks, event => event.result === 'fail')
    if ((data.equipment || []).length) lines.push(en ? `Equipment: ${n(failures, 'failure', 'failures')} in the period; ${n(checks.length, 'maintenance/calibration/safety check', 'maintenance/calibration/safety checks')}, ${failed} failed.` : `Εξοπλισμός: ${n(failures, 'βλάβη', 'βλάβες')} στην περίοδο· ${n(checks.length, 'συντήρηση/διακρίβωση/έλεγχος ασφάλειας', 'συντηρήσεις/διακριβώσεις/έλεγχοι ασφάλειας')}, ${failed} ${w(failed, 'απέτυχε', 'απέτυχαν')}.`)
  }
  if (source === 'compliance') {
    const current = (data.documents || []).filter(doc => ['published', 'approved'].includes(doc.status))
    if (!current.length) lines.push(en ? 'No controlled documents are recorded yet.' : 'Δεν έχουν καταχωριστεί ακόμη ελεγχόμενα έγγραφα.')
    else {
      const late = count(current, doc => doc.type !== 'licence' && doc.reviewDate && doc.reviewDate < period.to)
      const licences = current.filter(doc => doc.type === 'licence')
      const expired = count(licences, doc => doc.reviewDate && doc.reviewDate < period.to)
      lines.push(en ? `${n(current.length, 'document', 'documents')} in force; ${late} past ${w(late, 'its', 'their')} review date.` : `${n(current.length, 'έγγραφο', 'έγγραφα')} σε ισχύ· ${late} ${w(late, 'έχει', 'έχουν')} ξεπεράσει την ημερομηνία αναθεώρησης.`)
      if (licences.length) lines.push(en ? `${n(licences.length, 'licence', 'licences')}, ${expired} expired.` : `${n(licences.length, 'άδεια', 'άδειες')}, ${expired} ${w(expired, 'έχει', 'έχουν')} λήξει.`)
    }
  }
  if (source === 'improvements') {
    const summary = auditReviewSummary(data.audits || [], data.findings || [], day => inPeriod(day, period))
    const assessment = [...(data.riskAssessments || [])].filter(row => row.status !== 'archived').sort((a, b) => String(b.assessedOn || '').localeCompare(String(a.assessedOn || '')))[0]
    const opportunities = (assessment?.opportunities || []).map(normalizeOpportunity)
    const high = count(opportunities, o => o.ratingId === 'high')
    lines.push(en ? `${n(summary.findings.opportunity, 'opportunity', 'opportunities')} for improvement from the audits of the period; ${n(opportunities.length, 'opportunity', 'opportunities')} in the risk assessment (${high} of high value).` : `${n(summary.findings.opportunity, 'ευκαιρία', 'ευκαιρίες')} βελτίωσης από τις επιθεωρήσεις της περιόδου· ${n(opportunities.length, 'ευκαιρία', 'ευκαιρίες')} στην εκτίμηση κινδύνων (${high} υψηλής αξίας).`)
  }
  if (source === 'previousActions') {
    const actions = data.previous?.actions || []
    const done = count(actions, row => row.status === 'done'), open = count(actions, row => row.status === 'open')
    if (!data.previous) lines.push(en ? 'There is no earlier review in Limoxis.' : 'Δεν υπάρχει προηγούμενη ανασκόπηση στο Limoxis.')
    else if (!actions.length) lines.push(en ? 'No actions were decided in the previous review.' : 'Δεν είχαν αποφασιστεί ενέργειες στην προηγούμενη ανασκόπηση.')
    else lines.push(en ? `${done} of ${n(actions.length, 'action', 'actions')} of the previous review ${w(done, 'is', 'are')} done; ${open} ${w(open, 'remains', 'remain')} open.` : `Από ${actions.length === 1 ? 'την 1 ενέργεια' : `τις ${actions.length} ενέργειες`} της προηγούμενης ανασκόπησης ${w(done, 'ολοκληρώθηκε', 'ολοκληρώθηκαν')} ${done}· ${open} ${w(open, 'παραμένει ανοιχτή', 'παραμένουν ανοιχτές')}.`)
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
