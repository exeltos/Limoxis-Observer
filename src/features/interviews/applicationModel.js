// Η αίτηση του υποψηφίου από tablet (/apply/:token): the steps, what each one needs, the
// consents (the same texts as private.hr_application_consents in
// supabase/migrations/20261129300000_hr_application_tablet.sql) and the payload that
// hr_application_submit takes. Pure: the page and the tests read these.
import { EMPLOYMENT_TYPES, GENDERS, LEVELS, MARITAL, MILITARY, todayKey } from './interviewsModel'

export const APPLICATION_STEPS = Object.freeze([
  ['welcome', 'Καλωσόρισμα', 'Welcome'], ['personal', 'Προσωπικά στοιχεία', 'Personal details'], ['contact', 'Επικοινωνία', 'Contact'],
  ['education', 'Εκπαίδευση', 'Education'], ['languages', 'Γλώσσες', 'Languages'], ['experience', 'Προϋπηρεσία', 'Work experience'],
  ['about', 'Δεξιότητες & «Γιατί εμάς»', 'Skills & why us'], ['consents', 'Συναινέσεις', 'Consents'], ['review', 'Επισκόπηση & υποβολή', 'Review & submit'],
])
export const stepKey = index => APPLICATION_STEPS[index]?.[0] || 'welcome'
export const stepTitle = (index, language = 'el') => APPLICATION_STEPS[index]?.[language === 'en' ? 2 : 1] || ''

export const CONSENT_VERSION = '2026-10'
export const RETENTION_MONTHS = 24
export const CONSENTS = Object.freeze([
  { key: 'gdpr', required: true, title: ['Επεξεργασία προσωπικών δεδομένων', 'Processing of personal data'], text: {
    el: 'Συναινώ στην επεξεργασία των προσωπικών μου δεδομένων που περιέχει αυτή η αίτηση από το Νοσοκομείο, ως υπεύθυνο επεξεργασίας, αποκλειστικά για την αξιολόγηση της υποψηφιότητάς μου και τη διαδικασία επιλογής προσωπικού (Κανονισμός (ΕΕ) 2016/679 και ν. 4624/2019). Τα στοιχεία τα βλέπουν μόνο το Γραφείο Προσωπικού και όσοι συμμετέχουν στη συνέντευξη, δεν διαβιβάζονται σε τρίτους και διατηρούνται έως 24 μήνες από την υποβολή, εκτός αν προσληφθώ. Έχω δικαίωμα πρόσβασης, διόρθωσης, διαγραφής, περιορισμού και φορητότητας, μπορώ να ανακαλέσω τη συναίνεσή μου οποτεδήποτε με αίτημα στο Γραφείο Προσωπικού ή στον Υπεύθυνο Προστασίας Δεδομένων και να υποβάλω καταγγελία στην Αρχή Προστασίας Δεδομένων Προσωπικού Χαρακτήρα.',
    en: 'I consent to the Hospital, as data controller, processing the personal data in this application solely to assess my candidacy and for staff selection (Regulation (EU) 2016/679 and Greek Law 4624/2019). Only the HR office and those taking part in the interview see them; they are not passed to third parties and are kept for up to 24 months from submission, unless I am hired. I have the right of access, rectification, erasure, restriction and portability, I may withdraw my consent at any time by asking the HR office or the Data Protection Officer, and I may lodge a complaint with the Hellenic Data Protection Authority.' } },
  { key: 'future', required: false, title: ['Αίτηση και για άλλες θέσεις', 'Other positions too'], text: {
    el: 'Συναινώ να εξεταστεί η αίτησή μου και για άλλες θέσεις που θα προκύψουν στο Νοσοκομείο μέσα στους επόμενους 24 μήνες.',
    en: 'I consent to my application also being considered for other positions that open at the Hospital within the next 24 months.' } },
  { key: 'references', required: false, title: ['Συστάσεις από προηγούμενους εργοδότες', 'References from previous employers'], text: {
    el: 'Συναινώ το Γραφείο Προσωπικού να επικοινωνήσει με τους προηγούμενους εργοδότες που δηλώνω, για συστάσεις σχετικά με την εργασία μου.',
    en: 'I consent to the HR office contacting the previous employers I list, for references about my work.' } },
  { key: 'truth', required: true, title: ['Υπεύθυνη δήλωση', 'Declaration'], text: {
    el: 'Δηλώνω υπεύθυνα ότι τα στοιχεία της αίτησης είναι αληθή και πλήρη. Γνωρίζω ότι ανακριβή στοιχεία μπορεί να οδηγήσουν σε απόρριψη της αίτησης ή σε λύση της συνεργασίας.',
    en: 'I declare that the details in this application are true and complete. I understand that inaccurate details may lead to the application being rejected or the employment being terminated.' } },
])
// The texts the server sent (they win), else the ones above.
export const consentText = (consent, language = 'el', server = null) => server?.[language === 'en' ? 'en' : 'el']?.[consent.key] || consent.text[language === 'en' ? 'en' : 'el']

export const LIMITS = Object.freeze({ education: 10, languages: 12, employers: 15, short: 120, long: 2000, signature: 300000 })

export const newEducationRow = () => ({ title: '', school: '', year: '' })
export const newLanguageRow = (language = '') => ({ language, speaking: '', reading: '', writing: '', certificate: false, certificateName: '' })
export const newEmployerRow = () => ({ employer: '', from: '', to: '', current: false, jobTitle: '', leavingReason: '' })
export const newApplication = (position = '') => ({ lastName: '', firstName: '', fatherName: '', motherName: '', birthDate: '', birthPlace: '', gender: '', nationality: '', maritalStatus: '', children: '', militaryService: '',
  workPermit: null, practiceLicence: null, address: '', area: '', postcode: '', phoneMobile: '', phoneLandline: '', email: '', requestedPosition: position, employmentType: '',
  educationLevel: '', education: [newEducationRow()], languages: [newLanguageRow('el')], employers: [], itSkills: '', activities: '', whyUs: '',
  consents: { gdpr: false, future: false, references: false, truth: false }, signature: '' })

// Dates typed on the tablet: «ΗΗ/ΜΜ/ΕΕΕΕ» for the birth date, «ΜΜ/ΕΕΕΕ» for work periods.
// '' when empty, null when it is not a date.
export function parseDay(text) {
  const value = String(text || '').trim()
  if (!value) return ''
  const m = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (!m) return null
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d && y >= 1900 ? `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null
}
export function parseMonth(text) {
  const value = String(text || '').trim()
  if (!value) return ''
  const m = value.match(/^(\d{1,2})[/.-](\d{4})$/)
  if (!m || Number(m[1]) < 1 || Number(m[1]) > 12 || Number(m[2]) < 1950 || Number(m[2]) > 2100) return null
  return `${m[2]}-${String(Number(m[1])).padStart(2, '0')}-01`
}
// What the field shows while typing: the slashes come by themselves.
export const maskDay = raw => { const d = String(raw || '').replace(/\D/g, '').slice(0, 8); return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join('/') }
export const maskMonth = raw => { const d = String(raw || '').replace(/\D/g, '').slice(0, 6); return [d.slice(0, 2), d.slice(2)].filter(Boolean).join('/') }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const filled = value => String(value ?? '').trim() !== ''
const digits = value => String(value || '').replace(/\D/g, '')
const rowFilled = (row, keys) => keys.some(key => filled(row?.[key]))
const ageAt = (iso, today) => { const [by, bm, bd] = iso.split('-').map(Number), [ty, tm, td] = today.split('-').map(Number); return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0) }

// What a step still needs, as [field, message]; the page marks the field and says it.
export function stepProblems(step, draft, language = 'el', today = todayKey()) {
  const en = language === 'en'
  const out = []
  const need = (field, el, enText) => out.push([field, en ? enText : el])
  const key = typeof step === 'number' ? stepKey(step) : step
  if (key === 'personal') {
    if (String(draft.lastName || '').trim().length < 2) need('lastName', 'Γράψτε το επώνυμό σας.', 'Enter your surname.')
    if (String(draft.firstName || '').trim().length < 2) need('firstName', 'Γράψτε το όνομά σας.', 'Enter your first name.')
    const birth = parseDay(draft.birthDate)
    if (birth === null) need('birthDate', 'Η ημερομηνία γέννησης γράφεται ΗΗ/ΜΜ/ΕΕΕΕ.', 'Write the birth date as DD/MM/YYYY.')
    else if (birth && (ageAt(birth, today) < 16 || ageAt(birth, today) > 80)) need('birthDate', 'Ελέγξτε την ημερομηνία γέννησης.', 'Check the birth date.')
    if (filled(draft.children) && !(/^\d{1,2}$/.test(String(draft.children).trim()) && Number(draft.children) <= 30)) need('children', 'Τα παιδιά γράφονται ως αριθμός 0–30.', 'Children is a number 0–30.')
  }
  if (key === 'contact') {
    const phone = digits(draft.phoneMobile)
    if (phone.length < 10 || phone.length > 15) need('phoneMobile', 'Γράψτε ένα κινητό τηλέφωνο (10 ψηφία).', 'Enter a mobile phone (10 digits).')
    if (filled(draft.email) && !EMAIL.test(String(draft.email).trim())) need('email', 'Το email δεν είναι σωστό.', 'The email is not valid.')
    if (filled(draft.postcode) && !/^\d{3}\s?\d{2}$/.test(String(draft.postcode).trim())) need('postcode', 'Ο ταχυδρομικός κώδικας έχει 5 ψηφία.', 'The postcode has 5 digits.')
  }
  if (key === 'education') (draft.education || []).forEach((row, index) => {
    if (!rowFilled(row, ['title', 'school', 'year'])) return
    if (!filled(row.title) && !filled(row.school)) need(`education.${index}.title`, 'Γράψτε τον τίτλο ή τη σχολή.', 'Enter the degree or the school.')
    if (filled(row.year) && !(/^\d{4}$/.test(String(row.year).trim()) && Number(row.year) >= 1950 && Number(row.year) <= Number(today.slice(0, 4)) + 6)) need(`education.${index}.year`, 'Το έτος γράφεται με 4 ψηφία.', 'The year has 4 digits.')
  })
  if (key === 'languages') (draft.languages || []).forEach((row, index) => {
    const levels = ['speaking', 'reading', 'writing'].some(skill => filled(row[skill]))
    if (!filled(row.language) && (levels || row.certificate)) need(`languages.${index}.language`, 'Διαλέξτε τη γλώσσα.', 'Choose the language.')
    if (filled(row.language) && !levels) need(`languages.${index}.levels`, 'Διαλέξτε επίπεδο σε ομιλία, ανάγνωση ή γραφή.', 'Choose a level for speaking, reading or writing.')
  })
  if (key === 'experience') (draft.employers || []).forEach((row, index) => {
    if (!rowFilled(row, ['employer', 'from', 'to', 'jobTitle', 'leavingReason'])) return
    if (!filled(row.employer)) need(`employers.${index}.employer`, 'Γράψτε τον εργοδότη.', 'Enter the employer.')
    const from = parseMonth(row.from), to = row.current ? '' : parseMonth(row.to)
    if (from === null) need(`employers.${index}.from`, 'Ο μήνας γράφεται ΜΜ/ΕΕΕΕ.', 'Write the month as MM/YYYY.')
    if (to === null) need(`employers.${index}.to`, 'Ο μήνας γράφεται ΜΜ/ΕΕΕΕ.', 'Write the month as MM/YYYY.')
    else if (from && to && to < from) need(`employers.${index}.to`, 'Το «έως» είναι πριν από το «από».', '«To» is before «from».')
  })
  if (key === 'consents') {
    for (const consent of CONSENTS) if (consent.required && draft.consents?.[consent.key] !== true) need(`consents.${consent.key}`, `Χρειάζεται: ${consent.title[0]}.`, `Required: ${consent.title[1]}.`)
    if (!validSignature(draft.signature)) need('signature', 'Υπογράψτε στο πλαίσιο.', 'Sign in the box.')
  }
  if (key === 'review') return applicationProblems(draft, language, today).map(([, field, message]) => [field, message])
  return out
}
// Every step's problems, as [step index, field, message].
export function applicationProblems(draft, language = 'el', today = todayKey()) {
  return APPLICATION_STEPS.flatMap(([key], index) => (key === 'review' ? [] : stepProblems(key, draft, language, today).map(([field, message]) => [index, field, message])))
}
export const firstStepWithProblems = (draft, language, today) => applicationProblems(draft, language, today)[0]?.[0] ?? -1

export const validSignature = value => typeof value === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value) && value.length <= LIMITS.signature
// A line of text: no control characters, single spaces, cut; long text keeps its line breaks.
// eslint-disable-next-line no-control-regex
const cleanLine = (value, max = LIMITS.short) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
// eslint-disable-next-line no-control-regex
const cleanLong = (value, max = LIMITS.long) => String(value ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max)
const oneOf = (map, value) => (Object.hasOwn(map, value) ? value : '')
const yesNoValue = value => (value === true || value === false ? value : null)

// The payload for hr_application_submit: trimmed, limited, only known values. The
// server checks the same again (private.hr_app_*).
export function cleanApplication(draft, { language = 'el' } = {}) {
  const children = String(draft.children ?? '').trim()
  return {
    language: language === 'en' ? 'en' : 'el', consentVersion: CONSENT_VERSION,
    fullName: cleanLine(`${cleanLine(draft.lastName, 80)} ${cleanLine(draft.firstName, 80)}`, 160),
    fatherName: cleanLine(draft.fatherName, 80), motherName: cleanLine(draft.motherName, 80), birthDate: parseDay(draft.birthDate) || '', birthPlace: cleanLine(draft.birthPlace),
    gender: oneOf(GENDERS, draft.gender), nationality: cleanLine(draft.nationality, 80), citizenship: cleanLine(draft.nationality, 80), maritalStatus: oneOf(MARITAL, draft.maritalStatus),
    children: /^\d{1,2}$/.test(children) && Number(children) <= 30 ? children : '', militaryService: oneOf(MILITARY, draft.militaryService),
    workPermit: yesNoValue(draft.workPermit), practiceLicence: yesNoValue(draft.practiceLicence),
    address: cleanLine(draft.address, 200), area: cleanLine(draft.area), postcode: cleanLine(draft.postcode, 12), phoneMobile: cleanLine(draft.phoneMobile, 40), phoneLandline: cleanLine(draft.phoneLandline, 40), email: cleanLine(draft.email, 160).toLowerCase(),
    requestedPosition: cleanLine(draft.requestedPosition, 160), employmentType: oneOf(EMPLOYMENT_TYPES, draft.employmentType), educationLevel: cleanLine(draft.educationLevel),
    education: (draft.education || []).filter(row => filled(row.title) || filled(row.school)).slice(0, LIMITS.education)
      .map(row => ({ title: cleanLine(row.title, 160), school: cleanLine(row.school, 160), year: /^\d{4}$/.test(String(row.year || '').trim()) ? String(row.year).trim() : '', completed: true })),
    languages: (draft.languages || []).filter(row => filled(row.language)).slice(0, LIMITS.languages)
      .map(row => ({ language: cleanLine(row.language, 40), speaking: oneOf(LEVELS, row.speaking), reading: oneOf(LEVELS, row.reading), writing: oneOf(LEVELS, row.writing), certificate: row.certificate === true, certificateName: row.certificate === true ? cleanLine(row.certificateName) : '' })),
    employers: (draft.employers || []).filter(row => filled(row.employer)).slice(0, LIMITS.employers)
      .map(row => ({ employer: cleanLine(row.employer, 160), fromOn: parseMonth(row.from) || '', toOn: row.current ? '' : parseMonth(row.to) || '', jobTitle: cleanLine(row.jobTitle), leavingReason: cleanLine(row.leavingReason, 300) })),
    itSkills: cleanLong(draft.itSkills), activities: cleanLong(draft.activities), whyUs: cleanLong(draft.whyUs),
    consents: Object.fromEntries(CONSENTS.map(consent => [consent.key, draft.consents?.[consent.key] === true])),
    signature: validSignature(draft.signature) ? draft.signature : '',
  }
}

// The link's code: 12 characters, shown and typed as XXXX-XXXX-XXXX.
export const normalizeCode = token => String(token || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
export const isDemoToken = token => normalizeCode(token) === 'DEMO'
export const formatCode = token => (isDemoToken(token) ? 'DEMO' : normalizeCode(token).replace(/(.{4})(?=.)/g, '$1-'))
export const validCode = token => isDemoToken(token) || /^[A-HJ-NP-Z2-9]{12}$/.test(normalizeCode(token))
export const applicationPath = token => `/apply/${isDemoToken(token) ? 'demo' : formatCode(token)}`
export const draftKey = token => `limoxis.apply.${normalizeCode(token)}`

export function applicationErrorText(error, language = 'el') {
  const en = language === 'en'
  const text = String(error?.message || error || '')
  if (text.includes('HR_APPLICATION_USED')) return en ? 'This link has already been used. Ask the HR office for a new one.' : 'Ο σύνδεσμος έχει ήδη χρησιμοποιηθεί. Ζητήστε νέο από το Γραφείο Προσωπικού.'
  if (text.includes('HR_APPLICATION_EXPIRED')) return en ? 'This link has expired. Ask the HR office for a new one.' : 'Ο σύνδεσμος έχει λήξει. Ζητήστε νέο από το Γραφείο Προσωπικού.'
  if (text.includes('HR_APPLICATION_NOT_AVAILABLE')) return en ? 'This link is not valid. Check the code or ask the HR office.' : 'Ο σύνδεσμος δεν είναι έγκυρος. Ελέγξτε τον κωδικό ή ρωτήστε το Γραφείο Προσωπικού.'
  if (text.includes('HR_APPLICATION_BUSY')) return en ? 'Many applications are arriving right now. Please try again in a minute.' : 'Έρχονται πολλές αιτήσεις αυτή τη στιγμή. Δοκιμάστε ξανά σε ένα λεπτό.'
  if (text.includes('HR_APPLICATION_CONSENT_REQUIRED')) return en ? 'The consent to processing and the declaration are needed.' : 'Χρειάζονται η συναίνεση για την επεξεργασία και η υπεύθυνη δήλωση.'
  if (text.includes('HR_APPLICATION_SIGNATURE_REQUIRED')) return en ? 'Please sign again in the box.' : 'Υπογράψτε ξανά στο πλαίσιο.'
  if (text.includes('HR_APPLICATION_INVALID')) return en ? 'Your name and a phone or email are needed.' : 'Χρειάζονται το ονοματεπώνυμο και ένα τηλέφωνο ή email.'
  return en ? 'The application could not be sent. Check the connection and try again.' : 'Η αίτηση δεν στάλθηκε. Ελέγξτε τη σύνδεση και δοκιμάστε ξανά.'
}

// The sample the preview shows (help screens, screenshots): made-up details.
export const DEMO_PUBLIC = Object.freeze({ organizationName: 'Γενικό Νοσοκομείο (επίδειξη)', logo: '', position: 'ΤΕ Νοσηλευτική', expiresAt: '', consents: null, demo: true })
export function demoApplication() {
  return { ...newApplication('ΤΕ Νοσηλευτική'), lastName: 'Νικολάου', firstName: 'Ελένη', fatherName: 'Γεώργιος', motherName: 'Μαρία', birthDate: '14/03/1996', birthPlace: 'Λάρισα', gender: 'female', nationality: 'Ελληνική',
    maritalStatus: 'single', children: '0', workPermit: true, practiceLicence: true, address: 'Οδός Παραδείγματος 12', area: 'Λάρισα', postcode: '41222', phoneMobile: '6900000123', email: 'e.nikolaou@example.org', employmentType: 'full_time',
    educationLevel: 'Γενικό Λύκειο', education: [{ title: 'Πτυχίο Νοσηλευτικής', school: 'Πανεπιστήμιο Θεσσαλίας', year: '2019' }, { title: 'Μεταπτυχιακό στην Εντατική Νοσηλευτική', school: 'ΕΚΠΑ', year: '2022' }],
    languages: [{ ...newLanguageRow('el'), speaking: 'fluent', reading: 'fluent', writing: 'fluent' }, { language: 'en', speaking: 'very_good', reading: 'fluent', writing: 'good', certificate: true, certificateName: 'C1 (Advanced)' }],
    employers: [{ employer: 'Ιδιωτική Κλινική (παράδειγμα)', from: '06/2019', to: '09/2024', current: false, jobTitle: 'Νοσηλεύτρια ΜΕΘ', leavingReason: 'Μετακόμιση στη Λάρισα' }, { employer: 'Κέντρο Αποκατάστασης (παράδειγμα)', from: '10/2024', to: '', current: true, jobTitle: 'Νοσηλεύτρια', leavingReason: '' }],
    itSkills: 'Office, ηλεκτρονικός φάκελος ασθενούς', activities: 'Εθελόντρια στον Ερυθρό Σταυρό', whyUs: 'Θέλω να εργαστώ σε μια μονάδα με καλή οργάνωση και συνεχή εκπαίδευση, κοντά στο σπίτι μου.',
    consents: { gdpr: true, future: true, references: true, truth: true }, signature: DEMO_SIGNATURE }
}
// A drawn signature for the sample (made up).
export const DEMO_SIGNATURE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAWgAAAB4BAMAAAAtanXJAAAAGFBMVEUAAAAPIjMAAAAAAAAAAAAAAAAAAAAAAABcgH40AAAACHRSTlMA/wAAAAAAACXRGJEAAANwSURBVHja7VptkqwwCITUHIDc/5DhBrwf6oyOGvmI6+4rumpr/0xMp0MDiQIkEolEIpFIJBKJRCKRSCQSiUQi8fNAz6AKIPwg6eLj7Fvsg6QnvvTHlAZo/KjUDtIEDQT+VnggCADwk/FRnOPkyfjwkGZ4GC97SE/xzO7wQIpm+eIVWrxBjRTO8sXuw2CQUDzLF4cFIx0AIIBEs3xxCbUhbx0vLEGpS2As+YRmgKDUxTwph4KaQPy7NEJpn1ocT/XF7UNt0qu1fvcAgYTpIk1Wqev8twznAVW1uHbX23xjNLZcpNHKnwDaVAU/NoSoFSNGVAQmAjRoy2JxvVD6MdK0UYhRZ1yew5pWAvNDSivkmownE+u66e4uF4x1VGvKRgvIW+56ljoV2TWkNJonXk7CB0sm9y4Wq/f2zbFqZ9qKunbPeEx40BdpJtT+vlm7ABx53PoSnniue4dHKI49fER44I7E1GNiPY4UjGR5ui3lCUCFSmcUQ3WPtaTPc+MJiaVuND7QhgLZE/XFRaw7NufhdnTwwwCvnee7RiS2idPqnBlkN5ZsRqvrHIOjyvjxg1pra1O6m4AK+7KpJN3rgUhshcfkQ/xeBw9RGq/tbms3NwIRQFt33nJfl/clNbpLCwI0WHfebCDdSfk0+rpUdlcLwKprsyul6/swrQhRtpYW2t7hTDdmdBmJpT/xytKkkY4Mred2Lnn/Q0DqL7h0/YYf6mhvJlnv7U/oMUCli7Glm7hmS0MlIFUCs90RvHdmFXpTsyjWmKa9pQGrKheYL45wH0kCl++DX32fyFKptR0bakvR1yCGznHhWulPysdlxY3hntdD7OthX6rWQJqWBRlLS22OClB67rCrK0fXdv3jGkC1HhZKzx0S2HDdYAZ0XEW+lO4wt1U6H8pUBDisNC/l33PCW+IDlURYly8uSU/NGnrzhe1zENcbmOPwIHYKfXlg2x98HDOUc3f4hGbHqWWE0pM7nLNOwUW3fqpQTtXyzspAd38L8hrmju2Nz63fC92gSfX6KxYe8S7o2Q+zEom/hhuyx9HLo/abSdfBXcb9pOs5uVn9QV9d49CY6JOqowTHS/EU6mgYj+SN7h338rheIdLF41AdqgfTeCN1yS/NpZI2pjuvwL3eqoE0g5Fp2hD3jpAgkUgkEolEIpFI/Nf4B4XVBbMvFWi4AAAAAElFTkSuQmCC'
