import { FINDING_CLASSES, RESULT_VALUE, departmentArea, riskMonths, standardShort } from './auditStandards'

// The audit programme in pure functions: which questions an audit asks, how it
// scores, which answers become findings, whether the team is independent and
// competent, which clauses the year covered, and the dashboard figures. The
// screens, the report and the tests use these; nothing here reads or writes.

const today = () => new Date().toISOString().slice(0, 10)
const round = value => Math.round(value)
const text = value => String(value ?? '').trim()
const addDays = (day, days) => { const date = new Date(`${String(day || today()).slice(0, 10)}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10) }
const addMonths = (day, months) => { const date = new Date(`${String(day || today()).slice(0, 10)}T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() + months); return date.toISOString().slice(0, 10) }

// --- Which questions -----------------------------------------------------------------------

// A scope entry is a chapter («7», «IPSG», «ΧΠ-3») or a clause («7.1.5»): a
// question is in scope when its chapter or clause is listed, or its clause is
// under a listed clause (7.1 covers 7.1.5, not 7.10).
export function inScope(question, scope = []) {
  const list = (scope || []).map(text).filter(Boolean)
  if (!list.length) return true
  const clause = text(question.clauseRef), chapter = text(question.chapterRef)
  return list.some(entry => entry === chapter || entry === clause || clause.startsWith(`${entry}.`))
}

// A question applies to an area when it lists none or lists that area. An
// audit of the whole organization (no department) asks every question.
export function questionApplies(question, area) {
  if (!area) return true
  const areas = question.areas || []
  return !areas.length || areas.includes(area)
}

// The checklist an audit opens with: the template's questions for the
// department's area and the clauses in scope, each an answer row.
export function questionsForAudit(template, { department = '', scope = [], allAreas = false } = {}) {
  const area = department && !allAreas ? departmentArea(department) : ''
  return (template?.questions || [])
    .filter(question => questionApplies(question, area) && inScope(question, scope))
    .sort((a, b) => (a.position || 0) - (b.position || 0))
    .map((question, index) => answerRow(question, index))
}

export function answerRow(question, index = 0) {
  return {
    id: `q-${question.id || index + 1}`,
    templateQuestionId: question.id || null,
    position: index + 1,
    chapterRef: question.chapterRef || '',
    chapterTitle: question.chapterTitle || '',
    clauseRef: question.clauseRef || '',
    item: question.question,
    itemEn: question.question,
    guidance: question.guidance || '',
    evidenceRequired: question.evidence || '',
    weight: Number(question.weight) > 0 ? Number(question.weight) : 1,
    critical: Boolean(question.critical),
    required: true,
    answer: '',
    note: '',
    evidence: '',
    findingClass: '',
    adHoc: false,
  }
}

// A question the auditor adds on the spot (or a FileMaker question with no
// template match): it keeps its text and, when known, a clause.
export function adHocRow(item, { clauseRef = '', chapterRef = '', chapterTitle = '', position = 1 } = {}) {
  return { ...answerRow({ question: item, clauseRef, chapterRef: chapterRef || clauseRef.split('.')[0], chapterTitle }, position - 1), id: `adhoc-${Date.now().toString(36)}-${position}`, templateQuestionId: null, adHoc: true }
}

// The chapters of a template in order, for the scope picker and the coverage.
export function templateChapters(template) {
  const chapters = new Map()
  for (const question of template?.questions || []) {
    const key = question.chapterRef || '—'
    if (!chapters.has(key)) chapters.set(key, { ref: key, title: question.chapterTitle || '', questions: 0, clauses: new Set() })
    const entry = chapters.get(key)
    entry.questions += 1
    if (question.clauseRef) entry.clauses.add(question.clauseRef)
  }
  return [...chapters.values()].map(entry => ({ ...entry, clauses: [...entry.clauses] }))
}

// --- Scoring --------------------------------------------------------------------------------

// Weighted compliance: a conforming answer counts its weight, a partial one
// half, a nonconformity nothing; «not applicable» and unanswered rows are left
// out. Per chapter and overall, as a whole percentage.
function tally(rows) {
  let points = 0, weight = 0
  const counts = { yes: 0, partial: 0, no: 0, na: 0, unanswered: 0 }
  for (const row of rows) {
    const value = RESULT_VALUE[row.answer]
    if (row.answer === 'na') counts.na += 1
    else if (value === undefined) counts.unanswered += 1
    else {
      counts[row.answer] += 1
      const w = Number(row.weight) > 0 ? Number(row.weight) : 1
      points += value * w
      weight += w
    }
  }
  const applicable = counts.yes + counts.partial + counts.no
  return { ...counts, applicable, answered: applicable + counts.na, total: rows.length, rate: weight ? round(points * 100 / weight) : null, points, weight }
}

export function auditScore(rows = []) {
  const chapters = new Map()
  for (const row of rows) {
    const key = row.chapterRef || row.clauseRef?.split('.')[0] || ''
    if (!chapters.has(key)) chapters.set(key, { ref: key, title: row.chapterTitle || '', rows: [] })
    chapters.get(key).rows.push(row)
  }
  return {
    overall: tally(rows),
    chapters: [...chapters.values()].map(chapter => ({ ref: chapter.ref, title: chapter.title, ...tally(chapter.rows) })),
    criticalFailed: rows.filter(row => row.critical && row.answer === 'no').length,
  }
}

// The old shape the lists and the programme read (rate, applicable, yes).
export const complianceOf = record => {
  const { overall } = auditScore(record?.checklist || [])
  return { rate: overall.rate, applicable: overall.applicable, yes: overall.yes, no: overall.no, partial: overall.partial, unanswered: overall.unanswered }
}

// --- Findings -------------------------------------------------------------------------------

export const needsClass = row => row.answer === 'partial' || row.answer === 'no'
// The answers still to classify, and the classified ones still without a finding.
export const unclassified = (rows = []) => rows.filter(row => needsClass(row) && !row.findingClass)
export const awaitingFinding = (rows = []) => rows.filter(row => !row.findingId && ((needsClass(row) && row.findingClass) || (row.answer === 'yes' && ['observation', 'opportunity'].includes(row.findingClass))))
// A class that suits the answer: a nonconformity is major or minor; a partial
// one any of the four; a conforming answer only an observation or opportunity.
export function classesFor(answer) {
  if (answer === 'no') return ['major', 'minor']
  if (answer === 'partial') return ['major', 'minor', 'observation', 'opportunity']
  if (answer === 'yes') return ['observation', 'opportunity']
  return []
}

const classOf = value => FINDING_CLASSES.find(entry => entry.value === value) || FINDING_CLASSES[1]

// The finding an answer becomes: titled by its clause, classified, due by its
// class, pointing back at the audit and the question.
export function findingDraftFromAnswer(audit, row, { language = 'el', owner = '', dueDate = '' } = {}) {
  const en = language === 'en'
  const cls = classOf(row.findingClass)
  const date = audit.completedDate || audit.closingMeeting?.date || today()
  const clause = row.clauseRef ? `${standardShort(audit.standard)} ${row.clauseRef}`.trim() : ''
  const lines = [
    en ? `Audit ${audit.displayId || audit.id}${clause ? `, ${clause}` : ''}: «${row.item}».` : `Επιθεώρηση ${audit.displayId || audit.id}${clause ? `, ${clause}` : ''}: «${row.item}».`,
    row.note && (en ? `Found: ${row.note}` : `Διαπίστωση: ${row.note}`),
    row.evidence && (en ? `Evidence: ${row.evidence}` : `Τεκμήρια: ${row.evidence}`),
  ].filter(Boolean)
  return {
    title: `${clause ? `${clause} · ` : ''}${text(row.note) || row.item}`.slice(0, 240),
    titleEn: `${clause ? `${clause} · ` : ''}${text(row.note) || row.itemEn || row.item}`.slice(0, 240),
    departmentId: audit.departmentId || '',
    department: audit.department || '',
    departmentEn: audit.departmentEn || audit.department || '',
    severity: cls.severity,
    findingClass: cls.value,
    status: 'open',
    source: 'audit',
    sourceId: audit.id,
    auditItemId: row.dbId || row.id,
    clauseRef: row.clauseRef || '',
    standard: audit.standard || '',
    owners: owner ? [owner] : [],
    owner,
    dueDate: dueDate || addDays(date, cls.days),
    description: lines.join('\n'),
    date,
  }
}

// The CAPA a finding raises, with its owner and due date.
export function capaDraftFromFinding(finding, { owner = '', dueDate = '', language = 'el' } = {}) {
  const en = language === 'en'
  return {
    title: en ? `Corrective action: ${finding.titleEn || finding.title}` : `Διορθωτική ενέργεια: ${finding.title}`,
    titleEn: `Corrective action: ${finding.titleEn || finding.title}`,
    departmentId: finding.departmentId || '',
    department: finding.department || '',
    departmentEn: finding.departmentEn || finding.department || '',
    source: 'finding',
    sourceId: finding.id,
    actionType: finding.findingClass === 'opportunity' ? 'continuous_improvement' : 'corrective',
    priority: finding.severity || 'medium',
    owners: owner ? [owner] : finding.owners || [],
    owner: owner || finding.owner || '',
    dueDate: dueDate || finding.dueDate || '',
    effectivenessDue: addDays(dueDate || finding.dueDate || today(), 30),
    effectivenessStatus: 'pending',
    status: 'open',
    description: finding.description || '',
  }
}

// --- The team -------------------------------------------------------------------------------

const sameDepartment = (member, department) => {
  if (!member || member.external) return false
  if (member.departmentId && department.id) return String(member.departmentId) === String(department.id)
  return Boolean(member.department && department.name) && text(member.department).toLowerCase() === text(department.name).toLowerCase()
}

// Independence: no one audits their own department. The lead auditor of their
// own department blocks the audit; a team member there is a warning.
export function independenceIssues(team = [], department = {}) {
  if (!department?.id && !department?.name) return []
  return team.filter(member => sameDepartment(member, department)).map(member => ({ member, level: member.role === 'lead' ? 'block' : 'warn' }))
}
export const independenceBlocks = (team, department) => independenceIssues(team, department).some(issue => issue.level === 'block')

const AUDITOR = /επιθεωρ|auditor|ελεγκτ/i
// Competence: an employee on the team should hold an auditor certificate still
// valid, or have completed an auditor training. External auditors are not checked.
export function competenceWarnings(team = [], { certificates = [], assignments = [], programs = [] } = {}, on = today()) {
  const auditorPrograms = new Set(programs.filter(program => AUDITOR.test(`${program.title || ''} ${program.titleEn || ''} ${program.category || ''}`)).map(program => program.id))
  return team.filter(member => member.employeeId && !member.external).filter(member => {
    const certified = certificates.some(item => item.employeeId === member.employeeId && AUDITOR.test(`${item.title || ''} ${item.titleEn || ''}`) && (!item.validUntil || item.validUntil >= on))
    const trained = assignments.some(item => item.employeeId === member.employeeId && auditorPrograms.has(item.programId) && (item.status === 'completed' || item.completedDate))
    return !certified && !trained
  })
}

// --- The programme --------------------------------------------------------------------------

export const nextAuditDate = (lastDate, riskLevel) => (lastDate ? addMonths(lastDate, riskMonths(riskLevel)) : '')

// Without a planned next audit: the completed one's date plus its frequency (6 months unless set).
export const followingAuditDate = audit => (audit.status === 'completed' && audit.completedDate ? addMonths(audit.completedDate, audit.frequencyMonths || 6) : '')

// A department is audited twice a year (every 6 months unless its audit says
// otherwise) and always has its next audit planned. The database does the same
// when an audit is completed (quality_schedule_next_audit).
const isLiveInternal = audit => audit.lifecycleStatus !== 'voided' && audit.status !== 'cancelled' && (audit.auditType || 'internal') === 'internal' && Boolean(audit.department)
const isOpenAudit = audit => audit.status === 'planned' || audit.status === 'in_progress'

// Per department: audits of the year (done or planned) and whether one is still planned.
export function auditCoverage(audits = [], year = today().slice(0, 4)) {
  const byDepartment = new Map()
  audits.filter(isLiveInternal).forEach(audit => {
    const entry = byDepartment.get(audit.department) || { department: audit.department, inYear: 0, hasNext: false }
    if (String(audit.completedDate || audit.plannedDate || '').startsWith(String(year))) entry.inYear += 1
    if (isOpenAudit(audit)) entry.hasNext = true
    byDepartment.set(audit.department, entry)
  })
  const rows = [...byDepartment.values()]
  return { rows, full: rows.filter(row => row.inYear >= 2).length, half: rows.filter(row => row.inYear === 1).length, none: rows.filter(row => row.inYear === 0).length, noNext: rows.filter(row => !row.hasNext).length }
}

// The next audit of every department that has none open: its last audit's
// standard, questionnaire and lead auditor, a month (the 15th), never in the past.
export function missingNextAudits(audits = [], on = today()) {
  const latest = new Map()
  audits.filter(isLiveInternal).forEach(audit => {
    const key = `${audit.department}|${audit.standard || ''}`
    const when = audit.completedDate || audit.plannedDate || ''
    if (!latest.has(key) || when > (latest.get(key).completedDate || latest.get(key).plannedDate || '')) latest.set(key, audit)
  })
  const open = new Set(audits.filter(audit => isLiveInternal(audit) && isOpenAudit(audit)).map(audit => `${audit.department}|${audit.standard || ''}`))
  return [...latest.entries()].filter(([key]) => !open.has(key)).map(([, last]) => {
    const months = last.frequencyMonths || 6
    const base = String(last.completedDate || last.plannedDate || on).slice(0, 7)
    let due = `${addMonths(`${base}-15`, months).slice(0, 7)}-15`
    if (due < on) due = `${addMonths(`${on.slice(0, 7)}-15`, 1).slice(0, 7)}-15`
    return { ...last, plannedDate: due, completedDate: null, status: 'planned', plannedMonthOnly: true, frequencyMonths: months, findingIds: [], history: [], checklist: [], checklistSource: '' }
  })
}

// The year's planned audits as plans: one per department and month, or the
// month alone when the day is not fixed yet.
export const plannedDay = (year, month, day = 1) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

// Clause coverage of a standard in a year: for each chapter of its
// questionnaire and each department audited for it, whether the chapter was
// audited (with its compliance), is planned, or is a gap.
export function clauseCoverage(audits = [], template, year, departments = []) {
  const chapters = templateChapters(template)
  const inYear = audits.filter(audit => audit.standard === template?.standard && audit.status !== 'cancelled' && audit.lifecycleStatus !== 'voided' && String(audit.plannedDate || audit.completedDate || '').startsWith(String(year)))
  const names = new Map(departments.map(department => [department.name, department]))
  for (const audit of inYear) if (audit.department && !names.has(audit.department)) names.set(audit.department, { name: audit.department })
  const rows = [...names.values()].map(department => {
    const own = inYear.filter(audit => (audit.department || '') === department.name)
    const cells = chapters.map(chapter => {
      const answered = own.flatMap(audit => (audit.checklist || []).filter(row => (row.chapterRef || '') === chapter.ref && row.answer).map(row => ({ ...row, auditId: audit.id, date: audit.completedDate || audit.plannedDate })))
      if (answered.length) {
        const score = auditScore(answered).overall
        return { ref: chapter.ref, state: 'audited', rate: score.rate, answered: answered.length, last: answered.map(row => row.date).sort().at(-1) }
      }
      const planned = own.some(audit => audit.status !== 'completed' && inScope({ chapterRef: chapter.ref, clauseRef: chapter.ref }, audit.clausesScope))
      return { ref: chapter.ref, state: planned ? 'planned' : 'gap', rate: null, answered: 0 }
    })
    return { department: department.name, departmentEn: department.nameEn || department.name, audits: own.length, cells }
  }).filter(row => row.audits > 0)
  const totals = chapters.map((chapter, index) => ({ ref: chapter.ref, audited: rows.filter(row => row.cells[index].state === 'audited').length, planned: rows.filter(row => row.cells[index].state === 'planned').length, gap: rows.filter(row => row.cells[index].state === 'gap').length }))
  return { chapters, rows, totals, uncovered: totals.filter(total => !total.audited).map(total => total.ref) }
}

// --- Dashboard ------------------------------------------------------------------------------

const average = list => (list.length ? round(list.reduce((sum, value) => sum + value, 0) / list.length) : null)

export function auditDashboard(audits = [], findings = [], { year = new Date().getFullYear(), standard = '' } = {}) {
  const live = audits.filter(audit => audit.status !== 'cancelled' && audit.lifecycleStatus !== 'voided')
  const scored = live.map(audit => ({ audit, score: auditScore(audit.checklist || []) })).filter(entry => entry.score.overall.rate != null)
  const inYear = scored.filter(entry => String(entry.audit.completedDate || entry.audit.plannedDate || '').startsWith(String(year)))
  const group = (list, key) => {
    const map = new Map()
    for (const entry of list) { const k = key(entry) || ''; if (!map.has(k)) map.set(k, []); map.get(k).push(entry.score.overall.rate) }
    return [...map.entries()].map(([k, rates]) => ({ key: k, audits: rates.length, rate: average(rates) })).sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101))
  }
  // Compliance by chapter of one standard: every answer of the year, weighted.
  const chosen = standard || inYear[0]?.audit.standard || ''
  const byChapter = new Map()
  for (const { audit } of inYear.filter(entry => entry.audit.standard === chosen)) for (const row of audit.checklist || []) {
    const key = row.chapterRef || ''
    if (!byChapter.has(key)) byChapter.set(key, { ref: key, title: row.chapterTitle || '', rows: [] })
    byChapter.get(key).rows.push(row)
  }
  // Trend: the average compliance of the audits completed in each month, the last 12 months.
  const end = new Date(`${year}-12-01T12:00:00Z`) < new Date() ? new Date(`${year}-12-01T12:00:00Z`) : new Date()
  const months = Array.from({ length: 12 }, (_, index) => { const date = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 11 + index, 15)); return date.toISOString().slice(0, 7) })
  const trend = months.map(month => ({ month, rate: average(scored.filter(entry => String(entry.audit.completedDate || '').startsWith(month)).map(entry => entry.score.overall.rate)), audits: scored.filter(entry => String(entry.audit.completedDate || '').startsWith(month)).length }))
  const auditIds = new Set(audits.map(audit => audit.id))
  const auditFindings = findings.filter(finding => finding.source === 'audit' && auditIds.has(finding.sourceId) && finding.lifecycleStatus !== 'voided')
  const open = auditFindings.filter(finding => finding.status !== 'closed')
  const openByClass = Object.fromEntries(FINDING_CLASSES.map(entry => [entry.value, open.filter(finding => finding.findingClass === entry.value).length]))
  openByClass.unclassified = open.filter(finding => !finding.findingClass).length
  return {
    year,
    standard: chosen,
    audits: inYear.length,
    rate: average(inYear.map(entry => entry.score.overall.rate)),
    byStandard: group(inYear, entry => entry.audit.standard),
    byDepartment: group(inYear, entry => entry.audit.department),
    byChapter: [...byChapter.values()].map(entry => ({ ref: entry.ref, title: entry.title, ...tally(entry.rows) })),
    trend,
    openFindings: open.length,
    overdueFindings: open.filter(finding => finding.dueDate && finding.dueDate < today()).length,
    openByClass,
    findings: auditFindings.length,
  }
}

// What the Management Review reads for a period: per standard the audits and
// their average compliance, the findings by class and those still open.
export function auditReviewSummary(audits = [], findings = [], inPeriod = () => true) {
  const live = audits.filter(audit => audit.lifecycleStatus !== 'voided' && audit.status !== 'cancelled' && inPeriod(audit.completedDate || audit.plannedDate))
  const byStandard = new Map()
  for (const audit of live) {
    const key = audit.standard || 'other'
    if (!byStandard.has(key)) byStandard.set(key, { standard: key, audits: 0, completed: 0, rates: [] })
    const entry = byStandard.get(key)
    entry.audits += 1
    if (audit.status === 'completed') entry.completed += 1
    const rate = auditScore(audit.checklist || []).overall.rate
    if (rate != null) entry.rates.push(rate)
  }
  const ids = new Set(live.map(audit => audit.id))
  const own = findings.filter(finding => finding.source === 'audit' && ids.has(finding.sourceId))
  return {
    standards: [...byStandard.values()].map(entry => ({ standard: entry.standard, audits: entry.audits, completed: entry.completed, rate: average(entry.rates) })),
    findings: Object.fromEntries(FINDING_CLASSES.map(entry => [entry.value, own.filter(finding => finding.findingClass === entry.value).length])),
    open: own.filter(finding => finding.status !== 'closed').length,
    total: own.length,
  }
}

// --- FileMaker --------------------------------------------------------------------------------

// ΙΑΣΩ's FileMaker «Result» on the four-value scale, with the class it implies.
export function fmResult(value) {
  const v = text(value).toLowerCase()
  if (!v) return { answer: '', findingClass: '' }
  if (v.startsWith('πλήρη') || v.startsWith('πληρη')) return { answer: 'yes', findingClass: '' }
  if (v.includes('major') || v.includes('μείζ')) return { answer: 'no', findingClass: 'major' }
  if (v.startsWith('μερική') || v.startsWith('μερικη') || v.includes('minor')) return { answer: 'partial', findingClass: 'minor' }
  if (v.startsWith('παρατήρηση') || v.startsWith('παρατηρηση')) return { answer: 'yes', findingClass: 'observation' }
  if (v.startsWith('πρόταση') || v.startsWith('προταση')) return { answer: 'yes', findingClass: 'opportunity' }
  if (v.startsWith('μη ') || v.includes('μη κάλυψη') || v.includes('μη συμμ')) return { answer: 'no', findingClass: 'minor' }
  if (v.includes('δεν εφαρμ') || v === 'δ/ε' || v === 'n/a') return { answer: 'na', findingClass: '' }
  return { answer: '', findingClass: '' }
}

// The ten FileMaker audit questions («Θέμα: ερώτηση;») and the ISO 9001 clause
// each one audits; they stay as the audit's own questions with that clause.
export const FM_QUESTION_CLAUSES = [
  ['Προσωπικό και Καθήκοντα', '5.3', '5'],
  ['Διαχείριση Πληροφοριών', '7.5.3', '7'],
  ['Αντιμετώπιση Κρίσεων', '8.7', '8'],
  ['Εκπαίδευση και Κατάρτιση', '7.2', '7'],
  ['Πόροι και Υποδομές', '7.1.3', '7'],
  ['Ασφάλεια και Υγεία στην Εργασία', '7.1.4', '7'],
  ['Ποιότητα Εργασιών', '9.1.1', '9'],
  ['Τεκμηρίωση Συνεδριάσεων και Συναντήσεων', '7.4', '7'],
  ['Διαχείριση Συμβάντων', '10.2.1', '10'],
  ['Τήρηση Διαδικασιών', '8.1', '8'],
  ['Το προσωπικό γνωρίζει την πολιτική ποιότητας', '5.2.2', '5'],
]
export function fmQuestionClause(question) {
  const value = text(question)
  const match = FM_QUESTION_CLAUSES.find(([topic]) => value.startsWith(topic))
  return match ? { clauseRef: match[1], chapterRef: match[2] } : { clauseRef: '', chapterRef: '' }
}
// The question text cleaned (typos FileMaker kept), and its topic split off.
export function fmQuestionText(question) {
  return text(question).replace(/Γγνωρίζει/g, 'Γνωρίζει').replace(/σύφωνα/g, 'σύμφωνα').replace(/\s+/g, ' ')
}

// An audit round: the department audits of one month spread over a few working
// days (three by default), as even as possible, in the departments' order, so
// that not every department is audited on the same day. Returns the working days
// and, for each open audit of the round's month, the day it gets. The database
// does the same (quality_plan_audit_round).
export function workingDays(start, count = 3) {
  const days = []
  const date = new Date(`${String(start).slice(0, 10)}T12:00:00Z`)
  while (days.length < Math.max(1, count)) {
    const weekday = date.getUTCDay()
    if (weekday !== 0 && weekday !== 6) days.push(date.toISOString().slice(0, 10))
    date.setUTCDate(date.getUTCDate() + 1)
  }
  return days
}
export function spreadAuditRound(audits = [], start, count = 3) {
  const days = workingDays(start, count)
  const monthOf = String(start).slice(0, 7)
  const open = audits
    .filter(audit => audit.status === 'planned' && audit.lifecycleStatus !== 'voided' && (audit.auditType || 'internal') === 'internal' && audit.department && String(audit.plannedDate || '').slice(0, 7) === monthOf)
    .sort((a, b) => String(a.department).localeCompare(String(b.department), 'el'))
  return { days, assignments: open.map((audit, index) => ({ audit, plannedDate: days[Math.min(days.length - 1, Math.floor(index * days.length / open.length))] })) }
}
