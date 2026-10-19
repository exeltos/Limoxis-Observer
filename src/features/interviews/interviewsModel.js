// Συνεντεύξεις υποψηφίων: the pipeline of an application, the interview evaluation and
// the decision. Pure: the screens, the service and the reports read these.

export const STATUSES = Object.freeze(['new', 'screening', 'interview_scheduled', 'interviewed', 'offer', 'hired', 'rejected', 'withdrawn'])
export const OPEN_STATUSES = Object.freeze(['new', 'screening', 'interview_scheduled', 'interviewed', 'offer'])
const STATUS_LABELS = {
  new: ['Νέα αίτηση', 'New application'], screening: ['Σε έλεγχο', 'Screening'], interview_scheduled: ['Προγραμματισμένη συνέντευξη', 'Interview scheduled'],
  interviewed: ['Έγινε συνέντευξη', 'Interviewed'], offer: ['Πρόταση συνεργασίας', 'Offer'], hired: ['Προσλήφθηκε', 'Hired'], rejected: ['Απορρίφθηκε', 'Rejected'], withdrawn: ['Αποσύρθηκε', 'Withdrawn'],
}
const STATUS_TONES = { new: 'info', screening: 'info', interview_scheduled: 'warning', interviewed: 'info', offer: 'warning', hired: 'success', rejected: 'danger', withdrawn: 'neutral' }

export const EMPLOYMENT_TYPES = { full_time: ['Πλήρης απασχόληση', 'Full time'], part_time: ['Μερική απασχόληση', 'Part time'], seasonal: ['Εποχική', 'Seasonal'], internship: ['Πρακτική άσκηση', 'Internship'], other: ['Άλλο', 'Other'] }
export const GENDERS = { male: ['Άνδρας', 'Male'], female: ['Γυναίκα', 'Female'], other: ['Άλλο', 'Other'] }
export const MILITARY = { done: ['Εκπληρωμένη', 'Completed'], exempt: ['Απαλλαγή', 'Exempt'], not_done: ['Εκκρεμεί', 'Not completed'], not_applicable: ['Δεν αφορά', 'Not applicable'] }
export const MARITAL = { single: ['Άγαμος/η', 'Single'], married: ['Έγγαμος/η', 'Married'], divorced: ['Διαζευγμένος/η', 'Divorced'], widowed: ['Χήρος/α', 'Widowed'], other: ['Άλλο', 'Other'] }
// A language is rated in three skills, each on the same scale (FileMaker: ΕΥΧ = ευχερώς, ΜΕΤΡ = μετρίως).
export const LANGUAGE_SKILLS = Object.freeze([['speaking', 'Ομιλία', 'Speaking'], ['reading', 'Ανάγνωση', 'Reading'], ['writing', 'Γραφή', 'Writing']])
export const LEVELS = { fluent: ['Άριστα (ευχερώς)', 'Excellent (fluent)'], very_good: ['Πολύ καλά', 'Very good'], good: ['Καλά', 'Good'], fair: ['Μέτρια', 'Fair'], basic: ['Βασικά', 'Basic'] }
export const LANGUAGES = { el: ['Ελληνικά', 'Greek'], en: ['Αγγλικά', 'English'], fr: ['Γαλλικά', 'French'], de: ['Γερμανικά', 'German'], it: ['Ιταλικά', 'Italian'], es: ['Ισπανικά', 'Spanish'], sq: ['Αλβανικά', 'Albanian'], ru: ['Ρωσικά', 'Russian'], bg: ['Βουλγαρικά', 'Bulgarian'], ro: ['Ρουμανικά', 'Romanian'], ar: ['Αραβικά', 'Arabic'] }
export const INTERVIEW_STATUSES = { scheduled: ['Προγραμματισμένη', 'Scheduled'], completed: ['Ολοκληρώθηκε', 'Completed'], cancelled: ['Ακυρώθηκε', 'Cancelled'] }
export const OUTCOMES = { recommend: ['Προτείνεται', 'Recommended'], reserve: ['Επιφύλαξη / λίστα αναμονής', 'Reserve list'], not_recommend: ['Δεν προτείνεται', 'Not recommended'] }
export const DECISIONS = { hire: ['Πρόσληψη', 'Hire'], reserve: ['Λίστα αναμονής', 'Reserve list'], reject: ['Απόρριψη', 'Reject'] }
export const INTERVIEWER_ROLES = { evaluator: ['Αξιολογητής', 'Evaluator'], hr: ['Γραφείο Προσωπικού', 'HR office'] }

// The evaluation form: each criterion scored 1–5.
export const CRITERIA = Object.freeze([
  ['presentation', 'Εμφάνιση και επικοινωνία', 'Presentation and communication'],
  ['knowledge', 'Επαγγελματικές γνώσεις', 'Professional knowledge'],
  ['experience', 'Σχετική εμπειρία', 'Relevant experience'],
  ['motivation', 'Κίνητρο και ενδιαφέρον για τη θέση', 'Motivation and interest in the role'],
  ['teamwork', 'Συνεργασία και ομαδικότητα', 'Cooperation and teamwork'],
  ['availability', 'Διαθεσιμότητα (βάρδιες, έναρξη)', 'Availability (shifts, start)'],
])
export const SCORES = Object.freeze([[1, 'Ανεπαρκής', 'Poor'], [2, 'Μέτρια', 'Fair'], [3, 'Καλή', 'Good'], [4, 'Πολύ καλή', 'Very good'], [5, 'Εξαιρετική', 'Excellent']])

const pick = (map, value, language) => (map[value] ? map[value][language === 'en' ? 1 : 0] : value || '')
export const statusLabel = (value, language = 'el') => pick(STATUS_LABELS, value, language)
export const statusTone = value => STATUS_TONES[value] || 'neutral'
export const employmentLabel = (value, language = 'el') => pick(EMPLOYMENT_TYPES, value, language)
export const genderLabel = (value, language = 'el') => pick(GENDERS, value, language)
export const militaryLabel = (value, language = 'el') => pick(MILITARY, value, language)
export const maritalLabel = (value, language = 'el') => pick(MARITAL, value, language)
export const levelLabel = (value, language = 'el') => pick(LEVELS, value, language)
export const languageLabel = (value, language = 'el') => pick(LANGUAGES, value, language)
export const certificateLabel = (row, language = 'el') => (row?.certificate ? [language === 'en' ? 'Certificate' : 'Πιστοποιητικό', row.certificateName].filter(Boolean).join(': ') : row?.certificate === false ? (language === 'en' ? 'No certificate' : 'Χωρίς πιστοποιητικό') : '')
// «Αγγλικά — Ομιλία: Άριστα (ευχερώς) · Ανάγνωση: Καλά · Γραφή: Καλά · Πιστοποιητικό: B2»
export function languageSkillsText(row, language = 'el') {
  const skills = LANGUAGE_SKILLS.filter(([key]) => row?.[key]).map(([key, el, en]) => `${language === 'en' ? en : el}: ${levelLabel(row[key], language)}`)
  return `${languageLabel(row?.language, language)} — ${[...skills, certificateLabel(row, language)].filter(Boolean).join(' · ') || '—'}`
}
export const interviewStatusLabel = (value, language = 'el') => pick(INTERVIEW_STATUSES, value, language)
export const outcomeLabel = (value, language = 'el') => pick(OUTCOMES, value, language)
export const decisionLabel = (value, language = 'el') => pick(DECISIONS, value, language)
export const interviewerRoleLabel = (value, language = 'el') => pick(INTERVIEWER_ROLES, value, language)
export const outcomeTone = value => (value === 'recommend' ? 'success' : value === 'not_recommend' ? 'danger' : value === 'reserve' ? 'warning' : 'neutral')
export const options = (map, language = 'el') => Object.entries(map).map(([value, labels]) => ({ value, label: labels[language === 'en' ? 1 : 0] }))
export const statusOptions = (language = 'el') => STATUSES.map(value => ({ value, label: statusLabel(value, language) }))
export const yesNo = (value, language = 'el') => (value == null || value === '' ? '—' : value ? (language === 'en' ? 'Yes' : 'Ναι') : (language === 'en' ? 'No' : 'Όχι'))

export const todayKey = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
export const fmtDay = value => { if (!value) return '—'; const [y, m, d] = String(value).slice(0, 10).split('-'); return d ? `${d}/${m}/${y}` : String(value) }
export function fmtStamp(value, language = 'el') {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
}
export const fmtMoney = (value, language = 'el') => (value === '' || value == null || Number.isNaN(Number(value)) ? '—' : `${new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'el-GR', { maximumFractionDigits: 2 }).format(Number(value))} €`)
export function ageOn(birthDate, today = todayKey()) {
  if (!birthDate) return null
  const [by, bm, bd] = String(birthDate).slice(0, 10).split('-').map(Number), [ty, tm, td] = String(today).slice(0, 10).split('-').map(Number)
  if (!by || !ty) return null
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0)
}

// The overall rating: the mean of the criteria scored (1–5), one decimal.
export function overallRating(scores = {}) {
  const values = Object.values(scores || {}).map(Number).filter(value => Number.isFinite(value) && value >= 1 && value <= 5)
  if (!values.length) return null
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
}
export const ratingTone = value => (value == null ? 'neutral' : value >= 4 ? 'success' : value >= 3 ? 'info' : 'danger')
export const fmtRating = (value, language = 'el') => (value == null || value === '' ? '—' : `${Number(value).toLocaleString(language === 'en' ? 'en-GB' : 'el-GR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} / 5`)

// How many applications are at each step of the pipeline.
export function pipelineCounts(candidates = []) {
  const counts = Object.fromEntries(STATUSES.map(status => [status, 0]))
  for (const item of candidates) if (item.status in counts) counts[item.status] += 1
  return { ...counts, total: candidates.length, open: OPEN_STATUSES.reduce((sum, status) => sum + counts[status], 0) }
}
export const positionsOf = candidates => [...new Set(candidates.map(item => String(item.requestedPosition || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'el'))

const fold = value => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
export function filterCandidates(candidates = [], { query = '', status = 'all', position = 'all', source = 'all' } = {}) {
  const needle = fold(query).trim()
  return candidates.filter(item => (status === 'all' || (status === 'open' ? OPEN_STATUSES.includes(item.status) : item.status === status))
    && (position === 'all' || String(item.requestedPosition || '').trim() === position)
    && (source === 'all' || item.source === source)
    && (!needle || fold([item.code, item.fullName, item.email, item.phoneMobile, item.phoneLandline, item.requestedPosition, item.area].join(' ')).includes(needle)))
}

// An application's interviews in order, the next one to come and the latest evaluated.
export const sortedInterviews = candidate => [...(candidate?.interviews || [])].sort((a, b) => String(a.scheduledAt || a.evaluatedAt || a.createdAt || '').localeCompare(String(b.scheduledAt || b.evaluatedAt || b.createdAt || '')))
export function nextInterview(candidate, now = new Date().toISOString()) {
  return sortedInterviews(candidate).find(item => item.status === 'scheduled' && item.scheduledAt && item.scheduledAt >= now.slice(0, 16)) || sortedInterviews(candidate).find(item => item.status === 'scheduled') || null
}
export function latestEvaluation(candidate) {
  return [...sortedInterviews(candidate)].reverse().find(item => item.status === 'completed') || null
}
// The interviews to come, across all applications.
export function upcomingInterviews(candidates = [], now = new Date().toISOString()) {
  return candidates.flatMap(candidate => (candidate.interviews || []).filter(item => item.status === 'scheduled' && item.scheduledAt && item.scheduledAt >= now.slice(0, 10)).map(item => ({ ...item, candidate })))
    .sort((a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt)))
}

// What a step moves the application to (never back from a later step).
const RANK = { new: 0, screening: 1, interview_scheduled: 2, interviewed: 3, offer: 4, hired: 5, rejected: 5, withdrawn: 5 }
export const statusAfterSchedule = current => (RANK[current] < RANK.interview_scheduled ? 'interview_scheduled' : current)
export const statusAfterEvaluation = current => (RANK[current] < RANK.interviewed ? 'interviewed' : current)
export const statusAfterDecision = (decision, current) => (current === 'hired' ? 'hired' : decision === 'hire' ? 'offer' : decision === 'reject' ? 'rejected' : decision === 'reserve' ? (RANK[current] < RANK.interviewed ? current : 'interviewed') : current)

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// What is missing before an application can be saved.
export function candidateProblems(candidate, language = 'el', today = todayKey()) {
  const en = language === 'en'
  const out = []
  if (!String(candidate.fullName || '').trim()) out.push(en ? 'full name' : 'ονοματεπώνυμο')
  if (!candidate.consentGiven && (candidate.source || 'app') === 'app') out.push(en ? 'consent to the processing of personal data' : 'συναίνεση για την επεξεργασία προσωπικών δεδομένων')
  if (candidate.email && !EMAIL.test(String(candidate.email).trim())) out.push(en ? 'a valid email' : 'έγκυρο email')
  if (candidate.birthDate && String(candidate.birthDate) > today) out.push(en ? 'a birth date in the past' : 'ημερομηνία γέννησης στο παρελθόν')
  if (candidate.children !== '' && candidate.children != null && !(Number(candidate.children) >= 0 && Number(candidate.children) <= 30)) out.push(en ? 'number of children 0–30' : 'αριθμό παιδιών 0–30')
  for (const row of candidate.employers || []) if (row.fromOn && row.toOn && row.toOn < row.fromOn) { out.push(en ? 'employer dates in order' : 'σωστή σειρά ημερομηνιών εργοδότη'); break }
  return out
}
// A scheduled interview needs its date and time; an evaluation scores and an outcome.
export function interviewProblems(interview, language = 'el', { evaluation = false } = {}) {
  const en = language === 'en'
  const out = []
  if (!evaluation && !interview.scheduledAt) out.push(en ? 'date and time' : 'ημερομηνία και ώρα')
  if (evaluation) {
    if (overallRating(interview.scores) == null) out.push(en ? 'at least one score' : 'τουλάχιστον μία βαθμολογία')
    if (!interview.outcome) out.push(en ? 'the recommendation' : 'την πρόταση')
    if (!(interview.interviewers || []).some(item => String(item.name || '').trim())) out.push(en ? 'an evaluator' : 'αξιολογητή')
  }
  return out
}
export function decisionProblems(draft, language = 'el') {
  const en = language === 'en'
  const out = []
  if (!draft.decision) out.push(en ? 'the decision' : 'την απόφαση')
  if (!draft.decisionOn) out.push(en ? 'the date' : 'την ημερομηνία')
  if (draft.decision === 'reject' && !String(draft.decisionNotes || '').trim()) out.push(en ? 'the reason' : 'την αιτιολογία')
  return out
}

export const newCandidate = (today = todayKey()) => ({ id: '', code: '', fullName: '', gender: '', fatherName: '', motherName: '', birthDate: '', birthPlace: '', nationality: '', citizenship: '', idNumber: '', idAuthority: '', idIssuedOn: '',
  address: '', area: '', postcode: '', phoneLandline: '', phoneMobile: '', email: '', requestedPosition: '', employmentType: '', militaryService: '', workPermit: null, practiceLicence: null, smoker: null,
  maritalStatus: '', children: '', educationLevel: '', education: [], itSkills: '', activities: '', whyUs: '', applicationReason: '', appliedOn: today, consentGiven: false, consentAt: '', consentText: '',
  status: 'new', decision: '', decisionOn: '', decisionByName: '', decisionNotes: '', employeeId: '', source: 'app', notes: '', languages: [], employers: [], interviews: [] })
export const newEducation = () => ({ level: '', school: '', title: '', year: '', completed: true })
export const newLanguage = () => ({ id: '', language: '', reading: '', writing: '', speaking: '', certificate: null, certificateName: '' })
export const newEmployer = () => ({ id: '', employer: '', fromOn: '', toOn: '', jobTitle: '', salary: '', leavingReason: '' })
export const newInterview = candidateId => ({ id: '', candidateId, scheduledAt: '', location: '', status: 'scheduled', interviewers: [], scores: {}, overallRating: null, outcome: '', recommendation: '', strengths: '', weaknesses: '', salaryExpectation: '', offeredSalary: '', benefits: '', availableFrom: '', evaluatedAt: '', evaluatedByName: '', notes: '', source: 'app' })

// The employee a hired candidate becomes: «ΕΠΩΝΥΜΟ ΟΝΟΜΑ» as the registry writes it.
export function splitFullName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return { lastName: parts[0] || '', firstName: '' }
  return { lastName: parts[0], firstName: parts.slice(1).join(' ') }
}
export function employeeDraftFor(candidate, today = todayKey()) {
  const { firstName, lastName } = splitFullName(candidate.fullName)
  return { employeeCode: '', firstName, lastName, fatherName: candidate.fatherName || '', email: candidate.email || '', phone: candidate.phoneMobile || candidate.phoneLandline || '', birthDate: candidate.birthDate || '', position: candidate.requestedPosition || '', department: '', profession: '', employmentStatus: 'active', hireDate: today }
}
// An employee already in the registry with the candidate's name (either order) or email.
export function matchingEmployees(candidate, employees = []) {
  const name = fold(candidate.fullName).replace(/\s+/g, ' ').trim()
  const email = fold(candidate.email).trim()
  return employees.filter(item => {
    const a = fold(`${item.lastName} ${item.firstName}`).replace(/\s+/g, ' ').trim(), b = fold(`${item.firstName} ${item.lastName}`).replace(/\s+/g, ' ').trim()
    return (name && (name === a || name === b)) || (email && fold(item.email).trim() === email)
  })
}
