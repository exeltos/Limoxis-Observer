// Satisfaction surveys (ISO 9001 §9.1.2): the questionnaires, the templates a
// hospital starts from, and what the answers say. A survey's answers never
// carry who gave them.

export const SURVEY_AUDIENCES = [
  { value: 'patients', label: ['Ασθενείς', 'Patients'] },
  { value: 'staff', label: ['Προσωπικό', 'Staff'] },
  { value: 'visitors', label: ['Συνοδοί / επισκέπτες', 'Companions / visitors'] },
  { value: 'other', label: ['Άλλοι', 'Others'] },
]

export const SURVEY_STATUSES = [
  { value: 'draft', label: ['Προσχέδιο', 'Draft'], tone: 'info' },
  { value: 'open', label: ['Σε εξέλιξη', 'Open'], tone: 'success' },
  { value: 'closed', label: ['Ολοκληρώθηκε', 'Closed'], tone: 'neutral' },
]

export const QUESTION_TYPES = [
  { value: 'rating', label: ['Κλίμακα 1–5', 'Scale 1–5'] },
  { value: 'nps', label: ['Σύσταση 0–10', 'Recommend 0–10'] },
  { value: 'yesno', label: ['Ναι / Όχι', 'Yes / No'] },
  { value: 'single', label: ['Μία επιλογή', 'Single choice'] },
  { value: 'multiple', label: ['Πολλαπλή επιλογή', 'Multiple choice'] },
  { value: 'text', label: ['Ελεύθερο κείμενο', 'Free text'] },
]

export const RESPONSE_CHANNELS = [
  { value: 'link', label: ['Σύνδεσμος / QR', 'Link / QR'] },
  { value: 'tablet', label: ['Tablet στο τμήμα', 'Tablet at the ward'] },
  { value: 'paper', label: ['Έντυπο', 'Paper form'] },
]

const pick = (list, value, language) => list.find(item => item.value === value)?.label[language === 'en' ? 1 : 0] || value || ''
export const audienceLabel = (value, language) => pick(SURVEY_AUDIENCES, value, language)
export const surveyStatusLabel = (value, language) => pick(SURVEY_STATUSES, value, language)
export const surveyStatusTone = value => SURVEY_STATUSES.find(item => item.value === value)?.tone || 'neutral'
export const questionTypeLabel = (value, language) => pick(QUESTION_TYPES, value, language)
export const channelLabel = (value, language) => pick(RESPONSE_CHANNELS, value, language)
export const textOf = (item, language) => (language === 'en' ? item?.labelEn || item?.titleEn || item?.label || item?.title : item?.label || item?.title) || ''

// The labels a 1–5 scale shows.
export const RATING_LABELS = [
  ['Πολύ κακή', 'Very poor'], ['Κακή', 'Poor'], ['Μέτρια', 'Fair'], ['Καλή', 'Good'], ['Πολύ καλή', 'Very good'],
]

// --- Templates ----------------------------------------------------------------------

const q = (id, section, type, label, labelEn, extra = {}) => ({ id, section, type, label, labelEn, required: type !== 'text', options: [], ...extra })
const opt = (value, label, labelEn) => ({ value, label, labelEn })

const INPATIENT = [
  q('admission_welcome', 'admission', 'rating', 'Υποδοχή και εξυπηρέτηση κατά την εισαγωγή', 'Welcome and service on admission'),
  q('admission_wait', 'admission', 'rating', 'Χρόνος αναμονής για την εισαγωγή', 'Waiting time for admission'),
  q('nursing_courtesy', 'nursing', 'rating', 'Ευγένεια και σεβασμός από το νοσηλευτικό προσωπικό', 'Courtesy and respect from the nurses'),
  q('nursing_response', 'nursing', 'rating', 'Ανταπόκριση όταν χρειαστήκατε βοήθεια', 'Response when you needed help'),
  q('doctor_courtesy', 'medical', 'rating', 'Ευγένεια και σεβασμός από τους ιατρούς', 'Courtesy and respect from the doctors'),
  q('doctor_information', 'medical', 'rating', 'Ενημέρωση για την κατάστασή σας και τη θεραπεία', 'Information about your condition and treatment'),
  q('pain', 'medical', 'rating', 'Αντιμετώπιση του πόνου', 'Pain management'),
  q('privacy', 'environment', 'rating', 'Σεβασμός της ιδιωτικότητάς σας', 'Respect for your privacy'),
  q('cleanliness', 'environment', 'rating', 'Καθαριότητα θαλάμου και χώρων υγιεινής', 'Cleanliness of the room and bathrooms'),
  q('quiet', 'environment', 'rating', 'Ησυχία, ιδίως τη νύχτα', 'Quiet, especially at night'),
  q('food', 'environment', 'rating', 'Ποιότητα φαγητού', 'Quality of the food'),
  q('discharge_information', 'discharge', 'rating', 'Οδηγίες για μετά την έξοδο (φάρμακα, επόμενα βήματα)', 'Instructions for after discharge (medicines, next steps)'),
  q('hand_hygiene', 'safety', 'yesno', 'Είδατε το προσωπικό να καθαρίζει τα χέρια του πριν σας εξετάσει;', 'Did you see staff clean their hands before examining you?'),
  q('identity_check', 'safety', 'yesno', 'Επιβεβαίωναν το όνομά σας πριν από φάρμακα ή εξετάσεις;', 'Did they confirm your name before medicines or tests?'),
  q('overall', 'overall', 'rating', 'Συνολική ικανοποίηση από τη νοσηλεία', 'Overall satisfaction with your stay'),
  q('recommend', 'overall', 'nps', 'Πόσο πιθανό είναι να προτείνετε το νοσοκομείο σε φίλο ή συγγενή;', 'How likely are you to recommend the hospital to a friend or relative?'),
  q('best', 'comments', 'text', 'Τι σας άρεσε περισσότερο;', 'What did you like most?'),
  q('improve', 'comments', 'text', 'Τι να βελτιώσουμε;', 'What should we improve?'),
]

const OUTPATIENT = [
  q('appointment', 'access', 'rating', 'Ευκολία να κλείσετε ραντεβού ή να εξυπηρετηθείτε', 'Ease of getting an appointment or being seen'),
  q('wait', 'access', 'rating', 'Χρόνος αναμονής μέχρι να σας δουν', 'Waiting time until you were seen'),
  q('reception', 'access', 'rating', 'Εξυπηρέτηση στη γραμματεία', 'Service at the front desk'),
  q('courtesy', 'care', 'rating', 'Ευγένεια και σεβασμός από το προσωπικό', 'Courtesy and respect from the staff'),
  q('information', 'care', 'rating', 'Κατανοητή ενημέρωση για το τι έχετε και τι πρέπει να κάνετε', 'Clear information about your condition and what to do'),
  q('cleanliness', 'care', 'rating', 'Καθαριότητα χώρων', 'Cleanliness of the premises'),
  q('overall', 'overall', 'rating', 'Συνολική ικανοποίηση από την επίσκεψη', 'Overall satisfaction with your visit'),
  q('recommend', 'overall', 'nps', 'Πόσο πιθανό είναι να προτείνετε το νοσοκομείο σε φίλο ή συγγενή;', 'How likely are you to recommend the hospital to a friend or relative?'),
  q('improve', 'comments', 'text', 'Τι να βελτιώσουμε;', 'What should we improve?'),
]

const STAFF = [
  q('workload', 'work', 'rating', 'Ο φόρτος εργασίας είναι διαχειρίσιμος', 'The workload is manageable'),
  q('equipment', 'work', 'rating', 'Έχω τον εξοπλισμό και τα υλικά που χρειάζομαι', 'I have the equipment and supplies I need'),
  q('training', 'work', 'rating', 'Η εκπαίδευση που λαμβάνω επαρκεί για τον ρόλο μου', 'The training I receive is enough for my role'),
  q('communication', 'team', 'rating', 'Η επικοινωνία μέσα στο τμήμα', 'Communication within the department'),
  q('management', 'team', 'rating', 'Η στήριξη από τους προϊσταμένους', 'Support from my managers'),
  q('safety_culture', 'safety', 'rating', 'Μπορώ να αναφέρω ένα λάθος χωρίς φόβο', 'I can report a mistake without fear'),
  q('safety_feedback', 'safety', 'yesno', 'Μαθαίνω τι άλλαξε μετά από αναφορές συμβάντων;', 'Do I learn what changed after incident reports?'),
  q('improve_areas', 'safety', 'multiple', 'Πού χρειάζεται βελτίωση;', 'Where is improvement needed?', { required: false, options: [opt('staffing', 'Στελέχωση', 'Staffing'), opt('equipment', 'Εξοπλισμός', 'Equipment'), opt('training', 'Εκπαίδευση', 'Training'), opt('communication', 'Επικοινωνία', 'Communication'), opt('shifts', 'Βάρδιες', 'Shifts'), opt('facilities', 'Χώροι', 'Facilities')] }),
  q('overall', 'overall', 'rating', 'Συνολική ικανοποίηση από την εργασία μου', 'Overall satisfaction with my work'),
  q('recommend', 'overall', 'nps', 'Πόσο πιθανό είναι να προτείνετε το νοσοκομείο ως χώρο εργασίας;', 'How likely are you to recommend the hospital as a place to work?'),
  q('comments', 'comments', 'text', 'Προτάσεις', 'Suggestions'),
]

const SECTIONS = {
  admission: ['Εισαγωγή', 'Admission'], nursing: ['Νοσηλευτική φροντίδα', 'Nursing care'], medical: ['Ιατρική φροντίδα', 'Medical care'],
  environment: ['Περιβάλλον', 'Environment'], discharge: ['Έξοδος', 'Discharge'], safety: ['Ασφάλεια', 'Safety'], overall: ['Συνολικά', 'Overall'],
  comments: ['Σχόλια', 'Comments'], access: ['Πρόσβαση και αναμονή', 'Access and waiting'], care: ['Εξυπηρέτηση', 'Care'], work: ['Εργασία', 'Work'], team: ['Ομάδα', 'Team'],
}
export const sectionLabel = (key, language) => SECTIONS[key]?.[language === 'en' ? 1 : 0] || key || ''

export const SURVEY_TEMPLATES = [
  { key: 'inpatient', audience: 'patients', title: 'Ικανοποίηση νοσηλευόμενων ασθενών', titleEn: 'Inpatient satisfaction', description: 'Πείτε μας πώς ήταν η νοσηλεία σας. Συμπληρώνεται κατά την έξοδο.', descriptionEn: 'Tell us how your stay was. Filled in on discharge.', questions: INPATIENT },
  { key: 'outpatient', audience: 'patients', title: 'Ικανοποίηση εξωτερικών ασθενών και ΤΕΠ', titleEn: 'Outpatient and emergency satisfaction', description: 'Πείτε μας πώς ήταν η επίσκεψή σας στα εξωτερικά ιατρεία ή στο ΤΕΠ.', descriptionEn: 'Tell us how your visit to the outpatient clinics or the emergency department was.', questions: OUTPATIENT },
  { key: 'staff', audience: 'staff', title: 'Ικανοποίηση προσωπικού', titleEn: 'Staff satisfaction', description: 'Ετήσια έρευνα για το εργασιακό περιβάλλον και την κουλτούρα ασφάλειας.', descriptionEn: 'Yearly survey of the work environment and safety culture.', questions: STAFF },
  { key: 'blank', audience: 'patients', title: 'Νέα έρευνα', titleEn: 'New survey', description: '', descriptionEn: '', questions: [] },
]

export function surveyFromTemplate(key) {
  const template = SURVEY_TEMPLATES.find(item => item.key === key) || SURVEY_TEMPLATES[0]
  return {
    id: '', code: '', templateKey: template.key, audience: template.audience, title: template.title, titleEn: template.titleEn,
    description: template.description, descriptionEn: template.descriptionEn, departmentIds: [], questions: structuredClone(template.questions),
    status: 'draft', opensOn: '', closesOn: '', targetResponses: '', satisfiedTarget: 80, publicToken: '',
  }
}

// SRV-2026-01, SRV-2026-02… numbered within the year.
export function nextSurveyCode(codes = [], year = new Date().getFullYear()) {
  const numbers = codes.map(code => Number(String(code || '').match(new RegExp(`^SRV-${year}-(\\d+)$`))?.[1] || 0))
  return `SRV-${year}-${String(Math.max(0, ...numbers) + 1).padStart(2, '0')}`
}

// Whether a survey takes answers on a given day.
export function isSurveyOpen(survey, today = new Date().toISOString().slice(0, 10)) {
  return survey?.status === 'open' && (!survey.opensOn || survey.opensOn <= today) && (!survey.closesOn || survey.closesOn >= today)
}

// What a survey needs before it opens.
export function surveyProblems(survey, language = 'el') {
  const en = language === 'en', problems = []
  if (!String(survey.title || '').trim()) problems.push(en ? 'A title' : 'Τίτλος')
  if (!survey.questions?.length) problems.push(en ? 'At least one question' : 'Τουλάχιστον μία ερώτηση')
  for (const question of survey.questions || []) {
    if (!String(question.label || '').trim()) { problems.push(en ? 'Every question needs its text' : 'Κάθε ερώτηση θέλει κείμενο'); break }
  }
  for (const question of survey.questions || []) {
    if (['single', 'multiple'].includes(question.type) && (question.options || []).filter(item => String(item.label || '').trim()).length < 2) { problems.push(en ? 'Choice questions need at least two options' : 'Οι ερωτήσεις επιλογής θέλουν τουλάχιστον δύο επιλογές'); break }
  }
  if (survey.opensOn && survey.closesOn && survey.closesOn < survey.opensOn) problems.push(en ? 'The end comes before the start' : 'Η λήξη είναι πριν από την έναρξη')
  return problems
}

// The answers a respondent gave, kept as the database keeps them: only the
// survey's questions, each value of its kind. Null when a required one is missing.
export function cleanAnswers(questions = [], answers = {}) {
  const kept = {}
  for (const question of questions) {
    const value = answers[question.id]
    const empty = value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)
    if (empty) { if (question.required) return null; continue }
    const allowed = (question.options || []).map(item => item.value)
    if (question.type === 'rating' && [1, 2, 3, 4, 5].includes(value)) kept[question.id] = value
    else if (question.type === 'nps' && Number.isInteger(value) && value >= 0 && value <= 10) kept[question.id] = value
    else if (question.type === 'yesno' && typeof value === 'boolean') kept[question.id] = value
    else if (question.type === 'single' && allowed.includes(value)) kept[question.id] = value
    else if (question.type === 'multiple' && Array.isArray(value) && value.every(item => allowed.includes(item))) kept[question.id] = value
    else if (question.type === 'text' && typeof value === 'string') kept[question.id] = value.trim().slice(0, 2000)
    else if (question.required) return null
  }
  return Object.keys(kept).length ? kept : null
}

// --- Analysis -----------------------------------------------------------------------

const round = value => (value == null || !Number.isFinite(value) ? null : Math.round(value * 10) / 10)
const share = (part, whole) => (whole ? round((part / whole) * 100) : null)
const monthOf = value => String(value || '').slice(0, 7)

// One question's answers: how many, the mean and the share satisfied (4–5) of a
// scale, the score of a recommendation question (promoters 9–10 minus detractors
// 0–6), the share of Yes, the count of each option, the texts.
export function questionResult(question, responses = []) {
  const values = responses.map(response => response.answers?.[question.id]).filter(value => value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && !value.length))
  const result = { question, count: values.length }
  if (question.type === 'rating') {
    const numbers = values.map(Number).filter(Number.isFinite)
    result.mean = numbers.length ? round(numbers.reduce((sum, value) => sum + value, 0) / numbers.length) : null
    result.satisfied = share(numbers.filter(value => value >= 4).length, numbers.length)
    result.distribution = [1, 2, 3, 4, 5].map(score => numbers.filter(value => value === score).length)
  } else if (question.type === 'nps') {
    const numbers = values.map(Number).filter(Number.isFinite)
    const promoters = numbers.filter(value => value >= 9).length, detractors = numbers.filter(value => value <= 6).length
    result.promoters = share(promoters, numbers.length)
    result.detractors = share(detractors, numbers.length)
    result.nps = numbers.length ? Math.round(((promoters - detractors) / numbers.length) * 100) : null
    result.distribution = Array.from({ length: 11 }, (_, score) => numbers.filter(value => value === score).length)
  } else if (question.type === 'yesno') {
    result.yes = share(values.filter(value => value === true).length, values.length)
  } else if (['single', 'multiple'].includes(question.type)) {
    result.options = (question.options || []).map(item => {
      const count = values.filter(value => (Array.isArray(value) ? value.includes(item.value) : value === item.value)).length
      return { ...item, count, share: share(count, values.length) }
    })
  } else if (question.type === 'text') {
    result.texts = responses.filter(response => String(response.answers?.[question.id] || '').trim()).map(response => ({ id: response.id, text: response.answers[question.id], department: response.department || '', departmentEn: response.departmentEn || response.department || '', submittedAt: response.submittedAt }))
  }
  return result
}

// The survey's headline figures: responses, the share of satisfied answers over
// every 1–5 question, the recommendation score, and the questions below target.
export function surveySummary(survey, responses = []) {
  const results = (survey.questions || []).map(question => questionResult(question, responses))
  const ratings = results.filter(result => result.question.type === 'rating')
  const answered = ratings.reduce((sum, result) => sum + result.count, 0)
  const satisfiedAnswers = ratings.reduce((sum, result) => sum + (result.distribution?.[3] || 0) + (result.distribution?.[4] || 0), 0)
  const recommend = results.find(result => result.question.type === 'nps')
  const target = Number(survey.satisfiedTarget) || 80
  return {
    responses: responses.length,
    satisfied: share(satisfiedAnswers, answered),
    nps: recommend?.nps ?? null,
    target,
    progress: survey.targetResponses ? Math.min(100, Math.round((responses.length / Number(survey.targetResponses)) * 100)) : null,
    // Few answers make a share unreliable: below 10 a question is not flagged.
    below: ratings.filter(result => result.count >= 10 && result.satisfied != null && result.satisfied < target).sort((a, b) => a.satisfied - b.satisfied),
    comments: results.filter(result => result.question.type === 'text').reduce((sum, result) => sum + result.texts.length, 0),
    results,
  }
}

// The same figures for each department the responses are about.
export function departmentBreakdown(survey, responses = [], language = 'el') {
  const en = language === 'en'
  const groups = new Map()
  for (const response of responses) {
    const key = response.departmentId || ''
    const group = groups.get(key) || { key, department: (en ? response.departmentEn : response.department) || response.department || (en ? 'No department' : 'Χωρίς τμήμα'), responses: [] }
    group.responses.push(response)
    groups.set(key, group)
  }
  return [...groups.values()].map(group => ({ ...group, ...surveySummary(survey, group.responses) })).sort((a, b) => b.responses - a.responses)
}

// Satisfied share and responses month by month, the oldest first.
export function monthlyTrend(survey, responses = []) {
  const months = [...new Set(responses.map(response => monthOf(response.submittedAt)).filter(Boolean))].sort()
  return months.map(month => {
    const own = responses.filter(response => monthOf(response.submittedAt) === month)
    const summary = surveySummary(survey, own)
    return { month, responses: own.length, satisfied: summary.satisfied, nps: summary.nps }
  })
}

// The responses that match the filters of the results screen.
export function filterResponses(responses = [], { query = '', department = 'all', channel = 'all', from = '', to = '' } = {}) {
  const q = String(query || '').trim().toLowerCase()
  return responses
    .filter(response => !q || Object.values(response.answers || {}).some(value => typeof value === 'string' && value.toLowerCase().includes(q)))
    .filter(response => department === 'all' || (response.departmentId || '') === department)
    .filter(response => channel === 'all' || response.channel === channel)
    .filter(response => !from || String(response.submittedAt).slice(0, 10) >= from)
    .filter(response => !to || String(response.submittedAt).slice(0, 10) <= to)
}

// CSV for Excel: one row per response, one column per question.
export function responsesExport(survey, responses = [], language = 'el') {
  const en = language === 'en'
  const value = (question, answer) => {
    if (answer === undefined || answer === null) return ''
    if (question.type === 'yesno') return answer ? (en ? 'Yes' : 'Ναι') : (en ? 'No' : 'Όχι')
    if (question.type === 'single') return textOf((question.options || []).find(item => item.value === answer), language) || answer
    if (question.type === 'multiple') return (Array.isArray(answer) ? answer : [answer]).map(item => textOf((question.options || []).find(option => option.value === item), language) || item).join(', ')
    return answer
  }
  return {
    name: `${survey.code || 'survey'}_${en ? 'responses' : 'apantiseis'}`,
    headers: [en ? 'Date' : 'Ημερομηνία', en ? 'Department' : 'Τμήμα', en ? 'Channel' : 'Τρόπος', ...(survey.questions || []).map(question => textOf(question, language))],
    rows: responses.map(response => [String(response.submittedAt || '').slice(0, 10), (en ? response.departmentEn : response.department) || response.department || '', channelLabel(response.channel, language), ...(survey.questions || []).map(question => value(question, response.answers?.[question.id]))]),
  }
}
