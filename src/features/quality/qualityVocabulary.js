import { findLibraryItem, libraryLabel } from '../management/useLibraries'
import { demoLibrarySeed } from '../management/managementData'

// The closed vocabularies of the Quality Center, written once: the create
// form, the report form, the record sheet, the registry and the exports read
// them from here. Incident categories are a library (Management > Libraries >
// incidentCategories); the rest drive rules (harm, CAPA closure) and stay fixed.

const pick = (pair, language) => (language === 'en' ? pair[1] : pair[0])

export const INCIDENT_CLASSES = [
  { value: 'nearMiss', label: ['Παρ’ ολίγον συμβάν', 'Near miss'], hint: ['Δεν έφτασε στον ασθενή', 'Did not reach the patient'] },
  { value: 'noHarm', label: ['Χωρίς βλάβη', 'No harm'], hint: ['Έφτασε στον ασθενή χωρίς βλάβη', 'Reached the patient, no harm'] },
  { value: 'harmful', label: ['Με βλάβη', 'Harmful'], hint: ['Προκάλεσε βλάβη', 'Caused harm'] },
]

export const SEVERITIES = ['low', 'medium', 'high', 'critical']

// What is being reported: a patient-safety (clinical) incident, a non-clinical
// one (equipment, facility, staff safety…), a complaint, or a suggestion for
// improvement. One form, one register (ISO 9001 §10.2, JCI QPS).
export const REPORT_KINDS = [
  { value: 'clinical', label: ['Κλινικό συμβάν', 'Clinical incident'], hint: ['Ασφάλεια ασθενούς: φάρμακο, πτώση, λοίμωξη, ταυτοποίηση…', 'Patient safety: medication, fall, infection, identification…'] },
  { value: 'nonClinical', label: ['Μη κλινικό', 'Non-clinical'], hint: ['Εξοπλισμός, εγκαταστάσεις, ασφάλεια προσωπικού, προμηθευτής…', 'Equipment, facility, staff safety, supplier…'] },
  { value: 'complaint', label: ['Παράπονο', 'Complaint'], hint: ['Ασθενούς ή συνοδού: φροντίδα, επικοινωνία, αναμονή, καθαριότητα', 'From a patient or relative: care, communication, waiting, cleanliness'] },
  { value: 'suggestion', label: ['Πρόταση βελτίωσης', 'Improvement idea'], hint: ['Μια ιδέα για να γίνει κάτι καλύτερα ή πιο ασφαλές', 'An idea to make something better or safer'] },
]

// The harm to the patient, WHO patient-safety classification. Records written
// before used minor / major, read here as mild / severe.
export const IMPACTS = [
  { value: 'none', label: ['Χωρίς βλάβη', 'No harm'] },
  { value: 'mild', label: ['Ήπια', 'Mild'] },
  { value: 'moderate', label: ['Μέτρια', 'Moderate'] },
  { value: 'severe', label: ['Σοβαρή', 'Severe'] },
  { value: 'death', label: ['Θάνατος', 'Death'] },
]
const LEGACY_IMPACT = { minor: 'mild', major: 'severe' }
export const harmLevel = value => LEGACY_IMPACT[value] || value || 'none'

// A sentinel event (JCI): death or severe harm. It needs a root cause analysis
// within 45 days of being known.
export const SENTINEL_RCA_DAYS = 45
export const isSentinelHarm = impact => ['severe', 'death'].includes(harmLevel(impact))
export function rcaDueDate(date) {
  const day = new Date(`${String(date || '').slice(0, 10) || new Date().toISOString().slice(0, 10)}T12:00:00Z`)
  day.setUTCDate(day.getUTCDate() + SENTINEL_RCA_DAYS)
  return day.toISOString().slice(0, 10)
}

export const FINDING_SOURCES = [
  { value: 'manual', label: ['Χειροκίνητη καταχώρηση', 'Manual entry'] },
  { value: 'audit', label: ['Επιθεώρηση', 'Audit'] },
  { value: 'incident', label: ['Συμβάν', 'Incident'] },
  { value: 'control', label: ['Έλεγχος', 'Control'] },
]

export const CAPA_TYPES = [
  { value: 'corrective', label: ['Διορθωτική', 'Corrective'] },
  { value: 'preventive', label: ['Προληπτική', 'Preventive'] },
]

export const AUDIT_TYPES = [
  { value: 'internal', label: ['Εσωτερική', 'Internal'] },
  { value: 'external', label: ['Εξωτερική', 'External'] },
]

export const EFFECTIVENESS = [
  { value: 'pending', label: ['Εκκρεμεί', 'Pending'] },
  { value: 'effective', label: ['Αποτελεσματική', 'Effective'] },
  { value: 'notEffective', label: ['Μη αποτελεσματική', 'Not effective'] },
]

// The incident categories every hospital starts with (the library baseline,
// Management > Libraries). Records keep the short key (clinical, medication…);
// the library row carries it as code INC-<KEY>.
export const DEFAULT_INCIDENT_CATEGORIES = (demoLibrarySeed.incidentCategories || []).map(([el, en, meta]) => [String(meta.code).slice(4).toLowerCase(), el, en])

// Which kind of report each baseline category belongs to. A category a
// hospital adds itself is offered under every kind.
const CATEGORY_KIND = {
  clinical: 'clinical', medication: 'clinical', fall: 'clinical', pressureinjury: 'clinical', infection: 'clinical', identification: 'clinical', surgery: 'clinical', transfusion: 'clinical', diagnosis: 'clinical',
  equipment: 'nonClinical', process: 'nonClinical', staff: 'nonClinical', facility: 'nonClinical', security: 'nonClinical', supplier: 'nonClinical', it: 'nonClinical', other: 'nonClinical',
  complaint: 'complaint', complaintcare: 'complaint', complaintcommunication: 'complaint', complaintwaiting: 'complaint', complainthygiene: 'complaint',
}
export const categoryKind = key => CATEGORY_KIND[String(key || '').toLowerCase()] || null
// The kind an older record has, from its category (records before kinds existed).
export const reportKindOf = record => record?.reportKind || categoryKind(record?.category) || 'clinical'

export const incidentCategoryCode = key => `INC-${String(key || '').toUpperCase()}`

// What a record stores for a chosen library item: the short key of a baseline
// category, or the name of a category the hospital added.
export function incidentCategoryValue(item) {
  const code = String(item?.code || '')
  return code.startsWith('INC-') ? code.slice(4).toLowerCase() : item?.value || ''
}

// The library's categories as SearchableSelect options; the built-in list
// stands in until the library has loaded (or when it is empty).
export function incidentCategoryOptions(items = [], language = 'el', kind = null) {
  const source = items.length ? items : DEFAULT_INCIDENT_CATEGORIES.map(([key, el, en]) => ({ value: el, code: incidentCategoryCode(key), el, en }))
  return source
    .map(item => ({ value: incidentCategoryValue(item), label: libraryLabel(item, language), keywords: `${item.el} ${item.en}` }))
    .filter(option => !kind || !categoryKind(option.value) || categoryKind(option.value) === kind)
}

export function incidentCategoryLabel(value, items = [], language = 'el') {
  if (!value) return ''
  const item = findLibraryItem(items, incidentCategoryCode(value)) || findLibraryItem(items, value)
  if (item) return libraryLabel(item, language)
  const builtIn = DEFAULT_INCIDENT_CATEGORIES.find(([key]) => key === value)
  return builtIn ? (language === 'en' ? builtIn[2] : builtIn[1]) : value
}

// [{value,label}] for ModeSwitch / SearchableSelect from one of the lists above.
export const vocabularyOptions = (list, language = 'el') => list.map(item => ({ value: item.value, label: pick(item.label, language) }))
export const vocabularyLabel = (list, value, language = 'el') => {
  const item = list.find(entry => entry.value === value) || (list === IMPACTS ? list.find(entry => entry.value === harmLevel(value)) : null)
  return item ? pick(item.label, language) : value || ''
}
export const severityOptions = t => SEVERITIES.map(value => ({ value, label: t(value) }))

// The badge tone of a status in every Quality list and header.
export function qualityStatusTone(status) {
  if (['closed', 'completed', 'effective'].includes(status)) return 'success'
  if (['cancelled'].includes(status)) return 'neutral'
  if (['verification'].includes(status)) return 'warning'
  if (['notEffective'].includes(status)) return 'danger'
  return 'info'
}
export const severityTone = value => (value === 'critical' ? 'danger' : value === 'high' ? 'warning' : 'neutral')

// A record's code as the screen shows it. A corrective action is stored as
// CAPA-…; in Greek it reads ΔΕ-… (Διορθωτική Ενέργεια). The stored code, the
// links and the search stay the same.
export function qualityCode(record, language = 'el') {
  const code = String(record?.displayId || record?.id || record?.code || '')
  return language === 'en' ? code : code.replace(/^CAPA-/, 'ΔΕ-')
}
