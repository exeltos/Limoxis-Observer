// Το επιδημιολογικό ερωτηματολόγιο επιτήρησης: ορισμός ερωτήσεων, κανόνες και υπολογισμοί.
// ΕΝΑ ερωτηματολόγιο ανά επεισόδιο· η προέλευση και οι παράγοντες κινδύνου ΔΕΝ αποθηκεύονται,
// υπολογίζονται εδώ από τις απαντήσεις και τις ημερομηνίες. Σχεδιασμός: docs/design/epi-questionnaire/.
// Η διατύπωση των ερωτήσεων και οι χρονικοί κανόνες προέρχονται από το σχέδιο και χρειάζονται
// κλινική επαλήθευση από τον ιδιοκτήτη (βλ. docs/EPI_QUESTIONNAIRE.md).

export const EPI_ANSWER = Object.freeze({ YES: 'yes', NO: 'no', UNKNOWN: 'unknown' })
export const EPI_ANSWERS = Object.freeze([EPI_ANSWER.YES, EPI_ANSWER.NO, EPI_ANSWER.UNKNOWN])
export const EPI_SOURCE = Object.freeze({ MANUAL: 'manual', PREFILL: 'prefill', PREFILL_EDITED: 'prefill_edited' })

export const EPI_STEPS = Object.freeze([
  { id: 1, title: { el: 'Πρόσφατη φροντίδα υγείας', en: 'Recent healthcare' }, hint: { el: 'Τι έχει προηγηθεί πριν από αυτή την επιτήρηση.', en: 'What came before this surveillance.' } },
  { id: 2, title: { el: 'Συσκευές και επεμβάσεις', en: 'Devices and procedures' }, hint: { el: 'Όσα υπάρχουν ήδη στον φάκελο εμφανίζονται προσυμπληρωμένα.', en: 'What is already in the record is prefilled.' } },
  { id: 3, title: { el: 'Ιστορικό και ευαλωτότητα', en: 'History and vulnerability' }, hint: { el: 'Γνωστά στοιχεία του ασθενούς πριν από τη νοσηλεία.', en: 'What is known about the patient before the stay.' } },
])

// `risk`: counts as a risk factor when answered «Ναι». `prefill`: where the system can suggest the answer.
export const EPI_QUESTIONS = Object.freeze([
  { key: 'antibiotics_90d', step: 1, core: true, risk: { el: 'πρόσφατα αντιβιοτικά', en: 'recent antibiotics' }, windowDays: 90, prefill: 'therapy',
    label: { el: 'Πήρε αντιβιοτικά τις τελευταίες 90 ημέρες;', en: 'Has the patient received antibiotics in the last 90 days?' }, short: { el: 'Αντιβιοτικά (90 ημέρες)', en: 'Antibiotics (90 days)' } },
  { key: 'icu_stay', step: 1, core: true, risk: { el: 'ΜΕΘ', en: 'ICU' }, windowDays: 90, prefill: 'icu',
    label: { el: 'Νοσηλεύτηκε σε ΜΕΘ (τώρα ή σε προηγούμενη νοσηλεία);', en: 'Has the patient been in an ICU (now or in a previous stay)?' }, short: { el: 'Νοσηλεία σε ΜΕΘ', en: 'ICU stay' } },
  { key: 'transfer_from_facility', step: 1, core: true, risk: { el: 'μεταφορά από άλλο νοσοκομείο', en: 'transfer from another hospital' }, windowDays: 90, prefill: 'admission',
    label: { el: 'Ήρθε από άλλο νοσοκομείο ή μονάδα φροντίδας;', en: 'Did the patient come from another hospital or care facility?' }, short: { el: 'Μεταφορά από άλλη δομή υγείας', en: 'Transfer from another facility' } },
  { key: 'other_admission_90d', step: 1, core: false, risk: { el: 'άλλη νοσηλεία', en: 'another recent stay' }, windowDays: 90, prefill: null,
    label: { el: 'Άλλη νοσηλεία τις τελευταίες 90 ημέρες;', en: 'Any other hospital stay in the last 90 days?' }, short: { el: 'Άλλη νοσηλεία (90 ημέρες)', en: 'Other stay (90 days)' } },
  { key: 'invasive_device_48h', step: 2, core: false, risk: null, windowDays: 2, prefill: 'devices',
    label: { el: 'Έχει επεμβατική συσκευή τώρα ή τις τελευταίες 48 ώρες;', en: 'Has the patient had an invasive device now or in the last 48 hours?' }, short: { el: 'Επεμβατικές συσκευές (48 ώρες)', en: 'Invasive devices (48 hours)' } },
  { key: 'surgery_30d', step: 2, core: false, risk: null, windowDays: 30, prefill: null,
    label: { el: 'Έγινε επέμβαση τις τελευταίες 30 ημέρες;', en: 'Has the patient had surgery in the last 30 days?' }, short: { el: 'Επέμβαση (30 ημέρες)', en: 'Surgery (30 days)' } },
  { key: 'dialysis', step: 2, core: false, risk: null, windowDays: null, prefill: null,
    label: { el: 'Κάνει αιμοκάθαρση;', en: 'Is the patient on dialysis?' }, short: { el: 'Αιμοκάθαρση', en: 'Dialysis' } },
  { key: 'known_mdro', step: 3, core: false, risk: { el: 'γνωστό πολυανθεκτικό μικρόβιο', en: 'known multidrug-resistant organism' }, windowDays: null, prefill: null,
    label: { el: 'Είναι γνωστός φορέας ή είχε λοίμωξη από πολυανθεκτικό μικρόβιο;', en: 'Is the patient a known carrier of, or previously infected with, a multidrug-resistant organism?' }, short: { el: 'Γνωστό πολυανθεκτικό μικρόβιο', en: 'Known multidrug-resistant organism' } },
  { key: 'immunosuppression_30d', step: 3, core: false, risk: null, windowDays: 30, prefill: null,
    label: { el: 'Παίρνει κορτιζόνη, χημειοθεραπεία ή ανοσοκατασταλτικά;', en: 'Is the patient taking cortisone, chemotherapy or immunosuppressants?' }, short: { el: 'Ανοσοκαταστολή (30 ημέρες)', en: 'Immunosuppression (30 days)' } },
  { key: 'ltcf_residence', step: 3, core: false, risk: { el: 'οίκος ευγηρίας', en: 'long-term care facility' }, windowDays: null, prefill: null,
    label: { el: 'Έμενε σε οίκο ευγηρίας ή μονάδα μακροχρόνιας φροντίδας;', en: 'Did the patient live in a nursing home or long-term care facility?' }, short: { el: 'Διαμονή σε οίκο ευγηρίας', en: 'Nursing-home residence' } },
  { key: 'abroad_12m', step: 3, core: false, risk: { el: 'εξωτερικό', en: 'abroad' }, windowDays: 365, prefill: null,
    label: { el: 'Ταξίδεψε ή νοσηλεύτηκε στο εξωτερικό τους τελευταίους 12 μήνες;', en: 'Has the patient travelled or been hospitalised abroad in the last 12 months?' }, short: { el: 'Εξωτερικό (12 μήνες)', en: 'Abroad (12 months)' } },
])

export const EPI_CORE_KEYS = Object.freeze(EPI_QUESTIONS.filter(question => question.core).map(question => question.key))
export const EPI_QUESTION_COUNT = EPI_QUESTIONS.length
const byKey = Object.fromEntries(EPI_QUESTIONS.map(question => [question.key, question]))
export const epiQuestion = key => byKey[key] || null

export const epiText = (value, lang) => (value && typeof value === 'object' ? value[lang === 'en' ? 'en' : 'el'] || value.el || '' : value || '')

// The hospital's settings (epi_questionnaire_question_settings rows) applied over the defaults:
// wording, help text, time window, on / off. The three core questions are never off.
export function applyEpiSettings(settings = []) {
  const rows = new Map((settings || []).map(row => [row.questionKey, row]))
  return EPI_QUESTIONS.map(question => {
    const row = rows.get(question.key)
    return {
      ...question,
      label: { el: row?.labelEl || question.label.el, en: row?.labelEn || question.label.en },
      help: { el: row?.helpEl || '', en: row?.helpEn || '' },
      windowDays: row?.windowDays ?? question.windowDays,
      active: question.core ? true : row ? row.isActive !== false : true,
      edited: Boolean(row),
    }
  })
}
// The version of the questionnaire definition: 1 plus every saved change of any question.
export const epiDefinitionVersion = (settings = []) => 1 + (settings || []).reduce((sum, row) => sum + (Number(row.version) || 0), 0)

export const isEpiAnswer = value => EPI_ANSWERS.includes(value)
export const answerOf = (answers, key) => (isEpiAnswer(answers?.[key]?.a) ? answers[key].a : null)

// The core questions with no answer yet. «Άγνωστο» counts as an answer, so nobody is blocked.
export const missingCoreQuestions = (answers = {}) => EPI_CORE_KEYS.filter(key => !answerOf(answers, key))
export const isCoreComplete = answers => missingCoreQuestions(answers).length === 0

// The visible questions: the active ones.
export const activeEpiQuestions = questions => (questions || applyEpiSettings()).filter(question => question.active !== false)

export function epiCounts(answers = {}, questions = activeEpiQuestions()) {
  const list = questions.map(question => question.key)
  const answered = list.filter(key => answerOf(answers, key)).length
  return {
    total: list.length,
    answered,
    unknown: list.filter(key => answerOf(answers, key) === EPI_ANSWER.UNKNOWN).length,
    prefilled: list.filter(key => answers?.[key]?.src === EPI_SOURCE.PREFILL || answers?.[key]?.src === EPI_SOURCE.PREFILL_EDITED).length,
    coreAnswered: EPI_CORE_KEYS.length - missingCoreQuestions(answers).length,
    coreTotal: EPI_CORE_KEYS.length,
  }
}

// Computed status in the form vocabulary: done when the three core questions are answered.
export const epiFormStatus = row => (row && isCoreComplete(row.answers) ? 'done' : 'pending')

// ---- origin (hospital / outside the hospital) ------------------------------------------------
// Admission day = day 1. Day 3 or later (more than 48 hours) = hospital origin (the common ECDC /
// CDC NHSN rule); earlier = outside the hospital. Reference date: the first sample of the episode
// (collection date), else the start of the surveillance. Needs verification by the owner.
const day = value => (value ? String(value).slice(0, 10) : '')
function dayNumber(admissionDay, referenceDay) {
  const a = Date.parse(`${admissionDay}T12:00:00Z`)
  const b = Date.parse(`${referenceDay}T12:00:00Z`)
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 86400000) + 1 : null
}
export function referenceDate(record, samples = []) {
  const dates = [...samples, ...(record?.samples || [])].map(sample => day(sample.collectedAt || sample.requestedAt)).filter(Boolean).sort()
  return dates[0] || day(record?.startedAt) || ''
}
export function deriveOrigin({ admissionDate, record, samples = [] } = {}) {
  const admitted = day(admissionDate || record?.admissionDate)
  const reference = referenceDate(record, samples)
  if (!admitted || !reference) return null
  const hospitalDay = dayNumber(admitted, reference)
  if (hospitalDay == null || hospitalDay < 1) return null
  return { kind: hospitalDay >= 3 ? 'hospital' : 'community', hospitalDay, admittedOn: admitted, referenceOn: reference }
}

// ---- risk factors and the safety signal ------------------------------------------------------
export const riskFactorKeys = (answers = {}) => EPI_QUESTIONS.filter(question => question.risk && answerOf(answers, question.key) === EPI_ANSWER.YES).map(question => question.key)
export const riskFactorWords = (answers, lang) => riskFactorKeys(answers).map(key => epiText(byKey[key].risk, lang))
// Advisory, transparent, not a score: a known multidrug-resistant organism, or at least two factors.
// It suggests; it never decides isolation. Needs local validation by the owner.
export const riskSignal = (answers = {}) => answerOf(answers, 'known_mdro') === EPI_ANSWER.YES || riskFactorKeys(answers).length >= 2

// What the header, the episode row and the list show.
export function epiSummary({ row, record, admissionDate, samples = [] }) {
  const origin = deriveOrigin({ admissionDate, record, samples })
  const answers = row?.answers || {}
  const factors = riskFactorKeys(answers)
  return { origin, factors, factorCount: factors.length, signal: row ? riskSignal(answers) : false, status: epiFormStatus(row), hasRow: Boolean(row) }
}

// ---- prefill ----------------------------------------------------------------------------------
// Suggestions from what the record already holds; nothing is guessed. Absence of a record is not a
// «Όχι», except for devices where the system itself is the source. Stored as a snapshot in `prefilled`.
const ICU_TYPES = ['icu', 'nicu', 'picu']
const isIcu = (record, admission) =>
  ICU_TYPES.includes(String(admission?.department_type || admission?.departmentType || record?.departmentType || '').toLowerCase()) ||
  /(^|\s)(ΜΕΘ|ΜΕΝΝ|ICU|NICU|PICU)(\s|$)/i.test(`${record?.department || ''} ${record?.departmentEn || ''} ${admission?.department || ''}`)

export function buildEpiPrefill({ record, admission, samples = [], today = new Date().toISOString().slice(0, 10), fmtDate = value => value } = {}) {
  const out = {}
  const base = Date.parse(`${day(today)}T12:00:00Z`)
  const within = (value, days) => {
    const time = Date.parse(`${day(value)}T12:00:00Z`)
    return Number.isFinite(time) && Number.isFinite(base) && base - time <= days * 86400000
  }
  const therapies = (record?.therapy || []).filter(item => item && item.startedAt && within(item.startedAt, 90))
  if (therapies.length) {
    const first = [...therapies].sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)))[0]
    out.antibiotics_90d = { a: EPI_ANSWER.YES, source: 'therapy', detail: `${first.antimicrobial || ''}${first.antimicrobial ? ', ' : ''}${fmtDate(first.startedAt)}`.trim() }
  }
  if (isIcu(record, admission)) {
    const since = admission?.admissionDate || record?.admissionDate
    out.icu_stay = { a: EPI_ANSWER.YES, source: 'icu', detail: since ? fmtDate(since) : '' }
  }
  const from = admission?.admissionSource
  if (from === 'other_hospital' || from === 'ltcf') out.transfer_from_facility = { a: EPI_ANSWER.YES, source: 'admission', detail: admission.sourceFacility || '' }
  else if (from === 'home') out.transfer_from_facility = { a: EPI_ANSWER.NO, source: 'admission', detail: '' }
  // The mini version of a culture entered before the episode existed (newest sample first).
  const entered = [...samples].reverse().map(sample => sample.clinicalContext).filter(Boolean)
  for (const context of entered)
    for (const key of EPI_CORE_KEYS)
      if (!out[key] && isEpiAnswer(context[key]?.a)) out[key] = { a: context[key].a, source: 'sample', detail: context[key].detail || '' }
  const devices = record?.devices
  if (Array.isArray(devices)) {
    const recent = devices.filter(device => (!device.removedAt && device.status !== 'removed') || within(device.removedAt, 2))
    out.invasive_device_48h = recent.length
      ? { a: EPI_ANSWER.YES, source: 'devices', detail: recent.map(device => device.name || device.type).filter(Boolean).join(', ') }
      : { a: EPI_ANSWER.NO, source: 'devices', detail: '' }
  }
  return out
}

// The answers a questionnaire starts from: the stored ones, with the prefill for the rest.
export function startingAnswers(row, prefill = {}) {
  const answers = {}
  for (const question of EPI_QUESTIONS) {
    const stored = row?.answers?.[question.key]
    const suggested = row?.prefilled?.[question.key] || prefill[question.key]
    if (stored && isEpiAnswer(stored.a)) answers[question.key] = { a: stored.a, detail: stored.detail || '', src: stored.src || EPI_SOURCE.MANUAL }
    else if (suggested) answers[question.key] = { a: suggested.a, detail: suggested.detail || '', src: EPI_SOURCE.PREFILL }
  }
  return answers
}

// A person's choice: the source becomes «prefill_edited» when it differs from what the system suggested.
export function setEpiAnswer(answers, key, patch, suggestion) {
  const current = answers[key] || { a: null, detail: '', src: EPI_SOURCE.MANUAL }
  const next = { ...current, ...patch }
  const wasSuggested = suggestion && (current.src === EPI_SOURCE.PREFILL || current.src === EPI_SOURCE.PREFILL_EDITED)
  next.src = wasSuggested ? (next.a === suggestion.a ? EPI_SOURCE.PREFILL : EPI_SOURCE.PREFILL_EDITED) : EPI_SOURCE.MANUAL
  return { ...answers, [key]: next }
}

// Only the answered questions are stored (a blank answer stays blank).
export const cleanAnswers = answers =>
  Object.fromEntries(
    Object.entries(answers || {})
      .filter(([key, value]) => byKey[key] && isEpiAnswer(value?.a))
      .map(([key, value]) => [key, { a: value.a, detail: String(value.detail || '').trim(), src: value.src || EPI_SOURCE.MANUAL }]),
  )

// The three core questions only: the mini version (sample request, sample entry).
export const coreOnly = answers => Object.fromEntries(EPI_CORE_KEYS.filter(key => answers?.[key]).map(key => [key, answers[key]]))
// The mini version appears for culture samples only.
export const isCultureSampleType = type => ['bloodCulture', 'urineCulture', 'respiratorySample', 'woundCulture'].includes(type)
