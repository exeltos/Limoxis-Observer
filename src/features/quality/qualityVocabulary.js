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

export const IMPACTS = [
  { value: 'none', label: ['Χωρίς βλάβη / επίπτωση', 'No harm / impact'] },
  { value: 'minor', label: ['Μικρή', 'Minor'] },
  { value: 'moderate', label: ['Μέτρια', 'Moderate'] },
  { value: 'major', label: ['Σημαντική', 'Major'] },
  { value: 'severe', label: ['Σοβαρή', 'Severe'] },
]

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

export const incidentCategoryCode = key => `INC-${String(key || '').toUpperCase()}`

// What a record stores for a chosen library item: the short key of a baseline
// category, or the name of a category the hospital added.
export function incidentCategoryValue(item) {
  const code = String(item?.code || '')
  return code.startsWith('INC-') ? code.slice(4).toLowerCase() : item?.value || ''
}

// The library's categories as SearchableSelect options; the built-in list
// stands in until the library has loaded (or when it is empty).
export function incidentCategoryOptions(items = [], language = 'el') {
  const source = items.length ? items : DEFAULT_INCIDENT_CATEGORIES.map(([key, el, en]) => ({ value: el, code: incidentCategoryCode(key), el, en }))
  return source.map(item => ({ value: incidentCategoryValue(item), label: libraryLabel(item, language), keywords: `${item.el} ${item.en}` }))
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
  const item = list.find(entry => entry.value === value)
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
