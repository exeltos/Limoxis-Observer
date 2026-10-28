// Official ΕΟΔΥ catalogue «Κατάλογος Νοσημάτων Υποχρεωτικής Δήλωσης – Χρόνοι δήλωσης»
// (Υ.Α. Δ1α/Γ.Π.οικ. 16711/2022, ΦΕΚ 1665/Β/7-4-2022): 57 diseases, each with a deadline.
// Source copy: docs/reference/eody-katalogos-nosimaton-2022.pdf. The numbering is the catalogue's own.
// deadline: 'immediate' (Αμέσως), '24h' (24ωρο), 'weekly' (Εβδομάδα). notes: keys of EODY_FOOTNOTES.
export const EODY_SOURCE = 'ΕΟΔΥ · Υ.Α. Δ1α/Γ.Π.οικ. 16711/2022 (ΦΕΚ 1665/Β/2022)'
export const EODY_SOURCE_VERSION = '2022'

export const EODY_FOOTNOTES = Object.freeze({
  biothreat: { el: 'Εάν υπάρχει υποψία σκόπιμης απελευθέρωσης μικροοργανισμών (βιοτρομοκρατική ενέργεια), η δήλωση πρέπει να γίνεται αμέσως.', en: 'If deliberate release of microorganisms (bioterrorism) is suspected, the notification must be made immediately.' },
  covid: { el: 'Η λοίμωξη COVID-19 δηλώνεται αποκλειστικά μέσω του ψηφιοποιημένου δελτίου δήλωσης που υπάρχει στο μητρώο COVID-19.', en: 'COVID-19 is notified exclusively through the digital notification form of the COVID-19 registry.' },
  haemorrhagic: { el: 'Περιλαμβάνει τους αιμορραγικούς πυρετούς πλην του Δάγκειου Πυρετού, που αποτελεί ξεχωριστά δηλούμενο νόσημα, με δικό του δελτίο δήλωσης και ορισμό κρούσματος. Περιλαμβάνει τον Κίτρινο Πυρετό (για τον οποίο σημειώνεται ότι υπάρχει ξεχωριστός ορισμός κρούσματος).', en: 'Includes haemorrhagic fevers except Dengue fever, which is a separately notifiable disease with its own notification form and case definition. Includes Yellow fever (which has a separate case definition).' },
  encephalitis: { el: 'Δεν συμπεριλαμβάνεται η λοίμωξη από ιό του Δυτικού Νείλου, που αποτελεί ξεχωριστά δηλούμενο νόσημα, με δικό του δελτίο δήλωσης και ορισμό κρούσματος. Περιλαμβάνει την κρωτονογενή εγκεφαλίτιδα, η οποία έχει ξεχωριστό ορισμό κρούσματος.', en: 'Does not include West Nile virus infection, which is a separately notifiable disease with its own notification form and case definition. Includes tick-borne encephalitis, which has a separate case definition.' },
})

export const EODY_DEADLINES = Object.freeze(['immediate', '24h', 'weekly'])

const row = (n, id, el, en, deadline, ...notes) => Object.freeze({ n, id, el, en, deadline, notes: Object.freeze(notes) })

export const EODY_CATALOGUE = Object.freeze([
  row(1, 'cjd', 'Creutzfeldt-Jakob (Νόσος Creutzfeldt-Jakob - CJD)', 'Creutzfeldt-Jakob disease (CJD)', 'weekly'),
  row(2, 'covid19', 'COVID-19 (Λοίμωξη από νέο κορωνοϊό SARS-CoV-2)', 'COVID-19 (infection with the novel coronavirus SARS-CoV-2)', 'immediate', 'covid'),
  row(3, 'hiv', 'HIV λοίμωξη', 'HIV infection', 'weekly'),
  row(4, 'haemorrhagic_fevers', 'Αιμορραγικοί ιογενείς πυρετοί', 'Viral haemorrhagic fevers', 'immediate', 'haemorrhagic'),
  row(5, 'botulism', 'Αλλαντίαση', 'Botulism', 'immediate'),
  row(6, 'varicella_complicated', 'Ανεμοβλογιά με επιπλοκές', 'Varicella with complications', 'immediate'),
  row(7, 'anthrax', 'Άνθρακας', 'Anthrax', 'immediate'),
  row(8, 'unusual_event', 'Ασυνήθιστο συμβάν (συρροής κρουσμάτων ή μεμονωμένου περιστατικού)', 'Unusual event (cluster of cases or a single case)', 'immediate'),
  row(9, 'brucellosis', 'Βρουκέλλωση', 'Brucellosis', 'weekly'),
  row(10, 'gonorrhoea', 'Γονόρροια', 'Gonorrhoea', 'weekly'),
  row(11, 'influenza', 'Γρίπη (κρούσμα με εργαστηριακή επιβεβαίωση ή σύνδεση με κρούσμα που έχει επιβεβαιωθεί εργαστηριακά)', 'Influenza (laboratory-confirmed case, or a case linked to a laboratory-confirmed case)', '24h'),
  row(12, 'dengue', 'Δάγκειος πυρετός', 'Dengue fever', 'immediate'),
  row(13, 'diphtheria', 'Διφθερίτιδα', 'Diphtheria', 'immediate'),
  row(14, 'west_nile', 'Δυτικός Νείλος (Λοίμωξη από ιό του Δυτικού Νείλου)', 'West Nile virus infection', '24h'),
  row(15, 'arboviral_encephalitis', 'Εγκεφαλίτιδες από αρθρο-ιούς (συμπεριλαμβανομένης της κροτωνογενούς εγκεφαλίτιδας)', 'Arthropod-borne viral encephalitis (including tick-borne encephalitis)', 'immediate', 'encephalitis'),
  row(16, 'malaria', 'Ελονοσία', 'Malaria', '24h'),
  row(17, 'rubella', 'Ερυθρά', 'Rubella', '24h'),
  row(18, 'rubella_congenital', 'Ερυθρά, συγγενής', 'Congenital rubella', '24h'),
  row(19, 'smallpox', 'Ευλογιά', 'Smallpox', 'immediate'),
  row(20, 'echinococcosis', 'Εχινοκοκκίαση', 'Echinococcosis', 'weekly'),
  row(21, 'zika', 'ΖΙΚΑ (Λοίμωξη από ιό) και συγγενής λοίμωξη από ιό ΖΙΚΑ', 'Zika virus infection and congenital Zika virus infection', 'immediate'),
  row(22, 'hepatitis_a', 'Ηπατίτιδα Α, οξεία', 'Hepatitis A, acute', '24h'),
  row(23, 'hepatitis_b', 'Ηπατίτιδα Β (οξεία, χρόνια)', 'Hepatitis B (acute, chronic)', 'weekly'),
  row(24, 'hepatitis_c', 'Ηπατίτιδα C (οξεία, χρόνια)', 'Hepatitis C (acute, chronic)', 'weekly'),
  row(25, 'measles', 'Ιλαρά', 'Measles', '24h'),
  row(26, 'campylobacteriosis', 'Καμπυλοβακτηρίδιο (Λοίμωξη από)', 'Campylobacter infection', '24h'),
  row(27, 'pertussis', 'Κοκκύτης', 'Pertussis', '24h'),
  row(28, 'stec', 'Κολοβακτηρίδιο (Λοίμωξη από εντεροαιμορραγικό κολοβακτηρίδιο EHEC/VTEC/STEC)', 'Escherichia coli infection (enterohaemorrhagic E. coli EHEC/VTEC/STEC)', '24h'),
  row(29, 'legionellosis', 'Λεγιονέλλωση/Πυρετός Pontiac', 'Legionnaires’ disease / Pontiac fever', '24h'),
  row(30, 'leishmaniasis', 'Λεϊσμανίαση', 'Leishmaniasis', 'weekly'),
  row(31, 'leptospirosis', 'Λεπτοσπείρωση', 'Leptospirosis', 'weekly'),
  row(32, 'listeriosis', 'Λιστερίωση', 'Listeriosis', 'weekly'),
  row(33, 'hai', 'Λοιμώξεις που Συνδέονται με Χώρους Υπηρεσιών Υγείας (ΛΣΧΠΥΥ)', 'Healthcare-associated infections (HAI)', 'weekly'),
  row(34, 'rabies', 'Λύσσα', 'Rabies', 'immediate'),
  row(35, 'melioidosis_glanders', 'Μελιοείδωση/Μάλη', 'Melioidosis / Glanders', 'immediate'),
  row(36, 'meningitis', 'Μηνιγγίτιδα (βακτηριακή, άσηπτη)', 'Meningitis (bacterial, aseptic)', '24h'),
  row(37, 'meningococcal', 'Μηνιγγιτιδοκοκκική νόσος', 'Meningococcal disease', '24h'),
  row(38, 'lyme_tickborne', 'Νόσος Lyme/ Μπορρελίωση, Ρικετσιώσεις, Αναπλάσμωση, Ερλιχίωση', 'Lyme disease / Borreliosis, Rickettsioses, Anaplasmosis, Ehrlichiosis', 'weekly'),
  row(39, 'plague', 'Πανώλη', 'Plague', 'immediate'),
  row(40, 'mumps', 'Παρωτίτιδα', 'Mumps', '24h'),
  row(41, 'poliomyelitis', 'Πολυομυελίτιδα (και οξεία χαλαρή παράλυση)', 'Poliomyelitis (and acute flaccid paralysis)', 'immediate'),
  row(42, 'q_fever', 'Πυρετός Q', 'Q fever', 'weekly'),
  row(43, 'salmonellosis', 'Σαλμονέλλωση (μη τυφο-παρατυφική)', 'Salmonellosis (non-typhoidal, non-paratyphoidal)', '24h'),
  row(44, 'sars', 'ΣΟΑΣ- SARS (Σοβαρό Οξύ Αναπνευστικό Σύνδρομο)', 'SARS (Severe Acute Respiratory Syndrome)', 'immediate'),
  row(45, 'shigellosis', 'Σιγκέλλωση', 'Shigellosis', '24h'),
  row(46, 'syphilis', 'Σύφιλη', 'Syphilis', 'weekly'),
  row(47, 'syphilis_congenital', 'Σύφιλη συγγενής', 'Congenital syphilis', 'weekly'),
  row(48, 'foodborne_outbreak', 'Συρροή κρουσμάτων τροφιμογενούς-υδατογενούς νοσήματος', 'Cluster of cases of a food-borne or water-borne disease', '24h'),
  row(49, 'tetanus', 'Τέτανος/Τέτανος νεογνικός', 'Tetanus / Neonatal tetanus', 'weekly'),
  row(50, 'toxoplasmosis_congenital', 'Τοξοπλάσμωση, συγγενής', 'Toxoplasmosis, congenital', 'weekly'),
  row(51, 'tularaemia', 'Τουλαραιμία', 'Tularaemia', 'immediate'),
  row(52, 'trichinellosis', 'Τριχίνωση', 'Trichinellosis', '24h'),
  row(53, 'chikungunya', 'Τσικουνγκούνια - Chikungunya (Λοίμωξη από ιό Chikungunya)', 'Chikungunya virus infection', 'immediate'),
  row(54, 'typhoid', 'Τυφοειδής και παρατυφοειδής πυρετός', 'Typhoid and paratyphoid fever', '24h'),
  row(55, 'tuberculosis', 'Φυματίωση', 'Tuberculosis', 'weekly'),
  row(56, 'chlamydia', 'Χλαμυδιακή λοίμωξη', 'Chlamydial infection', 'weekly'),
  row(57, 'cholera', 'Χολέρα', 'Cholera', 'immediate'),
])

const byId = new Map(EODY_CATALOGUE.map(entry => [entry.id, entry]))
const norm = value => String(value || '').trim().toLowerCase()
const byName = new Map(EODY_CATALOGUE.flatMap(entry => [[norm(entry.el), entry], [norm(entry.en), entry]]))

export const eodyEntry = id => byId.get(id) || null
export const eodyEntryByName = name => byName.get(norm(name)) || null
export const eodyCode = entry => `ND-EODY-${String(entry.n).padStart(2, '0')}`
export const eodyLabel = (entry, language = 'el') => (language === 'en' ? entry.en : entry.el)
// Footnotes that apply to an entry: its own, and the general biological-threat note for every disease.
export const eodyNotes = (entry, language = 'el') => ['biothreat', ...entry.notes].map(key => EODY_FOOTNOTES[key][language === 'en' ? 'en' : 'el'])

const DEADLINE_WORDS = {
  immediate: { el: 'Δήλωση αμέσως', en: 'Notify immediately' },
  '24h': { el: 'Δήλωση εντός 24 ωρών', en: 'Notify within 24 hours' },
  weekly: { el: 'Δήλωση εντός εβδομάδας', en: 'Notify within a week' },
}
const GROUP_WORDS = {
  immediate: { el: 'Αμέσως', en: 'Immediately' },
  '24h': { el: 'Εντός 24 ωρών', en: 'Within 24 hours' },
  weekly: { el: 'Εντός εβδομάδας', en: 'Within a week' },
}
const lang = language => (language === 'en' ? 'en' : 'el')
export const deadlineWords = (deadline, language = 'el') => DEADLINE_WORDS[deadline]?.[lang(language)] || ''
export const deadlineGroupWords = (deadline, language = 'el') => GROUP_WORDS[deadline]?.[lang(language)] || ''

const LIMIT_HOURS = { '24h': 24, weekly: 168 }
const plural = (n, el, elMany, en, enMany, language) => (language === 'en' ? (n === 1 ? en : enMany) : (n === 1 ? el : elMany))

function span(hours, language) {
  const abs = Math.max(0, Math.abs(hours))
  if (abs < 1) return language === 'en' ? 'less than an hour' : 'λιγότερο από μία ώρα'
  if (abs < 48) { const n = Math.floor(abs); return `${n} ${plural(n, 'ώρα', 'ώρες', 'hour', 'hours', language)}` }
  const n = Math.floor(abs / 24)
  return `${n} ${plural(n, 'ημέρα', 'ημέρες', 'day', 'days', language)}`
}

// How a pending notification stands against its deadline, measured from `startIso` (creation or
// finding date): { overdue, text }. «Αμέσως» has no limit to count down, so it states how long it has waited.
// A date without a time starts at midnight in Europe/Athens (the hospital's clock).
function startOf(value) {
  const text = String(value || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return Date.parse(text)
  const zone = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Athens', timeZoneName: 'longOffset' }).formatToParts(new Date(`${text}T12:00:00Z`)).find(part => part.type === 'timeZoneName')?.value || 'GMT+02:00'
  return Date.parse(`${text}T00:00:00${zone.replace('GMT', '') || '+00:00'}`)
}

// When a notification with a timed deadline is due (null for «immediately» or no deadline).
export function deadlineDueAt(deadline, startIso) {
  const start = startOf(startIso)
  const limit = LIMIT_HOURS[deadline]
  return limit && !Number.isNaN(start) ? new Date(start + limit * 3600000) : null
}

export function deadlineStatusText(deadline, startIso, { now = Date.now(), language = 'el' } = {}) {
  const start = startOf(startIso)
  if (!deadline || Number.isNaN(start)) return { overdue: false, text: '' }
  const elapsed = (now - start) / 3600000
  const limit = LIMIT_HOURS[deadline]
  if (!limit) return { overdue: false, text: language === 'en' ? `waiting for ${span(elapsed, language)}` : `εκκρεμεί εδώ και ${span(elapsed, language)}` }
  if (elapsed > limit) return { overdue: true, text: language === 'en' ? `${span(elapsed - limit, language)} overdue` : `καθυστέρηση ${span(elapsed - limit, language)}` }
  return { overdue: false, text: language === 'en' ? `${span(limit - elapsed, language)} left` : `απομένουν ${span(limit - elapsed, language)}` }
}
