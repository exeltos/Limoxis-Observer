// The closed vocabularies of the audit programme: the standards, the answer
// scale, the finding classes, the kinds of audit, the team roles, the risk
// levels that set how often a department is audited, and the hospital areas a
// question applies to. Written once; screens, exports and tests read them here.

const pick = (pair, language) => (language === 'en' ? pair[1] : pair[0])

export const AUDIT_STANDARDS = [
  { value: 'iso9001', label: ['ISO 9001:2015', 'ISO 9001:2015'], short: 'ISO 9001' },
  { value: 'iso15224', label: ['ISO 15224 (υπηρεσίες υγείας)', 'ISO 15224 (healthcare)'], short: 'ISO 15224' },
  { value: 'haccp', label: ['HACCP / ISO 22000', 'HACCP / ISO 22000'], short: 'HACCP' },
  { value: 'iso15189', label: ['ISO 15189 (ιατρικά εργαστήρια)', 'ISO 15189 (medical laboratories)'], short: 'ISO 15189' },
  { value: 'temos', label: ['TEMOS (διεθνείς ασθενείς)', 'TEMOS (international patients)'], short: 'TEMOS' },
  { value: 'jci', label: ['JCI (πρότυπα νοσοκομείων)', 'JCI (hospital standards)'], short: 'JCI' },
  { value: 'other', label: ['Άλλο / εσωτερικά κριτήρια', 'Other / internal criteria'], short: 'Άλλο' },
]
export const standardLabel = (value, language = 'el') => { const item = AUDIT_STANDARDS.find(entry => entry.value === value); return item ? pick(item.label, language) : value || '' }
export const standardShort = value => AUDIT_STANDARDS.find(entry => entry.value === value)?.short || value || ''

// One select per question. The stored values are the checklist's (yes / no /
// na) plus «partial», so the audits made before the programme keep their answers.
export const AUDIT_RESULTS = [
  { value: 'yes', label: ['Συμμορφώνεται', 'Conforms'], tone: 'success' },
  { value: 'partial', label: ['Μερική συμμόρφωση', 'Partial conformity'], tone: 'warning' },
  { value: 'no', label: ['Μη συμμόρφωση', 'Nonconformity'], tone: 'danger' },
  { value: 'na', label: ['Δεν εφαρμόζεται', 'Not applicable'], tone: 'neutral' },
]
export const RESULT_VALUE = { yes: 1, partial: 0.5, no: 0 }
export const resultLabel = (value, language = 'el') => { const item = AUDIT_RESULTS.find(entry => entry.value === value); return item ? pick(item.label, language) : '' }

// What a «Μερική» or «Μη συμμόρφωση» is. A conforming answer may still carry an
// observation or an opportunity for improvement.
export const FINDING_CLASSES = [
  { value: 'major', label: ['Μείζον', 'Major'], severity: 'high', days: 30 },
  { value: 'minor', label: ['Έλασσον', 'Minor'], severity: 'medium', days: 60 },
  { value: 'observation', label: ['Παρατήρηση', 'Observation'], severity: 'low', days: 90 },
  { value: 'opportunity', label: ['Ευκαιρία βελτίωσης', 'Opportunity for improvement'], severity: 'low', days: 90 },
]
export const findingClassLabel = (value, language = 'el') => { const item = FINDING_CLASSES.find(entry => entry.value === value); return item ? pick(item.label, language) : '' }
export const findingClassTone = value => ({ major: 'danger', minor: 'warning', observation: 'info', opportunity: 'neutral' })[value] || 'neutral'

export const AUDIT_KINDS = [
  { value: 'internal', label: ['Εσωτερική', 'Internal'] },
  { value: 'external', label: ['Εξωτερική', 'External'] },
  { value: 'certification', label: ['Πιστοποίησης', 'Certification'] },
  { value: 'supplier', label: ['Προμηθευτή', 'Supplier'] },
]

export const TEAM_ROLES = [
  { value: 'lead', label: ['Επικεφαλής επιθεωρητής', 'Lead auditor'] },
  { value: 'member', label: ['Μέλος ομάδας', 'Team member'] },
  { value: 'expert', label: ['Τεχνικός εμπειρογνώμονας', 'Technical expert'] },
  { value: 'observer', label: ['Παρατηρητής', 'Observer'] },
]

// Risk-based frequency: how often a department is audited for a standard.
export const RISK_LEVELS = [
  { value: 'high', label: ['Υψηλός κίνδυνος', 'High risk'], months: 6 },
  { value: 'medium', label: ['Μέτριος κίνδυνος', 'Medium risk'], months: 12 },
  { value: 'low', label: ['Χαμηλός κίνδυνος', 'Low risk'], months: 24 },
]
export const riskMonths = level => RISK_LEVELS.find(entry => entry.value === level)?.months || 12

export const PROGRAMME_STATUSES = ['planned', 'inProgress', 'completed', 'cancelled']

// The areas of a hospital a questionnaire or a question applies to. A
// department's area is read from its type and name; a question without areas
// applies everywhere.
export const AUDIT_AREAS = [
  { value: 'clinical', label: ['Κλινικά τμήματα', 'Clinical departments'] },
  { value: 'laboratory', label: ['Εργαστήρια', 'Laboratories'] },
  { value: 'kitchen', label: ['Κουζίνα / διατροφή', 'Kitchen / nutrition'] },
  { value: 'international', label: ['Διεθνείς ασθενείς', 'International patients'] },
  { value: 'support', label: ['Υποστηρικτικές υπηρεσίες', 'Support services'] },
  { value: 'management', label: ['Διοίκηση / Ποιότητα', 'Management / Quality'] },
]
export const areaLabel = (value, language = 'el') => { const item = AUDIT_AREAS.find(entry => entry.value === value); return item ? pick(item.label, language) : value }

const AREA_PATTERNS = [
  ['laboratory', /εργαστ|μικροβιολ|βιοχημ|αιματολ|αιμοδοσ|παθολογοανατ|κυτταρολ|labor|microbio/i],
  ['kitchen', /κουζ[ίι]ν|διατροφ|μαγειρ|εστίασ|εστιασ|kitchen|catering|dietet/i],
  ['international', /διεθν|international|medical travel|ξέν(ων|οι) ασθεν/i],
  ['management', /διοίκ|διοικ|ποιότητ|ποιοτητ|διεύθυνσ|διευθυνσ|γραμματ|λογιστ|οικονομ|προμηθ|management|quality|admin/i],
  ['support', /τεχνικ|αποθήκ|αποθηκ|πλυντ|ιματισ|καθαρι|φύλαξ|φυλαξ|μεταφορ|πληροφορ|technical|laundry|store|it\b/i],
]
export function departmentArea(department) {
  const name = typeof department === 'string' ? department : department?.name || ''
  for (const [area, pattern] of AREA_PATTERNS) if (pattern.test(name)) return area
  return 'clinical'
}
